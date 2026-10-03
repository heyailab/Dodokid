// feedback.controller.js
// Thin controller for feedback submission.

const feedbackService = require('../services/feedback.service');

async function submit(ctx) {
  return feedbackService.submit(ctx.user.uid, ctx.validated || ctx.req.body);
}

module.exports = { submit };
