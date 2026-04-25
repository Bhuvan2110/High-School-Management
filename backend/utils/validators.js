// utils/validators.js
// Pure validation functions — no dependencies, easy to unit test

/**
 * Validate an email address format
 */
const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && re.test(email.trim());
};

/**
 * Validate password strength
 * Rules: min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit, 1 special char
 */
const isStrongPassword = (password) => {
  if (typeof password !== 'string' || password.length < 8) return false;
  const hasUpper   = /[A-Z]/.test(password);
  const hasLower   = /[a-z]/.test(password);
  const hasDigit   = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  return hasUpper && hasLower && hasDigit && hasSpecial;
};

/**
 * Validate that a string is non-empty after trimming
 */
const isNonEmpty = (value) => {
  return typeof value === 'string' && value.trim().length > 0;
};

/**
 * Validate a UUID v4 string
 */
const isValidUUID = (value) => {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return typeof value === 'string' && re.test(value);
};

/**
 * Validate user role
 */
const isValidRole = (role) => {
  return ['admin', 'teacher', 'student'].includes(role);
};

/**
 * Validate class name
 */
const isValidClassName = (name) => {
  return ['8', '9', '10'].includes(String(name));
};

/**
 * Validate section name (single uppercase letter A-Z)
 */
const isValidSectionName = (name) => {
  return typeof name === 'string' && /^[A-Z]$/.test(name.trim().toUpperCase());
};

/**
 * Sanitize a string — trim whitespace, remove HTML tags
 */
const sanitize = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/<[^>]*>/g, '');
};

/**
 * Validate registration payload
 * Returns { valid: boolean, errors: string[] }
 */
const validateRegistration = ({ name, email, password, role }) => {
  const errors = [];

  if (!isNonEmpty(name))           errors.push('Name is required');
  if (name && name.trim().length > 100)
                                   errors.push('Name must be 100 characters or less');
  if (!isValidEmail(email))        errors.push('Valid email address is required');
  if (!isStrongPassword(password)) errors.push(
    'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
  );
  if (!isValidRole(role))          errors.push('Role must be admin, teacher, or student');

  return { valid: errors.length === 0, errors };
};

/**
 * Validate login payload
 */
const validateLogin = ({ email, password }) => {
  const errors = [];
  if (!isValidEmail(email)) errors.push('Valid email address is required');
  if (!password)            errors.push('Password is required');
  return { valid: errors.length === 0, errors };
};

/**
 * Validate subject creation payload
 */
const validateSubject = ({ subject_name }) => {
  const errors = [];
  if (!isNonEmpty(subject_name))          errors.push('Subject name is required');
  if (subject_name && subject_name.trim().length > 100)
                                          errors.push('Subject name must be 100 characters or less');
  return { valid: errors.length === 0, errors };
};

module.exports = {
  isValidEmail,
  isStrongPassword,
  isNonEmpty,
  isValidUUID,
  isValidRole,
  isValidClassName,
  isValidSectionName,
  sanitize,
  validateRegistration,
  validateLogin,
  validateSubject,
};
