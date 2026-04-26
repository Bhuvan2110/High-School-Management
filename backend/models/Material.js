// models/Material.js
// Study materials uploaded by teachers per subject

const { pool } = require('../config/db');

const Material = {

  /** Get all materials for a subject */
  getBySubject: async (subjectId) => {
    const [rows] = await pool.execute(
      `SELECT m.*, u.name AS teacher_name
       FROM materials m
       JOIN users u ON u.id = m.teacher_id
       WHERE m.subject_id = ?
       ORDER BY m.uploaded_at DESC`,
      [subjectId]
    );
    return rows;
  },

  /** Get all materials uploaded by a teacher */
  getByTeacher: async (teacherId) => {
    const [rows] = await pool.execute(
      `SELECT m.*, sub.subject_name
       FROM materials m
       JOIN subjects sub ON sub.id = m.subject_id
       WHERE m.teacher_id = ?
       ORDER BY m.uploaded_at DESC`,
      [teacherId]
    );
    return rows;
  },

  /** Get materials for subjects a student has selected */
  getForStudent: async (studentId) => {
    const [rows] = await pool.execute(
      `SELECT m.*, sub.subject_name, u.name AS teacher_name
       FROM materials m
       JOIN subjects sub ON sub.id = m.subject_id
       JOIN users u ON u.id = m.teacher_id
       WHERE m.subject_id IN (
         SELECT subject_id FROM student_subjects WHERE student_id = ?
       )
       ORDER BY m.uploaded_at DESC`,
      [studentId]
    );
    return rows;
  },

  /** Save a new material record */
  create: async ({ subject_id, teacher_id, title, description, file_path, file_name, file_type, file_size_kb }) => {
    const [result] = await pool.execute(
      `INSERT INTO materials (subject_id, teacher_id, title, description, file_path, file_name, file_type, file_size_kb)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [subject_id, teacher_id, title, description || null, file_path, file_name, file_type, file_size_kb || null]
    );
    return Material.findById(result.insertId);
  },

  findById: async (id) => {
    const [rows] = await pool.execute(
      `SELECT m.*, u.name AS teacher_name, sub.subject_name
       FROM materials m
       JOIN users u ON u.id = m.teacher_id
       JOIN subjects sub ON sub.id = m.subject_id
       WHERE m.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  delete: async (id) => {
    const mat = await Material.findById(id);
    if (!mat) return null;
    await pool.execute('DELETE FROM materials WHERE id = ?', [id]);
    return mat; // caller uses file_path to delete from disk
  },

  count: async (teacherId = null) => {
    const query = teacherId
      ? 'SELECT COUNT(*) AS total FROM materials WHERE teacher_id = ?'
      : 'SELECT COUNT(*) AS total FROM materials';
    const params = teacherId ? [teacherId] : [];
    const [rows] = await pool.execute(query, params);
    return rows[0].total;
  },
};

module.exports = Material;
