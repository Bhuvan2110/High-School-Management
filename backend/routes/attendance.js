// routes/attendance.js
const express = require('express');
const router  = express.Router();
const { markAttendance, getAttendanceBySubjectDate, getStudentAttendance, getClassReport } = require('../controllers/attendanceController');
const { verifyToken, adminOrTeacher, allRoles } = require('../middleware/auth');

router.use(verifyToken);
router.post('/',                              adminOrTeacher, markAttendance);
router.get('/subject/:id',                   adminOrTeacher, getAttendanceBySubjectDate);
router.get('/student/:id',                   allRoles,       getStudentAttendance);
router.get('/report/:subjectId',             adminOrTeacher, getClassReport);

module.exports = router;
