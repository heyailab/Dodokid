// progress.service.js
// Learning progress upsert, summary, and listing, scoped by child ownership.

const errors = require('../utils/errors');
const childRepo = require('../repositories/child.repo');
const progressRepo = require('../repositories/progress.repo');
const milestonesRepo = require('../repositories/milestones.repo');

const STATUSES = ['not_started', 'in_progress', 'completed'];

function assertOwns(child, userId) {
  if (!child || child.userId !== userId) {
    throw errors.forbidden('Child profile does not belong to this account');
  }
}

async function upsertProgress(userId, childId, payload) {
  const child = await childRepo.getById(childId);
  assertOwns(child, userId);
  const { itemId, status, score } = payload || {};
  if (!itemId) throw errors.badRequest('itemId is required');
  if (!STATUSES.includes(status)) {
    throw errors.badRequest('status must be one of not_started, in_progress, completed');
  }
  const patch = { status };
  if (score !== undefined) {
    const s = Number(score);
    if (Number.isNaN(s) || s < 0 || s > 100) {
      throw errors.badRequest('score must be between 0 and 100');
    }
    patch.score = s;
  }
  const record = await progressRepo.upsert(childId, itemId, patch);
  // Award a first-completion milestone when an item is completed.
  if (status === 'completed') {
    const existing = await milestonesRepo.findOne(childId, 'first_complete');
    if (!existing) {
      await milestonesRepo.create({
        childId,
        badgeKey: 'first_complete',
        earnedAt: new Date().toISOString(),
        streak: 1,
      });
    }
  }
  return record;
}

async function getProgress(userId, childId) {
  const child = await childRepo.getById(childId);
  assertOwns(child, userId);
  const records = await progressRepo.listByChild(childId);
  const total = records.length;
  const completed = records.filter((r) => r.status === 'completed').length;
  const inProgress = records.filter((r) => r.status === 'in_progress').length;
  const notStarted = records.filter((r) => r.status === 'not_started').length;
  const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { childId, total, completed, inProgress, notStarted, completionRate };
}

async function listProgress(userId, childId) {
  const child = await childRepo.getById(childId);
  assertOwns(child, userId);
  return progressRepo.listByChild(childId);
}

module.exports = { STATUSES, upsertProgress, getProgress, listProgress };
