CREATE DATABASE IF NOT EXISTS mini_crm;
USE mini_crm;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  google_id VARCHAR(255),
  name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  country VARCHAR(50),
  total_spend DECIMAL(12,2) DEFAULT 0,
  visits INT DEFAULT 0,
  last_order_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (email)
);

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT,
  amount DECIMAL(12,2),
  created_at DATETIME,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE segments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  rule_json JSON,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE campaigns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  segment_id INT,
  message_template TEXT,
  created_by INT,
  audience_size INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'CREATED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (segment_id) REFERENCES segments(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE communication_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT,
  customer_id INT,
  contact_method VARCHAR(50) DEFAULT 'sms',
  destination VARCHAR(255),
  message TEXT,
  status VARCHAR(50) DEFAULT 'PENDING', -- PENDING / SENT / FAILED / RECEIVED
  vendor_message_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
