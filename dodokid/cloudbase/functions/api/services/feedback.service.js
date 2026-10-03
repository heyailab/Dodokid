// feedback.service.js
// User feedback submission.

const errors = require('../utils/errors');
const feedbackRepo = require('../repositories/feedback.repo');

async function submit(userId, payload) {
  const { text } = payload || {};
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw errors.badRequest('text is required');
  }
  if (text.length > 1000) {
    throw errors.badRequest('text must be at most 1000 characters');
  }
  return feedbackRepo.create({
    userId,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  });
}

module.exports = { submit };
