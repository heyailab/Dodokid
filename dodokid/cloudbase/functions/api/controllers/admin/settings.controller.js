// controllers/admin/settings.controller.js
const settingsService = require('../../services/admin/settingsAdmin.service');

async function get(ctx) {
  return settingsService.getSettings();
}

async function update(ctx) {
  return settingsService.updateSettings(ctx.adminUser, ctx.validated);
}

module.exports = { get, update };
