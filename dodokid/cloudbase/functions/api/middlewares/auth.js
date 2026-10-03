// auth.js
// Authentication middleware: validates the Bearer JWT, rejects refresh tokens
// used for API access, and checks the revocation blacklist. On success it
// attaches the decoded payload to ctx.user.

const jwt = require('../utils/jwt');
const errors = require('../utils/errors');
const authRepo = require('../repositories/auth.repo');

function extractToken(headers) {
  const h = headers || {};
  const auth = h.authorization || h.Authorization;
  if (!auth) return null;
  const parts = String(auth).split(' ');
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
  return parts[0];
}

async function authMiddleware(ctx) {
  const token = extractToken(ctx.req.headers);
  if (!token) throw errors.unauthorized('Missing authorization token');
  let payload;
  try {
    payload = jwt.verify(token);
  } catch (e) {
    throw errors.unauthorized('Invalid or expired token');
  }
  if (payload.type === 'refresh') {
    throw errors.unauthorized('Refresh token cannot be used for API access');
  }
  const revoked = await authRepo.isRevoked(payload.jti);
  if (revoked) throw errors.unauthorized('Token has been revoked');
  ctx.user = payload;
}

module.exports = { authMiddleware, extractToken };
