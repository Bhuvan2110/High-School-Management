// routes/subjects.js
const express = require('express');
const router  = express.Router();
const { getAllSubjects, getSubjectById, createSubject, updateSubject, deleteSubject } = require('../controllers/subjectController');
const { verifyToken, adminOnly, allRoles } = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

router.get('/',    allRoles,   getAllSubjects);   // All roles can view
router.get('/:id', allRoles,   getSubjectById);
router.post('/',   adminOnly,  createSubject);    // Admin ONLY
router.put('/:id', adminOnly,  updateSubject);    // Admin ONLY
router.delete('/:id', adminOnly, deleteSubject);  // Admin ONLY

module.exports = router;
