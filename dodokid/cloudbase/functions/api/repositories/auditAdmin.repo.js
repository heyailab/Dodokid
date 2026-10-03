// auditAdmin.repo.js
// Data access for audit_log (v0.2 fields per Spec 6.1: actorRole, targetType,
// targetId, before, after, ip). Write path is shared by all admin services;
// the read path backs GET /admin/audit.

const base = require('./base.repo');

const NAME = 'audit_log';

const write = (entry) => base.insert(NAME, Object.assign({ ts: new Date().toISOString() }, entry));

async function listAudit(filters, page, limit) {
  const where = {};
  if (filters.actor) where.actor = filters.actor;
  if (filters.action) where.action = filters.action;
  if (filters.targetType) where.targetType = filters.targetType;
  if (filters.targetId) where.targetId = filters.targetId;
  const range = {};
  if (filters.from) range.$gte = filters.from;
  if (filters.to) range.$lte = filters.to;
  if (Object.keys(range).length > 0) where.ts = range;
  const items = await base.findWhere(NAME, where, {
    orderBy: { field: 'ts', dir: 'desc' },
    skip: (page - 1) * limit,
    limit,
  });
  const total = await base.countWhere(NAME, where);
  return { items, total };
}

const listRecent = (limit) =>
  base.findWhere(NAME, {}, { orderBy: { field: 'ts', dir: 'desc' }, limit });

module.exports = { NAME, write, listAudit, listRecent };
