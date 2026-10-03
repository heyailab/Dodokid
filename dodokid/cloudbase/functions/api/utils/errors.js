// errors.js
// Application error hierarchy and error code table.
// Business errors carry an HTTP status and a machine-readable code so the
// global error handler can map them to the unified response contract.

const CODES = {
  BAD_REQUEST: { code: 40000, status: 400 },
  UNAUTHORIZED: { code: 40100, status: 401 },
  FORBIDDEN: { code: 40300, status: 403 },
  NOT_FOUND: { code: 40400, status: 404 },
  CONFLICT: { code: 40900, status: 409 },
  RATE_LIMITED: { code: 42900, status: 429 },
  INTERNAL: { code: 50000, status: 500 },
};

class AppError extends Error {
  constructor(type, message, details) {
    super(message);
    this.name = 'AppError';
    const meta = CODES[type] || CODES.INTERNAL;
    this.type = type;
    this.code = meta.code;
    this.status = meta.status;
    this.details = details;
  }
}

function badRequest(message, details) {
  return new AppError('BAD_REQUEST', message, details);
}
function unauthorized(message) {
  return new AppError('UNAUTHORIZED', message || 'Unauthorized');
}
function forbidden(message) {
  return new AppError('FORBIDDEN', message || 'Forbidden');
}
function notFound(message) {
  return new AppError('NOT_FOUND', message || 'Not found');
}
function conflict(message, details) {
  return new AppError('CONFLICT', message, details);
}
function rateLimited(message) {
  return new AppError('RATE_LIMITED', message || 'Too many requests, please retry later');
}
function internal(message) {
  return new AppError('INTERNAL', message || 'Internal server error');
}

module.exports = {
  CODES,
  AppError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  rateLimited,
  internal,
};
