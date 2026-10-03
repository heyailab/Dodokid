// userAdmin.repo.js
// Data access for operations users (editor/admin). The parent-side access
// lives in users.repo.js; this file serves the console user management.
// passwordHash is a repo-internal field: service views strip it before any
// response is built.

const base = require('./base.repo');
const { _ } = require('../appContext');

const NAME = 'users';

async function listOpsUsers(filters, page, limit) {
  const where = {};
  if (filters.role) {
    where.role = filters.role;
  } else {
    where.role = _.in(['editor', 'admin']); // parents are excluded per openapi
  }
  if (filters.status) where.status = filters.status;
  const items = await base.findWhere(NAME, where, {
    orderBy: { field: 'createdAt', dir: 'desc' },
    skip: (page - 1) * limit,
    limit,
  });
  const total = await base.countWhere(NAME, where);
  return { items, total };
}

const getById = (id) => base.getById(NAME, id);
const updateById = (id, patch) => base.updateById(NAME, id, patch);

module.exports = { NAME, listOpsUsers, getById, updateById };
