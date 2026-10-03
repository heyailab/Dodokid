// child.controller.js
// Thin controller for child profile endpoints.

const childService = require('../services/child.service');

async function create(ctx) {
  return childService.createChild(ctx.user.uid, ctx.validated || ctx.req.body);
}

async function switchActive(ctx) {
  const { childId } = ctx.validated || ctx.req.body;
  // Switching the active child is a client-side selection; we validate that the
  // child belongs to this account before returning it.
  return childService.getChild(ctx.user.uid, childId);
}

async function list(ctx) {
  return childService.listChildren(ctx.user.uid);
}

async function get(ctx) {
  return childService.getChild(ctx.user.uid, ctx.params.id);
}

async function update(ctx) {
  return childService.updateChild(ctx.user.uid, ctx.params.id, ctx.validated || ctx.req.body);
}

async function remove(ctx) {
  const revoke = ctx.req.query && ctx.req.query.revoke === 'true';
  return childService.deleteChild(ctx.user.uid, ctx.params.id, revoke);
}

module.exports = { create, switchActive, list, get, update, remove };
