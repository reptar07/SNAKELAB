const { queryOne, runSql } = require('./database');
const { verifyPassword, isHashedPassword, hashPassword, hashToken, randomToken } = require('./passwords');

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;

const loginAttempts = new Map();

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function isLoginRateLimited(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 0, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}

function recordLoginFailure(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

function clearLoginFailures(ip) {
  loginAttempts.delete(ip);
}

function purgeExpiredSessions() {
  runSql('DELETE FROM admin_sessions WHERE expires_at < ?', [Date.now()]);
}

function createSession(adminId) {
  purgeExpiredSessions();
  const token = randomToken();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  runSql(
    'INSERT INTO admin_sessions (token_hash, admin_id, expires_at) VALUES (?, ?, ?)',
    [hashToken(token), adminId, expiresAt]
  );
  return { token, expiresAt };
}

function getSession(token) {
  if (!token) return null;
  purgeExpiredSessions();
  return queryOne(
    `SELECT s.id, s.admin_id, s.expires_at, a.username
     FROM admin_sessions s
     JOIN admins a ON a.id = s.admin_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    [hashToken(token), Date.now()]
  );
}

function destroySession(token) {
  if (!token) return;
  runSql('DELETE FROM admin_sessions WHERE token_hash = ?', [hashToken(token)]);
}

function destroyAllSessions(adminId) {
  runSql('DELETE FROM admin_sessions WHERE admin_id = ?', [adminId]);
}

function extractBearer(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

function requireAdmin(req, res, next) {
  const session = getSession(extractBearer(req));
  if (!session) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  req.admin = { id: session.admin_id, username: session.username };
  next();
}

async function loginAdmin(username, password, ip) {
  if (isLoginRateLimited(ip)) {
    return { ok: false, status: 429, error: 'Demasiados intentos. Espera unos minutos.' };
  }

  const user = String(username || '').trim();
  const pass = String(password || '');
  if (!user || !pass) {
    recordLoginFailure(ip);
    return { ok: false, status: 401, error: 'Credenciales incorrectas' };
  }

  const admin = queryOne('SELECT id, username, password FROM admins WHERE username = ?', [user]);
  const valid = admin && verifyPassword(pass, admin.password);

  if (!valid) {
    recordLoginFailure(ip);
    return { ok: false, status: 401, error: 'Credenciales incorrectas' };
  }

  if (!isHashedPassword(admin.password)) {
    runSql('UPDATE admins SET password = ? WHERE id = ?', [hashPassword(pass), admin.id]);
  }

  clearLoginFailures(ip);
  const session = createSession(admin.id);
  return { ok: true, token: session.token, expiresAt: session.expiresAt };
}

function updateAdminPassword(adminId, newPassword) {
  const pass = String(newPassword || '');
  if (pass.length < 8) {
    return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres' };
  }
  runSql('UPDATE admins SET password = ? WHERE id = ?', [hashPassword(pass), adminId]);
  destroyAllSessions(adminId);
  return { ok: true };
}

module.exports = {
  requireAdmin,
  loginAdmin,
  createSession,
  getSession,
  destroySession,
  extractBearer,
  updateAdminPassword,
  clientIp
};
