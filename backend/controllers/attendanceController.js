// controllers/attendanceController.js

const Attendance   = require('../models/Attendance');
const TeacherSubject = require('../models/TeacherSubject');
const Section      = require('../models/Section');
const { sendSuccess, sendCreated, sendError, sendForbidden, sendNotFound, sendValidationError, sendServerError } = require('../utils/response');
const { logAction, getIp, ACTIONS } = require('../utils/auditLogger');

// Validate date string YYYY-MM-DD
const isValidDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));

// ── POST /api/attendance  ──────────────────────────────────────
// Teacher marks attendance for all students in a subject on a date
const markAttendance = async (req, res) => {
  try {
    const { subject_id, date, records } = req.body;
    // records = [{ student_id, status: 'present'|'absent'|'late', remarks? }]

    if (!subject_id)       return sendValidationError(res, ['subject_id is required']);
    if (!isValidDate(date)) return sendValidationError(res, ['date must be YYYY-MM-DD']);
    if (!Array.isArray(records) || !records.length)
                           return sendValidationError(res, ['records must be a non-empty array']);

    // Validate every record
    const VALID_STATUS = new Set(['present', 'absent', 'late']);
    for (const r of records) {
      if (!r.student_id)            return sendValidationError(res, ['Each record needs student_id']);
      if (!VALID_STATUS.has(r.status))
                                    return sendValidationError(res, [`Invalid status "${r.status}". Use: present | absent | late`]);
    }

    // Teachers: verify they're assigned to this subject
    if (req.user.role === 'teacher') {
      const assignments = await TeacherSubject.getByTeacher(req.user.id);
      const assigned = assignments.some(a => a.subject_id === parseInt(subject_id));
      if (!assigned) return sendForbidden(res, 'You are not assigned to this subject');
    }

    const fullRecords = records.map(r => ({ ...r, subject_id: parseInt(subject_id), date }));
    await Attendance.markBulk(fullRecords, req.user.id);

    await logAction({
      userId: req.user.id, action: ACTIONS.ATTENDANCE_MARKED,
      entityType: 'attendance', entityId: subject_id,
      ipAddress: getIp(req),
      details: { subject_id, date, count: records.length },
    });

    return sendCreated(res, null, `Attendance marked for ${records.length} student(s) on ${date}`);
  } catch (err) {
    console.error('[markAttendance]', err.message);
    return sendServerError(res);
  }
};

// ── GET /api/attendance/subject/:id?date=YYYY-MM-DD  ──────────
const getAttendanceBySubjectDate = async (req, res) => {
  try {
    const { id: subjectId } = req.params;
    const { date } = req.query;

    if (!isValidDate(date)) return sendValidationError(res, ['date query param required: YYYY-MM-DD']);

    // Teachers check assignment
    if (req.user.role === 'teacher') {
      const assignments = await TeacherSubject.getByTeacher(req.user.id);
      if (!assignments.some(a => a.subject_id === parseInt(subjectId))) {
        return sendForbidden(res, 'You are not assigned to this subject');
      }
    }

    const records = await Attendance.getBySubjectAndDate(subjectId, date);
    const markedDates = await Attendance.getMarkedDates(subjectId);
    return sendSuccess(res, { records, marked_dates: markedDates, date, subject_id: subjectId });
  } catch (err) {
    console.error('[getAttendanceBySubjectDate]', err.message);
    return sendServerError(res);
  }
};

// ── GET /api/attendance/student/:id  ─────────────────────────
// Students can only view their own; teachers/admin can view any
const getStudentAttendance = async (req, res) => {
  try {
    const { id: studentId } = req.params;

    if (req.user.role === 'student' && req.user.id !== studentId) {
      return sendForbidden(res, 'You can only view your own attendance');
    }

    const [records, summary] = await Promise.all([
      Attendance.getByStudent(studentId),
      Attendance.getSummaryByStudent(studentId),
    ]);

    return sendSuccess(res, { records, summary, student_id: studentId });
  } catch (err) {
    console.error('[getStudentAttendance]', err.message);
    return sendServerError(res);
  }
};

// ── GET /api/attendance/report/:subjectId?from=&to=  ─────────
const getClassReport = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { from, to } = req.query;

    if (!isValidDate(from) || !isValidDate(to)) {
      return sendValidationError(res, ['from and to query params required: YYYY-MM-DD']);
    }

    const report = await Attendance.getClassReport(subjectId, from, to);
    return sendSuccess(res, { report, subject_id: subjectId, from, to });
  } catch (err) {
    console.error('[getClassReport]', err.message);
    return sendServerError(res);
  }
};

module.exports = { markAttendance, getAttendanceBySubjectDate, getStudentAttendance, getClassReport };
