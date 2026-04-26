// routes/marks.js
const express = require('express');
const router  = express.Router();
const { enterMarks, getMarksBySubject, getStudentMarks, getMyResults } = require('../controllers/marksController');
const { verifyToken, adminOrTeacher, allRoles, studentOnly } = require('../middleware/auth');

router.use(verifyToken);
router.post('/',                   adminOrTeacher, enterMarks);
router.get('/my-results',          studentOnly,    getMyResults);
router.get('/subject/:id',         adminOrTeacher, getMarksBySubject);
router.get('/student/:id',         allRoles,       getStudentMarks);

module.exports = router;
