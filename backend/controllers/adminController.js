// controllers/adminController.js
// Admin-only operations: user management, class/section management, stats, audit logs

const bcrypt         = require('bcryptjs');
const User           = require('../models/User');
const Class          = require('../models/Class');
const Section        = require('../models/Section');
const { pool }       = require('../config/db');
const { sanitize, isValidClassName, isValidSectionName, isValidRole, isValidUUID } = require('../utils/validators');
const { sendSuccess, sendCreated, sendError, sendNotFound, sendConflict, sendValidationError, sendServerError } = require('../utils/response');
const { logAction, getIp, ACTIONS } = require('../utils/auditLogger');

require('dotenv').config();

// ═══════════════════════════════════════════════════════════════
// DASHBOARD STATS
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/stats
const getStats = async (req, res) => {
  try {
    const [[students], [teachers], [admins], [subjects], [sections]] = await Promise.all([
      pool.execute("SELECT COUNT(*) AS total FROM users WHERE role='student' AND is_active=TRUE"),
      pool.execute("SELECT COUNT(*) AS total FROM users WHERE role='teacher' AND is_active=TRUE"),
      pool.execute("SELECT COUNT(*) AS total FROM users WHERE role='admin'  AND is_active=TRUE"),
      pool.execute("SELECT COUNT(*) AS total FROM subjects WHERE is_active=TRUE"),
      pool.execute("SELECT COUNT(*) AS total FROM sections"),
    ]);
    return sendSuccess(res, {
      students:  students[0].total,
      teachers:  teachers[0].total,
      admins:    admins[0].total,
      subjects:  subjects[0].total,
      sections:  sections[0].total,
    });
  } catch (err) {
    console.error('[getStats]', err.message);
    return sendServerError(res);
  }
};

// ═══════════════════════════════════════════════════════════════
// USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/users
const getAllUsers = async (req, res) => {
  try {
    const { role, active, page = 1, limit = 20 } = req.query;
    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset   = (pageNum - 1) * limitNum;

    const filter = {};
    if (role && isValidRole(role))       filter.role      = role;
    if (active !== undefined)            filter.is_active = active === 'true';

    const [users, total] = await Promise.all([
      User.findAll({ ...filter, limit: limitNum, offset }),
      User.count(filter),
    ]);

    return sendSuccess(res, {
      users,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    console.error('[getAllUsers]', err.message);
    return sendServerError(res);
  }
};

// GET /api/admin/users/:id
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return sendNotFound(res, 'User');
    return sendSuccess(res, { user });
  } catch (err) {
    console.error('[getUserById]', err.message);
    return sendServerError(res);
  }
};

// PATCH /api/admin/users/:id/role
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!isValidRole(role)) return sendValidationError(res, ['Role must be admin, teacher, or student']);

    const target = await User.findById(req.params.id);
    if (!target) return sendNotFound(res, 'User');
    if (target.id === req.user.id) return sendError(res, 'You cannot change your own role', 403);

    const oldRole = target.role;
    await User.updateRole(target.id, role);

    await logAction({
      userId: req.user.id, action: ACTIONS.USER_ROLE_CHANGED,
      entityType: 'user', entityId: target.id,
      ipAddress: getIp(req),
      details: { old_role: oldRole, new_role: role, target_email: target.email },
    });

    return sendSuccess(res, null, `User role updated from ${oldRole} to ${role}`);
  } catch (err) {
    console.error('[updateUserRole]', err.message);
    return sendServerError(res);
  }
};

// PATCH /api/admin/users/:id/status
const toggleUserStatus = async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return sendNotFound(res, 'User');
    if (target.id === req.user.id) return sendError(res, 'You cannot deactivate your own account', 403);

    const newStatus = !target.is_active;
    await User.setActive(target.id, newStatus);

    const action = newStatus ? ACTIONS.USER_REACTIVATED : ACTIONS.USER_DEACTIVATED;
    await logAction({
      userId: req.user.id, action,
      entityType: 'user', entityId: target.id,
      ipAddress: getIp(req),
      details: { target_email: target.email },
    });

    return sendSuccess(res, { is_active: newStatus },
      `User account ${newStatus ? 'reactivated' : 'deactivated'} successfully`);
  } catch (err) {
    console.error('[toggleUserStatus]', err.message);
    return sendServerError(res);
  }
};

