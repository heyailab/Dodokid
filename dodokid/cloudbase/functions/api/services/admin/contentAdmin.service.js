// contentAdmin.service.js
// Admin CRUD for content items plus the C-end-shaped preview. Status
// transitions themselves live in contentWorkflow.service.js (single source of
// the ADR-006 TRANSITIONS table).

const errors = require('../../utils/errors');
const base = require('../../repositories/base.repo');
const contentRepo = require('../../repositories/contentAdmin.repo');
const mediaRepo = require('../../repositories/mediaAdmin.repo');
const catalogRepo = require('../../repositories/catalogAdmin.repo');
const workflow = require('./contentWorkflow.service');
const auditService = require('./auditAdmin.service');

function pageMeta(total, page, limit) {
  return auditService.buildMeta(total, page, limit);
}

async function listContents(filters, page, limit, sort, order) {
  const { items, total } = await contentRepo.listAdmin(filters, page, limit, sort, order);
  return { items, meta: pageMeta(total, page, limit) };
}

async function getContent(id) {
  const item = await contentRepo.getById(id);
  if (!item) throw errors.notFound('Content item not found');
  const media = await mediaRepo.listMedia({ itemId: id }, 1, 100);
  return { item, media: media.items };
}

async function createContent(adminUser, ip, body) {
  const module = await catalogRepo.findModuleByKey(body.moduleKey);
  if (!module) throw errors.badRequest('Unknown moduleKey: ' + body.moduleKey);
  const doc = {
    moduleKey: body.moduleKey,
    type: body.type,
    ageGroup: body.ageGroup,
    title: body.title,
    summary: body.summary || null,
    cover: body.cover || null,
    mediaRef: body.mediaRef || null,
    tags: Array.isArray(body.tags) ? body.tags : [],
    order: typeof body.order === 'number' ? body.order : 0,
    locale: body.locale || 'zh-CN',
    // isSample (v1.2.1): only reaches here for admins - the adminOnlyFields
    // middleware rejects editors with 403 before the controller runs.
    isSample: body.isSample === true,
    status: 'draft', // new content always enters the machine at draft
    version: 1,
    authorId: adminUser.id,
    reviewerId: null,
    publishedAt: null,
  };
  const created = await base.insert(contentRepo.NAME, doc);
  await auditService.writeAudit({
    actor: adminUser.id,
    actorRole: adminUser.role,
    action: 'admin.content.create',
    targetType: 'content_item',
    targetId: created._id,
    before: null,
    after: auditService.contentAuditView(created),
    ip,
  });
  return created;
}

async function updateContent(adminUser, ip, id, body) {
  const item = await contentRepo.getById(id);
  if (!item) throw errors.notFound('Content item not found');
  // in_review is frozen until reject or archive (ADR-006 section 1).
  if (item.status === 'in_review') {
    throw errors.conflict(
      'Content is in review and read-only; reject or archive it before editing',
      { currentStatus: item.status }
    );
  }
  const patch = {};
  ['title', 'summary', 'cover', 'mediaRef', 'locale'].forEach((f) => {
    if (body[f] !== undefined) patch[f] = body[f];
  });
  if (body.tags !== undefined) patch.tags = Array.isArray(body.tags) ? body.tags : [];
  if (body.order !== undefined) patch.order = Number(body.order);
  if (body.isSample !== undefined) patch.isSample = !!body.isSample; // admin-only, gated upstream
  let newStatus = item.status;
  if (item.status === 'archived') {
    // Re-edit of an archived item returns it to draft (ADR-006 reEdit).
    workflow.assertTransition('reEdit', item.status);
    newStatus = 'draft';
    patch.status = newStatus;
  }
  const newVersion = item.version + 1; // every mutation bumps the version
  patch.version = newVersion;
  const applied = await contentRepo.casUpdate(id, body.expectedVersion, patch);
  if (!applied) {
    const fresh = await contentRepo.getById(id);
    throw errors.conflict('Content was modified concurrently, please refresh and retry', {
      currentVersion: fresh ? fresh.version : null,
    });
  }
  const updated = await contentRepo.getById(id);
  await auditService.writeAudit({
    actor: adminUser.id,
    actorRole: adminUser.role,
    action: 'admin.content.update',
    targetType: 'content_item',
    targetId: id,
    before: auditService.contentAuditView(item),
    after: auditService.contentAuditView(updated),
    ip,
  });
  return updated;
}

