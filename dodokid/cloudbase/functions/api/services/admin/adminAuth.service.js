// adminAuth.service.js
// Operations console authentication, independent from parent auth (ADR-005):
// account (phone) + bcrypt password -> JWT with audience "admin".

const crypto = require('crypto');
const config = require('../../config');
const jwt = require('../../utils/jwt');
const errors = require('../../utils/errors');
const { maskPhone } = require('../../utils/phone');
const passwordUtil = require('../../utils/password');
const usersRepo = require('../../repositories/users.repo');
const authRepo = require('../../repositories/auth.repo');
const auditService = require('./auditAdmin.service');

const OPS_ROLES = ['editor', 'admin'];

function issueAdminTokens(user) {
  const jti = crypto.randomBytes(16).toString('hex');
  const accessToken = jwt.sign(
    { uid: user._id, role: user.role, phone: user.phone, aud: 'admin', jti },
    config.adminAccessTtlSec
  );
  const refreshToken = jwt.sign(
    { uid: user._id, role: user.role, type: 'refresh', aud: 'admin' },
    config.adminRefreshTtlSec
  );
  return { accessToken, refreshToken };
}

function adminUserView(user) {
  return {
    id: user._id,
    phone: maskPhone(user.phone),
    role: user.role,
    status: user.status || 'active',
    createdAt: user.createdAt,
  };
}

async function login(account, password, ip) {
  const user = await usersRepo.findByPhone(String(account || '').trim());
  // Uniform "invalid credentials" for unknown account and wrong password so
  // the endpoint cannot be used to enumerate which phones are ops accounts.
  if (!user || !user.passwordHash) {
    throw errors.unauthorized('Invalid account or password');
  }
  const passwordOk = await passwordUtil.verifyPassword(password, user.passwordHash);
  if (!passwordOk) {
    throw errors.unauthorized('Invalid account or password');
  }
  if (!OPS_ROLES.includes(user.role)) {
    throw errors.forbidden('Not an operations account');
  }
  if (user.status !== 'active') {
    throw errors.forbidden('Account is disabled');
  }
  await auditService.writeAudit({
    actor: user._id,
    actorRole: user.role,
    action: 'admin.auth.login',
    targetType: 'user',
    targetId: user._id,
    before: null,
    after: { loginAt: new Date().toISOString() },
    ip,
  });
  return { user: adminUserView(user), tokens: issueAdminTokens(user) };
}

async function logout(payload) {
  if (payload && payload.jti) {
    await authRepo.revoke(payload.jti, payload.exp);
  }
  return { loggedOut: true };
}

// Fresh read so role/status changes are reflected on /admin/auth/me.
async function me(adminUser) {
  const user = await usersRepo.getById(adminUser.id);
  if (!user) throw errors.unauthorized('Account no longer exists');
  return adminUserView(user);
}

module.exports = { issueAdminTokens, adminUserView, login, logout, me };