// POST /api/admin/users/:id/reset-password
const resetUserPassword = async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 8) {
      return sendValidationError(res, ['Password must be at least 8 characters']);
    }

    const target = await User.findById(req.params.id);
    if (!target) return sendNotFound(res, 'User');

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const hash = await bcrypt.hash(new_password, saltRounds);
    await User.updatePassword(target.id, hash);

    await logAction({
      userId: req.user.id, action: ACTIONS.USER_PASSWORD_RESET,
      entityType: 'user', entityId: target.id,
      ipAddress: getIp(req),
      details: { target_email: target.email },
    });

    return sendSuccess(res, null, 'Password reset successfully');
  } catch (err) {
    console.error('[resetUserPassword]', err.message);
    return sendServerError(res);
  }
};

// ═══════════════════════════════════════════════════════════════
// CLASS MANAGEMENT
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/classes
const getAllClasses = async (req, res) => {
  try {
    const classes = await Class.findAll();
    // Attach sections to each class
    const sections = await Section.findAll();
    const result = classes.map(c => ({
      ...c,
      sections: sections.filter(s => s.class_id === c.id),
    }));
    return sendSuccess(res, { classes: result });
  } catch (err) {
    console.error('[getAllClasses]', err.message);
    return sendServerError(res);
  }
};

// POST /api/admin/classes
const createClass = async (req, res) => {
  try {
    const { class_name } = req.body;
    if (!isValidClassName(class_name)) {
      return sendValidationError(res, ['Class name must be 8, 9, or 10']);
    }
    const exists = await Class.findByName(String(class_name));
    if (exists) return sendConflict(res, `Class ${class_name} already exists`);

    const cls = await Class.create(String(class_name), req.user.id);
    await logAction({
      userId: req.user.id, action: ACTIONS.CLASS_CREATED,
      entityType: 'class', entityId: cls.id,
      ipAddress: getIp(req), details: { class_name },
    });
    return sendCreated(res, { class: cls }, `Class ${class_name} created`);
  } catch (err) {
    console.error('[createClass]', err.message);
    return sendServerError(res);
  }
};

// ═══════════════════════════════════════════════════════════════
// SECTION MANAGEMENT
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/sections?class_id=
const getAllSections = async (req, res) => {
  try {
    const classId = req.query.class_id ? parseInt(req.query.class_id) : null;
    const sections = await Section.findAll(classId);
    return sendSuccess(res, { sections });
  } catch (err) {
    console.error('[getAllSections]', err.message);
    return sendServerError(res);
  }
};

// POST /api/admin/sections
const createSection = async (req, res) => {
  try {
    const { class_id, section_name } = req.body;
    if (!class_id) return sendValidationError(res, ['class_id is required']);
    if (!isValidSectionName(section_name)) {
      return sendValidationError(res, ['Section name must be a single uppercase letter A-Z']);
    }

    const cls = await Class.findById(class_id);
    if (!cls) return sendNotFound(res, 'Class');

    const exists = await Section.nameExists(class_id, section_name);
    if (exists) return sendConflict(res, `Section ${section_name.toUpperCase()} already exists in Class ${cls.class_name}`);

    const section = await Section.create(class_id, section_name, req.user.id);

    await logAction({
      userId: req.user.id, action: ACTIONS.SECTION_CREATED,
      entityType: 'section', entityId: section.id,
      ipAddress: getIp(req),
      details: { class_id, class_name: cls.class_name, section_name: section.section_name },
    });

    return sendCreated(res, { section }, `Section ${section.section_name} created in Class ${cls.class_name}`);
  } catch (err) {
    console.error('[createSection]', err.message);
    return sendServerError(res);
  }
};

// DELETE /api/admin/sections/:id
const deleteSection = async (req, res) => {
  try {
    const section = await Section.findById(req.params.id);
    if (!section) return sendNotFound(res, 'Section');
    await Section.delete(section.id);
    await logAction({
      userId: req.user.id, action: ACTIONS.SECTION_DELETED,
      entityType: 'section', entityId: section.id,
      ipAddress: getIp(req),
      details: { section_name: section.section_name, class_name: section.class_name },
    });
    return sendSuccess(res, null, 'Section deleted');
  } catch (err) {
    console.error('[deleteSection]', err.message);
    if (err.message.includes('Cannot delete')) return sendError(res, err.message, 409);
    return sendServerError(res);
  }
};

