// controllers/admin/auth.controller.js
// Admin auth endpoints: login/logout/me. Thin: parse ctx, call service.

const adminAuthService = require('../../services/admin/adminAuth.service');
const jwt = require('../../utils/jwt');

async function login(ctx) {
  const { account, password } = ctx.validated;
  return adminAuthService.login(account, password, ctx.clientIp);
}

async function logout(ctx) {
  const token = String((ctx.req.headers || {}).authorization || '').split(' ')[1];
  return adminAuthService.logout(jwt.decode(token));
}

async function me(ctx) {
  return adminAuthService.me(ctx.adminUser);
}

module.exports = { login, logout, me };
