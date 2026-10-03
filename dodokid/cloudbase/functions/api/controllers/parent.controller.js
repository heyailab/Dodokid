// parent.controller.js
// Thin controller: runs validation (via middleware), calls the auth service,
// and returns the plain data. No business logic here.

const authService = require('../services/auth.service');

async function sendSmsCode(ctx) {
  const { phone } = ctx.validated || ctx.req.body;
  return authService.sendSmsCode(phone);
}

async function verifyCode(ctx) {
  const { phone, code } = ctx.validated || ctx.req.body;
  await authService.verifyCodeInternal(phone, code);
  return { verified: true };
}

async function register(ctx) {
  const { phone, code } = ctx.validated || ctx.req.body;
  return authService.register(phone, code);
}

async function login(ctx) {
  const { phone, code } = ctx.validated || ctx.req.body;
  return authService.login(phone, code);
}

async function logout(ctx) {
  return authService.logout(ctx.user);
}

module.exports = { sendSmsCode, verifyCode, register, login, logout };