// POST /api/admin/sections/:id/assign
const assignStudentToSection = async (req, res) => {
  try {
    const { student_id } = req.body;
    if (!student_id) return sendValidationError(res, ['student_id is required']);

    const [section, student] = await Promise.all([
      Section.findById(req.params.id),
      User.findById(student_id),
    ]);
    if (!section)  return sendNotFound(res, 'Section');
    if (!student)  return sendNotFound(res, 'Student');
    if (student.role !== 'student') return sendError(res, 'User is not a student', 400);

    await Section.assignStudent(student_id, section.id);

    await logAction({
      userId: req.user.id, action: ACTIONS.STUDENT_ASSIGNED,
      entityType: 'section', entityId: section.id,
      ipAddress: getIp(req),
      details: { student_id, student_name: student.name, section: section.section_name },
    });

    return sendSuccess(res, null, `${student.name} assigned to Section ${section.section_name}`);
  } catch (err) {
    console.error('[assignStudentToSection]', err.message);
    return sendServerError(res);
  }
};

// GET /api/admin/sections/:id/students
const getSectionStudents = async (req, res) => {
  try {
    const section = await Section.findById(req.params.id);
    if (!section) return sendNotFound(res, 'Section');
    const students = await Section.getStudents(section.id);
    return sendSuccess(res, { section, students });
  } catch (err) {
    console.error('[getSectionStudents]', err.message);
    return sendServerError(res);
  }
};

// ═══════════════════════════════════════════════════════════════
// AUDIT LOGS
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/audit-logs
const getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, action, user_id } = req.query;
    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const offset   = (pageNum - 1) * limitNum;

    let query = `
      SELECT al.*, u.name AS user_name, u.email AS user_email
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE 1=1
    `;
    const params = [];
    if (action)  { query += ' AND al.action = ?';   params.push(action); }
    if (user_id) { query += ' AND al.user_id = ?';  params.push(user_id); }
    query += ' ORDER BY al.performed_at DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const [logs] = await pool.execute(query, params);

    const [[{ total }]] = await pool.execute('SELECT COUNT(*) AS total FROM audit_logs');
    return sendSuccess(res, {
      logs,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    console.error('[getAuditLogs]', err.message);
    return sendServerError(res);
  }
};

