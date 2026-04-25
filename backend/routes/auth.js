// routes/auth.js
const express = require('express');
const router  = express.Router();
const rateLimit = require('express-rate-limit');

const { register, login, refreshAccessToken, logout, getMe } = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// Strict rate limit on auth endpoints — 5 attempts per 15 min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5,
  message:  { success: false, message: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// Public routes
router.post('/register', authLimiter, register);
router.post('/login',    authLimiter, login);
router.post('/refresh',  refreshAccessToken);

// Protected routes
router.post('/logout', verifyToken, logout);
router.get('/me',      verifyToken, getMe);

module.exports = router;
