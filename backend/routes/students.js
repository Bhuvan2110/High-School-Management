// routes/students.js
const express = require('express');
const router  = express.Router();
const { getProfile, getAvailableSubjects, updateSubjectSelection, getMySubjects } = require('../controllers/studentController');
const { verifyToken, studentOnly } = require('../middleware/auth');

router.use(verifyToken, studentOnly);

router.get('/profile',   getProfile);
router.get('/subjects',  getAvailableSubjects);   // View all available (Admin-created)
router.post('/subjects', updateSubjectSelection); // Select from list — cannot create new
router.get('/my-subjects', getMySubjects);

module.exports = router;
