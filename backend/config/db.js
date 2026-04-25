// config/db.js
// MySQL connection pool — used throughout the app
// All queries go through this pool; never create direct connections

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               process.env.DB_PORT     || 3306,
  database:           process.env.DB_NAME     || 'highschool_db',
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit:    10,          // max simultaneous connections
  queueLimit:         0,           // unlimited queued requests
  timezone:           '+00:00',    // store all times as UTC
  charset:            'utf8mb4',   // full unicode (emojis, special chars)
  decimalNumbers:     true,        // return decimals as JS numbers
});

// Test the connection on startup
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅  MySQL connected — host:', process.env.DB_HOST, '| db:', process.env.DB_NAME);
    connection.release();
  } catch (err) {
    console.error('❌  MySQL connection FAILED:', err.message);
    console.error('    → Check DB_HOST, DB_USER, DB_PASSWORD, DB_NAME in your .env file');
    process.exit(1); // exit so the server never starts with a broken DB
  }
}

module.exports = { pool, testConnection };
