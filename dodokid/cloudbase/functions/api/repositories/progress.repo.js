// progress.repo.js
// Data access for learning progress records.
const base = require('./base.repo');
const NAME = 'progress_records';

const upsert = async (childId, itemId, patch) => {
  const existing = await base.findOneWhere(NAME, { childId, itemId });
  if (existing) {
    return base.updateById(NAME, existing._id, Object.assign({ updatedAt: new Date().toISOString() }, patch));
  }
  return base.insert(
    NAME,
    Object.assign({ childId, itemId, updatedAt: new Date().toISOString() }, patch)
  );
};

const listByChild = (childId) =>
  base.findWhere(NAME, { childId }, { orderBy: { field: 'updatedAt', dir: 'desc' } });

const countByChild = (childId) => base.countWhere(NAME, { childId });
const removeByChild = (childId) => base.removeWhere(NAME, { childId });

module.exports = { NAME, upsert, listByChild, countByChild, removeByChild };
