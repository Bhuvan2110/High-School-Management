// utils/response.js
// Standardized API response helpers used in every controller
// All API responses follow the same shape for easy frontend handling

/**
 * Send a success response
 * @param {object} res     - Express response object
 * @param {*}      data    - Payload to send
 * @param {string} message - Human-readable success message
 * @param {number} status  - HTTP status code (default 200)
 */
const sendSuccess = (res, data = null, message = 'Success', status = 200) => {
  const response = {
    success: true,
    message,
  };
  if (data !== null) response.data = data;
  return res.status(status).json(response);
};

/**
 * Send a created (201) response
 */
const sendCreated = (res, data = null, message = 'Resource created successfully') => {
  return sendSuccess(res, data, message, 201);
};

/**
 * Send an error response
 * @param {object} res     - Express response object
 * @param {string} message - Human-readable error message
 * @param {number} status  - HTTP status code (default 400)
 * @param {*}      errors  - Additional error details (validation errors etc.)
 */
const sendError = (res, message = 'Something went wrong', status = 400, errors = null) => {
  const response = {
    success: false,
    message,
  };
  if (errors) response.errors = errors;
  // Never expose stack traces in production
  return res.status(status).json(response);
};

/**
 * Send a 401 Unauthorized response
 */
const sendUnauthorized = (res, message = 'Authentication required') => {
  return sendError(res, message, 401);
};

/**
 * Send a 403 Forbidden response
 */
const sendForbidden = (res, message = 'You do not have permission to perform this action') => {
  return sendError(res, message, 403);
};

/**
 * Send a 404 Not Found response
 */
const sendNotFound = (res, resource = 'Resource') => {
  return sendError(res, `${resource} not found`, 404);
};

/**
 * Send a 409 Conflict response (duplicate data)
 */
const sendConflict = (res, message = 'Resource already exists') => {
  return sendError(res, message, 409);
};

/**
 * Send a 422 Unprocessable Entity (validation failure)
 */
const sendValidationError = (res, errors, message = 'Validation failed') => {
  return sendError(res, message, 422, errors);
};

/**
 * Send a 500 Internal Server Error
 */
const sendServerError = (res, message = 'Internal server error') => {
  return sendError(res, message, 500);
};

module.exports = {
  sendSuccess,
  sendCreated,
  sendError,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendConflict,
  sendValidationError,
  sendServerError,
};
