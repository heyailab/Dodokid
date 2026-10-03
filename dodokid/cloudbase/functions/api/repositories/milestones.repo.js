// milestones.repo.js
// Data access for earned milestones/badges.
const base = require('./base.repo');
const NAME = 'milestones';

const listByChild = (childId) =>
  base.findWhere(NAME, { childId }, { orderBy: { field: 'earnedAt', dir: 'desc' } });
const create = (doc) => base.insert(NAME, doc);
const findOne = (childId, badgeKey) => base.findOneWhere(NAME, { childId, badgeKey });
const removeByChild = (childId) => base.removeWhere(NAME, { childId });

module.exports = { NAME, listByChild, create, findOne, removeByChild };
