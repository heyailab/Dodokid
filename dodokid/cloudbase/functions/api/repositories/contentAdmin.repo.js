// contentAdmin.repo.js
// Data access for the admin view of content_items. All business rules (state
// machine, who may edit) live in services/admin; this file only queries.

const base = require('./base.repo');
const { db } = require('../appContext');

const NAME = 'content_items';

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildWhere(filters) {
  const where = {};
  if (filters.moduleKey) where.moduleKey = filters.moduleKey;
  if (filters.type) where.type = filters.type;
  if (filters.ageGroup) where.ageGroup = filters.ageGroup;
  if (filters.status) where.status = filters.status;
  if (filters.q) where.title = db.RegExp({ regexp: escapeRegExp(filters.q), options: 'i' });
  return where;
}

async function listAdmin(filters, page, limit, sort, order) {
  const where = buildWhere(filters);
  const items = await base.findWhere(NAME, where, {
    orderBy: { field: sort || 'updatedAt', dir: order === 'asc' ? 'asc' : 'desc' },
    skip: (page - 1) * limit,
    limit,
  });
  const total = await base.countWhere(NAME, where);
  return { items, total };
}

const getById = (id) => base.getById(NAME, id);

// Optimistic-lock CAS (ADR-006 section 2): the conditional update only applies
// when the stored version still equals expectedVersion. Returns true when the
// update was applied, false when another writer changed the document first.
async function casUpdate(id, expectedVersion, patch) {
  const data = Object.assign({ updatedAt: new Date().toISOString() }, patch);
  const res = await base.col(NAME).where({ _id: id, version: expectedVersion }).update({ data });
  const updated = (res && (res.updated || (res.stats && res.stats.updated))) || 0;
  return updated > 0;
}

const removeById = (id) => base.removeById(NAME, id);

async function countByStatus() {
  const statuses = ['draft', 'in_review', 'published', 'archived'];
  const counts = await Promise.all(
    statuses.map((s) => base.countWhere(NAME, { status: s }))
  );
  const byStatus = {};
  statuses.forEach((s, i) => {
    byStatus[s] = counts[i];
  });
  return byStatus;
}

const countAll = () => base.countWhere(NAME, {});

// ADR-006 section 5: a media asset still referenced by published content
// (cover or mediaRef) must not be deleted (409 upstream).
const countPublishedReferringCover = (cdnKey) =>
  base.countWhere(NAME, { cover: cdnKey, status: 'published' });

const countPublishedReferringMediaRef = (cdnKey) =>
  base.countWhere(NAME, { mediaRef: cdnKey, status: 'published' });

const countByModule = (moduleKey, status) => {
  const where = { moduleKey };
  if (status) where.status = status;
  return base.countWhere(NAME, where);
};

module.exports = {
  NAME,
  listAdmin,
  getById,
  casUpdate,
  removeById,
  countByStatus,
  countAll,
  countPublishedReferringCover,
  countPublishedReferringMediaRef,
  countByModule,
};
