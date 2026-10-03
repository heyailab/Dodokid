// milestones.service.js
// Earned milestones/badges for a child, scoped by ownership.

const errors = require('../utils/errors');
const childRepo = require('../repositories/child.repo');
const milestonesRepo = require('../repositories/milestones.repo');

async function listMilestones(userId, childId) {
  const child = await childRepo.getById(childId);
  if (!child || child.userId !== userId) {
    throw errors.forbidden('Child profile does not belong to this account');
  }
  return milestonesRepo.listByChild(childId);
}

module.exports = { listMilestones };
