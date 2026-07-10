const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const app = express();
const port = process.env.PORT || 4000;

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "restaurant_system",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function ensureDatabaseTables() {
  await db.execute(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    full_name VARCHAR(128) DEFAULT '',
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('manager', 'cashier') NOT NULL,
    status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(128) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    stock INT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT ON UPDATE CASCADE
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cashier_id INT NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    tax DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    discount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    payments TEXT,
    status ENUM('pending','completed','cancelled') NOT NULL DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT DEFAULT NULL,
    name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE ON UPDATE CASCADE
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS refresh_tokens (
    token VARCHAR(512) PRIMARY KEY,
    user_id INT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
}

// Initialize schema on background without blocking server startup
let schemaInitialized = false;
async function initializeSchema() {
  if (schemaInitialized) return;
  try {
    await ensureDatabaseTables();
    await ensureUserSchemaUpdates();
    await ensureOrderSchemaUpdates();
    schemaInitialized = true;
    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Failed to initialize schema:', error.message);
    setTimeout(initializeSchema, 5000); // Retry in 5 seconds
  }
}

async function ensureUserSchemaUpdates() {
  const [cols] = await db.execute("SHOW COLUMNS FROM users");
  const names = cols.map(col => col.Field);

  if (!names.includes('full_name')) {
    await db.execute("ALTER TABLE users ADD COLUMN full_name VARCHAR(128) DEFAULT ''");
  }
  if (!names.includes('status')) {
    await db.execute("ALTER TABLE users ADD COLUMN status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active'");
  }
  if (!names.includes('last_seen')) {
    await db.execute("ALTER TABLE users ADD COLUMN last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
  }
}

async function ensureOrderSchemaUpdates() {
  const [cols] = await db.execute("SHOW COLUMNS FROM orders");
  const names = cols.map(col => col.Field);

  if (names.includes('table_number')) {
    await db.execute("ALTER TABLE orders DROP COLUMN table_number");
  }
  if (!names.includes('cashier_id')) {
    await db.execute("ALTER TABLE orders ADD COLUMN cashier_id INT DEFAULT NULL");
  } else {
    await db.execute("ALTER TABLE orders MODIFY COLUMN cashier_id INT DEFAULT NULL");
  }
  if (!names.includes('payments')) {
    await db.execute("ALTER TABLE orders ADD COLUMN payments TEXT");
  }
  if (!names.includes('status')) {
    await db.execute("ALTER TABLE orders ADD COLUMN status ENUM('pending','completed','cancelled') NOT NULL DEFAULT 'completed'");
  }
  if (!names.includes('total_amount')) {
    await db.execute("ALTER TABLE orders ADD COLUMN total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00");
  }
  if (!names.includes('discount')) {
    await db.execute("ALTER TABLE orders ADD COLUMN discount DECIMAL(10,2) NOT NULL DEFAULT 0.00");
  }
  if (!names.includes('tax')) {
    await db.execute("ALTER TABLE orders ADD COLUMN tax DECIMAL(10,2) NOT NULL DEFAULT 0.00");
  }
  if (!names.includes('subtotal')) {
    await db.execute("ALTER TABLE orders ADD COLUMN subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00");
  }
}

// Start schema initialization in background (non-blocking)
initializeSchema();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use(express.static(path.join(__dirname, "assets")));
app.use(express.static(__dirname));

//Front-end routes
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/manager-setup", (req, res) => {
    res.sendFile(path.join(__dirname, "manager-setup.html"));
});

function createToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || "supersecretkey", { expiresIn: "3h" });
}

async function createRefreshToken(userId) {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET || "supersecretkey", { expiresIn: '30d' });
  await db.execute("INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))", [token, userId]);
  return token;
}

async function revokeRefreshToken(token) {
  try { await db.execute("DELETE FROM refresh_tokens WHERE token = ?", [token]); } catch (e) { }
}

async function findRefreshToken(token) {
  try {
    const [rows] = await db.execute("SELECT token, user_id, expires_at FROM refresh_tokens WHERE token = ?", [token]);
    return rows && rows.length ? rows[0] : null;
  } catch (e) { return null; }
}

function getCookieFromHeader(req, name) {
  const header = req.headers && req.headers.cookie;
  if (!header) return null;
  const parts = header.split(';').map(p => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + '=')) return decodeURIComponent(p.slice(name.length + 1));
  }
  return null;
}

