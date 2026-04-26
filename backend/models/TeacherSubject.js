// models/TeacherSubject.js
// Maps which subjects/sections are assigned to which teacher (Admin sets this)

const { pool } = require('../config/db');

const TeacherSubject = {

  /** Assign a teacher to a subject+section */
  assign: async (teacherId, subjectId, sectionId) => {
    await pool.execute(
      `INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id, section_id) VALUES (?, ?, ?)`,
      [teacherId, subjectId, sectionId]
    );
  },

  /** Remove an assignment */
  remove: async (teacherId, subjectId, sectionId) => {
    await pool.execute(
      `DELETE FROM teacher_subjects WHERE teacher_id = ? AND subject_id = ? AND section_id = ?`,
      [teacherId, subjectId, sectionId]
    );
  },

  /** Get all assignments for a teacher */
  getByTeacher: async (teacherId) => {
    const [rows] = await pool.execute(
      `SELECT ts.*, sub.subject_name, sec.section_name, c.class_name, c.id AS class_id
       FROM teacher_subjects ts
       JOIN subjects sub ON sub.id = ts.subject_id
       JOIN sections sec ON sec.id = ts.section_id
       JOIN classes c ON c.id = sec.class_id
       WHERE ts.teacher_id = ?
       ORDER BY c.class_name, sec.section_name, sub.subject_name`,
      [teacherId]
    );
    return rows;
  },

  /** Get all assignments (admin view) */
  getAll: async () => {
    const [rows] = await pool.execute(
      `SELECT ts.*, u.name AS teacher_name, sub.subject_name,
              sec.section_name, c.class_name
       FROM teacher_subjects ts
       JOIN users u ON u.id = ts.teacher_id
       JOIN subjects sub ON sub.id = ts.subject_id
       JOIN sections sec ON sec.id = ts.section_id
       JOIN classes c ON c.id = sec.class_id
       ORDER BY u.name, c.class_name`,
    );
    return rows;
  },

  /** Check if teacher is assigned to a specific subject+section */
  isAssigned: async (teacherId, subjectId, sectionId) => {
    const [rows] = await pool.execute(
      `SELECT id FROM teacher_subjects
       WHERE teacher_id=? AND subject_id=? AND section_id=? LIMIT 1`,
      [teacherId, subjectId, sectionId]
    );
    return rows.length > 0;
  },

  /** Get students in all sections assigned to this teacher for a subject */
  getStudentsForTeacherSubject: async (teacherId, subjectId) => {
    const [rows] = await pool.execute(
      `SELECT DISTINCT u.id, u.name, u.email,
              sec.section_name, c.class_name
       FROM teacher_subjects ts
       JOIN sections sec ON sec.id = ts.section_id
       JOIN classes c ON c.id = sec.class_id
       JOIN student_sections ss ON ss.section_id = sec.id
       JOIN users u ON u.id = ss.student_id
       WHERE ts.teacher_id = ? AND ts.subject_id = ?
       ORDER BY c.class_name, sec.section_name, u.name`,
      [teacherId, subjectId]
    );
    return rows;
  },
};

module.exports = TeacherSubject;
