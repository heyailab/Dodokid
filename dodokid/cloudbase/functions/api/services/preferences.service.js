// preferences.service.js
// User preferences (language, theme). Upsert by user.

const errors = require('../utils/errors');
const prefsRepo = require('../repositories/preferences.repo');

const LANGS = ['zh-CN', 'en', 'zh-TW'];
const THEMES = ['light', 'dark', 'system'];

async function updatePreferences(userId, payload) {
  const patch = {};
  if (payload.lang !== undefined) {
    if (!LANGS.includes(payload.lang)) {
      throw errors.badRequest('lang must be one of zh-CN, en, zh-TW');
    }
    patch.lang = payload.lang;
  }
  if (payload.theme !== undefined) {
    if (!THEMES.includes(payload.theme)) {
      throw errors.badRequest('theme must be light, dark, or system');
    }
    patch.theme = payload.theme;
  }
  if (Object.keys(patch).length === 0) {
    throw errors.badRequest('No valid preference fields provided');
  }
  return prefsRepo.upsert(userId, patch);
}

module.exports = { LANGS, THEMES, updatePreferences };
