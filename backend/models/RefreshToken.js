// models/RefreshToken.js
// Manages refresh tokens stored in the database for secure rotation

const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const RefreshToken = {

  /**
   * Store a new refresh token (hashed)
   * We hash the token before storing — even a DB breach doesn't expose valid tokens
   */
  create: async (userId, token, expiresAt) => {
    const id = uuidv4();
    // Hash the token with fewer rounds (4) — speed matters here, security comes from the secret
    const tokenHash = await bcrypt.hash(token, 4);
    await pool.execute(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
       VALUES (?, ?, ?, ?)`,
      [id, userId, tokenHash, expiresAt]
    );
    return id;
  },

  /**
   * Find all active (non-revoked, non-expired) tokens for a user
   * Used to validate a presented refresh token by comparing hashes
   */
  findActiveByUser: async (userId) => {
    const [rows] = await pool.execute(
      `SELECT * FROM refresh_tokens
       WHERE user_id = ? AND revoked = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  },

  /**
   * Find and validate a refresh token
   * Returns the token record if valid, null otherwise
   */
  findAndValidate: async (userId, token) => {
    const activeTokens = await RefreshToken.findActiveByUser(userId);
    for (const record of activeTokens) {
      const isMatch = await bcrypt.compare(token, record.token_hash);
      if (isMatch) return record;
    }
    return null;
  },

  /**
   * Revoke a specific token by its ID
   */
  revokeById: async (id) => {
    await pool.execute(
      'UPDATE refresh_tokens SET revoked = TRUE WHERE id = ?',
      [id]
    );
  },

  /**
   * Revoke ALL tokens for a user (full logout / security event)
   */
  revokeAllForUser: async (userId) => {
    await pool.execute(
      'UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = ?',
      [userId]
    );
  },

  /**
   * Cleanup expired/revoked tokens older than 30 days
   * Should be run periodically (cron job in Phase 3)
   */
  cleanup: async () => {
    const [result] = await pool.execute(
      `DELETE FROM refresh_tokens
       WHERE (revoked = TRUE OR expires_at < NOW())
       AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    return result.affectedRows;
  },
};

module.exports = RefreshToken;
