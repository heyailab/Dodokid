// consent.controller.js
// Thin controller for consent endpoints.

const consentService = require('../services/consent.service');

async function record(ctx) {
  return consentService.recordConsent(ctx.user.uid, ctx.validated || ctx.req.body);
}

module.exports = { record };