async function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "supersecretkey");
    // ensure the user still exists and is active
    const [rows] = await db.execute('SELECT id, username, role, status FROM users WHERE id = ?', [decoded.id]);
    if (rows.length === 0) return res.status(403).json({ message: 'Forbidden' });
    const dbUser = rows[0];
    if (dbUser.status !== 'Active') return res.status(403).json({ message: 'Account is inactive' });
    req.user = { id: dbUser.id, username: dbUser.username, role: dbUser.role };
    next();
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    console.error('verifyToken error:', msg);
    // If the token is expired, return 401 so clients can detect expiry specifically
    if (err && err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'TokenExpired', error: msg });
    }
    return res.status(403).json({ message: 'Forbidden' });
  }
}

async function managerSetupAccess(req, res, next) {
  try {
    const [rows] = await db.execute("SELECT COUNT(*) AS count FROM users WHERE role = 'manager'");
    const hasManager = rows[0].count > 0;
    if (!hasManager) {
      return next();
    }

    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    jwt.verify(token, process.env.JWT_SECRET || "supersecretkey", (err, user) => {
      if (err) return res.status(403).json({ message: "Forbidden" });
      if (user.role !== "manager") {
        return res.status(403).json({ message: "Forbidden" });
      }
      req.user = user;
      next();
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to validate manager setup access." });
  }
}

app.get("/api/manager/setup-status", async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT COUNT(*) AS count FROM users WHERE role = 'manager'");
    res.json({ hasManager: rows[0].count > 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to check manager setup status." });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required." });
  }

  try {
    const [rows] = await db.execute("SELECT id, username, password_hash, role, status FROM users WHERE username = ?", [username]);
    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const user = rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    if (user.status && user.status !== 'Active') {
      return res.status(403).json({ message: 'Account is inactive.' });
    }

    await db.execute('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    const token = createToken({ id: user.id, username: user.username, role: user.role });
    // create refresh token and set as httpOnly cookie
    try {
      const refresh = await createRefreshToken(user.id);
      res.cookie('rms_refresh', refresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    } catch (e) {
      console.error('Unable to create refresh token:', e);
    }
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
});

app.get("/api/manager/dashboard", verifyToken, async (req, res) => {
  if (req.user.role !== "manager") {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const [orders] = await db.execute(
      `SELECT o.id,
              o.status,
              o.total_amount,
              o.payments,
              o.created_at,
              u.username AS cashier,
              (SELECT IFNULL(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS items_count
       FROM orders o
       LEFT JOIN users u ON o.cashier_id = u.id
       ORDER BY o.created_at DESC`
    );
    const [summary] = await db.execute(
      `SELECT
        COUNT(*) AS total_orders,
        SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END) AS revenue,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS open_orders,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders
      FROM orders`
    );

    const [activeCashiers] = await db.execute(
      `SELECT u.id,
              COALESCE(u.full_name, u.username) AS name,
              SUM(CASE WHEN o.status = 'completed' THEN o.total_amount ELSE 0 END) AS total_sales
       FROM users u
       LEFT JOIN orders o ON o.cashier_id = u.id
       WHERE u.role = 'cashier'
         AND u.last_seen > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
       GROUP BY u.id, u.username, u.full_name
       ORDER BY total_sales DESC`
    );

    const [orderItems] = await db.execute(
      `SELECT o.id AS order_id,
              o.status,
              o.created_at,
              oi.product_id,
              oi.name,
              oi.quantity,
              oi.price,
              COALESCE(u.username, 'Unknown') AS cashier
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       LEFT JOIN users u ON o.cashier_id = u.id
       ORDER BY o.created_at DESC`
    );

    const [staffPerformance] = await db.execute(
      `SELECT u.id,
              COALESCE(u.full_name, u.username) AS staff_name,
              SUM(CASE WHEN o.status = 'completed' THEN 1 ELSE 0 END) AS sales_count,
              SUM(CASE WHEN o.status = 'completed' THEN o.total_amount ELSE 0 END) AS total_sales
       FROM users u
       LEFT JOIN orders o ON o.cashier_id = u.id
       WHERE u.role = 'cashier'
       GROUP BY u.id, u.username, u.full_name
       ORDER BY total_sales DESC`
    );

    res.json({ summary: summary[0], orders, active_cashiers: activeCashiers, order_items: orderItems, staff_performance: staffPerformance });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load manager dashboard." });
  }
});

app.get('/api/inventory/categories', verifyToken, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const [rows] = await db.execute('SELECT id, name, description FROM categories ORDER BY name ASC');
    res.json({ categories: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to load categories.' });
  }
});

app.post('/api/inventory/categories', verifyToken, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Category name is required.' });
  }

  try {
    const [existing] = await db.execute('SELECT id FROM categories WHERE name = ?', [name]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'This category already exists.' });
    }

    const [result] = await db.execute('INSERT INTO categories (name, description) VALUES (?, ?)', [name, description || null]);
    res.status(201).json({ id: result.insertId, name, description });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to save category.' });
  }
});

