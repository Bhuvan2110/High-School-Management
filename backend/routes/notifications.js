// routes/notifications.js
const express = require('express');
const router  = express.Router();
const { getMyNotifications, markOneRead, markAllRead, deleteNotification, broadcast } = require('../controllers/notificationController');
const { verifyToken, allRoles, adminOnly } = require('../middleware/auth');

router.use(verifyToken);
router.get('/',                        allRoles,   getMyNotifications);
router.patch('/mark-all-read',         allRoles,   markAllRead);
router.patch('/:id/read',              allRoles,   markOneRead);
router.delete('/:id',                  allRoles,   deleteNotification);
router.post('/broadcast',              adminOnly,  broadcast);

module.exports = router;
