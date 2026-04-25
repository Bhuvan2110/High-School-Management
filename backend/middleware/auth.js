// middleware/auth.js
// Two middlewares:
//  1. verifyToken   — checks JWT is valid, attaches user to req
//  2. requireRole   — checks user has the required role(s)

const { verifyAccessToken } = require('../utils/jwt');
const { sendUnauthorized, sendForbidden } = require('../utils/response');

/**
 * verifyToken
 * Reads the JWT from the Authorization header (Bearer <token>)
 * or from the httpOnly cookie named 'accessToken'
 * Attaches decoded payload to req.user
 */
const verifyToken = (req, res, next) => {
  try {
    // 1. Try cookie first (preferred — httpOnly cookies are XSS-safe)
    let token = req.cookies?.accessToken;

    // 2. Fall back to Authorization header
    if (!token) {
      const authHeader = req.headers['authorization'] || req.headers['Authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return sendUnauthorized(res, 'No authentication token provided');
    }

    // Verify signature + expiry
    const decoded = verifyAccessToken(token);
    req.user = decoded; // { id, role, name, iat, exp }
    next();

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendUnauthorized(res, 'Token has expired — please log in again');
    }
    if (err.name === 'JsonWebTokenError') {
      return sendUnauthorized(res, 'Invalid token');
    }
    return sendUnauthorized(res, 'Authentication failed');
  }
};

/**
 * requireRole(...roles)
 * Factory that returns middleware enforcing role-based access
 *
 * Usage:
 *   router.post('/subjects', verifyToken, requireRole('admin'), createSubject)
 *   router.get('/dashboard', verifyToken, requireRole('admin', 'teacher'), getDashboard)
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendUnauthorized(res, 'Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      return sendForbidden(
        res,
        `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`
      );
    }

    next();
  };
};

// Convenience exports for common role combinations
const adminOnly    = requireRole('admin');
const teacherOnly  = requireRole('teacher');
const studentOnly  = requireRole('student');
const adminOrTeacher = requireRole('admin', 'teacher');
const allRoles     = requireRole('admin', 'teacher', 'student');

module.exports = {
  verifyToken,
  requireRole,
  adminOnly,
  teacherOnly,
  studentOnly,
  adminOrTeacher,
  allRoles,
};
