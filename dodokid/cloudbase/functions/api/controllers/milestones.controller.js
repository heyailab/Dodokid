// milestones.controller.js
// Thin controller for milestones endpoints.

const milestonesService = require('../services/milestones.service');

async function list(ctx) {
  return milestonesService.listMilestones(ctx.user.uid, ctx.params.childId);
}

module.exports = { list };
