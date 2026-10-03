// controllers/admin/user.controller.js
const userService = require('../../services/admin/userAdmin.service');

function paging(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit };
}

async function list(ctx) {
  const q = ctx.req.query || {};
  const { page, limit } = paging(q);
  return userService.listUsers({ role: q.role, status: q.status }, page, limit);
}

async function changeRole(ctx) {
  return userService.changeRole(ctx.adminUser, ctx.clientIp, ctx.params.id, ctx.validated.role);
}

async function changeStatus(ctx) {
  return userService.changeStatus(ctx.adminUser, ctx.clientIp, ctx.params.id, ctx.validated.status);
}

module.exports = { list, changeRole, changeStatus };
