// crypto.js
// Password hashing helpers for the parent gate.
// Uses scrypt (built into Node) so no extra dependency is required.

const crypto = require('crypto');

function hashPassword(password, salt) {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), useSalt, 64).toString('hex');
  return { salt: useSalt, hash: derived };
}

function verifyPassword(password, salt, hash) {
  if (!salt || !hash) return false;
  const computed = hashPassword(password, salt);
  const a = Buffer.from(computed.hash, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { hashPassword, verifyPassword };
