// mediaAdmin.repo.js
// Data access for media_assets (admin side). The C-end media reads live in
// content.repo.js.

const base = require('./base.repo');
const { db } = require('../appContext');

const NAME = 'media_assets';

async function listMedia(filters, page, limit) {
  const where = {};
  if (filters.folder) where.folder = filters.folder;
  if (filters.itemId) where.itemId = filters.itemId;
  if (filters.mime) where.mime = db.RegExp({ regexp: '^' + filters.mime, options: 'i' });
  const items = await base.findWhere(NAME, where, {
    orderBy: { field: 'createdAt', dir: 'desc' },
    skip: (page - 1) * limit,
    limit,
  });
  const total = await base.countWhere(NAME, where);
  return { items, total };
}

const getById = (id) => base.getById(NAME, id);
const create = (doc) => base.insert(NAME, doc);
const removeById = (id) => base.removeById(NAME, id);
const countAll = () => base.countWhere(NAME, {});

// ADR-006 section 5: hard-deleting a content item keeps the media files
// reusable; only the itemId binding is cleared.
async function unbindFromItem(itemId) {
  await base.col(NAME).where({ itemId }).update({ data: { itemId: null } });
  return true;
}

module.exports = { NAME, listMedia, getById, create, removeById, countAll, unbindFromItem };
