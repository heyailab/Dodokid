// consent.service.js
// Guardian consent recording. A consent record can be created before a child
// profile exists (childId omitted) and later consumed by child creation, which
// satisfies the "consent must precede child PI collection" compliance rule.

const errors = require('../utils/errors');
const childRepo = require('../repositories/child.repo');
const consentRepo = require('../repositories/consent.repo');
const auditRepo = require('../repositories/audit.repo');

async function recordConsent(userId, payload) {
  const { childId, type, method } = payload || {};
  if (!type) throw errors.badRequest('type is required');
  if (!method) throw errors.badRequest('method is required');
  if (childId) {
    const child = await childRepo.getById(childId);
    if (!child || child.userId !== userId) {
      throw errors.forbidden('Child profile does not belong to this account');
    }
  }
  const record = await consentRepo.create({
    childId: childId || null,
    userId,
    type,
    method,
    signedAt: new Date().toISOString(),
    status: 'active',
  });
  await auditRepo.write(userId, 'consent.record', { consentId: record._id, type });
  return { consentId: record._id, status: record.status };
}

module.exports = { recordConsent };
