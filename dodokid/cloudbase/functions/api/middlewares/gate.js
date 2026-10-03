// gate.js
// Parent-gate middleware: required for sensitive settings routes. Verifies the
// short-lived gate token issued by POST /api/v1/parent/gate/verify and confirms
// it belongs to the authenticated account.

const jwt = require('../utils/jwt');
const errors = require('../utils/errors');

function getGateToken(headers) {
  const h = headers || {};
  return h['x-gate-token'] || h['X-Gate-Token'] || null;
}

function gateMiddleware(ctx) {
  if (!ctx.user) throw errors.unauthorized('Authentication required before parent gate');
  const token = getGateToken(ctx.req.headers);
  if (!token) throw errors.forbidden('Parent gate token required');
  let payload;
  try {
    payload = jwt.verify(token);
  } catch (e) {
    throw errors.forbidden('Invalid or expired parent gate token');
  }
  if (payload.scope !== 'gate') {
    throw errors.forbidden('Token is not a parent gate token');
  }
  if (payload.uid !== ctx.user.uid) {
    throw errors.forbidden('Parent gate token does not match account');
  }
  ctx.gate = payload;
}

module.exports = { gateMiddleware, getGateToken };
