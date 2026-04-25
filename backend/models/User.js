// models/User.js
// All database queries related to the users table
// Uses parameterized queries throughout — no SQL injection possible

const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const User = {

  /**
   * Find a user by their email address
   */
  findByEmail: async (email) => {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE email = ? AND is_active = TRUE LIMIT 1',
      [email.toLowerCase().trim()]
    );
    return rows[0] || null;
  },

  /**
   * Find a user by their UUID
   */
  findById: async (id) => {
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, is_active, last_login, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Find a user by ID including password hash (for password change)
   */
  findByIdWithHash: async (id) => {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Create a new user
   * Returns the created user (without password_hash)
   */
  create: async ({ name, email, password_hash, role }) => {
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES (?, ?, ?, ?, ?)`,
      [id, name.trim(), email.toLowerCase().trim(), password_hash, role]
    );
    return User.findById(id);
  },

  /**
   * Get all users (admin use)
   * Excludes password_hash
   */
  findAll: async ({ role = null, is_active = null, limit = 100, offset = 0 } = {}) => {
    let query = `
      SELECT id, name, email, role, is_active, last_login, created_at
      FROM users
      WHERE 1=1
    `;
    const params = [];

    if (role !== null)      { query += ' AND role = ?';      params.push(role); }
    if (is_active !== null) { query += ' AND is_active = ?'; params.push(is_active); }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.execute(query, params);
    return rows;
  },

  /**
   * Count total users (for pagination)
   */
  count: async ({ role = null, is_active = null } = {}) => {
    let query = 'SELECT COUNT(*) AS total FROM users WHERE 1=1';
    const params = [];
    if (role !== null)      { query += ' AND role = ?';      params.push(role); }
    if (is_active !== null) { query += ' AND is_active = ?'; params.push(is_active); }
    const [rows] = await pool.execute(query, params);
    return rows[0].total;
  },

  /**
   * Update last_login timestamp
   */
  updateLastLogin: async (id) => {
    await pool.execute(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
  },

  /**
   * Update user's active status
   */
  setActive: async (id, isActive) => {
    await pool.execute(
      'UPDATE users SET is_active = ? WHERE id = ?',
      [isActive, id]
    );
  },

  /**
   * Update user role
   */
  updateRole: async (id, role) => {
    await pool.execute(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, id]
    );
  },

  /**
   * Update password hash (for password reset)
   */
  updatePassword: async (id, password_hash) => {
    await pool.execute(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [password_hash, id]
    );
  },

  /**
   * Update user profile (name)
   */
  updateProfile: async (id, { name }) => {
    await pool.execute(
      'UPDATE users SET name = ? WHERE id = ?',
      [name.trim(), id]
    );
    return User.findById(id);
  },

  /**
   * Check if email already exists
   */
  emailExists: async (email) => {
    const [rows] = await pool.execute(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email.toLowerCase().trim()]
    );
    return rows.length > 0;
  },

  /**
   * Store RSA public key for E2EE (Phase 4)
   */
  storePublicKey: async (id, publicKey) => {
    await pool.execute(
      'UPDATE users SET public_key = ? WHERE id = ?',
      [publicKey, id]
    );
  },

  /**
   * Get public key for E2EE (Phase 4)
   */
  getPublicKey: async (id) => {
    const [rows] = await pool.execute(
      'SELECT public_key FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0]?.public_key || null;
  },
};

module.exports = User;
