// validate.js
// Validation middleware factory. Runs a schema validator against the request
// body and stores the cleaned result on ctx.validated for the controller.
//
// adminOnlyFields(fields) is the role-aware companion (v1.2.1): fields that
// only admins may write are rejected with 40300 for any other role (AC-11
// pattern); for admins the normalized boolean values are copied onto
// ctx.validated. Must be chained AFTER validate (needs ctx.validated) and
// after adminAuth (needs ctx.adminUser).

const errors = require('../utils/errors');

function validate(fn) {
  return (ctx) => {
    ctx.validated = fn(ctx.req.body);
  };
}

function adminOnlyFields(fields) {
  return (ctx) => {
    const body = ctx.req.body || {};
    const present = fields.filter((f) => body[f] !== undefined);
    if (present.length === 0) return;
    const role = ctx.adminUser ? ctx.adminUser.role : null;
    if (role !== 'admin') {
      throw errors.forbidden(
        'Field(s) ' + present.join(', ') + ' can only be set by admin'
      );
    }
    if (ctx.validated && typeof ctx.validated === 'object') {
      present.forEach((f) => {
        ctx.validated[f] = !!body[f];
      });
    }
  };
}

module.exports = { validate, adminOnlyFields };
