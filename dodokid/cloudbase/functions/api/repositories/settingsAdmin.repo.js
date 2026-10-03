// settingsAdmin.repo.js
// Data access for console settings. Stored as a singleton document in the
// admin_settings collection (key "console"); absent collection/record falls
// back to service-level defaults.

const base = require('./base.repo');

const NAME = 'admin_settings';
const SINGLETON_KEY = 'global'; // schema.json: idx_key singleton marker

const getSingleton = () => base.findOneWhere(NAME, { key: SINGLETON_KEY });

async function saveSingleton(patch) {
  const existing = await getSingleton();
  if (existing) {
    return base.updateById(NAME, existing._id, patch);
  }
  return base.insert(NAME, Object.assign({ key: SINGLETON_KEY }, patch));
}

module.exports = { NAME, SINGLETON_KEY, getSingleton, saveSingleton };