app.put('/api/inventory/categories/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const categoryId = Number(req.params.id);
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Category name is required.' });
  }

  try {
    const [existing] = await db.execute('SELECT id FROM categories WHERE name = ? AND id <> ?', [name, categoryId]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'This category already exists.' });
    }

    const [result] = await db.execute('UPDATE categories SET name = ?, description = ? WHERE id = ?', [name, description || null, categoryId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Category not found.' });
    }

    res.json({ id: categoryId, name, description });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to update category.' });
  }
});

app.delete('/api/inventory/categories/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const categoryId = Number(req.params.id);
  try {
    const [productRows] = await db.execute('SELECT id FROM products WHERE category_id = ?', [categoryId]);
    if (productRows.length > 0) {
      return res.status(409).json({ message: 'Cannot delete category with assigned products.' });
    }

    const [result] = await db.execute('DELETE FROM categories WHERE id = ?', [categoryId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Category not found.' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to delete category.' });
  }
});

app.get('/api/inventory/products', verifyToken, async (req, res) => {
  if (!['manager', 'cashier'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    const query = req.user.role === 'manager'
      ? `SELECT p.id, p.name, p.price, p.stock, p.status, p.description, p.category_id, c.name AS category_name
         FROM products p
         JOIN categories c ON p.category_id = c.id
         ORDER BY p.name ASC`
      : `SELECT p.id, p.name, p.price, p.stock, p.status, p.description, p.category_id, c.name AS category_name
         FROM products p
         JOIN categories c ON p.category_id = c.id
         WHERE p.status = 'Available'
         ORDER BY p.name ASC`;

    const [rows] = await db.execute(query);
    res.json({ products: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to load products.' });
  }
});

app.get('/api/public/products', async (req, res) => {
  try {
    const query = `SELECT p.id, p.name, p.price, p.stock, p.status, p.description, p.category_id, c.name AS category_name
                   FROM products p
                   JOIN categories c ON p.category_id = c.id
                   ORDER BY p.name ASC`;
    const [rows] = await db.execute(query);
    res.json({ products: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to load public menu items.' });
  }
});

app.post('/api/public/orders', async (req, res) => {
  const { items, subtotal, tax, discount, total } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Order must contain at least one item.' });
  }

  try {
    const [orderResult] = await db.execute(
      'INSERT INTO orders (cashier_id, subtotal, tax, discount, total_amount, payments, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [null, subtotal || 0, tax || 0, discount || 0, total || 0, JSON.stringify({}), 'pending']
    );

    const orderId = orderResult.insertId;
    const insertItems = items.map(item => db.execute(
      'INSERT INTO order_items (order_id, product_id, name, quantity, price) VALUES (?, ?, ?, ?, ?)',
      [orderId, item.id || null, item.name, item.quantity || 1, item.price || 0]
    ));

    await Promise.all(insertItems);

    const [rows] = await db.execute('SELECT created_at FROM orders WHERE id = ?', [orderId]);
    const createdAt = rows[0]?.created_at || new Date();

    res.status(201).json({ orderId, created_at: createdAt });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to place public order.' });
  }
});

app.post('/api/inventory/products', verifyToken, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const { name, category_id, price, stock, status, description } = req.body;
  if (!name || !category_id || price === undefined || stock === undefined || !status) {
    return res.status(400).json({ message: 'Name, category, price, stock, and status are required.' });
  }

  try {
    const [categoryRows] = await db.execute('SELECT id, name FROM categories WHERE id = ?', [category_id]);
    if (categoryRows.length === 0) {
      return res.status(400).json({ message: 'Selected category does not exist.' });
    }

    const [result] = await db.execute(
      'INSERT INTO products (category_id, name, price, stock, status, description) VALUES (?, ?, ?, ?, ?, ?)',
      [category_id, name, price, stock, status, description || null]
    );

    const product = {
      id: result.insertId,
      category_id,
      category_name: categoryRows[0].name,
      name,
      price,
      stock,
      status,
      description,
    };
    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to save product.' });
  }
});

app.put('/api/inventory/products/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const productId = Number(req.params.id);
  const { name, category_id, price, stock, status, description } = req.body;
  if (!name || !category_id || price === undefined || stock === undefined || !status) {
    return res.status(400).json({ message: 'Name, category, price, stock, and status are required.' });
  }

  try {
    const [categoryRows] = await db.execute('SELECT id, name FROM categories WHERE id = ?', [category_id]);
    if (categoryRows.length === 0) {
      return res.status(400).json({ message: 'Selected category does not exist.' });
    }

    const [result] = await db.execute(
      'UPDATE products SET category_id = ?, name = ?, price = ?, stock = ?, status = ?, description = ? WHERE id = ?',
      [category_id, name, price, stock, status, description || null, productId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    res.json({
      id: productId,
      category_id,
      category_name: categoryRows[0].name,
      name,
      price,
      stock,
      status,
      description,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to update product.' });
  }
});

app.delete('/api/inventory/products/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const productId = Number(req.params.id);
  try {
    const [result] = await db.execute('DELETE FROM products WHERE id = ?', [productId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Product not found.' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to delete product.' });
  }
});

app.get("/api/cashier/dashboard", verifyToken, async (req, res) => {
  if (req.user.role !== "cashier") {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const [orders] = await db.execute(
      `SELECT
        o.id,
        o.status,
        o.subtotal,
        o.tax,
        o.discount,
        o.total_amount,
        o.created_at,
        o.payments,
        COALESCE((SELECT SUM(quantity) FROM order_items WHERE order_id = o.id), 0) AS items_count
      FROM orders o
      WHERE o.cashier_id = ?
      ORDER BY o.created_at DESC
      LIMIT 12`,
      [req.user.id]
    );
    const [summary] = await db.execute(
      `SELECT
        SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END) AS sales,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_orders,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_orders
      FROM orders
      WHERE cashier_id = ?`,
      [req.user.id]
    );

    res.json({ summary: summary[0], orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load cashier dashboard." });
  }
});

app.post('/api/cashier/orders', verifyToken, async (req, res) => {
  if (req.user.role !== 'cashier') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const { items, subtotal, tax, discount, total, payments } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Order must contain at least one item.' });
  }

  try {
    const [orderResult] = await db.execute(
      'INSERT INTO orders (cashier_id, subtotal, tax, discount, total_amount, payments, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, subtotal || 0, tax || 0, discount || 0, total || 0, JSON.stringify(payments || {}), 'completed']
    );

    const orderId = orderResult.insertId;
    const insertItems = items.map(item => db.execute(
      'INSERT INTO order_items (order_id, product_id, name, quantity, price) VALUES (?, ?, ?, ?, ?)',
      [orderId, item.id || null, item.name, item.quantity || 1, item.price || 0]
    ));

    await Promise.all(insertItems);

    const [rows] = await db.execute('SELECT created_at FROM orders WHERE id = ?', [orderId]);
    const createdAt = rows[0]?.created_at || new Date();

    res.status(201).json({ orderId, created_at: createdAt });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to save order.' });
  }
});

app.get('/api/cashier/orders/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'cashier') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const orderId = Number(req.params.id);
  if (!orderId) {
    return res.status(400).json({ message: 'Invalid order id.' });
  }

  try {
    const [orders] = await db.execute('SELECT id, cashier_id, subtotal, tax, discount, total_amount, payments, status, created_at FROM orders WHERE id = ?', [orderId]);
    if (orders.length === 0) {
      return res.status(404).json({ message: 'Order not found.' });
    }
    const order = orders[0];
    const [items] = await db.execute('SELECT id, product_id, name, quantity, price FROM order_items WHERE order_id = ?', [orderId]);
    res.json({ order: { ...order, items } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to load order details.' });
  }
});

app.get('/api/manager/users', verifyToken, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    const [rows] = await db.execute('SELECT id, username, full_name, role, status, last_seen, created_at FROM users ORDER BY created_at DESC');
    res.json({ users: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to load users.' });
  }
});

app.post('/api/manager/users', verifyToken, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const { full_name, username, password, role, status } = req.body;
  if (!full_name || !username || !password || !role || !status) {
    return res.status(400).json({ message: 'Full name, username, password, role, and status are required.' });
  }

  if (!['manager', 'cashier'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role selected.' });
  }

  if (!['Active', 'Inactive'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status selected.' });
  }

  try {
    const [existing] = await db.execute('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Username already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await db.execute(
      'INSERT INTO users (full_name, username, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
      [full_name, username, passwordHash, role, status]
    );
    const [rows] = await db.execute('SELECT id, username, full_name, role, status, last_seen, created_at FROM users WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to create user.' });
  }
});

// Update user (manager only)
app.put('/api/manager/users/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
  const userId = Number(req.params.id);
  const { full_name, username, role, status, password } = req.body;

  try {
    // check username conflict
    const [rowsExisting] = await db.execute('SELECT id, username, full_name, role, status FROM users WHERE id = ?', [userId]);
    if (rowsExisting.length === 0) return res.status(404).json({ message: 'User not found.' });
    const existingUser = rowsExisting[0];

    // merge fields, allow partial updates
    const newFullName = typeof full_name !== 'undefined' ? full_name : existingUser.full_name;
    const newUsername = typeof username !== 'undefined' ? username : existingUser.username;
    const newRole = typeof role !== 'undefined' ? role : existingUser.role;
    const newStatus = typeof status !== 'undefined' ? status : existingUser.status;

    if (!newFullName || !newUsername) return res.status(400).json({ message: 'Full name and username are required.' });
    if (!['manager', 'cashier'].includes(newRole)) return res.status(400).json({ message: 'Invalid role selected.' });
    if (!['Active', 'Inactive'].includes(newStatus)) return res.status(400).json({ message: 'Invalid status selected.' });

    const [existing] = await db.execute('SELECT id FROM users WHERE username = ? AND id <> ?', [newUsername, userId]);
    if (existing.length > 0) return res.status(409).json({ message: 'Username already exists.' });

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      await db.execute('UPDATE users SET full_name = ?, username = ?, password_hash = ?, role = ?, status = ? WHERE id = ?', [newFullName, newUsername, passwordHash, newRole, newStatus, userId]);
    } else {
      await db.execute('UPDATE users SET full_name = ?, username = ?, role = ?, status = ? WHERE id = ?', [newFullName, newUsername, newRole, newStatus, userId]);
    }

    const [rows] = await db.execute('SELECT id, username, full_name, role, status, last_seen, created_at FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) return res.status(404).json({ message: 'User not found.' });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to update user.' });
  }
});

// Reset password for a user (manager only)
app.post('/api/manager/users/:id/reset-password', verifyToken, async (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
  const userId = Number(req.params.id);
  try {
    // generate a temporary password
    const tempPassword = 'password123';
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const [result] = await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: 'Password reset successfully.', tempPassword });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to reset password.' });
  }
});

// Delete user (manager only)
app.delete('/api/manager/users/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
  const userId = Number(req.params.id);
  try {
    const [result] = await db.execute('DELETE FROM users WHERE id = ?', [userId]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found.' });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to delete user.' });
  }
});

