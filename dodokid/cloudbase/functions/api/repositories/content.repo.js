// content.repo.js
// Data access for C-END content reads. ADR-006 section 4: every C-end query
// is forced to status='published' HERE at the repo layer, not left to caller
// discipline, so draft/in_review/archived items can never leak to the app
// (AC-13 / AC-15). Admin reads use contentAdmin.repo.js instead.
const base = require('./base.repo');
const { db, _ } = require('../appContext');

const NAME = 'content_items';
const MODULES = 'content_modules';
const MEDIA = 'media_assets';

const PUBLISHED = 'published';

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const listByModuleAge = (moduleKey, ageGroup) => {
  // status=published is mandatory here (AC-13/AC-15).
  const where = { status: PUBLISHED };
  if (moduleKey) where.moduleKey = moduleKey;
  if (ageGroup) where.ageGroup = ageGroup;
  return base.findWhere(NAME, where, { orderBy: { field: 'order', dir: 'asc' } });
};

const getById = (id) => base.getById(NAME, id);

// C-end detail: published-only wrapper over getById. Returns null for missing
// OR non-published items so the service can answer a uniform 404 (AC-15).
const getPublishedById = async (id) => {
  const item = await getById(id);
  if (!item || item.status !== PUBLISHED) return null;
  return item;
};

const search = (q) => {
  // status=published is mandatory here (AC-13/AC-15).
  const regex = db.RegExp({ regexp: escapeRegExp(q), options: 'i' });
  return base.findWhere(NAME, { title: regex, status: PUBLISHED }, { limit: 50 });
};

const listModules = () =>
  // C-end categories return enabled modules only (openapi /content/categories).
  base.findWhere(MODULES, { enabled: true }, { orderBy: { field: 'order', dir: 'asc' } });

// Sample chapters (v1.2.1): published AND isSample=true, order asc, limit 10.
// status=published is mandatory here (AC-13/AC-15), same as listByModuleAge.
const listSamples = (ageGroups) => {
  const where = { status: PUBLISHED, isSample: true };
  if (ageGroups && ageGroups.length === 1) {
    where.ageGroup = ageGroups[0];
  } else if (ageGroups && ageGroups.length > 1) {
    where.ageGroup = _.in(ageGroups);
  }
  return base.findWhere(NAME, where, { orderBy: { field: 'order', dir: 'asc' }, limit: 10 });
};

const getMediaByItem = (itemId) => base.findWhere(MEDIA, { itemId });

module.exports = {
  NAME,
  MODULES,
  MEDIA,
  listByModuleAge,
  getById,
  getPublishedById,
  search,
  listSamples,
  listModules,
  getMediaByItem,
};
