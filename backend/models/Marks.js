// models/Marks.js
// Subject-wise marks per student per exam type

const { pool } = require('../config/db');

const Marks = {

  /** Enter or update marks for a student */
  upsert: async ({ student_id, subject_id, teacher_id, exam_type, marks_value, max_marks, remarks }) => {
    const [result] = await pool.execute(
      `INSERT INTO marks (student_id, subject_id, teacher_id, exam_type, marks_value, max_marks, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         marks_value = VALUES(marks_value),
         max_marks   = VALUES(max_marks),
         remarks     = VALUES(remarks),
         teacher_id  = VALUES(teacher_id)`,
      [student_id, subject_id, teacher_id, exam_type, marks_value, max_marks || 100, remarks || null]
    );
    return result;
  },

  /** Bulk enter marks for multiple students at once */
  upsertBulk: async (records, teacherId) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const r of records) {
        await conn.execute(
          `INSERT INTO marks (student_id, subject_id, teacher_id, exam_type, marks_value, max_marks, remarks)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             marks_value = VALUES(marks_value),
             max_marks   = VALUES(max_marks),
             remarks     = VALUES(remarks)`,
          [r.student_id, r.subject_id, teacherId, r.exam_type, r.marks_value, r.max_marks || 100, r.remarks || null]
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

  /** Get all marks for a student */
  getByStudent: async (studentId) => {
    const [rows] = await pool.execute(
      `SELECT m.*, sub.subject_name,
              ROUND(m.marks_value / m.max_marks * 100, 1) AS percentage,
              CASE
                WHEN m.marks_value / m.max_marks >= 0.90 THEN 'A+'
                WHEN m.marks_value / m.max_marks >= 0.80 THEN 'A'
                WHEN m.marks_value / m.max_marks >= 0.70 THEN 'B'
                WHEN m.marks_value / m.max_marks >= 0.60 THEN 'C'
                WHEN m.marks_value / m.max_marks >= 0.50 THEN 'D'
                ELSE 'F'
              END AS grade
       FROM marks m
       JOIN subjects sub ON sub.id = m.subject_id
       WHERE m.student_id = ?
       ORDER BY sub.subject_name, m.exam_type`,
      [studentId]
    );
    return rows;
  },

  /** Get marks for a subject (all students) — teacher view */
  getBySubject: async (subjectId, examType = null) => {
    let query = `
      SELECT m.*, u.name AS student_name,
             ROUND(m.marks_value / m.max_marks * 100, 1) AS percentage,
             CASE
               WHEN m.marks_value / m.max_marks >= 0.90 THEN 'A+'
               WHEN m.marks_value / m.max_marks >= 0.80 THEN 'A'
               WHEN m.marks_value / m.max_marks >= 0.70 THEN 'B'
               WHEN m.marks_value / m.max_marks >= 0.60 THEN 'C'
               WHEN m.marks_value / m.max_marks >= 0.50 THEN 'D'
               ELSE 'F'
             END AS grade
      FROM marks m
      JOIN users u ON u.id = m.student_id
      WHERE m.subject_id = ?
    `;
    const params = [subjectId];
    if (examType) { query += ' AND m.exam_type = ?'; params.push(examType); }
    query += ' ORDER BY u.name';
    const [rows] = await pool.execute(query, params);
    return rows;
  },

  /** Result card: aggregate per subject for a student */
  getResultCard: async (studentId) => {
    const [rows] = await pool.execute(
      `SELECT
         sub.subject_name,
         MAX(CASE WHEN m.exam_type='unit_test' THEN m.marks_value END) AS unit_test,
         MAX(CASE WHEN m.exam_type='midterm'   THEN m.marks_value END) AS midterm,
         MAX(CASE WHEN m.exam_type='final'     THEN m.marks_value END) AS final,
         MAX(m.max_marks) AS max_marks,
         ROUND(AVG(m.marks_value / m.max_marks) * 100, 1) AS overall_percentage,
         CASE
           WHEN AVG(m.marks_value / m.max_marks) >= 0.90 THEN 'A+'
           WHEN AVG(m.marks_value / m.max_marks) >= 0.80 THEN 'A'
           WHEN AVG(m.marks_value / m.max_marks) >= 0.70 THEN 'B'
           WHEN AVG(m.marks_value / m.max_marks) >= 0.60 THEN 'C'
           WHEN AVG(m.marks_value / m.max_marks) >= 0.50 THEN 'D'
           ELSE 'F'
         END AS grade
       FROM marks m
       JOIN subjects sub ON sub.id = m.subject_id
       WHERE m.student_id = ?
       GROUP BY m.subject_id
       ORDER BY sub.subject_name`,
      [studentId]
    );
    return rows;
  },

  /** Distinct exam types in use */
  getExamTypes: async () => {
    const [rows] = await pool.execute('SELECT DISTINCT exam_type FROM marks ORDER BY exam_type');
    return rows.map(r => r.exam_type);
  },
};

module.exports = Marks;
