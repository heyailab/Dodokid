// preferences.repo.js
// Data access for user preferences (language, theme).
const base = require('./base.repo');
const NAME = 'preferences';

const getByUser = (userId) => base.findOneWhere(NAME, { userId });
const upsert = async (userId, patch) => {
  const existing = await base.findOneWhere(NAME, { userId });
  if (existing) return base.updateById(NAME, existing._id, patch);
  return base.insert(NAME, Object.assign({ userId }, patch));
};

module.exports = { NAME, getByUser, upsert };
