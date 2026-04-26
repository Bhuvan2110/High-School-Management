// models/Attendance.js
// Per-student, per-subject, per-date attendance records

const { pool } = require('../config/db');

const Attendance = {

  /**
   * Mark attendance for a list of students in one shot
   * @param {Array} records  [{ student_id, subject_id, date, status, remarks }]
   * @param {string} teacherId
   */
  markBulk: async (records, teacherId) => {
    if (!records.length) return;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const r of records) {
        await conn.execute(
          `INSERT INTO attendance (student_id, subject_id, teacher_id, date, status, remarks)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status = VALUES(status), remarks = VALUES(remarks)`,
          [r.student_id, r.subject_id, teacherId, r.date, r.status || 'present', r.remarks || null]
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

  /** Get attendance for a subject on a specific date */
  getBySubjectAndDate: async (subjectId, date) => {
    const [rows] = await pool.execute(
      `SELECT a.*, u.name AS student_name, u.email AS student_email
       FROM attendance a
       JOIN users u ON u.id = a.student_id
       WHERE a.subject_id = ? AND a.date = ?
       ORDER BY u.name`,
      [subjectId, date]
    );
    return rows;
  },

  /** Get all attendance for a student (optional: per subject) */
  getByStudent: async (studentId, subjectId = null) => {
    let query = `
      SELECT a.*, sub.subject_name, u.name AS teacher_name
      FROM attendance a
      JOIN subjects sub ON sub.id = a.subject_id
      JOIN users u ON u.id = a.teacher_id
      WHERE a.student_id = ?
    `;
    const params = [studentId];
    if (subjectId) { query += ' AND a.subject_id = ?'; params.push(subjectId); }
    query += ' ORDER BY a.date DESC';
    const [rows] = await pool.execute(query, params);
    return rows;
  },

  /** Attendance summary per subject for a student (percentage, counts) */
  getSummaryByStudent: async (studentId) => {
    const [rows] = await pool.execute(
      `SELECT
         sub.id AS subject_id,
         sub.subject_name,
         COUNT(*) AS total_classes,
         SUM(a.status = 'present') AS present,
         SUM(a.status = 'absent')  AS absent,
         SUM(a.status = 'late')    AS late,
         ROUND(SUM(a.status IN ('present','late')) / COUNT(*) * 100, 1) AS percentage
       FROM attendance a
       JOIN subjects sub ON sub.id = a.subject_id
       WHERE a.student_id = ?
       GROUP BY a.subject_id
       ORDER BY sub.subject_name`,
      [studentId]
    );
    return rows;
  },

  /** Class-wide attendance report for a subject in a date range */
  getClassReport: async (subjectId, fromDate, toDate) => {
    const [rows] = await pool.execute(
      `SELECT
         u.id AS student_id, u.name AS student_name,
         COUNT(*) AS total,
         SUM(a.status='present') AS present,
         SUM(a.status='absent')  AS absent,
         SUM(a.status='late')    AS late,
         ROUND(SUM(a.status IN ('present','late'))/COUNT(*)*100,1) AS percentage
       FROM attendance a
       JOIN users u ON u.id = a.student_id
       WHERE a.subject_id = ? AND a.date BETWEEN ? AND ?
       GROUP BY a.student_id
       ORDER BY u.name`,
      [subjectId, fromDate, toDate]
    );
    return rows;
  },

  /** Get dates already marked for a subject */
  getMarkedDates: async (subjectId) => {
    const [rows] = await pool.execute(
      `SELECT DISTINCT date FROM attendance
       WHERE subject_id = ? ORDER BY date DESC LIMIT 30`,
      [subjectId]
    );
    return rows.map(r => r.date);
  },
};

module.exports = Attendance;
