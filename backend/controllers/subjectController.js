// controllers/subjectController.js
// GET (all roles) | POST, PUT, DELETE (Admin only — enforced by route middleware)

const Subject = require('../models/Subject');
const { validateSubject, sanitize } = require('../utils/validators');
const { sendSuccess, sendCreated, sendError, sendNotFound, sendConflict, sendValidationError, sendServerError } = require('../utils/response');
const { logAction, getIp, ACTIONS } = require('../utils/auditLogger');

// ── GET /api/subjects  ──────────────────────────────────────────
// Public to all authenticated users
const getAllSubjects = async (req, res) => {
  try {
    const includeInactive = req.query.all === 'true' && req.user.role === 'admin';
    const subjects = await Subject.findAll({ includeInactive });
    return sendSuccess(res, { subjects, total: subjects.length });
  } catch (err) {
    console.error('[getAllSubjects]', err.message);
    return sendServerError(res);
  }
};

// ── GET /api/subjects/:id  ──────────────────────────────────────
const getSubjectById = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return sendNotFound(res, 'Subject');
    const studentCount = await Subject.studentCount(subject.id);
    return sendSuccess(res, { subject: { ...subject, student_count: studentCount } });
  } catch (err) {
    console.error('[getSubjectById]', err.message);
    return sendServerError(res);
  }
};

// ── POST /api/subjects  ────────────────────────────────────────
// Admin only
const createSubject = async (req, res) => {
  try {
    const { subject_name } = req.body;
    const { valid, errors } = validateSubject({ subject_name });
    if (!valid) return sendValidationError(res, errors);

    const duplicate = await Subject.nameExists(subject_name);
    if (duplicate) return sendConflict(res, `Subject "${subject_name.trim()}" already exists`);

    const subject = await Subject.create(sanitize(subject_name), req.user.id);

    await logAction({
      userId: req.user.id, action: ACTIONS.SUBJECT_CREATED,
      entityType: 'subject', entityId: subject.id,
      ipAddress: getIp(req),
      details: { subject_name: subject.subject_name },
    });

    return sendCreated(res, { subject }, `Subject "${subject.subject_name}" created successfully`);
  } catch (err) {
    console.error('[createSubject]', err.message);
    return sendServerError(res);
  }
};

// ── PUT /api/subjects/:id  ─────────────────────────────────────
// Admin only
const updateSubject = async (req, res) => {
  try {
    const existing = await Subject.findById(req.params.id);
    if (!existing) return sendNotFound(res, 'Subject');

    const { subject_name } = req.body;
    const { valid, errors } = validateSubject({ subject_name });
    if (!valid) return sendValidationError(res, errors);

    const duplicate = await Subject.nameExists(subject_name, existing.id);
    if (duplicate) return sendConflict(res, `Subject "${subject_name.trim()}" already exists`);

    const updated = await Subject.update(existing.id, sanitize(subject_name));

    await logAction({
      userId: req.user.id, action: ACTIONS.SUBJECT_UPDATED,
      entityType: 'subject', entityId: existing.id,
      ipAddress: getIp(req),
      details: { old: existing.subject_name, new: updated.subject_name },
    });

    return sendSuccess(res, { subject: updated }, 'Subject updated successfully');
  } catch (err) {
    console.error('[updateSubject]', err.message);
    return sendServerError(res);
  }
};

// ── DELETE /api/subjects/:id  ──────────────────────────────────
// Admin only — soft deletes if students exist, hard deletes otherwise
const deleteSubject = async (req, res) => {
  try {
    const existing = await Subject.findById(req.params.id);
    if (!existing) return sendNotFound(res, 'Subject');

    const count = await Subject.studentCount(existing.id);

    if (count > 0) {
      // Soft delete — preserve student history
      await Subject.deactivate(existing.id);
      await logAction({
        userId: req.user.id, action: ACTIONS.SUBJECT_DELETED,
        entityType: 'subject', entityId: existing.id,
        ipAddress: getIp(req),
        details: { subject_name: existing.subject_name, type: 'soft_delete', student_count: count },
      });
      return sendSuccess(res, null,
        `Subject deactivated (${count} student(s) had selected it — data preserved)`);
    } else {
      await Subject.delete(existing.id);
      await logAction({
        userId: req.user.id, action: ACTIONS.SUBJECT_DELETED,
        entityType: 'subject', entityId: existing.id,
        ipAddress: getIp(req),
        details: { subject_name: existing.subject_name, type: 'hard_delete' },
      });
      return sendSuccess(res, null, `Subject "${existing.subject_name}" permanently deleted`);
    }
  } catch (err) {
    console.error('[deleteSubject]', err.message);
    if (err.message.includes('Cannot delete')) return sendError(res, err.message, 409);
    return sendServerError(res);
  }
};

module.exports = { getAllSubjects, getSubjectById, createSubject, updateSubject, deleteSubject };
