const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { initDatabase, queryAll, queryOne, runSql, getDb, saveDatabase } = require('./database');
const {
  requireAdmin,
  loginAdmin,
  destroySession,
  extractBearer,
  updateAdminPassword,
  clientIp
} = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(cors({
  origin: true,
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const uploadsDir = path.join(__dirname, 'public', 'uploads');
const imagesDir = path.join(uploadsDir, 'images');
const modelsDir = path.join(uploadsDir, 'models');
[uploadsDir, imagesDir, modelsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = file.fieldname === 'model' ? modelsDir : imagesDir;
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'model') {
      const allowed = ['.glb', '.gltf', '.stl', '.obj'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed.includes(ext)) return cb(null, true);
      return cb(new Error('Solo se permiten archivos .glb, .gltf, .stl, .obj'));
    }
    if (file.fieldname === 'cover_image' || file.fieldname === 'images' || file.fieldname === 'file') {
      const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed.includes(ext)) return cb(null, true);
      return cb(new Error('Solo se permiten imágenes .jpg, .png, .webp, .gif'));
    }
    cb(new Error('Campo de archivo no permitido'));
  }
});

const ALLOWED_ORDER_STATUS = ['pendiente', 'pagado', 'imprimiendo', 'enviado', 'completado', 'cancelado'];
const ALLOWED_PAYMENT = ['transferencia', 'nequi', 'daviplata', 'efectivo'];
const PUBLIC_SETTING_KEYS = [
  'whatsapp_number', 'whatsapp_message', 'hero_title', 'hero_subtitle',
  'currency', 'store_name', 'instagram', 'tiktok', 'facebook'
];
const CHECKOUT_TOKEN_TTL_MS = 10 * 60 * 1000;
const ORDER_WINDOW_MS = 15 * 60 * 1000;
const ORDER_MAX_ATTEMPTS = 5;
const CUSTOMER_WINDOW_MS = 15 * 60 * 1000;
const CUSTOMER_MAX_ATTEMPTS = 10;
const checkoutTokens = new Map();
const publicRequestAttempts = new Map();

function fail(res, status, message) {
  return res.status(status).json({ error: message });
}

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function rateLimitKey(req, action) {
  return `${action}:${clientIp(req)}`;
}

function isPublicRateLimited(key, maxAttempts, windowMs) {
  const now = Date.now();
  const entry = publicRequestAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    publicRequestAttempts.set(key, { count: 0, resetAt: now + windowMs });
    return false;
  }
  return entry.count >= maxAttempts;
}

function recordPublicRequest(key, windowMs) {
  const now = Date.now();
  const entry = publicRequestAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    publicRequestAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  entry.count += 1;
}

function createCheckoutToken(customerId, req) {
  const now = Date.now();
  for (const [token, session] of checkoutTokens) {
    if (session.expiresAt <= now) checkoutTokens.delete(token);
  }
  const token = crypto.randomBytes(32).toString('base64url');
  checkoutTokens.set(token, { customerId, ip: clientIp(req), expiresAt: now + CHECKOUT_TOKEN_TTL_MS });
  return token;
}

function consumeCheckoutToken(token, req) {
  const session = checkoutTokens.get(String(token || ''));
  if (!session || session.expiresAt <= Date.now() || session.ip !== clientIp(req)) return null;
  checkoutTokens.delete(token);
  return session.customerId;
}

function createOrderWithStockReservation(customerId, items, subtotal, paymentMethod, notes, reservations) {
  const db = getDb();
  db.run('BEGIN TRANSACTION');
  try {
    db.run(
      'INSERT INTO orders (customer_id, items, subtotal, tax, total, payment_method, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [customerId, JSON.stringify(items), subtotal, 0, subtotal, paymentMethod, notes]
    );
    const lastId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
    for (const { productId, quantity } of reservations.values()) {
      db.run('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?', [quantity, productId, quantity]);
      if (db.getRowsModified() !== 1) throw new Error('STOCK_CHANGED');
    }
    db.run('COMMIT');
    saveDatabase();
    return { lastId };
  } catch (err) {
    try { db.run('ROLLBACK'); } catch (_) { /* transaction already closed */ }
    throw err;
  }
}

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ==================== AUTH ====================

