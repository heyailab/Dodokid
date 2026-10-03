// userAdmin.service.js
// Operations user management (admin only). Never returns passwordHash; phone
// numbers are masked. parent->editor/admin provisioning happens through the
// internal bootstrap script (ADR-005 section 5), NOT through these endpoints:
// the role endpoint only allows editor <-> admin transitions per openapi.

const errors = require('../../utils/errors');
const userRepo = require('../../repositories/userAdmin.repo');
const auditService = require('./auditAdmin.service');
const { adminUserView } = require('./adminAuth.service');

function buildMeta(total, page, limit) {
  return auditService.buildMeta(total, page, limit);
}

async function listUsers(filters, page, limit) {
  const { items, total } = await userRepo.listOpsUsers(filters, page, limit);
  return { items: items.map(adminUserView), meta: buildMeta(total, page, limit) };
}

async function loadTarget(id) {
  const user = await userRepo.getById(id);
  if (!user) throw errors.notFound('User not found');
  return user;
}

async function changeRole(adminUser, ip, id, role) {
  const target = await loadTarget(id);
  if (target.role === 'parent') {
    throw errors.conflict(
      'Parent accounts cannot be promoted here; use the internal ops bootstrap flow to provision an editor/admin account'
    );
  }
  if (target.role === role) {
    return adminUserView(target); // idempotent no-op
  }
  const updated = await userRepo.updateById(id, { role });
  await auditService.writeAudit({
    actor: adminUser.id,
    actorRole: adminUser.role,
    action: 'admin.user.role_change',
    targetType: 'user',
    targetId: id,
    before: { role: target.role },
    after: { role: updated.role },
    ip,
  });
  return adminUserView(updated);
}

async function changeStatus(adminUser, ip, id, status) {
  const target = await loadTarget(id);
  if (target._id === adminUser.id && status === 'disabled') {
    throw errors.conflict('You cannot disable your own account');
  }
  if ((target.status || 'active') === status) {
    return adminUserView(target); // idempotent no-op
  }
  const updated = await userRepo.updateById(id, { status });
  await auditService.writeAudit({
    actor: adminUser.id,
    actorRole: adminUser.role,
    action: 'admin.user.status_change',
    targetType: 'user',
    targetId: id,
    before: { status: target.status || 'active' },
    after: { status: updated.status },
    ip,
  });
  return adminUserView(updated);
}

module.exports = { listUsers, changeRole, changeStatus };
