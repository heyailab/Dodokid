// progress.controller.js
// Thin controller for progress endpoints.

const progressService = require('../services/progress.service');

async function get(ctx) {
  return progressService.getProgress(ctx.user.uid, ctx.params.childId);
}

async function list(ctx) {
  return progressService.listProgress(ctx.user.uid, ctx.params.childId);
}

async function upsert(ctx) {
  return progressService.upsertProgress(ctx.user.uid, ctx.params.childId, ctx.validated || ctx.req.body);
}

module.exports = { get, list, upsert };