app.post("/api/manager/setup", managerSetupAccess, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required." });
  }

  try {
    const [existing] = await db.execute("SELECT id FROM users WHERE username = ?", [username]);
    if (existing.length > 0) {
      return res.status(409).json({ message: "Username already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await db.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'manager')", [username, passwordHash]);
    res.status(201).json({ id: result.insertId, username, role: "manager" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to create manager account." });
  }
});

app.get("/api/auth/status", verifyToken, (req, res) => {
  res.json({ user: req.user });
});

// Refresh JWT token
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const incoming = req.body && req.body.refreshToken ? req.body.refreshToken : null;
    const cookieToken = getCookieFromHeader(req, 'rms_refresh');
    const token = incoming || cookieToken;
    if (!token) return res.status(401).json({ message: 'No refresh token provided' });

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || "supersecretkey");
    } catch (err) {
      console.error('refresh verify error:', err && err.message ? err.message : err);
      await revokeRefreshToken(token).catch(()=>{});
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const stored = await findRefreshToken(token);
    if (!stored) return res.status(401).json({ message: 'Refresh token not found' });

    const newAccess = createToken({ id: payload.id, username: payload.username || '', role: payload.role || '' });
    await revokeRefreshToken(token).catch(()=>{});
    const newRefresh = await createRefreshToken(payload.id);

    res.cookie('rms_refresh', newRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({ token: newAccess });
  } catch (error) {
    console.error('Unable to refresh token:', error);
    res.status(500).json({ message: 'Unable to refresh token.' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const cookieToken = getCookieFromHeader(req, 'rms_refresh');
    const incoming = req.body && req.body.refreshToken ? req.body.refreshToken : null;
    const token = incoming || cookieToken;
    if (token) await revokeRefreshToken(token).catch(()=>{});
    res.clearCookie('rms_refresh');
    res.json({ ok: true });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ message: 'Unable to logout' });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
