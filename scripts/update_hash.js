const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

(async () => {
  try {
    const db = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    const hash = '$2b$10$QmbWzmIuBZOhm6oNOmNKIuPChd2Xa8twl7UqvcazSVGL36kynD5Wa';
    await db.execute("UPDATE users SET password_hash = ? WHERE username IN (?, ?)", [hash, 'manager1', 'cashier1']);
    const [rows] = await db.execute("SELECT id, username, role, password_hash, LENGTH(password_hash) AS len FROM users WHERE username IN (?, ?)", ['manager1', 'cashier1']);
    console.log(JSON.stringify(rows, null, 2));
    await db.end();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
