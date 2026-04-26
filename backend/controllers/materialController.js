// controllers/materialController.js

const path           = require('path');
const Material       = require('../models/Material');
const Subject        = require('../models/Subject');
const TeacherSubject = require('../models/TeacherSubject');
const { deleteFile, getFileType } = require('../middleware/upload');
const { notify }     = require('../utils/notificationService');
const StudentSubject = require('../models/StudentSubject');
const { sendSuccess, sendCreated, sendError, sendForbidden, sendNotFound, sendValidationError, sendServerError } = require('../utils/response');
const { logAction, getIp, ACTIONS } = require('../utils/auditLogger');

// ── POST /api/materials  ──────────────────────────────────────
// Teacher uploads a study material file
const uploadMaterial = async (req, res) => {
  try {
    if (!req.file) return sendValidationError(res, ['No file uploaded']);

    const { subject_id, title, description } = req.body;

    if (!subject_id)          return sendValidationError(res, ['subject_id is required']);
    if (!title?.trim())       return sendValidationError(res, ['title is required']);

    // Check subject exists
    const subject = await Subject.findById(subject_id);
    if (!subject) {
      deleteFile(req.file.path);
      return sendNotFound(res, 'Subject');
    }

    // Teacher must be assigned to the subject
    if (req.user.role === 'teacher') {
      const assignments = await TeacherSubject.getByTeacher(req.user.id);
      if (!assignments.some(a => a.subject_id === parseInt(subject_id))) {
        deleteFile(req.file.path);
        return sendForbidden(res, 'You are not assigned to this subject');
      }
    }

    const material = await Material.create({
      subject_id:   parseInt(subject_id),
      teacher_id:   req.user.id,
      title:        title.trim(),
      description:  description?.trim() || null,
      file_path:    req.file.path,
      file_name:    req.file.originalname,
      file_type:    getFileType(req.file.mimetype),
      file_size_kb: Math.round(req.file.size / 1024),
    });

    // Notify all students who selected this subject
    try {
      const students = await StudentSubject.getBySubject(parseInt(subject_id));
      if (students.length) {
        const { broadcastNotify } = require('../utils/notificationService');
        await broadcastNotify({
          recipientIds:  students.map(s => s.student_id),
          senderIdField: req.user.id,
          title:         `New Material: ${subject.subject_name}`,
          message:       `"${title.trim()}" has been uploaded for ${subject.subject_name}.`,
          type:          'assignment',
        });
      }
    } catch { /* notifications are non-blocking */ }

    await logAction({
      userId: req.user.id, action: ACTIONS.MATERIAL_UPLOADED,
      entityType: 'material', entityId: material.id,
      ipAddress: getIp(req),
      details: { title, subject_id, file_type: material.file_type, file_size_kb: material.file_size_kb },
    });

    return sendCreated(res, { material }, 'Material uploaded successfully');
  } catch (err) {
    if (req.file) deleteFile(req.file.path);
    console.error('[uploadMaterial]', err.message);
    return sendServerError(res);
  }
};

// ── GET /api/materials/subject/:id  ───────────────────────────
const getMaterialsBySubject = async (req, res) => {
  try {
    const materials = await Material.getBySubject(req.params.id);
    return sendSuccess(res, { materials });
  } catch (err) {
    console.error('[getMaterialsBySubject]', err.message);
    return sendServerError(res);
  }
};

// ── GET /api/materials/my-materials  ─────────────────────────
// For teachers: their own uploads | For students: materials for their subjects
const getMyMaterials = async (req, res) => {
  try {
    let materials;
    if (req.user.role === 'teacher') {
      materials = await Material.getByTeacher(req.user.id);
    } else {
      materials = await Material.getForStudent(req.user.id);
    }
    return sendSuccess(res, { materials });
  } catch (err) {
    console.error('[getMyMaterials]', err.message);
    return sendServerError(res);
  }
};

// ── GET /api/materials/:id/download  ─────────────────────────
const downloadMaterial = async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) return sendNotFound(res, 'Material');

    // Students can only download materials for their selected subjects
    if (req.user.role === 'student') {
      const mySubjects = await StudentSubject.getByStudent(req.user.id);
      const mySubjectIds = new Set(mySubjects.map(s => s.id));
      if (!mySubjectIds.has(material.subject_id)) {
        return sendForbidden(res, 'You have not selected this subject');
      }
    }

    return res.download(material.file_path, material.file_name, (err) => {
      if (err) {
        console.error('[downloadMaterial]', err.message);
        if (!res.headersSent) return sendNotFound(res, 'File');
      }
    });
  } catch (err) {
    console.error('[downloadMaterial]', err.message);
    return sendServerError(res);
  }
};

// ── DELETE /api/materials/:id  ────────────────────────────────
const deleteMaterial = async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) return sendNotFound(res, 'Material');

    // Teachers can only delete their own uploads; admin can delete any
    if (req.user.role === 'teacher' && material.teacher_id !== req.user.id) {
      return sendForbidden(res, 'You can only delete your own uploads');
    }

    deleteFile(material.file_path);
    await Material.delete(material.id);

    await logAction({
      userId: req.user.id, action: ACTIONS.MATERIAL_DELETED,
      entityType: 'material', entityId: material.id,
      ipAddress: getIp(req),
      details: { title: material.title, subject_id: material.subject_id },
    });

    return sendSuccess(res, null, 'Material deleted successfully');
  } catch (err) {
    console.error('[deleteMaterial]', err.message);
    return sendServerError(res);
  }
};

module.exports = { uploadMaterial, getMaterialsBySubject, getMyMaterials, downloadMaterial, deleteMaterial };