// ═══════════════════════════════════════════════════════════════
// TEACHER ASSIGNMENT MANAGEMENT
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/teacher-assignments
const getAllTeacherAssignments = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT ts.*, u.name AS teacher_name, u.email AS teacher_email,
              sub.subject_name, sec.section_name, c.class_name, c.id AS class_id
       FROM teacher_subjects ts
       JOIN users u ON u.id = ts.teacher_id
       JOIN subjects sub ON sub.id = ts.subject_id
       JOIN sections sec ON sec.id = ts.section_id
       JOIN classes c ON c.id = sec.class_id
       ORDER BY u.name, c.class_name, sec.section_name`
    );
    return sendSuccess(res, { assignments: rows });
  } catch (err) {
    console.error('[getAllTeacherAssignments]', err.message);
    return sendServerError(res);
  }
};

// POST /api/admin/teacher-assignments
const createTeacherAssignment = async (req, res) => {
  try {
    const { teacher_id, subject_id, section_id } = req.body;
    if (!teacher_id || !subject_id || !section_id)
      return sendValidationError(res, ['teacher_id, subject_id, section_id required']);

    const teacher = await User.findById(teacher_id);
    if (!teacher || teacher.role !== 'teacher') return sendNotFound(res, 'Teacher');

    await pool.execute(
      'INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id, section_id) VALUES (?,?,?)',
      [teacher_id, subject_id, section_id]
    );

    await logAction({
      userId: req.user.id, action: 'TEACHER_ASSIGNED',
      entityType: 'teacher_subjects', entityId: teacher_id,
      ipAddress: getIp(req),
      details: { teacher_name: teacher.name, subject_id, section_id },
    });

    return sendCreated(res, null, `${teacher.name} assigned successfully`);
  } catch (err) {
    console.error('[createTeacherAssignment]', err.message);
    return sendServerError(res);
  }
};

// DELETE /api/admin/teacher-assignments
const removeTeacherAssignment = async (req, res) => {
  try {
    const { teacher_id, subject_id, section_id } = req.body;
    await pool.execute(
      'DELETE FROM teacher_subjects WHERE teacher_id=? AND subject_id=? AND section_id=?',
      [teacher_id, subject_id, section_id]
    );
    return sendSuccess(res, null, 'Assignment removed');
  } catch (err) {
    console.error('[removeTeacherAssignment]', err.message);
    return sendServerError(res);
  }
};

// ═══════════════════════════════════════════════════════════════
// ADMIN — ALL MARKS VIEW
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/marks?student_id=&subject_id=&exam_type=
const getAllMarks = async (req, res) => {
  try {
    const { student_id, subject_id, exam_type, class_name, section_name } = req.query;
    let query = `
      SELECT m.*,
             u.name AS student_name, u.email AS student_email,
             sub.subject_name,
             t.name AS teacher_name,
             sec.section_name, c.class_name,
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
      JOIN subjects sub ON sub.id = m.subject_id
      JOIN users t ON t.id = m.teacher_id
      LEFT JOIN student_sections ss ON ss.student_id = m.student_id
      LEFT JOIN sections sec ON sec.id = ss.section_id
      LEFT JOIN classes c ON c.id = sec.class_id
      WHERE 1=1
    `;
    const params = [];
    if (student_id)  { query += ' AND m.student_id = ?';    params.push(student_id); }
    if (subject_id)  { query += ' AND m.subject_id = ?';    params.push(subject_id); }
    if (exam_type)   { query += ' AND m.exam_type = ?';     params.push(exam_type); }
    if (class_name)  { query += ' AND c.class_name = ?';    params.push(class_name); }
    if (section_name){ query += ' AND sec.section_name = ?'; params.push(section_name); }
    query += ' ORDER BY u.name, sub.subject_name, m.exam_type';

    const [rows] = await pool.execute(query, params);
    return sendSuccess(res, { marks: rows, total: rows.length });
  } catch (err) {
    console.error('[getAllMarks]', err.message);
    return sendServerError(res);
  }
};

// ═══════════════════════════════════════════════════════════════
// ADMIN — ALL ATTENDANCE VIEW
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/attendance?student_id=&subject_id=&date=&class_name=
const getAllAttendance = async (req, res) => {
  try {
    const { student_id, subject_id, date, class_name, section_name } = req.query;
    let query = `
      SELECT a.*,
             u.name AS student_name,
             sub.subject_name,
             t.name AS teacher_name,
             sec.section_name, c.class_name
      FROM attendance a
      JOIN users u ON u.id = a.student_id
      JOIN subjects sub ON sub.id = a.subject_id
      JOIN users t ON t.id = a.teacher_id
      LEFT JOIN student_sections ss ON ss.student_id = a.student_id
      LEFT JOIN sections sec ON sec.id = ss.section_id
      LEFT JOIN classes c ON c.id = sec.class_id
      WHERE 1=1
    `;
    const params = [];
    if (student_id)  { query += ' AND a.student_id = ?';    params.push(student_id); }
    if (subject_id)  { query += ' AND a.subject_id = ?';    params.push(subject_id); }
    if (date)        { query += ' AND a.date = ?';           params.push(date); }
    if (class_name)  { query += ' AND c.class_name = ?';    params.push(class_name); }
    if (section_name){ query += ' AND sec.section_name = ?'; params.push(section_name); }
    query += ' ORDER BY a.date DESC, u.name LIMIT 500';

    const [rows] = await pool.execute(query, params);
    return sendSuccess(res, { attendance: rows, total: rows.length });
  } catch (err) {
    console.error('[getAllAttendance]', err.message);
    return sendServerError(res);
  }
};

module.exports = {
  getStats,
  getAllUsers, getUserById, updateUserRole, toggleUserStatus, resetUserPassword,
  getAllClasses, createClass,
  getAllSections, createSection, deleteSection, assignStudentToSection, getSectionStudents,
  getAllTeacherAssignments, createTeacherAssignment, removeTeacherAssignment,
  getAllMarks, getAllAttendance,
  getAuditLogs,
};
