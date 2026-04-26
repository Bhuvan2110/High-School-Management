// controllers/teacherController.js

const TeacherSubject = require('../models/TeacherSubject');
const Attendance     = require('../models/Attendance');
const Marks          = require('../models/Marks');
const Material       = require('../models/Material');
const Notification   = require('../models/Notification');
const User           = require('../models/User');
const Subject        = require('../models/Subject');
const Section        = require('../models/Section');
const { sendSuccess, sendCreated, sendNotFound, sendForbidden, sendValidationError, sendServerError } = require('../utils/response');

// ── GET /api/teachers/dashboard  ─────────────────────────────
const getDashboard = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const [assignments, materials, unreadCount] = await Promise.all([
      TeacherSubject.getByTeacher(teacherId),
      Material.getByTeacher(teacherId),
      Notification.countUnread(teacherId),
    ]);

    // Unique subjects and sections
    const uniqueSubjects = [...new Map(assignments.map(a => [a.subject_id, a])).values()];
    const uniqueSections = [...new Map(assignments.map(a => [a.section_id, a])).values()];

    // Count distinct students across all assigned sections
    let studentSet = new Set();
    for (const a of assignments) {
      const students = await Section.getStudents(a.section_id);
      students.forEach(s => studentSet.add(s.id));
    }

    return sendSuccess(res, {
      stats: {
        subjects:       uniqueSubjects.length,
        sections:       uniqueSections.length,
        students:       studentSet.size,
        materials:      materials.length,
        notifications:  unreadCount,
      },
      assignments,
      recent_materials: materials.slice(0, 5),
    });
  } catch (err) {
    console.error('[getDashboard]', err.message);
    return sendServerError(res);
  }
};

// ── GET /api/teachers/my-subjects  ───────────────────────────
const getMySubjects = async (req, res) => {
  try {
    const assignments = await TeacherSubject.getByTeacher(req.user.id);
    // Group by subject
    const grouped = {};
    for (const a of assignments) {
      if (!grouped[a.subject_id]) {
        grouped[a.subject_id] = {
          subject_id:   a.subject_id,
          subject_name: a.subject_name,
          sections:     [],
        };
      }
      grouped[a.subject_id].sections.push({
        section_id:   a.section_id,
        section_name: a.section_name,
        class_name:   a.class_name,
        class_id:     a.class_id,
      });
    }
    return sendSuccess(res, { subjects: Object.values(grouped) });
  } catch (err) {
    console.error('[getMySubjects]', err.message);
    return sendServerError(res);
  }
};

// ── GET /api/teachers/students?subject_id=  ───────────────────
// Returns students the teacher can mark attendance / enter marks for
const getMyStudents = async (req, res) => {
  try {
    const { subject_id } = req.query;
    if (!subject_id) return sendValidationError(res, ['subject_id query param required']);

    // Verify assignment
    const assignments = await TeacherSubject.getByTeacher(req.user.id);
    if (!assignments.some(a => a.subject_id === parseInt(subject_id))) {
      return sendForbidden(res, 'You are not assigned to this subject');
    }

    const students = await TeacherSubject.getStudentsForTeacherSubject(req.user.id, parseInt(subject_id));
    return sendSuccess(res, { students, total: students.length });
  } catch (err) {
    console.error('[getMyStudents]', err.message);
    return sendServerError(res);
  }
};

// ── POST /api/teachers/assign  ────────────────────────────────
// Admin assigns a teacher to subject + section
const assignTeacher = async (req, res) => {
  try {
    const { teacher_id, subject_id, section_id } = req.body;
    if (!teacher_id || !subject_id || !section_id) {
      return sendValidationError(res, ['teacher_id, subject_id, section_id are all required']);
    }

    const teacher = await User.findById(teacher_id);
    if (!teacher || teacher.role !== 'teacher') return sendNotFound(res, 'Teacher');

    await TeacherSubject.assign(teacher_id, parseInt(subject_id), parseInt(section_id));
    return sendCreated(res, null, `Teacher "${teacher.name}" assigned successfully`);
  } catch (err) {
    console.error('[assignTeacher]', err.message);
    return sendServerError(res);
  }
};

// ── DELETE /api/teachers/assign  ─────────────────────────────
const removeTeacherAssignment = async (req, res) => {
  try {
    const { teacher_id, subject_id, section_id } = req.body;
    await TeacherSubject.remove(teacher_id, parseInt(subject_id), parseInt(section_id));
    return sendSuccess(res, null, 'Assignment removed');
  } catch (err) {
    console.error('[removeTeacherAssignment]', err.message);
    return sendServerError(res);
  }
};

// ── GET /api/teachers/all-assignments  ────────────────────────
// Admin view of all teacher assignments
const getAllAssignments = async (req, res) => {
  try {
    const assignments = await TeacherSubject.getAll();
    return sendSuccess(res, { assignments });
  } catch (err) {
    console.error('[getAllAssignments]', err.message);
    return sendServerError(res);
  }
};

module.exports = {
  getDashboard, getMySubjects, getMyStudents,
  assignTeacher, removeTeacherAssignment, getAllAssignments,
};
