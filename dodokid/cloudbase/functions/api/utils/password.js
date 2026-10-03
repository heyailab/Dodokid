// password.js
// Bcrypt password hashing for operations-console accounts (ADR-005 section 5).
// Only editor/admin users carry a passwordHash; parent users always have
// passwordHash=null and the field is never returned by any API response.

const bcrypt = require('bcryptjs');

const ROUNDS = 10;

async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be a string of at least 8 characters');
  }
  return bcrypt.hash(password, ROUNDS);
}

async function verifyPassword(password, hash) {
  if (!hash || typeof password !== 'string') return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch (e) {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
