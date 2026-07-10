CREATE DATABASE IF NOT EXISTS restaurant_system;
USE restaurant_system;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('manager', 'cashier', 'delivery') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users MODIFY COLUMN role ENUM('manager', 'cashier', 'delivery') NOT NULL;

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cashier_id INT NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  tax DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  discount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payments TEXT,
  status ENUM('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO users (username, password_hash, role) VALUES
('manager1', '$2b$10$QmbWzmIuBZOhm6oNOmNKIuPChd2Xa8twl7UqvcazSVGL36kynD5Wa', 'manager'),
('cashier1', '$2b$10$QmbWzmIuBZOhm6oNOmNKIuPChd2Xa8twl7UqvcazSVGL36kynD5Wa', 'cashier');
