// consent.repo.js
// Data access for guardian consent records.
const base = require('./base.repo');
const NAME = 'consent_records';

const create = (doc) => base.insert(NAME, doc);
const getById = (id) => base.getById(NAME, id);
const findByChild = (childId) =>
  base.findWhere(NAME, { childId }, { orderBy: { field: 'signedAt', dir: 'desc' } });
const updateById = (id, patch) => base.updateById(NAME, id, patch);

module.exports = { NAME, create, getById, findByChild, updateById };
