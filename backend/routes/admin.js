// routes/admin.js
const express = require('express');
const router  = express.Router();
const {
  getStats,
  getAllUsers, getUserById, updateUserRole, toggleUserStatus, resetUserPassword,
  getAllClasses, createClass,
  getAllSections, createSection, deleteSection, assignStudentToSection, getSectionStudents,
  getAllTeacherAssignments, createTeacherAssignment, removeTeacherAssignment,
  getAllMarks, getAllAttendance,
  getAuditLogs,
} = require('../controllers/adminController');
const { verifyToken, adminOnly } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(verifyToken, adminOnly);

// Stats
router.get('/stats', getStats);

// Users
router.get('/users',                      getAllUsers);
router.get('/users/:id',                  getUserById);
router.patch('/users/:id/role',           updateUserRole);
router.patch('/users/:id/status',         toggleUserStatus);
router.post('/users/:id/reset-password',  resetUserPassword);

// Classes
router.get('/classes',   getAllClasses);
router.post('/classes',  createClass);

// Sections
router.get('/sections',                     getAllSections);
router.post('/sections',                    createSection);
router.delete('/sections/:id',              deleteSection);
router.post('/sections/:id/assign',         assignStudentToSection);
router.get('/sections/:id/students',        getSectionStudents);

// Teacher assignments (admin can assign teachers)
router.get('/teacher-assignments',          getAllTeacherAssignments);
router.post('/teacher-assignments',         createTeacherAssignment);
router.delete('/teacher-assignments',       removeTeacherAssignment);

// Admin view: all marks, all attendance
router.get('/marks',        getAllMarks);
router.get('/attendance',   getAllAttendance);

// Audit logs
router.get('/audit-logs', getAuditLogs);

module.exports = router;
