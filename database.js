const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { hashPassword } = require('./passwords');

const DB_PATH = path.join(__dirname, 'data', 'snake-lab.db');
let db = null;

async function initDatabase() {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const SQL = await initSqlJs();

  // Load existing DB or create new one
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      icon TEXT,
      image TEXT,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      compare_price REAL,
      category_id INTEGER,
      sizes TEXT DEFAULT '[]',
      colors TEXT DEFAULT '[]',
      materials TEXT DEFAULT '[]',
      images TEXT DEFAULT '[]',
      model_3d TEXT,
      size_prices TEXT DEFAULT '{}',
      dimensions TEXT DEFAULT '{}',
      customizable_parts TEXT DEFAULT '[]',
      fixed_parts TEXT DEFAULT '[]',
      show_3d INTEGER DEFAULT 1,
      variants TEXT DEFAULT '[]',
      is_featured INTEGER DEFAULT 0,
      is_trending INTEGER DEFAULT 0,
      stock INTEGER DEFAULT 99,
      production_days INTEGER DEFAULT 3,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    )
  `);

  const productColumns = db.exec("PRAGMA table_info(products)")[0]?.values || [];
  const hasSizePrices = productColumns.some((column) => column[1] === 'size_prices');
  if (!hasSizePrices) {
    db.run('ALTER TABLE products ADD COLUMN size_prices TEXT DEFAULT \"{}\"');
  }
  const currentProductColumns = db.exec("PRAGMA table_info(products)")[0]?.values || [];
  if (!currentProductColumns.some((column) => column[1] === 'dimensions')) db.run('ALTER TABLE products ADD COLUMN dimensions TEXT DEFAULT \"{}\"');
  if (!currentProductColumns.some((column) => column[1] === 'customizable_parts')) db.run('ALTER TABLE products ADD COLUMN customizable_parts TEXT DEFAULT \"[]\"');
  if (!currentProductColumns.some((column) => column[1] === 'fixed_parts')) db.run('ALTER TABLE products ADD COLUMN fixed_parts TEXT DEFAULT \"[]\"');
  if (!currentProductColumns.some((column) => column[1] === 'show_3d')) db.run('ALTER TABLE products ADD COLUMN show_3d INTEGER DEFAULT 1');
  if (!currentProductColumns.some((column) => column[1] === 'variants')) db.run('ALTER TABLE products ADD COLUMN variants TEXT DEFAULT \"[]\"');

  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      address TEXT,
      city TEXT,
      department TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      items TEXT NOT NULL,
      subtotal REAL,
      tax REAL,
      total REAL,
      status TEXT DEFAULT 'pendiente',
      payment_method TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT UNIQUE NOT NULL,
      admin_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
    )
  `);

  // Seed settings
  const defaultSettings = [
    ['whatsapp_number', '573214403628'],
    ['whatsapp_message', 'Hola SNAKE LAB! Me interesa un producto'],
    ['hero_title', 'Fabricamos tus ideas en 3D'],
    ['hero_subtitle', 'Figuras, anime, decoración y más. Impresiones 3D de alta calidad con acabados premium.'],
    ['currency', 'COP'],
    ['store_name', 'SNAKE LAB'],
    ['instagram', '#'],
    ['tiktok', '#'],
    ['facebook', '#']
  ];
  for (const [key, value] of defaultSettings) {
    db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }

  // A new installation must explicitly provide its initial administrator
  // password. Never ship a usable default credential.
  const adminCount = db.exec('SELECT COUNT(*) as count FROM admins');
  const resetPassword = String(process.env.ADMIN_RESET_PASSWORD || '');
  if (adminCount[0].values[0][0] === 0) {
    const initialPassword = String(process.env.ADMIN_PASSWORD || resetPassword || '');
    if (initialPassword.length < 12) {
      throw new Error('ADMIN_PASSWORD o ADMIN_RESET_PASSWORD debe definirse y tener al menos 12 caracteres antes del primer inicio.');
    }
    db.run('INSERT INTO admins (username, password) VALUES (?, ?)', ['admin', hashPassword(initialPassword)]);
  }

  if (resetPassword) {
    if (resetPassword.length < 12) {
      throw new Error('ADMIN_RESET_PASSWORD debe tener al menos 12 caracteres.');
    }
    db.run('UPDATE admins SET password = ? WHERE username = ?', [hashPassword(resetPassword), 'admin']);
    db.run('DELETE FROM admin_sessions');
    console.warn('ADMIN_RESET_PASSWORD aplicado al usuario admin. Elimina esta variable de Railway ahora.');
  }

  // Seed categories
  const catCount = db.exec('SELECT COUNT(*) as count FROM categories');
  if (catCount[0].values[0][0] === 0) {
    const cats = [
      ['Figuras Gaming', 'figuras-gaming', 'gamepad', 'Figuras coleccionables de tus videojuegos favoritos', 1],
      ['Anime', 'anime', 'sparkles', 'Figuras y accesorios de anime y manga', 2],
      ['Soportes para Controles', 'soportes-controles', 'monitor-smartphone', 'Soportes personalizados para tus controles', 3],
      ['Decoración', 'decoracion', 'lamp', 'Objetos decorativos únicos para tu hogar', 4],
      ['Personalizados', 'personalizados', 'wrench', 'Productos diseñados a tu medida', 5],
      ['Tendencia', 'tendencia', 'flame', 'Lo más popular y actual del momento', 6]
    ];
    for (const [name, slug, icon, desc, order] of cats) {
      db.run('INSERT INTO categories (name, slug, icon, description, sort_order) VALUES (?, ?, ?, ?, ?)',
        [name, slug, icon, desc, order]);
    }
  }

  // Seed products
  const prodCount = db.exec('SELECT COUNT(*) as count FROM products');
  if (prodCount[0].values[0][0] === 0) {
    const products = [
      {
        name: 'Kratos - God of War', slug: 'kratos-god-of-war',
        description: 'Figura detallada de Kratos con las Espadas del Caos. Acabado premium con pintura a mano disponible. Cada detalle capturado con precisión de impresión 3D de alta resolución.',
        price: 85000, compare_price: 120000, category_id: 1,
        sizes: ['10cm', '15cm', '20cm', '30cm'],
        colors: ['#808080', '#c4a35a', '#ffffff', '#1a1a2e'],
        materials: ['PLA', 'Resina'],
        images: ['/uploads/images/kratos.jpg'],
        is_featured: 1, is_trending: 0, production_days: 5
      },
      {
        name: 'Goku Ultra Instinto', slug: 'goku-ultra-instinto',
        description: 'Figura de Goku en su forma Ultra Instinto Dominado. Efecto de aura incluido. Base con iluminación LED opcional.',
        price: 75000, compare_price: 95000, category_id: 2,
        sizes: ['10cm', '15cm', '20cm'],
        colors: ['#c0c0c0', '#4fc3f7', '#ffffff'],
        materials: ['PLA', 'Resina'],
        images: ['/uploads/images/goku.jpg'],
        is_featured: 1, is_trending: 1, production_days: 4
      },
      {
        name: 'Soporte PS5 Spiderman', slug: 'soporte-ps5-spiderman',
        description: 'Soporte para control PS5 con diseño de Spiderman. Mantén tu control seguro y con estilo. Compatible con DualSense.',
        price: 45000, compare_price: 60000, category_id: 3,
        sizes: ['Estándar'],
        colors: ['#e53935', '#1565c0', '#000000'],
        materials: ['PLA', 'PETG'],
        images: ['/uploads/images/soporte-ps5.jpg'],
        is_featured: 1, is_trending: 1, production_days: 3
      },
      {
        name: 'Lámpara Luna 3D', slug: 'lampara-luna-3d',
        description: 'Lámpara decorativa con forma de luna con textura realista. Luz cálida LED incluida. Perfecta para escritorio o mesa de noche.',
        price: 55000, compare_price: 70000, category_id: 4,
        sizes: ['12cm', '15cm', '20cm'],
        colors: ['#fdd835', '#ffffff'],
        materials: ['PLA'],
        images: ['/uploads/images/lampara-luna.jpg'],
        is_featured: 1, is_trending: 0, production_days: 3
      },
      {
        name: 'Naruto Sage Mode', slug: 'naruto-sage-mode',
        description: 'Figura de Naruto en Modo Sabio con pose dinámica. Detalles ultra precisos en resina. Base temática incluida.',
        price: 70000, compare_price: 90000, category_id: 2,
        sizes: ['10cm', '15cm', '20cm'],
        colors: ['#ff9800', '#000000', '#ffffff'],
        materials: ['PLA', 'Resina'],
        images: ['/uploads/images/naruto.jpg'],
        is_featured: 0, is_trending: 1, production_days: 4
      },
      {
        name: 'Soporte Xbox Halo', slug: 'soporte-xbox-halo',
        description: 'Soporte para control Xbox con diseño inspirado en Master Chief. Compatible con todos los controles Xbox.',
        price: 48000, compare_price: 65000, category_id: 3,
        sizes: ['Estándar'],
        colors: ['#2e7d32', '#37474f', '#ff6f00'],
        materials: ['PLA', 'PETG'],
        images: ['/uploads/images/soporte-xbox.jpg'],
        is_featured: 0, is_trending: 0, production_days: 3
      },
      {
        name: 'Dragón Articulado', slug: 'dragon-articulado',
        description: 'Dragón articulado con movimiento en todas sus articulaciones. Impreso en una sola pieza. El juguete fidget perfecto.',
        price: 35000, compare_price: 45000, category_id: 6,
        sizes: ['15cm', '25cm', '40cm'],
        colors: ['#e53935', '#7b1fa2', '#00bcd4', '#4caf50', '#ff9800', '#212121'],
        materials: ['PLA'],
        images: ['/uploads/images/dragon.jpg'],
        is_featured: 1, is_trending: 1, production_days: 2
      },
      {
        name: 'Maceta Baby Groot', slug: 'maceta-baby-groot',
        description: 'Maceta decorativa con forma de Baby Groot. Ideal para suculentas y plantas pequeñas.',
        price: 40000, compare_price: 55000, category_id: 4,
        sizes: ['10cm', '15cm'],
        colors: ['#795548', '#4caf50', '#8d6e63'],
        materials: ['PLA'],
        images: ['/uploads/images/groot.jpg'],
        is_featured: 0, is_trending: 1, production_days: 3
      },
      {
        name: 'Tu Diseño Personalizado', slug: 'diseno-personalizado',
        description: 'Envíanos tu idea o archivo 3D y lo hacemos realidad. Cotización según complejidad y tamaño.',
        price: 50000, compare_price: null, category_id: 5,
        sizes: ['Según diseño'],
        colors: ['#9c27b0', '#00bcd4', '#ff5722', '#4caf50'],
        materials: ['PLA', 'PETG', 'Resina', 'TPU'],
        images: ['/uploads/images/custom.jpg'],
        is_featured: 1, is_trending: 0, production_days: 7
      },
      {
        name: 'Pikachu Articulado', slug: 'pikachu-articulado',
        description: 'Pikachu articulado con movimiento de cabeza, brazos y cola. El pokémon más querido ahora en tu escritorio.',
        price: 38000, compare_price: 50000, category_id: 6,
        sizes: ['8cm', '12cm', '18cm'],
        colors: ['#fdd835', '#ffeb3b'],
        materials: ['PLA'],
        images: ['/uploads/images/pikachu.jpg'],
        is_featured: 0, is_trending: 1, production_days: 2
      }
    ];

    for (const p of products) {
      db.run(`INSERT INTO products (name, slug, description, price, compare_price, category_id, sizes, colors, materials, images, is_featured, is_trending, production_days)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.name, p.slug, p.description, p.price, p.compare_price, p.category_id,
         JSON.stringify(p.sizes), JSON.stringify(p.colors), JSON.stringify(p.materials),
         JSON.stringify(p.images), p.is_featured, p.is_trending, p.production_days]);
    }
  }

  saveDatabase();
  console.log('Database initialized successfully');
  return db;
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

function getDb() {
  return db;
}

// Helper functions
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

function runSql(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
  return { changes: db.getRowsModified(), lastId: getLastInsertId() };
}

function getLastInsertId() {
  const result = db.exec('SELECT last_insert_rowid() as id');
  return result.length > 0 ? result[0].values[0][0] : 0;
}

module.exports = { initDatabase, getDb, saveDatabase, queryAll, queryOne, runSql };
