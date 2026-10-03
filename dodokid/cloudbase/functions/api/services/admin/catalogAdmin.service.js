// catalogAdmin.service.js
// Module and category management for the console.

const errors = require('../../utils/errors');
const catalogRepo = require('../../repositories/catalogAdmin.repo');
const contentRepo = require('../../repositories/contentAdmin.repo');
const auditService = require('./auditAdmin.service');

const TARGET_TYPE = { modules: 'module', categories: 'category' };

function assertKeyUniqueness(existing) {
  if (existing) throw errors.conflict('This key already exists');
}

async function createEntry(kind, adminUser, ip, body) {
  const repo = catalogRepo;
  const find = kind === 'modules' ? repo.findModuleByKey : repo.findCategoryByKey;
  const create = kind === 'modules' ? repo.createModule : repo.createCategory;
  assertKeyUniqueness(await find(body.key));
  const doc = {
    key: body.key,
    name: body.name,
    order: typeof body.order === 'number' ? body.order : 0,
    enabled: body.enabled !== undefined ? !!body.enabled : true,
  };
  if (kind === 'modules') {
    doc.colorToken = body.colorToken || null;
    doc.iconKey = body.iconKey || null;
  }
  const created = await create(doc);
  await auditService.writeAudit({
    actor: adminUser.id,
    actorRole: adminUser.role,
    action: 'admin.' + (kind === 'modules' ? 'module' : 'category') + '.create',
    targetType: TARGET_TYPE[kind],
    targetId: created._id,
    before: null,
    after: created,
    ip,
  });
  return created;
}

async function updateEntry(kind, adminUser, ip, id, body) {
  const repo = catalogRepo;
  const getById = kind === 'modules' ? repo.getModuleById : repo.getCategoryById;
  const update = kind === 'modules' ? repo.updateModule : repo.updateCategory;
  const existing = await getById(id);
  if (!existing) throw errors.notFound('Not found');
  // key is immutable (referenced by content); only mutable fields update.
  const patch = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.order !== undefined) patch.order = Number(body.order);
  if (body.enabled !== undefined) patch.enabled = !!body.enabled;
  if (kind === 'modules' && body.colorToken !== undefined) patch.colorToken = body.colorToken;
  if (kind === 'modules' && body.iconKey !== undefined) patch.iconKey = body.iconKey;
  const updated = await update(id, patch);
  await auditService.writeAudit({
    actor: adminUser.id,
    actorRole: adminUser.role,
    action: 'admin.' + (kind === 'modules' ? 'module' : 'category') + '.update',
    targetType: TARGET_TYPE[kind],
    targetId: id,
    before: existing,
    after: updated,
    ip,
  });
  return updated;
}

async function deleteEntry(kind, adminUser, ip, id) {
  const repo = catalogRepo;
  const getById = kind === 'modules' ? repo.getModuleById : repo.getCategoryById;
  const remove = kind === 'modules' ? repo.removeModule : repo.removeCategory;
  const existing = await getById(id);
  if (!existing) throw errors.notFound('Not found');
  if (kind === 'modules') {
    // A module still referenced by published content cannot be removed.
    const publishedRefs = await contentRepo.countByModule(existing.key, 'published');
    if (publishedRefs > 0) {
      throw errors.conflict(
        'Module is still referenced by ' + publishedRefs + ' published content item(s)'
      );
    }
  }
  await remove(id);
  await auditService.writeAudit({
    actor: adminUser.id,
    actorRole: adminUser.role,
    action: 'admin.' + (kind === 'modules' ? 'module' : 'category') + '.delete',
    targetType: TARGET_TYPE[kind],
    targetId: id,
    before: existing,
    after: null,
    ip,
  });
  return { deleted: true };
}

module.exports = {
  listModules: () => catalogRepo.listModules(),
  listCategories: () => catalogRepo.listCategories(),
  createEntry,
  updateEntry,
  deleteEntry,
};
