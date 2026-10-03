// audit.repo.js
// Data access for the audit log of sensitive operations.
const base = require('./base.repo');
const NAME = 'audit_log';

const write = (actor, action, detail) =>
  base.insert(NAME, {
    actor,
    action,
    detail: detail || null,
    ts: new Date().toISOString(),
  });

module.exports = { NAME, write };
