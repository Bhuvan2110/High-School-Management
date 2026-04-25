// middleware/errorHandler.js
// Global Express error handler — must be registered LAST in app.js

const { sendServerError } = require('../utils/response');

/**
 * Global error handler
 * Called when next(err) is invoked anywhere in the app
 * Ensures errors never expose raw stack traces to clients
 */
const errorHandler = (err, req, res, next) => {
  // Log full error internally
  console.error('━━━ UNHANDLED ERROR ━━━');
  console.error('Route  :', req.method, req.originalUrl);
  console.error('User   :', req.user?.id || 'unauthenticated');
  console.error('Message:', err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error('Stack  :', err.stack);
  }

  // MySQL / database errors
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'A record with this value already exists',
    });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      message: 'Referenced record does not exist',
    });
  }

  // Multer file upload errors (Phase 3)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File is too large. Maximum size is 10MB',
    });
  }

  // Generic fallback — never expose internals
  const status  = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred'
    : err.message || 'An unexpected error occurred';

  return res.status(status).json({ success: false, message });
};

/**
 * 404 handler — for routes that don't exist
 * Register this BEFORE errorHandler
 */
const notFoundHandler = (req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

module.exports = { errorHandler, notFoundHandler };
