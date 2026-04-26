// controllers/notificationController.js

const Notification = require('../models/Notification');
const User         = require('../models/User');
const { broadcastNotify } = require('../utils/notificationService');
const { sendSuccess, sendError, sendNotFound, sendValidationError, sendServerError } = require('../utils/response');

// ── GET /api/notifications  ───────────────────────────────────
const getMyNotifications = async (req, res) => {
  try {
    const { unread } = req.query;
    const notifications = await Notification.getByUser(req.user.id, {
      unreadOnly: unread === 'true',
      limit: 50,
    });
    const unreadCount = await Notification.countUnread(req.user.id);
    return sendSuccess(res, { notifications, unread_count: unreadCount });
  } catch (err) {
    console.error('[getMyNotifications]', err.message);
    return sendServerError(res);
  }
};

// ── PATCH /api/notifications/:id/read  ────────────────────────
const markOneRead = async (req, res) => {
  try {
    await Notification.markRead(req.params.id, req.user.id);
    return sendSuccess(res, null, 'Notification marked as read');
  } catch (err) {
    console.error('[markOneRead]', err.message);
    return sendServerError(res);
  }
};

// ── PATCH /api/notifications/mark-all-read  ───────────────────
const markAllRead = async (req, res) => {
  try {
    await Notification.markAllRead(req.user.id);
    return sendSuccess(res, null, 'All notifications marked as read');
  } catch (err) {
    console.error('[markAllRead]', err.message);
    return sendServerError(res);
  }
};

// ── DELETE /api/notifications/:id  ───────────────────────────
const deleteNotification = async (req, res) => {
  try {
    await Notification.delete(req.params.id, req.user.id);
    return sendSuccess(res, null, 'Notification deleted');
  } catch (err) {
    console.error('[deleteNotification]', err.message);
    return sendServerError(res);
  }
};

// ── POST /api/notifications/broadcast  ────────────────────────
// Admin only: send an announcement to a whole role group
const broadcast = async (req, res) => {
  try {
    const { title, message, target_role } = req.body;
    if (!title?.trim())   return sendValidationError(res, ['title is required']);
    if (!message?.trim()) return sendValidationError(res, ['message is required']);

    const validRoles = ['admin', 'teacher', 'student', 'all'];
    if (!validRoles.includes(target_role)) {
      return sendValidationError(res, [`target_role must be one of: ${validRoles.join(', ')}`]);
    }

    // Fetch target user IDs
    let users;
    if (target_role === 'all') {
      users = await User.findAll({ limit: 1000 });
    } else {
      users = await User.findAll({ role: target_role, limit: 1000 });
    }

    const recipientIds = users.map(u => u.id).filter(id => id !== req.user.id);
    if (!recipientIds.length) return sendError(res, 'No recipients found for this role', 400);

    await broadcastNotify({
      recipientIds,
      senderIdField: req.user.id,
      title:         title.trim(),
      message:       message.trim(),
      type:          'announcement',
    });

    return sendSuccess(res, { sent_to: recipientIds.length },
      `Announcement sent to ${recipientIds.length} user(s)`);
  } catch (err) {
    console.error('[broadcast]', err.message);
    return sendServerError(res);
  }
};

module.exports = { getMyNotifications, markOneRead, markAllRead, deleteNotification, broadcast };
