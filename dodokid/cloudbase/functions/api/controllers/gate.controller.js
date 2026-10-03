// gate.controller.js
// Thin controller for the parent gate (setup + verify).

const gateService = require('../services/gate.service');

async function setup(ctx) {
  return gateService.setupGate(ctx.user.uid, ctx.validated || ctx.req.body);
}

async function verify(ctx) {
  return gateService.verifyGate(ctx.user.uid, ctx.validated || ctx.req.body);
}

module.exports = { setup, verify };
