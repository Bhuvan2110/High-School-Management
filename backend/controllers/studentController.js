// controllers/studentController.js
// Student-facing endpoints: profile, subject selection, section info

const User           = require('../models/User');
const Subject        = require('../models/Subject');
const StudentSubject = require('../models/StudentSubject');
const { pool }       = require('../config/db');
const { sendSuccess, sendError, sendNotFound, sendServerError } = require('../utils/response');
const { logAction, getIp, ACTIONS } = require('../utils/auditLogger');

// GET /api/students/profile
const getProfile = async (req, res) => {
  try {
    const student = await User.findById(req.user.id);
    if (!student) return sendNotFound(res, 'Student');

    // Get section info
    const [sectionRows] = await pool.execute(
      `SELECT s.id, s.section_name, c.class_name, c.id AS class_id
       FROM student_sections ss
       JOIN sections s ON s.id = ss.section_id
       JOIN classes c ON c.id = s.class_id
       WHERE ss.student_id = ? LIMIT 1`,
      [req.user.id]
    );
    const section = sectionRows[0] || null;

    // Get selected subjects
    const subjects = await StudentSubject.getByStudent(req.user.id);

    return sendSuccess(res, { student, section, subjects });
  } catch (err) {
    console.error('[getProfile]', err.message);
    return sendServerError(res);
  }
};

// GET /api/students/subjects
// Returns Admin-created subjects with selection status
const getAvailableSubjects = async (req, res) => {
  try {
    const [allSubjects, mySubjects] = await Promise.all([
      Subject.findAll(),
      StudentSubject.getByStudent(req.user.id),
    ]);
    const selectedIds = new Set(mySubjects.map(s => s.id));
    const subjects = allSubjects.map(s => ({
      ...s,
      is_selected: selectedIds.has(s.id),
    }));
    return sendSuccess(res, { subjects });
  } catch (err) {
    console.error('[getAvailableSubjects]', err.message);
    return sendServerError(res);
  }
};

// POST /api/students/subjects
// Body: { subject_ids: [1, 2, 3] }  — replaces entire selection
const updateSubjectSelection = async (req, res) => {
  try {
    const { subject_ids } = req.body;

    if (!Array.isArray(subject_ids)) {
      return sendError(res, 'subject_ids must be an array', 400);
    }

    // Validate all IDs exist and are active
    const allSubjects = await Subject.findAll();
    const validIds = new Set(allSubjects.map(s => s.id));
    const invalid = subject_ids.filter(id => !validIds.has(parseInt(id)));

    if (invalid.length > 0) {
      return sendError(res, `Invalid or inactive subject IDs: ${invalid.join(', ')}. Students can only select Admin-created subjects.`, 400);
    }

    await StudentSubject.replaceAll(req.user.id, subject_ids.map(Number));

    // Log each selection
    await logAction({
      userId: req.user.id, action: ACTIONS.SUBJECT_SELECTED,
      entityType: 'student_subjects', entityId: req.user.id,
      ipAddress: getIp(req),
      details: { selected_count: subject_ids.length, subject_ids },
    });

    const updated = await StudentSubject.getByStudent(req.user.id);
    return sendSuccess(res, { subjects: updated }, `${updated.length} subject(s) selected successfully`);
  } catch (err) {
    console.error('[updateSubjectSelection]', err.message);
    return sendServerError(res);
  }
};

// GET /api/students/my-subjects
const getMySubjects = async (req, res) => {
  try {
    const subjects = await StudentSubject.getByStudent(req.user.id);
    return sendSuccess(res, { subjects });
  } catch (err) {
    console.error('[getMySubjects]', err.message);
    return sendServerError(res);
  }
};

module.exports = { getProfile, getAvailableSubjects, updateSubjectSelection, getMySubjects };
