// settingsAdmin.service.js
// Console settings backed by the admin_settings singleton (key "global",
// per schema.json). The document is created lazily with defaults on first
// read so idx_key uniqueness is always backed by a real record.

const config = require('../../config');
const settingsRepo = require('../../repositories/settingsAdmin.repo');

function defaults() {
  return {
    mediaMaxSizeMB: config.mediaMaxSizeMB,
    allowedMimeTypes: config.mediaAllowedMimeTypes,
    defaultLocale: 'zh-CN',
    paginationLimit: 20,
  };
}

async function getSettings() {
  let stored = await settingsRepo.getSingleton();
  if (!stored) {
    // Lazy bootstrap: persist the defaults so the singleton exists (schema
    // note in schema.json); safe against races via findOneWhere-then-insert.
    stored = await settingsRepo.saveSingleton(Object.assign({ updatedBy: null }, defaults()));
  }
  return {
    mediaMaxSizeMB: stored.mediaMaxSizeMB,
    allowedMimeTypes: stored.allowedMimeTypes,
    defaultLocale: stored.defaultLocale,
    paginationLimit: stored.paginationLimit,
  };
}

async function updateSettings(adminUser, body) {
  // Validator already range-checked each field; store the full canonical set.
  const patch = {
    mediaMaxSizeMB: body.mediaMaxSizeMB,
    allowedMimeTypes: body.allowedMimeTypes,
    defaultLocale: body.defaultLocale,
    paginationLimit: body.paginationLimit,
    updatedBy: adminUser ? adminUser.id : null,
  };
  await settingsRepo.saveSingleton(patch);
  return getSettings();
}

// Effective media policy used by the upload flow (falls back to env config).
async function getMediaPolicy() {
  const s = await getSettings();
  return { mediaMaxSizeMB: s.mediaMaxSizeMB, allowedMimeTypes: s.allowedMimeTypes };
}

module.exports = { getSettings, updateSettings, getMediaPolicy, defaults };
