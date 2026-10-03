// controllers/admin/content.controller.js
// Admin content endpoints (CRUD + workflow + revisions + preview).

const contentService = require('../../services/admin/contentAdmin.service');
const workflow = require('../../services/admin/contentWorkflow.service');
const revisionRepo = require('../../repositories/revision.repo');
const auditService = require('../../services/admin/auditAdmin.service');

function paging(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit };
}

async function list(ctx) {
  const q = ctx.req.query || {};
  const { page, limit } = paging(q);
  const filters = {
    moduleKey: q.moduleKey,
    type: q.type,
    ageGroup: q.ageGroup,
    status: q.status,
    q: q.q,
  };
  const sort = ['updatedAt', 'createdAt', 'title', 'order'].includes(q.sort)
    ? q.sort : 'updatedAt';
  const order = q.order === 'asc' ? 'asc' : 'desc';
  return contentService.listContents(filters, page, limit, sort, order);
}

async function create(ctx) {
  return contentService.createContent(ctx.adminUser, ctx.clientIp, ctx.validated);
}

async function get(ctx) {
  return contentService.getContent(ctx.params.id);
}

async function update(ctx) {
  return contentService.updateContent(ctx.adminUser, ctx.clientIp, ctx.params.id, ctx.validated);
}

async function remove(ctx) {
  return contentService.deleteContent(ctx.adminUser, ctx.clientIp, ctx.params.id);
}

async function submit(ctx) {
  const note = ctx.validated ? ctx.validated.note : undefined;
  return workflow.submit(ctx.adminUser, ctx.clientIp, ctx.params.id, note);
}

async function approve(ctx) {
  return workflow.approve(ctx.adminUser, ctx.clientIp, ctx.params.id);
}

async function publish(ctx) {
  const expectedVersion = ctx.validated ? ctx.validated.expectedVersion : undefined;
  return workflow.publish(ctx.adminUser, ctx.clientIp, ctx.params.id, expectedVersion);
}

async function withdraw(ctx) {
  return workflow.withdraw(ctx.adminUser, ctx.clientIp, ctx.params.id);
}

async function duplicate(ctx) {
  return contentService.duplicateContent(
    ctx.adminUser, ctx.clientIp, ctx.params.id, ctx.validated
  );
}

async function reject(ctx) {
  return workflow.reject(ctx.adminUser, ctx.clientIp, ctx.params.id, ctx.validated.reason);
}

async function unpublish(ctx) {
  return workflow.unpublish(ctx.adminUser, ctx.clientIp, ctx.params.id);
}

async function archive(ctx) {
  return workflow.archive(ctx.adminUser, ctx.clientIp, ctx.params.id);
}

async function revisions(ctx) {
  const item = await workflow.loadItem(ctx.params.id); // 404 when item missing
  const { page, limit } = paging(ctx.req.query || {});
  const items = await revisionRepo.listByContent(item._id, {
    skip: (page - 1) * limit,
    limit,
  });
  const total = await revisionRepo.countByContent(item._id);
  return { items, meta: auditService.buildMeta(total, page, limit) };
}

async function restore(ctx) {
  return workflow.restore(ctx.adminUser, ctx.clientIp, ctx.params.id, ctx.params.revisionId);
}

async function preview(ctx) {
  return contentService.previewContent(ctx.params.id);
}

module.exports = { list, create, get, update, remove, submit, approve, publish, withdraw, reject, unpublish, archive, duplicate, revisions, restore, preview };
