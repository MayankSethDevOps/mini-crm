// db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'changeme',
  database: process.env.MYSQL_DB || 'mini_crm',
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;
