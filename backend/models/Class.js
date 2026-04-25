// models/Class.js
const { pool } = require('../config/db');

const Class = {

  findAll: async () => {
    const [rows] = await pool.execute(
      `SELECT c.*, u.name AS created_by_name,
              COUNT(DISTINCT s.id) AS section_count
       FROM classes c
       LEFT JOIN users u ON u.id = c.created_by
       LEFT JOIN sections s ON s.class_id = c.id
       GROUP BY c.id ORDER BY c.class_name`
    );
    return rows;
  },

  findById: async (id) => {
    const [rows] = await pool.execute(
      'SELECT * FROM classes WHERE id = ? LIMIT 1', [id]
    );
    return rows[0] || null;
  },

  findByName: async (className) => {
    const [rows] = await pool.execute(
      'SELECT * FROM classes WHERE class_name = ? LIMIT 1', [className]
    );
    return rows[0] || null;
  },

  create: async (className, adminId) => {
    const [result] = await pool.execute(
      'INSERT INTO classes (class_name, created_by) VALUES (?, ?)',
      [className, adminId]
    );
    return Class.findById(result.insertId);
  },

  count: async () => {
    const [rows] = await pool.execute('SELECT COUNT(*) AS total FROM classes');
    return rows[0].total;
  },
};

module.exports = Class;
