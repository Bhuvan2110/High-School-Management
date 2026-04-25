// utils/auditLogger.js
// Appends every sensitive action to the audit_logs table
// Called from controllers after important operations

const { pool } = require('../config/db');

/**
 * Log an action to the audit_logs table
 * @param {object} params
 * @param {string|null} params.userId      - The user performing the action (null if unauthenticated)
 * @param {string}      params.action      - Action code e.g. 'USER_LOGIN', 'SUBJECT_CREATED'
 * @param {string|null} params.entityType  - The type of record affected e.g. 'user', 'subject'
 * @param {string|null} params.entityId    - The ID of the affected record
 * @param {string|null} params.ipAddress   - Client IP address
 * @param {string|null} params.userAgent   - Client user agent string
 * @param {object|null} params.details     - Additional JSON context (old/new values etc.)
 */
const logAction = async ({
  userId     = null,
  action,
  entityType = null,
  entityId   = null,
  ipAddress  = null,
  userAgent  = null,
  details    = null,
}) => {
  try {
    await pool.execute(
      `INSERT INTO audit_logs 
        (user_id, action, entity_type, entity_id, ip_address, user_agent, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        action,
        entityType,
        entityId     ? String(entityId) : null,
        ipAddress,
        userAgent    ? userAgent.substring(0, 500) : null,
        details      ? JSON.stringify(details) : null,
      ]
    );
  } catch (err) {
    // Never crash the main request because of an audit log failure
    console.error('⚠️  Audit log insert failed:', err.message);
  }
};

/**
 * Helper to extract IP address from Express request
 * Handles proxies (X-Forwarded-For header)
 */
const getIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    null
  );
};

// Pre-defined action constants — keeps action names consistent
const ACTIONS = {
  // Auth
  USER_REGISTER:         'USER_REGISTER',
  USER_LOGIN:            'USER_LOGIN',
  USER_LOGIN_FAILED:     'USER_LOGIN_FAILED',
  USER_LOGOUT:           'USER_LOGOUT',
  TOKEN_REFRESHED:       'TOKEN_REFRESHED',

  // Admin — Users
  USER_ROLE_CHANGED:     'USER_ROLE_CHANGED',
  USER_DEACTIVATED:      'USER_DEACTIVATED',
  USER_REACTIVATED:      'USER_REACTIVATED',
  USER_PASSWORD_RESET:   'USER_PASSWORD_RESET',

  // Admin — Classes & Sections
  CLASS_CREATED:         'CLASS_CREATED',
  SECTION_CREATED:       'SECTION_CREATED',
  SECTION_DELETED:       'SECTION_DELETED',
  STUDENT_ASSIGNED:      'STUDENT_ASSIGNED',

  // Admin — Subjects
  SUBJECT_CREATED:       'SUBJECT_CREATED',
  SUBJECT_UPDATED:       'SUBJECT_UPDATED',
  SUBJECT_DELETED:       'SUBJECT_DELETED',

  // Student
  SUBJECT_SELECTED:      'SUBJECT_SELECTED',
  SUBJECT_DESELECTED:    'SUBJECT_DESELECTED',

  // Teacher
  MATERIAL_UPLOADED:     'MATERIAL_UPLOADED',
  MATERIAL_DELETED:      'MATERIAL_DELETED',
  ATTENDANCE_MARKED:     'ATTENDANCE_MARKED',
  MARKS_ENTERED:         'MARKS_ENTERED',

  // System
  DB_INITIALIZED:        'DB_INITIALIZED',
};

module.exports = { logAction, getIp, ACTIONS };
