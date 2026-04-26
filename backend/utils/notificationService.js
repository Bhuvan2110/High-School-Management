// utils/notificationService.js
// Sends in-app notifications and optional email alerts via Nodemailer

const Notification = require('../models/Notification');
require('dotenv').config();

// ── Nodemailer setup (optional — works without email config) ──
let transporter = null;
try {
  const nodemailer = require('nodemailer');
  if (process.env.EMAIL_HOST && process.env.EMAIL_USER) {
    transporter = nodemailer.createTransport({
      host:   process.env.EMAIL_HOST,
      port:   parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    console.log('✅  Email transporter configured');
  } else {
    console.log('ℹ️   Email not configured (EMAIL_HOST/EMAIL_USER missing) — in-app only');
  }
} catch { /* nodemailer not installed */ }

/**
 * Send an in-app notification + optional email
 * @param {object} opts
 * @param {string}   opts.recipientId  - User ID
 * @param {string}   opts.recipientEmail - For email (optional)
 * @param {string}   opts.senderId     - Sender user ID (null = system)
 * @param {string}   opts.title        - Short notification title
 * @param {string}   opts.message      - Full message body
 * @param {string}   opts.type         - notification type enum
 * @param {boolean}  opts.sendEmail    - Whether to also email
 */
const notify = async ({
  recipientId,
  recipientEmail = null,
  senderId = null,
  title,
  message,
  type = 'system',
  sendEmail = false,
}) => {
  try {
    // 1. In-app notification
    await Notification.create({ recipient_id: recipientId, sender_id: senderId, title, message, type });

    // 2. Email (if configured and requested)
    if (sendEmail && transporter && recipientEmail) {
      await transporter.sendMail({
        from:    `"${process.env.EMAIL_FROM_NAME || 'High School System'}" <${process.env.EMAIL_USER}>`,
        to:      recipientEmail,
        subject: `[School Portal] ${title}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#0D1B2A;padding:24px;border-radius:8px 8px 0 0">
              <h2 style="color:#C9952A;margin:0">🏫 High School Management</h2>
            </div>
            <div style="background:#f7f9fc;padding:24px;border:1px solid #d1dce8;border-top:none;border-radius:0 0 8px 8px">
              <h3 style="color:#0D1B2A">${title}</h3>
              <p style="color:#3D566E;line-height:1.6">${message}</p>
              <hr style="border:none;border-top:1px solid #d1dce8;margin:20px 0"/>
              <small style="color:#7A93AB">This is an automated message from your school portal. Do not reply to this email.</small>
            </div>
          </div>
        `,
      });
    }
  } catch (err) {
    console.error('⚠️  Notification error:', err.message);
    // Never crash main flow due to notification failure
  }
};

/**
 * Broadcast notification to many recipients
 */
const broadcastNotify = async ({
  recipientIds,
  senderIdField,
  title,
  message,
  type = 'announcement',
}) => {
  try {
    await Notification.broadcast({
      recipient_ids: recipientIds,
      sender_id: senderIdField,
      title,
      message,
      type,
    });
  } catch (err) {
    console.error('⚠️  Broadcast notification error:', err.message);
  }
};

module.exports = { notify, broadcastNotify };
