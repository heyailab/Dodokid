// adminAuth.js
// Authentication middleware for the operations console (ADR-005).
// Triple check, any failure -> 401:
//   1. JWT audience must be "admin" (parent tokens carry aud "app" and can
//      never enter the console, even if their role claim was tampered with).
//   2. The user role must be editor or admin (parent is rejected).
//   3. The user status must be "active" (checked against the DB on every
//      request so disabling an account takes effect immediately).
// On success it attaches ctx.adminUser = { id, role, phone } and ctx.clientIp.

const jwt = require('../utils/jwt');
const errors = require('../utils/errors');
const { extractToken } = require('./auth');
const { getClientIp } = require('../utils/request');
const usersRepo = require('../repositories/users.repo');

const OPS_ROLES = ['editor', 'admin'];

async function adminAuthMiddleware(ctx) {
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
  if (payload.aud !== 'admin') {
    throw errors.unauthorized('Admin token required');
  }
  const user = await usersRepo.getById(payload.uid);
  if (!user || !OPS_ROLES.includes(user.role)) {
    throw errors.unauthorized('Not an operations account');
  }
  if (user.status !== 'active') {
    throw errors.unauthorized('Account is disabled');
  }
  ctx.adminUser = { id: user._id, role: user.role, phone: user.phone };
  ctx.clientIp = getClientIp(ctx.req.headers);
}

module.exports = { adminAuthMiddleware, OPS_ROLES };