app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const result = await loginAdmin(username, password, clientIp(req));
    if (!result.ok) return fail(res, result.status, result.error);
    res.json({ success: true, token: result.token, expiresAt: result.expiresAt });
  } catch (err) {
    console.error(err);
    fail(res, 500, 'Error interno');
  }
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({ username: req.admin.username });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  try {
    destroySession(extractBearer(req));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    fail(res, 500, 'Error interno');
  }
});

app.put('/api/admin/password', requireAdmin, (req, res) => {
  try {
    const result = updateAdminPassword(req.admin.id, req.body?.password);
    if (!result.ok) return fail(res, 400, result.error);
    res.json({ success: true, message: 'Contraseña actualizada. Inicia sesión de nuevo.' });
  } catch (err) {
    console.error(err);
    fail(res, 500, 'Error interno');
  }
});

// ==================== CATEGORIES ====================

app.get('/api/categories', (req, res) => {
  try {
    res.json(queryAll('SELECT * FROM categories ORDER BY sort_order ASC'));
  } catch (err) {
    console.error(err);
    fail(res, 500, 'Error interno');
  }
});

app.get('/api/categories/:id', (req, res) => {
  try {
    const cat = queryOne('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (!cat) return fail(res, 404, 'Categoría no encontrada');
    res.json(cat);
  } catch (err) {
    console.error(err);
    fail(res, 500, 'Error interno');
  }
});

app.post('/api/categories', requireAdmin, (req, res) => {
  try {
    const { name, slug, icon, image, description, sort_order } = req.body || {};
    if (!name) return fail(res, 400, 'El nombre es obligatorio');
    const result = runSql(
      'INSERT INTO categories (name, slug, icon, image, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [name, slug || slugify(name), icon || null, image || null, description || null, parseInt(sort_order, 10) || 0]
    );
    res.json({ id: result.lastId, message: 'Categoría creada' });
  } catch (err) {
    console.error(err);
    fail(res, 500, 'Error interno');
  }
});

app.put('/api/categories/:id', requireAdmin, (req, res) => {
  try {
    const { name, slug, icon, image, description, sort_order } = req.body || {};
    runSql(
      'UPDATE categories SET name=?, slug=?, icon=?, image=?, description=?, sort_order=? WHERE id=?',
      [name, slug, icon, image, description, sort_order, req.params.id]
    );
    res.json({ message: 'Categoría actualizada' });
  } catch (err) {
    console.error(err);
    fail(res, 500, 'Error interno');
  }
});

app.delete('/api/categories/:id', requireAdmin, (req, res) => {
  try {
    runSql('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ message: 'Categoría eliminada' });
  } catch (err) {
    console.error(err);
    fail(res, 500, 'Error interno');
  }
});

// ==================== PRODUCTS ====================

app.get('/api/products', (req, res) => {
  try {
    const { category, featured, trending, search, limit, offset } = req.query;
    let sql = `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1`;
    const params = [];

    if (category) {
      sql += ' AND (c.slug = ? OR p.category_id = ?)';
      params.push(category, category);
    }
    if (featured === '1') sql += ' AND p.is_featured = 1';
    if (trending === '1') sql += ' AND p.is_trending = 1';
    if (search) {
      sql += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY p.created_at DESC';

    if (limit) {
      sql += ' LIMIT ?';
      params.push(Math.min(parseInt(limit, 10) || 50, 100));
    }
    if (offset) {
      sql += ' OFFSET ?';
      params.push(Math.max(parseInt(offset, 10) || 0, 0));
    }

    res.json(queryAll(sql, params));
  } catch (err) {
    console.error(err);
    fail(res, 500, 'Error interno');
  }
});

app.get('/api/products/:id', (req, res) => {
  try {
    const product = queryOne(
      'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ? OR p.slug = ?',
      [req.params.id, req.params.id]
    );
    if (!product) return fail(res, 404, 'Producto no encontrado');
    res.json(product);
  } catch (err) {
    console.error(err);
    fail(res, 500, 'Error interno');
  }
});

function parseImageArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean).map(String);
  } catch (e) {
    return [];
  }
}

