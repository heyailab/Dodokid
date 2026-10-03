// contentWorkflow.service.js
// SINGLE implementation of the content lifecycle state machine (ADR-006).
// Routes/controllers must never duplicate TRANSITIONS; every status change of
// content_items goes through this file. Illegal transitions and edits to
// frozen (in_review) items return 409. All writes are CAS on version.

const errors = require('../../utils/errors');
const contentRepo = require('../../repositories/contentAdmin.repo');
const revisionRepo = require('../../repositories/revision.repo');
const auditService = require('./auditAdmin.service');

// ADR-006 transition table (9 transitions, incl. reEdit/restore and the
// v1.2.0 additions publish/withdraw from design contract 3.4d).
const TRANSITIONS = {
  submit: { from: ['draft'], to: 'in_review', role: 'editor' },
  approve: { from: ['in_review'], to: 'published', role: 'admin' },
  publish: { from: ['draft'], to: 'published', role: 'admin' }, // draft direct-publish
  withdraw: { from: ['in_review'], to: 'draft', role: 'editor' }, // recall from review
  reject: { from: ['in_review'], to: 'draft', role: 'admin' },
  unpublish: { from: ['published'], to: 'archived', role: 'admin' },
  archive: { from: ['draft', 'in_review', 'published'], to: 'archived', role: 'admin' },
  reEdit: { from: ['archived'], to: 'draft', role: 'editor' }, // triggered by PUT
  restore: { from: ['*'], to: 'draft', role: 'admin' }, // revision rollback
};

function allowedActions(status) {
  return Object.keys(TRANSITIONS).filter((a) => {
    const t = TRANSITIONS[a];
    return t.from.includes('*') || t.from.includes(status);
  });
}

// Throws 409 with the current status and the actions that would be legal.
function assertTransition(action, currentStatus) {
  const t = TRANSITIONS[action];
  if (!t) throw errors.internal('Unknown transition: ' + action);
  const legal = t.from.includes('*') || t.from.includes(currentStatus);
  if (!legal) {
    throw errors.conflict(
      'Illegal transition "' + action + '" from status "' + currentStatus +
        '"; allowed actions: ' + (allowedActions(currentStatus).join(', ') || 'none'),
      { currentStatus, allowedActions: allowedActions(currentStatus) }
    );
  }
  return t;
}

async function loadItem(id) {
  const item = await contentRepo.getById(id);
  if (!item) throw errors.notFound('Content item not found');
  return item;
}

// CAS conflict after a lost race: report the server's current version so the
// console can prompt "content was modified by someone else, please refresh".
async function casConflict(id) {
  const fresh = await contentRepo.getById(id);
  throw errors.conflict('Content was modified concurrently, please refresh and retry', {
    currentVersion: fresh ? fresh.version : null,
  });
}

async function snapshotRevision(contentId, version, action, note, authorId) {
  const doc = await contentRepo.getById(contentId);
  await revisionRepo.create({
    contentId,
    version,
    snapshot: doc,
    action,
    note: note || null,
    authorId,
  });
  return doc;
}

function auditFrom(adminUser, ip, action, item) {
  return auditService.writeAudit({
    actor: adminUser.id,
    actorRole: adminUser.role,
    action,
    targetType: 'content_item',
    targetId: item._id,
    before: auditService.contentAuditView(item),
    after: null,
    ip,
  });
}

// --- status transitions -----------------------------------------------------

async function submit(adminUser, ip, id, note) {
  const item = await loadItem(id);
  assertTransition('submit', item.status);
  const newVersion = item.version + 1;
  const applied = await contentRepo.casUpdate(id, item.version, {
    status: 'in_review',
    version: newVersion,
  });
  if (!applied) await casConflict(id);
  const updated = await snapshotRevision(id, newVersion, 'submit', note, adminUser.id); // AC-09
  await auditService.writeAudit({
    actor: adminUser.id,
    actorRole: adminUser.role,
    action: 'admin.content.submit',
    targetType: 'content_item',
    targetId: id,
    before: auditService.contentAuditView(item),
    after: auditService.contentAuditView(updated),
    ip,
  });
  return updated;
}

// Shared publication path for approve (in_review) and publish (draft):
// both set publishedAt, write a revision snapshot and audit (ADR-006).
// publish additionally supports an optional expectedVersion optimistic lock.
async function publishLike(adminUser, ip, id, action, expectedVersion) {
  const item = await loadItem(id);
  assertTransition(action, item.status);
  if (expectedVersion !== undefined && expectedVersion !== null &&
      Number(expectedVersion) !== item.version) {
    throw errors.conflict('Content was modified concurrently, please refresh and retry', {
      currentVersion: item.version,
    });
  }
  const newVersion = item.version + 1;
  const applied = await contentRepo.casUpdate(id, item.version, {
    status: 'published',
    publishedAt: new Date().toISOString(),
    reviewerId: adminUser.id,
    version: newVersion,
  });
  if (!applied) await casConflict(id);
  const updated = await snapshotRevision(id, newVersion, action, null, adminUser.id);
  await auditService.writeAudit({
    actor: adminUser.id,
    actorRole: adminUser.role,
    action: 'admin.content.' + action,
    targetType: 'content_item',
    targetId: id,
    before: auditService.contentAuditView(item),
    after: auditService.contentAuditView(updated),
    ip,
  });
  return updated;
}

