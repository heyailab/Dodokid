// settings.controller.js
// Thin controller for parental settings endpoints.
// These routes require the parent gate (enforced by gate middleware).

const settingsService = require('../services/settings.service');

async function get(ctx) {
  return settingsService.getSettings(ctx.user.uid);
}

async function setTimeLimit(ctx) {
  return settingsService.setTimeLimit(ctx.user.uid, ctx.validated || ctx.req.body);
}

module.exports = { get, setTimeLimit };
