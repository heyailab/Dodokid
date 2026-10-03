// preferences.controller.js
// Thin controller for user preferences.

const prefsService = require('../services/preferences.service');

async function update(ctx) {
  return prefsService.updatePreferences(ctx.user.uid, ctx.validated || ctx.req.body);
}

module.exports = { update };