async function approve(adminUser, ip, id) {
  return publishLike(adminUser, ip, id, 'approve');
}

// Draft direct-publish (design contract 3.4d / openapi v1.2.0), admin only.
async function publish(adminUser, ip, id, expectedVersion) {
  return publishLike(adminUser, ip, id, 'publish', expectedVersion);
}

// Withdraw from review (editor+): in_review -> draft WITHOUT a revision
// snapshot (unlike reject); reviewerId cleared, version still increments.
async function withdraw(adminUser, ip, id) {
  const item = await loadItem(id);
  assertTransition('withdraw', item.status);
  const newVersion = item.version + 1;
  const applied = await contentRepo.casUpdate(id, item.version, {
    status: 'draft',
    reviewerId: null,
    version: newVersion,
  });
  if (!applied) await casConflict(id);
  const updated = await contentRepo.getById(id);
  await auditService.writeAudit({
    actor: adminUser.id,
    actorRole: adminUser.role,
    action: 'admin.content.withdraw',
    targetType: 'content_item',
    targetId: id,
    before: auditService.contentAuditView(item),
    after: auditService.contentAuditView(updated),
    ip,
  });
  return updated;
}

async function reject(adminUser, ip, id, reason) {
  const item = await loadItem(id);
  assertTransition('reject', item.status);
  const newVersion = item.version + 1;
  const applied = await contentRepo.casUpdate(id, item.version, {
    status: 'draft',
    reviewerId: adminUser.id,
    version: newVersion,
  });
  if (!applied) await casConflict(id);
  const updated = await snapshotRevision(id, newVersion, 'reject', reason, adminUser.id);
  await auditService.writeAudit({
    actor: adminUser.id,
    actorRole: adminUser.role,
    action: 'admin.content.reject',
    targetType: 'content_item',
    targetId: id,
    before: auditService.contentAuditView(item),
    after: auditService.contentAuditView(updated),
    ip,
  });
  return updated;
}

// unpublish (published -> archived) and archive (any active -> archived) both
// end in archived and write no revision (ADR-006 snapshot table).
async function moveToArchived(adminUser, ip, id, action) {
  const item = await loadItem(id);
  assertTransition(action, item.status);
  const newVersion = item.version + 1;
  const applied = await contentRepo.casUpdate(id, item.version, {
    status: 'archived',
    version: newVersion,
  });
  if (!applied) await casConflict(id);
  const updated = await contentRepo.getById(id);
  await auditService.writeAudit({
    actor: adminUser.id,
    actorRole: adminUser.role,
    action: 'admin.content.' + action,
    targetType: 'content_item',
    targetId: id,
    before: auditService.contentAuditView(item),
    after: auditService.contentAuditView(updated),
    ip,
  });
  return updated;
}

// Forward-only rollback (ADR-006 section 3): the target revision's snapshot
// becomes the new working copy as a NEW version; history is never rewritten.
async function restore(adminUser, ip, id, revisionId) {
  const revision = await revisionRepo.getById(revisionId);
  if (!revision || revision.contentId !== id) {
    throw errors.notFound('Revision not found for this content item');
  }
  const item = await loadItem(id);
  assertTransition('restore', item.status);
  const snap = revision.snapshot || {};
  const newVersion = item.version + 1;
  const patch = Object.assign({}, snap, {
    status: 'draft',
    version: newVersion,
    publishedAt: null,
    reviewerId: null,
    updatedAt: new Date().toISOString(),
  });
  delete patch._id;
  delete patch.createdAt;
  const applied = await contentRepo.casUpdate(id, item.version, patch);
  if (!applied) await casConflict(id);
  const updated = await snapshotRevision(
    id, newVersion, 'restore', 'Restored from revision ' + revisionId, adminUser.id
  );
  await auditService.writeAudit({
    actor: adminUser.id,
    actorRole: adminUser.role,
    action: 'admin.content.restore',
    targetType: 'content_item',
    targetId: id,
    before: auditService.contentAuditView(item),
    after: auditService.contentAuditView(updated),
    ip,
  });
  return updated;
}

module.exports = {
  TRANSITIONS,
  allowedActions,
  assertTransition,
  submit,
  approve,
  publish,
  withdraw,
  reject,
  unpublish: (adminUser, ip, id) => moveToArchived(adminUser, ip, id, 'unpublish'),
  archive: (adminUser, ip, id) => moveToArchived(adminUser, ip, id, 'archive'),
  restore,
  loadItem,
};
