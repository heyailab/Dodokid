// child.repo.js
// Data access for child profiles.
// NOTE: child profiles store only minimized data (nickname, age group, avatar).
// No precise location, microphone, or contact data is ever written here.
const base = require('./base.repo');
const NAME = 'child_profiles';

const listByUser = (userId) =>
  base.findWhere(NAME, { userId }, { orderBy: { field: 'createdAt', dir: 'desc' } });
const getById = (id) => base.getById(NAME, id);
const create = (doc) => base.insert(NAME, doc);
const updateById = (id, patch) => base.updateById(NAME, id, patch);
const removeById = (id) => base.removeById(NAME, id);
const removeByUser = (userId) => base.removeWhere(NAME, { userId });

module.exports = { NAME, listByUser, getById, create, updateById, removeById, removeByUser };
