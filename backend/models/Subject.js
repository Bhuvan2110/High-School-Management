// models/Subject.js
// All DB queries for the subjects table
// IMPORTANT: Only Admin can INSERT/UPDATE/DELETE subjects (enforced in controller + middleware)

const { pool } = require('../config/db');

const Subject = {

  /** Get all active subjects (public — students & teachers can view) */
  findAll: async ({ includeInactive = false } = {}) => {
    const query = includeInactive
      ? `SELECT s.*, u.name AS created_by_name FROM subjects s
         LEFT JOIN users u ON u.id = s.created_by ORDER BY s.subject_name`
      : `SELECT s.*, u.name AS created_by_name FROM subjects s
         LEFT JOIN users u ON u.id = s.created_by
         WHERE s.is_active = TRUE ORDER BY s.subject_name`;
    const [rows] = await pool.execute(query);
    return rows;
  },

  /** Find by ID */
  findById: async (id) => {
    const [rows] = await pool.execute(
      `SELECT s.*, u.name AS created_by_name FROM subjects s
       LEFT JOIN users u ON u.id = s.created_by WHERE s.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  /** Check duplicate name (case-insensitive) */
  nameExists: async (name, excludeId = null) => {
    const query = excludeId
      ? 'SELECT id FROM subjects WHERE LOWER(subject_name) = LOWER(?) AND id != ? LIMIT 1'
      : 'SELECT id FROM subjects WHERE LOWER(subject_name) = LOWER(?) LIMIT 1';
    const params = excludeId ? [name.trim(), excludeId] : [name.trim()];
    const [rows] = await pool.execute(query, params);
    return rows.length > 0;
  },

  /** Create — adminId must be an Admin (validated in controller) */
  create: async (subjectName, adminId) => {
    const [result] = await pool.execute(
      'INSERT INTO subjects (subject_name, created_by) VALUES (?, ?)',
      [subjectName.trim(), adminId]
    );
    return Subject.findById(result.insertId);
  },

  /** Update name */
  update: async (id, subjectName) => {
    await pool.execute(
      'UPDATE subjects SET subject_name = ? WHERE id = ?',
      [subjectName.trim(), id]
    );
    return Subject.findById(id);
  },

  /** Soft-delete (set inactive) — preserves student_subjects history */
  deactivate: async (id) => {
    await pool.execute('UPDATE subjects SET is_active = FALSE WHERE id = ?', [id]);
  },

  /** Hard delete — only if no students have selected it */
  delete: async (id) => {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) AS cnt FROM student_subjects WHERE subject_id = ?', [id]
    );
    if (rows[0].cnt > 0) {
      throw new Error('Cannot delete: students have selected this subject. Deactivate instead.');
    }
    await pool.execute('DELETE FROM subjects WHERE id = ?', [id]);
  },

  /** Count how many students selected a subject */
  studentCount: async (id) => {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) AS cnt FROM student_subjects WHERE subject_id = ?', [id]
    );
    return rows[0].cnt;
  },

  /** Total count */
  count: async () => {
    const [rows] = await pool.execute('SELECT COUNT(*) AS total FROM subjects WHERE is_active = TRUE');
    return rows[0].total;
  },
};

module.exports = Subject;
