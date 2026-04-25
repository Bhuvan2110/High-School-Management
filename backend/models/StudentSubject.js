// models/StudentSubject.js
const { pool } = require('../config/db');

const StudentSubject = {

  /** Get all subjects a student has selected */
  getByStudent: async (studentId) => {
    const [rows] = await pool.execute(
      `SELECT sub.id, sub.subject_name, sub.is_active, ss.selected_at
       FROM student_subjects ss
       JOIN subjects sub ON sub.id = ss.subject_id
       WHERE ss.student_id = ?
       ORDER BY sub.subject_name`,
      [studentId]
    );
    return rows;
  },

  /** Get all students who selected a specific subject */
  getBySubject: async (subjectId) => {
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, ss.selected_at
       FROM student_subjects ss
       JOIN users u ON u.id = ss.student_id
       WHERE ss.subject_id = ?
       ORDER BY u.name`,
      [subjectId]
    );
    return rows;
  },

  /** Student selects a subject */
  select: async (studentId, subjectId) => {
    await pool.execute(
      `INSERT IGNORE INTO student_subjects (student_id, subject_id) VALUES (?, ?)`,
      [studentId, subjectId]
    );
  },

  /** Student deselects a subject */
  deselect: async (studentId, subjectId) => {
    await pool.execute(
      'DELETE FROM student_subjects WHERE student_id = ? AND subject_id = ?',
      [studentId, subjectId]
    );
  },

  /** Replace all subject selections for a student (bulk update) */
  replaceAll: async (studentId, subjectIds) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('DELETE FROM student_subjects WHERE student_id = ?', [studentId]);
      if (subjectIds.length > 0) {
        const values = subjectIds.map(id => [studentId, id]);
        await conn.query('INSERT INTO student_subjects (student_id, subject_id) VALUES ?', [values]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
};

module.exports = StudentSubject;
