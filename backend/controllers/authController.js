// controllers/authController.js
// Handles: register, login, logout, refresh token, get current user

const bcrypt    = require('bcryptjs');
const User      = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, getRefreshTokenExpiry } = require('../utils/jwt');
const { validateRegistration, validateLogin, sanitize } = require('../utils/validators');
const { sendSuccess, sendCreated, sendError, sendUnauthorized, sendValidationError, sendConflict, sendServerError } = require('../utils/response');
const { logAction, getIp, ACTIONS } = require('../utils/auditLogger');

require('dotenv').config();

const COOKIE_OPTIONS = {
  httpOnly: true,         // not accessible via JS — XSS protection
  secure:   process.env.NODE_ENV === 'production', // HTTPS only in prod
  sameSite: 'strict',    // CSRF protection
  path:     '/',
};

// ────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ────────────────────────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // 1. Validate input
    const { valid, errors } = validateRegistration({ name, email, password, role });
    if (!valid) return sendValidationError(res, errors);

    // 2. Check for duplicate email
    const exists = await User.emailExists(email);
    if (exists) return sendConflict(res, 'An account with this email already exists');

    // 3. Hash password
    const saltRounds  = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // 4. Create user
    const user = await User.create({
      name: sanitize(name),
      email,
      password_hash,
      role,
    });

    // 5. Audit log
    await logAction({
      userId:     user.id,
      action:     ACTIONS.USER_REGISTER,
      entityType: 'user',
      entityId:   user.id,
      ipAddress:  getIp(req),
      userAgent:  req.headers['user-agent'],
      details:    { role, email },
    });

    return sendCreated(res, {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    }, 'Account created successfully');

  } catch (err) {
    console.error('[register]', err.message);
    return sendServerError(res);
  }
};

// ────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validate input
    const { valid, errors } = validateLogin({ email, password });
    if (!valid) return sendValidationError(res, errors);

    // 2. Find user
    const user = await User.findByEmail(email);
    if (!user) {
      // Log failed attempt before returning
      await logAction({
        action:    ACTIONS.USER_LOGIN_FAILED,
        ipAddress: getIp(req),
        details:   { email, reason: 'user_not_found' },
      });
      // Generic message — don't reveal whether email exists
      return sendUnauthorized(res, 'Invalid email or password');
    }

    // 3. Check account is active
    if (!user.is_active) {
      await logAction({
        userId:    user.id,
        action:    ACTIONS.USER_LOGIN_FAILED,
        ipAddress: getIp(req),
        details:   { reason: 'account_deactivated' },
      });
      return sendUnauthorized(res, 'Your account has been deactivated. Contact admin.');
    }

    // 4. Compare password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      await logAction({
        userId:    user.id,
        action:    ACTIONS.USER_LOGIN_FAILED,
        ipAddress: getIp(req),
        details:   { reason: 'wrong_password' },
      });
      return sendUnauthorized(res, 'Invalid email or password');
    }

    // 5. Generate tokens
    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const expiresAt    = getRefreshTokenExpiry();

    // 6. Store refresh token in DB
    await RefreshToken.create(user.id, refreshToken, expiresAt);

    // 7. Update last login
    await User.updateLastLogin(user.id);

    // 8. Set tokens as HttpOnly cookies
    res.cookie('accessToken',  accessToken,  { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });         // 15 min
    res.cookie('refreshToken', refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 }); // 7 days

    // 9. Audit log
    await logAction({
      userId:     user.id,
      action:     ACTIONS.USER_LOGIN,
      entityType: 'user',
      entityId:   user.id,
      ipAddress:  getIp(req),
      userAgent:  req.headers['user-agent'],
    });

    return sendSuccess(res, {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken, // also send in body for localStorage fallback
    }, 'Login successful');

  } catch (err) {
    console.error('[login]', err.message);
    return sendServerError(res);
  }
};

// ────────────────────────────────────────────────────────────────
// POST /api/auth/refresh
// ────────────────────────────────────────────────────────────────
const refreshAccessToken = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) return sendUnauthorized(res, 'Refresh token not provided');

    // 1. Verify JWT signature
    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      return sendUnauthorized(res, 'Invalid or expired refresh token');
    }

    // 2. Find and validate against DB (rotation check)
    const tokenRecord = await RefreshToken.findAndValidate(decoded.id, token);
    if (!tokenRecord) {
      // Token not in DB or already revoked — possible token theft
      await RefreshToken.revokeAllForUser(decoded.id); // revoke everything as precaution
      return sendUnauthorized(res, 'Refresh token is invalid or has been revoked');
    }

    // 3. Load user
    const user = await User.findById(decoded.id);
    if (!user || !user.is_active) {
      return sendUnauthorized(res, 'User account not found or deactivated');
    }

    // 4. Rotate tokens — revoke old, issue new
    await RefreshToken.revokeById(tokenRecord.id);
    const newAccessToken  = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    const expiresAt       = getRefreshTokenExpiry();
    await RefreshToken.create(user.id, newRefreshToken, expiresAt);

    // 5. Set new cookies
    res.cookie('accessToken',  newAccessToken,  { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', newRefreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });

    await logAction({
      userId: user.id, action: ACTIONS.TOKEN_REFRESHED, ipAddress: getIp(req),
    });

    return sendSuccess(res, { accessToken: newAccessToken }, 'Token refreshed');

  } catch (err) {
    console.error('[refreshAccessToken]', err.message);
    return sendServerError(res);
  }
};

// ────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// ────────────────────────────────────────────────────────────────
const logout = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;

    if (token && req.user?.id) {
      const tokenRecord = await RefreshToken.findAndValidate(req.user.id, token);
      if (tokenRecord) await RefreshToken.revokeById(tokenRecord.id);
    }

    // Clear cookies
    res.clearCookie('accessToken',  { ...COOKIE_OPTIONS });
    res.clearCookie('refreshToken', { ...COOKIE_OPTIONS });

    await logAction({
      userId: req.user?.id, action: ACTIONS.USER_LOGOUT, ipAddress: getIp(req),
    });

    return sendSuccess(res, null, 'Logged out successfully');

  } catch (err) {
    console.error('[logout]', err.message);
    return sendServerError(res);
  }
};

// ────────────────────────────────────────────────────────────────
// GET /api/auth/me
// Returns the currently authenticated user's profile
// ────────────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return sendUnauthorized(res, 'User not found');
    return sendSuccess(res, { user });
  } catch (err) {
    console.error('[getMe]', err.message);
    return sendServerError(res);
  }
};

module.exports = { register, login, refreshAccessToken, logout, getMe };
