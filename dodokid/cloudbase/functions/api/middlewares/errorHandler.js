// errorHandler.js
// Unified error handler. Maps AppError instances to the standard response
// contract; unexpected errors are logged and returned as a generic 500.

const errors = require('../utils/errors');
const { fail } = require('../utils/response');

function handleError(err) {
  if (err instanceof errors.AppError) {
    return fail(err.code, err.message, err.details);
  }
  console.error('Unhandled error', err);
  return fail(errors.CODES.INTERNAL.code, 'Internal server error');
}

module.exports = { handleError };
