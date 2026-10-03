// settings.service.js
// Parental settings: daily screen-time limit and mode. Sensitive, so callers
// must pass the parent gate (enforced by the gate middleware on the routes).

const errors = require('../utils/errors');
const settingsRepo = require('../repositories/settings.repo');
const auditRepo = require('../repositories/audit.repo');

const MODES = ['strict', 'balanced', 'free'];

async function getSettings(userId) {
  const s = await settingsRepo.getByUser(userId);
  if (!s) return { dailyLimitMin: 0, mode: 'balanced' };
  return { dailyLimitMin: s.dailyLimitMin || 0, mode: s.mode || 'balanced' };
}

async function setTimeLimit(userId, payload) {
  if (payload.dailyLimitMin === undefined || payload.dailyLimitMin === null) {
    throw errors.badRequest('dailyLimitMin is required');
  }
  const v = Number(payload.dailyLimitMin);
  if (Number.isNaN(v) || v < 0 || v > 1440) {
    throw errors.badRequest('dailyLimitMin must be between 0 and 1440');
  }
  const patch = { dailyLimitMin: v };
  if (payload.mode !== undefined) {
    if (!MODES.includes(payload.mode)) {
      throw errors.badRequest('mode must be strict, balanced, or free');
    }
    patch.mode = payload.mode;
  }
  await settingsRepo.upsert(userId, patch);
  await auditRepo.write(userId, 'settings.update', { dailyLimitMin: v, mode: patch.mode });
  return getSettings(userId);
}

module.exports = { MODES, getSettings, setTimeLimit };