// Hard delete (admin only). Media bindings are cleared, files stay reusable.
async function deleteContent(adminUser, ip, id) {
  const item = await contentRepo.getById(id);
  if (!item) throw errors.notFound('Content item not found');
  await contentRepo.removeById(id);
  await mediaRepo.unbindFromItem(id);
  await auditService.writeAudit({
    actor: adminUser.id,
    actorRole: adminUser.role,
    action: 'admin.content.delete',
    targetType: 'content_item',
    targetId: id,
    before: auditService.contentAuditView(item),
    after: null,
    ip,
  });
  return { deleted: true };
}

// Preview renders the C-end payload shape for ANY status (never exposed to C).
function cEndItemView(item) {
  return {
    _id: item._id,
    moduleKey: item.moduleKey,
    ageGroup: item.ageGroup,
    title: item.title,
    summary: item.summary || null,
    cover: item.cover || null,
    mediaRef: item.mediaRef || null,
    type: item.type,
    tags: item.tags || [],
    order: typeof item.order === 'number' ? item.order : 0,
    locale: item.locale || 'zh-CN',
  };
}

function cEndMediaView(m) {
  return {
    _id: m._id,
    itemId: m.itemId || null,
    url: m.url,
    cdnKey: m.cdnKey,
    size: m.size,
    mime: m.mime,
    width: m.width || null,
    height: m.height || null,
    durationMs: m.durationMs || null,
  };
}

// Duplicate any item (any status) into a NEW draft (openapi v1.2.0). The
// source is never modified; cover/mediaRef keep referencing the same media
// (shared cdnKey, no media_assets records are copied).
async function duplicateContent(adminUser, ip, id, body) {
  const source = await contentRepo.getById(id);
  if (!source) throw errors.notFound('Content item not found');
  const doc = {
    moduleKey: source.moduleKey,
    type: source.type,
    ageGroup: source.ageGroup,
    title: (body && body.title) || (source.title + ' (副本)'),
    summary: source.summary || null,
    cover: source.cover || null,
    mediaRef: source.mediaRef || null,
    tags: Array.isArray(source.tags) ? source.tags.slice() : [],
    order: typeof source.order === 'number' ? source.order : 0,
    locale: source.locale || 'zh-CN',
    // Duplicating a sample chapter naturally yields a sample draft; it still
    // requires admin approval/publish before going live.
    isSample: !!source.isSample,
    status: 'draft',
    version: 1,
    authorId: adminUser.id,
    reviewerId: null,
    publishedAt: null,
  };
  const created = await base.insert(contentRepo.NAME, doc);
  await auditService.writeAudit({
    actor: adminUser.id,
    actorRole: adminUser.role,
    action: 'admin.content.duplicate',
    targetType: 'content_item',
    targetId: created._id,
    before: null,
    after: Object.assign(auditService.contentAuditView(created), { sourceId: id }),
    ip,
  });
  return created;
}

async function previewContent(id) {
  const item = await contentRepo.getById(id);
  if (!item) throw errors.notFound('Content item not found');
  const media = await mediaRepo.listMedia({ itemId: id }, 1, 100);
  return {
    item: cEndItemView(item),
    media: media.items.map(cEndMediaView),
  };
}

module.exports = {
  listContents,
  getContent,
  createContent,
  updateContent,
  deleteContent,
  duplicateContent,
  previewContent,
  cEndItemView,
  cEndMediaView,
};
