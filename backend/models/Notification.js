// models/Notification.js
const { pool } = require('../config/db');

const Notification = {

  /** Create a single notification */
  create: async ({ recipient_id, sender_id = null, title, message, type = 'system' }) => {
    const [result] = await pool.execute(
      `INSERT INTO notifications (recipient_id, sender_id, title, message, type)
       VALUES (?, ?, ?, ?, ?)`,
      [recipient_id, sender_id, title, message, type]
    );
    return result.insertId;
  },

  /** Broadcast to multiple recipients at once */
  broadcast: async ({ recipient_ids, sender_id, title, message, type = 'announcement' }) => {
    if (!recipient_ids.length) return;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const rid of recipient_ids) {
        await conn.execute(
          `INSERT INTO notifications (recipient_id, sender_id, title, message, type)
           VALUES (?, ?, ?, ?, ?)`,
          [rid, sender_id, title, message, type]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  /** Get all notifications for a user */
  getByUser: async (userId, { unreadOnly = false, limit = 50 } = {}) => {
    let query = `
      SELECT n.*, u.name AS sender_name
      FROM notifications n
      LEFT JOIN users u ON u.id = n.sender_id
      WHERE n.recipient_id = ?
    `;
    const params = [userId];
    if (unreadOnly) { query += ' AND n.is_read = FALSE'; }
    query += ' ORDER BY n.created_at DESC LIMIT ?';
    params.push(limit);
    const [rows] = await pool.execute(query, params);
    return rows;
  },

  /** Count unread notifications */
  countUnread: async (userId) => {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) AS total FROM notifications WHERE recipient_id = ? AND is_read = FALSE',
      [userId]
    );
    return rows[0].total;
  },

  /** Mark one notification as read */
  markRead: async (id, userId) => {
    await pool.execute(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND recipient_id = ?',
      [id, userId]
    );
  },

  /** Mark all as read for a user */
  markAllRead: async (userId) => {
    await pool.execute(
      'UPDATE notifications SET is_read = TRUE WHERE recipient_id = ?',
      [userId]
    );
  },

  delete: async (id, userId) => {
    await pool.execute(
      'DELETE FROM notifications WHERE id = ? AND recipient_id = ?',
      [id, userId]
    );
  },
};

module.exports = Notification;
