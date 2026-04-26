// controllers/marksController.js

const Marks          = require('../models/Marks');
const TeacherSubject = require('../models/TeacherSubject');
const User           = require('../models/User');
const { notify }     = require('../utils/notificationService');
const { sendSuccess, sendCreated, sendError, sendForbidden, sendNotFound, sendValidationError, sendServerError } = require('../utils/response');
const { logAction, getIp, ACTIONS } = require('../utils/auditLogger');

const VALID_EXAM_TYPES = ['unit_test', 'midterm', 'final', 'assignment', 'quiz'];

// ── POST /api/marks  ───────────────────────────────────────────
// Teacher enters marks for multiple students at once
const enterMarks = async (req, res) => {
  try {
    const { subject_id, exam_type, records } = req.body;
    // records = [{ student_id, marks_value, max_marks?, remarks? }]

    if (!subject_id)                        return sendValidationError(res, ['subject_id is required']);
    if (!VALID_EXAM_TYPES.includes(exam_type))
      return sendValidationError(res, [`exam_type must be one of: ${VALID_EXAM_TYPES.join(', ')}`]);
    if (!Array.isArray(records) || !records.length)
                                            return sendValidationError(res, ['records must be a non-empty array']);

    // Validate each record
    for (const r of records) {
      if (!r.student_id)                    return sendValidationError(res, ['Each record needs student_id']);
      if (r.marks_value === undefined || r.marks_value === null)
                                            return sendValidationError(res, ['Each record needs marks_value']);
      if (isNaN(r.marks_value) || r.marks_value < 0)
                                            return sendValidationError(res, ['marks_value must be a non-negative number']);
      const max = r.max_marks || 100;
      if (r.marks_value > max)             return sendValidationError(res, [`marks_value (${r.marks_value}) cannot exceed max_marks (${max})`]);
    }

    // Teacher assignment check
    if (req.user.role === 'teacher') {
      const assignments = await TeacherSubject.getByTeacher(req.user.id);
      if (!assignments.some(a => a.subject_id === parseInt(subject_id))) {
        return sendForbidden(res, 'You are not assigned to this subject');
      }
    }

    const fullRecords = records.map(r => ({
      ...r,
      subject_id: parseInt(subject_id),
      exam_type,
    }));
    await Marks.upsertBulk(fullRecords, req.user.id);

    // Notify each student their marks were entered
    for (const r of records) {
      const student = await User.findById(r.student_id);
      if (student) {
        await notify({
          recipientId:    r.student_id,
          recipientEmail: student.email,
          senderId:       req.user.id,
          title:          'Marks Published',
          message:        `Your ${exam_type.replace('_', ' ')} marks have been entered. Check your result card.`,
          type:           'marks',
          sendEmail:      false, // enable when email configured
        });
      }
    }

    await logAction({
      userId: req.user.id, action: ACTIONS.MARKS_ENTERED,
      entityType: 'marks', entityId: subject_id,
      ipAddress: getIp(req),
      details: { subject_id, exam_type, count: records.length },
    });

    return sendCreated(res, null, `Marks entered for ${records.length} student(s)`);
  } catch (err) {
    console.error('[enterMarks]', err.message);
    return sendServerError(res);
  }
};

// ── GET /api/marks/subject/:id?exam_type=  ────────────────────
const getMarksBySubject = async (req, res) => {
  try {
    const { id: subjectId } = req.params;
    const { exam_type }     = req.query;

    if (req.user.role === 'teacher') {
      const assignments = await TeacherSubject.getByTeacher(req.user.id);
      if (!assignments.some(a => a.subject_id === parseInt(subjectId))) {
        return sendForbidden(res, 'You are not assigned to this subject');
      }
    }

    const marks = await Marks.getBySubject(subjectId, exam_type || null);
    return sendSuccess(res, { marks, subject_id: subjectId });
  } catch (err) {
    console.error('[getMarksBySubject]', err.message);
    return sendServerError(res);
  }
};

// ── GET /api/marks/student/:id  ───────────────────────────────
const getStudentMarks = async (req, res) => {
  try {
    const { id: studentId } = req.params;

    if (req.user.role === 'student' && req.user.id !== studentId) {
      return sendForbidden(res, 'You can only view your own marks');
    }

    const [marks, resultCard] = await Promise.all([
      Marks.getByStudent(studentId),
      Marks.getResultCard(studentId),
    ]);

    // Overall percentage across all subjects
    const overall = resultCard.length
      ? (resultCard.reduce((s, r) => s + (r.overall_percentage || 0), 0) / resultCard.length).toFixed(1)
      : null;

    return sendSuccess(res, { marks, result_card: resultCard, overall_percentage: overall });
  } catch (err) {
    console.error('[getStudentMarks]', err.message);
    return sendServerError(res);
  }
};

// ── GET /api/marks/my-results  ────────────────────────────────
// Convenience endpoint for the logged-in student
const getMyResults = async (req, res) => {
  try {
    const [marks, resultCard] = await Promise.all([
      Marks.getByStudent(req.user.id),
      Marks.getResultCard(req.user.id),
    ]);
    const overall = resultCard.length
      ? (resultCard.reduce((s, r) => s + (r.overall_percentage || 0), 0) / resultCard.length).toFixed(1)
      : null;
    return sendSuccess(res, { marks, result_card: resultCard, overall_percentage: overall });
  } catch (err) {
    console.error('[getMyResults]', err.message);
    return sendServerError(res);
  }
};

module.exports = { enterMarks, getMarksBySubject, getStudentMarks, getMyResults };
