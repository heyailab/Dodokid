// rbac.js
// Second-layer authorization middleware for the console (ADR-005).
// rbac('editor') passes for editor AND admin (editor+ endpoints).
// rbac('admin') passes for admin only; editor gets 403 (AC-11).

const errors = require('../utils/errors');

function rbac(level) {
  return (ctx) => {
    const user = ctx.adminUser;
    if (!user) throw errors.unauthorized('Admin authentication required');
    if (level === 'admin' && user.role !== 'admin') {
      throw errors.forbidden('Admin role required for this operation');
    }
    // level === 'editor': adminAuth already guaranteed role in {editor, admin}.
  };
}

module.exports = { rbac };
