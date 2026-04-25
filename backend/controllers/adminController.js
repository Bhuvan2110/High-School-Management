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

module.exports = {
  getStats,
  getAllUsers, getUserById, updateUserRole, toggleUserStatus, resetUserPassword,
  getAllClasses, createClass,
  getAllSections, createSection, deleteSection, assignStudentToSection, getSectionStudents,
  getAuditLogs,
};
