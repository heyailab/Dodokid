// auditAdmin.service.js
// Shared audit writer for all admin services (Spec 14.4 event list, AC-14).
// Every entry carries actorRole/targetType/targetId/before/after/ip/ts.
// User-target snapshots are stripped of passwordHash before persisting.

const auditRepo = require('../../repositories/auditAdmin.repo');

const SENSITIVE_FIELDS = ['passwordHash'];

function sanitizeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot === undefined ? null : snapshot;
  const clone = Object.assign({}, snapshot);
  SENSITIVE_FIELDS.forEach((f) => {
    if (f in clone) clone[f] = '[redacted]';
  });
  return clone;
}

async function writeAudit(entry) {
  return auditRepo.write({
    actor: entry.actor,
    actorRole: entry.actorRole,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId || null,
    before: sanitizeSnapshot(entry.before),
    after: sanitizeSnapshot(entry.after),
    ip: entry.ip || null,
  });
}

// Content snapshot kept small for the before/after columns: identity plus the
// fields an operator needs to reconstruct what changed (ADR-006 traceability).
function contentAuditView(item) {
  if (!item) return null;
  return {
    title: item.title,
    status: item.status,
    version: item.version,
    moduleKey: item.moduleKey,
    isSample: !!item.isSample, // v1.2.1: included so audits show flag diffs
    updatedAt: item.updatedAt,
  };
}

async function listAudit(filters, page, limit) {
  const { items, total } = await auditRepo.listAudit(filters, page, limit);
  return { items, meta: buildMeta(total, page, limit) };
}

function buildMeta(total, page, limit) {
  return {
    total,
    page,
    limit,
    hasMore: page * limit < total,
  };
}

module.exports = { writeAudit, contentAuditView, listAudit, buildMeta };
