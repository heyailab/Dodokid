// child.service.js
// Child profile lifecycle with guardian-consent enforcement and ownership checks.
// Data minimization: only nickname, age group, and avatar are stored. No precise
// location, microphone, or contact data is ever collected.

const errors = require('../utils/errors');
const childRepo = require('../repositories/child.repo');
const consentRepo = require('../repositories/consent.repo');
const progressRepo = require('../repositories/progress.repo');
const milestonesRepo = require('../repositories/milestones.repo');
const auditRepo = require('../repositories/audit.repo');

const AGE_GROUPS = ['3-4', '4-6'];

function assertOwns(child, userId) {
  if (!child || child.userId !== userId) {
    throw errors.forbidden('Child profile does not belong to this account');
  }
}

function cleanProfile(child) {
  return {
    id: child._id,
    name: child.name,
    ageGroup: child.ageGroup,
    avatar: child.avatar || null,
    createdAt: child.createdAt,
  };
}

async function createChild(userId, payload) {
  const { consentId, name, ageGroup, avatar } = payload || {};
  if (!consentId) throw errors.badRequest('consentId is required to create a child profile');
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw errors.badRequest('name is required');
  }
  if (!AGE_GROUPS.includes(ageGroup)) {
    throw errors.badRequest('ageGroup must be one of 3-4, 4-6');
  }
  const consent = await consentRepo.getById(consentId);
  if (!consent) throw errors.badRequest('Consent record not found');
  if (consent.childId) throw errors.conflict('Consent already used for another child');
  if (consent.expiresAt && new Date(consent.expiresAt).getTime() < Date.now()) {
    throw errors.badRequest('Consent expired');
  }
  const child = await childRepo.create({
    userId,
    name: name.trim(),
    ageGroup,
    avatar: avatar || null,
  });
  await consentRepo.updateById(consentId, { childId: child._id, status: 'used' });
  await auditRepo.write(userId, 'child.create', { childId: child._id });
  return cleanProfile(child);
}

async function listChildren(userId) {
  const children = await childRepo.listByUser(userId);
  return children.map(cleanProfile);
}

async function getChild(userId, childId) {
  const child = await childRepo.getById(childId);
  assertOwns(child, userId);
  return cleanProfile(child);
}

async function updateChild(userId, childId, payload) {
  const child = await childRepo.getById(childId);
  assertOwns(child, userId);
  const allowed = {};
  if (payload.name !== undefined) {
    if (!payload.name || !String(payload.name).trim()) throw errors.badRequest('name cannot be empty');
    allowed.name = String(payload.name).trim();
  }
  if (payload.avatar !== undefined) allowed.avatar = payload.avatar;
  if (payload.ageGroup !== undefined) {
    if (!AGE_GROUPS.includes(payload.ageGroup)) throw errors.badRequest('ageGroup must be one of 3-4, 4-6');
    allowed.ageGroup = payload.ageGroup;
  }
  const updated = await childRepo.updateById(childId, allowed);
  return cleanProfile(updated);
}

async function deleteChild(userId, childId, revokeConsent) {
  const child = await childRepo.getById(childId);
  assertOwns(child, userId);
  // Revoking consent means deleting all child-related data (GDPR-style erasure).
  await childRepo.removeById(childId);
  const consents = await consentRepo.findByChild(childId);
  for (const c of consents) {
    await consentRepo.updateById(c._id, { status: 'revoked', revokedAt: new Date().toISOString() });
  }
  await progressRepo.removeByChild(childId);
  await milestonesRepo.removeByChild(childId);
  await auditRepo.write(userId, 'child.delete', { childId, revokeConsent: !!revokeConsent });
  return { deleted: true, childId };
}

module.exports = {
  AGE_GROUPS,
  createChild,
  listChildren,
  getChild,
  updateChild,
  deleteChild,
};
