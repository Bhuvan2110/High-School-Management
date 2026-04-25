// utils/jwt.js
// JWT token generation and verification helpers

const jwt = require('jsonwebtoken');
require('dotenv').config();

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES  || '15m';
const REFRESH_EXPIRES= process.env.JWT_REFRESH_EXPIRES || '7d';

/**
 * Generate a short-lived access token (15 min)
 * Payload contains minimal user info needed for RBAC
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id:   user.id,
      role: user.role,
      name: user.name,
    },
    ACCESS_SECRET,
    {
      expiresIn: ACCESS_EXPIRES,
      issuer:    'highschool-mgmt',
      audience:  'highschool-mgmt-client',
    }
  );
};

/**
 * Generate a long-lived refresh token (7 days)
 * Contains only the user ID — minimal payload
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id },
    REFRESH_SECRET,
    {
      expiresIn: REFRESH_EXPIRES,
      issuer:    'highschool-mgmt',
      audience:  'highschool-mgmt-client',
    }
  );
};

/**
 * Verify an access token
 * Returns decoded payload or throws
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, ACCESS_SECRET, {
    issuer:   'highschool-mgmt',
    audience: 'highschool-mgmt-client',
  });
};

/**
 * Verify a refresh token
 * Returns decoded payload or throws
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, REFRESH_SECRET, {
    issuer:   'highschool-mgmt',
    audience: 'highschool-mgmt-client',
  });
};

/**
 * Calculate the expiry Date object for a refresh token
 * so we can store it in the database
 */
const getRefreshTokenExpiry = () => {
  // Parse JWT_REFRESH_EXPIRES (e.g. '7d') → milliseconds
  const str = REFRESH_EXPIRES;
  const unit = str.slice(-1);
  const val  = parseInt(str.slice(0, -1), 10);
  const msMap = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const ms = val * (msMap[unit] || 86400000);
  return new Date(Date.now() + ms);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
};
