// models/Section.js
const { pool } = require('../config/db');

const Section = {

  findAll: async (classId = null) => {
    let query = `
      SELECT s.*, c.class_name, u.name AS created_by_name,
             COUNT(ss.student_id) AS student_count
      FROM sections s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN users u ON u.id = s.created_by
      LEFT JOIN student_sections ss ON ss.section_id = s.id
    `;
    const params = [];
    if (classId) { query += ' WHERE s.class_id = ?'; params.push(classId); }
    query += ' GROUP BY s.id ORDER BY c.class_name, s.section_name';
    const [rows] = await pool.execute(query, params);
    return rows;
  },

  findById: async (id) => {
    const [rows] = await pool.execute(
      `SELECT s.*, c.class_name FROM sections s
       LEFT JOIN classes c ON c.id = s.class_id WHERE s.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  nameExists: async (classId, sectionName) => {
    const [rows] = await pool.execute(
      'SELECT id FROM sections WHERE class_id = ? AND section_name = ? LIMIT 1',
      [classId, sectionName.toUpperCase()]
    );
    return rows.length > 0;
  },

  create: async (classId, sectionName, adminId) => {
    const [result] = await pool.execute(
      'INSERT INTO sections (class_id, section_name, created_by) VALUES (?, ?, ?)',
      [classId, sectionName.toUpperCase(), adminId]
    );
    return Section.findById(result.insertId);
  },

  delete: async (id) => {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) AS cnt FROM student_sections WHERE section_id = ?', [id]
    );
    if (rows[0].cnt > 0) {
      throw new Error('Cannot delete section with enrolled students. Reassign students first.');
    }
    await pool.execute('DELETE FROM sections WHERE id = ?', [id]);
  },

  /** Assign a student to a section (upsert) */
  assignStudent: async (studentId, sectionId) => {
    await pool.execute(
      `INSERT INTO student_sections (student_id, section_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE section_id = VALUES(section_id)`,
      [studentId, sectionId]
    );
  },

  /** Get students in a section */
  getStudents: async (sectionId) => {
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.last_login, ss.enrolled_at
       FROM student_sections ss
       JOIN users u ON u.id = ss.student_id
       WHERE ss.section_id = ?
       ORDER BY u.name`,
      [sectionId]
    );
    return rows;
  },

  count: async () => {
    const [rows] = await pool.execute('SELECT COUNT(*) AS total FROM sections');
    return rows[0].total;
  },
};

module.exports = Section;
