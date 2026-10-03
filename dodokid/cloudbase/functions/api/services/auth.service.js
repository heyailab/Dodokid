// auth.service.js
// Parent authentication: SMS code issuance/verification, register, login, logout.
// Issues custom JWT access + refresh tokens. Logout revokes the access token
// jti via a blacklist so stateless tokens can be invalidated.

const crypto = require('crypto');
const config = require('../config');
const jwt = require('../utils/jwt');
const errors = require('../utils/errors');
const phoneUtil = require('../utils/phone');
const usersRepo = require('../repositories/users.repo');
const smsRepo = require('../repositories/sms.repo');
const authRepo = require('../repositories/auth.repo');
const auditRepo = require('../repositories/audit.repo');
const smsProvider = require('./sms.service');

function issueTokens(user) {
  const jti = crypto.randomBytes(16).toString('hex');
  const accessToken = jwt.sign(
    { uid: user._id, role: user.role || 'parent', phone: user.phone, jti },
    config.jwtAccessTtlSec
  );
  const refreshToken = jwt.sign(
    { uid: user._id, role: user.role || 'parent', type: 'refresh' },
    config.jwtRefreshTtlSec
  );
  return { accessToken, refreshToken };
}

function publicUser(user) {
  return {
    id: user._id,
    phone: phoneUtil.maskPhone(user.phone),
    role: user.role || 'parent',
    createdAt: user.createdAt,
  };
}

async function sendSmsCode(phone) {
  if (!phoneUtil.isValidPhone(phone)) {
    throw errors.badRequest('Invalid phone number');
  }
  const code = phoneUtil.generateCode(config.smsCodeLength);
  const expiresAt = new Date(Date.now() + config.smsCodeTtlSec * 1000).toISOString();
  await smsRepo.create({ phone, code, expiresAt, consumed: false, attempts: 0 });
  await smsProvider.send(phone, code);
  const result = { sent: true };
  if (config.devMode) result.devCode = code; // only exposed outside production
  return result;
}

async function verifyCodeInternal(phone, code) {
  const record = await smsRepo.getLatestValid(phone);
  if (!record) throw errors.badRequest('No active verification code');
  if (new Date(record.expiresAt).getTime() < Date.now()) {
    throw errors.badRequest('Verification code expired');
  }
  if (record.code !== String(code)) {
    throw errors.badRequest('Invalid verification code');
  }
  await smsRepo.markConsumed(record._id);
  return true;
}

async function register(phone, code) {
  await verifyCodeInternal(phone, code);
  const existing = await usersRepo.findByPhone(phone);
  if (existing) {
    throw errors.conflict('Phone already registered, please login instead');
  }
  const user = await usersRepo.create({ phone, role: 'parent' });
  await auditRepo.write(user._id, 'user.register', { phone: phoneUtil.maskPhone(phone) });
  return { user: publicUser(user), tokens: issueTokens(user) };
}

async function login(phone, code) {
  await verifyCodeInternal(phone, code);
  const user = await usersRepo.findByPhone(phone);
  if (!user) {
    throw errors.conflict('User not registered, please register first');
  }
  await auditRepo.write(user._id, 'user.login', { phone: phoneUtil.maskPhone(phone) });
  return { user: publicUser(user), tokens: issueTokens(user) };
}

async function logout(user) {
  const jti = user.jti;
  const exp = user.exp;
  if (jti) {
    await authRepo.revoke(jti, exp);
  }
  return { loggedOut: true };
}

module.exports = {
  issueTokens,
  sendSmsCode,
  verifyCodeInternal,
  register,
  login,
  logout,
  publicUser,
};