function parseModelArray(value) {
  if (!value) return [];
  const raw = String(value).trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(Boolean).map(String).map((item) => item.trim()).filter(Boolean);
    }
    if (typeof parsed === 'string' && parsed.trim()) {
      return [parsed.trim()];
    }
  } catch (e) {
    // Some legacy values are plain strings, not JSON arrays.
  }

  return raw.startsWith('/uploads/models/') || raw.startsWith('http') ? [raw] : [];
}

function productFromUpload(req) {
  const { name, description, price, compare_price, category_id, sizes, colors, materials,
          is_featured, is_trending, stock, production_days } = req.body;

  if (!name || !price) throw new Error('VALIDATION:Nombre y precio son obligatorios');

  const existingImages = parseImageArray(req.body.existing_images);
  const existingCover = req.body.existing_cover ? String(req.body.existing_cover).trim() : '';
  const uploadedCover = req.files && req.files.cover_image && req.files.cover_image[0]
    ? '/uploads/images/' + req.files.cover_image[0].filename
    : '';
  const uploadedImages = req.files && req.files.images
    ? req.files.images.map(f => '/uploads/images/' + f.filename)
    : [];

  let coverImage = uploadedCover || existingCover || existingImages[0] || '';
  let imageUrls = [];

  if (coverImage) imageUrls.push(coverImage);

  const galleryImages = [...existingImages.filter(url => url && url !== coverImage), ...uploadedImages.filter(url => url && url !== coverImage)];
  imageUrls.push(...galleryImages);

  if (!coverImage && imageUrls.length === 0 && uploadedImages.length) {
    imageUrls = uploadedImages;
  }

  const existingModels = parseModelArray(req.body.existing_models || req.body.existing_model || '[]');
  const uploadedModels = req.files && req.files.model
    ? req.files.model.map(f => '/uploads/models/' + f.filename)
    : [];
  const modelUrls = [...existingModels, ...uploadedModels.filter(url => !existingModels.includes(url))];
  const model3d = modelUrls.length > 0 ? JSON.stringify(modelUrls) : null;

  return {
    name,
    slug: slugify(name),
    description: description || '',
    price: parseFloat(price),
    compare_price: compare_price ? parseFloat(compare_price) : null,
    category_id: parseInt(category_id, 10) || null,
    sizes: sizes || '[]',
    colors: colors || '[]',
    materials: materials || '[]',
    images: JSON.stringify(imageUrls),
    model3d,
    is_featured: is_featured === '1' || is_featured === 'true' ? 1 : 0,
    is_trending: is_trending === '1' || is_trending === 'true' ? 1 : 0,
    stock: Number.isInteger(parseInt(stock, 10)) && parseInt(stock, 10) >= 0 ? parseInt(stock, 10) : 99,
    production_days: parseInt(production_days, 10) || 3
  };
}

