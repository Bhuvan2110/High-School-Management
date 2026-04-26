// routes/teachers.js
const express = require('express');
const router  = express.Router();
const { getDashboard, getMySubjects, getMyStudents, assignTeacher, removeTeacherAssignment, getAllAssignments } = require('../controllers/teacherController');
const { verifyToken, adminOnly, adminOrTeacher } = require('../middleware/auth');

router.use(verifyToken);
router.get('/dashboard',            adminOrTeacher, getDashboard);
router.get('/my-subjects',          adminOrTeacher, getMySubjects);
router.get('/students',             adminOrTeacher, getMyStudents);
router.get('/all-assignments',      adminOnly,      getAllAssignments);
router.post('/assign',              adminOnly,      assignTeacher);
router.delete('/assign',            adminOnly,      removeTeacherAssignment);

module.exports = router;