app.post('/api/products', requireAdmin, upload.fields([
  { name: 'cover_image', maxCount: 1 },
  { name: 'images', maxCount: 5 },
  { name: 'model', maxCount: 1 }
]), (req, res) => {
  try {
    const p = productFromUpload(req);
    const result = runSql(`
      INSERT INTO products (name, slug, description, price, compare_price, category_id, sizes, colors, materials, images, model_3d, is_featured, is_trending, stock, production_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.name, p.slug, p.description, p.price, p.compare_price, p.category_id,
       p.sizes, p.colors, p.materials, p.images, p.model3d,
       p.is_featured, p.is_trending, p.stock, p.production_days]
    );
    res.json({ id: result.lastId, message: 'Producto creado' });
  } catch (err) {
    if (String(err.message).startsWith('VALIDATION:')) {
      return fail(res, 400, err.message.replace('VALIDATION:', ''));
    }
    console.error(err);
    fail(res, 500, 'Error interno');
  }
});

app.put('/api/products/:id', requireAdmin, upload.fields([
  { name: 'cover_image', maxCount: 1 },
  { name: 'images', maxCount: 5 },
  { name: 'model', maxCount: 1 }
]), (req, res) => {
  try {
    const p = productFromUpload(req);
    runSql(`
      UPDATE products SET name=?, slug=?, description=?, price=?, compare_price=?, category_id=?,
      sizes=?, colors=?, materials=?, images=?, model_3d=?, is_featured=?, is_trending=?,
      stock=?, production_days=? WHERE id=?`,
      [p.name, p.slug, p.description, p.price, p.compare_price, p.category_id,
       p.sizes, p.colors, p.materials, p.images, p.model3d,
       p.is_featured, p.is_trending, p.stock, p.production_days, req.params.id]
    );
    res.json({ message: 'Producto actualizado' });
  } catch (err) {
    if (String(err.message).startsWith('VALIDATION:')) {
      return fail(res, 400, err.message.replace('VALIDATION:', ''));
    }
    console.error(err);
    fail(res, 500, 'Error interno');
  }
});

app.delete('/api/products/:id', requireAdmin, (req, res) => {
  try {
    runSql('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ message: 'Producto eliminado' });
  } catch (err) {
    console.error(err);
    fail(res, 500, 'Error interno');
  }
});

// ==================== CUSTOMERS ====================

app.get('/api/customers', requireAdmin, (req, res) => {
  try {
    res.json(queryAll('SELECT * FROM customers ORDER BY created_at DESC'));
  } catch (err) {
    console.error(err);
    fail(res, 500, 'Error interno');
  }
});

app.post('/api/customers', (req, res) => {
  try {
    const rateKey = rateLimitKey(req, 'customer');
    if (isPublicRateLimited(rateKey, CUSTOMER_MAX_ATTEMPTS, CUSTOMER_WINDOW_MS)) {
      return fail(res, 429, 'Demasiados intentos. Espera unos minutos.');
    }
    recordPublicRequest(rateKey, CUSTOMER_WINDOW_MS);

    const { name, email, phone, address, city, department } = req.body || {};
    if (!name || !email || !phone || !address || !city) {
      return fail(res, 400, 'Faltan datos del cliente');
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return fail(res, 400, 'Email inválido');
    }

    const existing = queryOne('SELECT id, name, phone, address, city, department FROM customers WHERE email = ?', [normalizedEmail]);
    if (existing) {
      // A public request must prove knowledge of the registered contact data
      // before it can create an order for an existing customer.
      const matches = normalizeText(existing.name) === normalizeText(name)
        && normalizeText(existing.phone) === normalizeText(phone)
        && normalizeText(existing.address) === normalizeText(address)
        && normalizeText(existing.city) === normalizeText(city)
        && normalizeText(existing.department) === normalizeText(department);
      if (!matches) return fail(res, 409, 'Los datos no coinciden con el cliente registrado.');
      return res.json({ checkout_token: createCheckoutToken(existing.id, req), message: 'Cliente verificado' });
    }
    const result = runSql(
      'INSERT INTO customers (name, email, phone, address, city, department) VALUES (?, ?, ?, ?, ?, ?)',
      [name, normalizedEmail, phone, address, city, department || '']
    );
    res.json({ checkout_token: createCheckoutToken(result.lastId, req), message: 'Cliente registrado' });
  } catch (err) {
    console.error(err);
    fail(res, 500, 'Error interno');
  }
});

// ==================== ORDERS ====================

app.get('/api/orders', requireAdmin, (req, res) => {
  try {
    const orders = queryAll(`
      SELECT o.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
      FROM orders o LEFT JOIN customers c ON o.customer_id = c.id
      ORDER BY o.created_at DESC
    `);
    res.json(orders);
  } catch (err) {
    console.error(err);
    fail(res, 500, 'Error interno');
  }
});

app.post('/api/orders', (req, res) => {
  try {
    const rateKey = rateLimitKey(req, 'order');
    if (isPublicRateLimited(rateKey, ORDER_MAX_ATTEMPTS, ORDER_WINDOW_MS)) {
      return fail(res, 429, 'Demasiados pedidos. Espera unos minutos.');
    }
    recordPublicRequest(rateKey, ORDER_WINDOW_MS);

    const { checkout_token, items, payment_method, notes } = req.body || {};
    if (!checkout_token || !Array.isArray(items) || items.length === 0) {
      return fail(res, 400, 'Pedido inválido');
    }

    const customerId = consumeCheckoutToken(checkout_token, req);
    if (!customerId) return fail(res, 403, 'La sesión de compra no es válida o expiró.');

    const method = ALLOWED_PAYMENT.includes(payment_method) ? payment_method : 'transferencia';

    let subtotal = 0;
    const sanitized = [];
    const reservations = new Map();
    for (const item of items.slice(0, 50)) {
      const product = queryOne('SELECT id, name, price, stock FROM products WHERE id = ?', [item.id]);
      if (!product) return fail(res, 400, 'Producto no válido en el pedido');
      const quantity = Math.min(Math.max(parseInt(item.quantity, 10) || 1, 1), 20);
      subtotal += product.price * quantity;
      sanitized.push({
        id: product.id,
        name: product.name,
        price: product.price,
        quantity,
        size: item.size || null,
        color: item.color || null,
        material: item.material || null
      });
      const current = reservations.get(product.id) || { productId: product.id, quantity: 0, stock: Number(product.stock) || 0 };
      current.quantity += quantity;
      reservations.set(product.id, current);
    }

    for (const reservation of reservations.values()) {
      if (reservation.quantity > reservation.stock) {
        return fail(res, 409, 'No hay inventario suficiente para completar el pedido.');
      }
    }

    const result = createOrderWithStockReservation(
      customerId, sanitized, subtotal, method, String(notes || '').slice(0, 1000), reservations
    );
    res.json({ id: result.lastId, message: 'Pedido creado' });
  } catch (err) {
    if (err.message === 'STOCK_CHANGED') return fail(res, 409, 'El inventario cambió. Intenta nuevamente.');
    console.error(err);
    fail(res, 500, 'Error interno');
  }
});

app.put('/api/orders/:id/status', requireAdmin, (req, res) => {
  try {
    const { status } = req.body || {};
    if (!ALLOWED_ORDER_STATUS.includes(status)) {
      return fail(res, 400, 'Estado no válido');
    }
    runSql('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: 'Estado actualizado' });
  } catch (err) {
    console.error(err);
    fail(res, 500, 'Error interno');
  }
});

// ==================== SETTINGS / STATS / UPLOAD ====================

app.get('/api/settings', (req, res) => {
  try {
    const settings = queryAll('SELECT * FROM settings');
    const obj = {};
    settings.forEach(s => {
      if (PUBLIC_SETTING_KEYS.includes(s.key)) obj[s.key] = s.value;
    });
    res.json(obj);
  } catch (err) {
    console.error(err);
    fail(res, 500, 'Error interno');
  }
});

app.put('/api/settings', requireAdmin, (req, res) => {
  try {
    const body = req.body || {};
    for (const [key, value] of Object.entries(body)) {
      if (key === 'admin_password' || key === 'password') continue;
      if (!PUBLIC_SETTING_KEYS.includes(key)) continue;
      runSql('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
    }
    res.json({ message: 'Configuración actualizada' });
  } catch (err) {
    console.error(err);
    fail(res, 500, 'Error interno');
  }
});

app.get('/api/stats', requireAdmin, (req, res) => {
  try {
    const products = queryOne('SELECT COUNT(*) as count FROM products');
    const orders = queryOne('SELECT COUNT(*) as count FROM orders');
    const customers = queryOne('SELECT COUNT(*) as count FROM customers');
    const revenue = queryOne('SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE status != ?', ['cancelado']);
    res.json({
      products: products.count,
      orders: orders.count,
      customers: customers.count,
      revenue: revenue.total
    });
  } catch (err) {
    console.error(err);
    fail(res, 500, 'Error interno');
  }
});

app.post('/api/upload', requireAdmin, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return fail(res, 400, 'No file uploaded');
    const url = '/uploads/images/' + req.file.filename;
    res.json({ url, filename: req.file.filename });
  } catch (err) {
    console.error(err);
    fail(res, 500, 'Error interno');
  }
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return fail(res, 404, 'No encontrado');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return fail(res, 400, 'JSON inválido');
  }
  if (err.message && /Solo se permiten|Campo de archivo/.test(err.message)) {
    return fail(res, 400, err.message);
  }
  console.error(err);
  fail(res, 500, 'Error interno');
});

async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════╗
    ║     🐍 SNAKE LAB Server Running      ║
    ║                                       ║
    ║  Tienda:  http://localhost:${PORT}        ║
    ║  Admin:   http://localhost:${PORT}/admin  ║
    ╚═══════════════════════════════════════╝
    `);
  });
}

start().catch(console.error);
