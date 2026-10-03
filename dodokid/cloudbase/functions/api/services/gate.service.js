// gate.service.js
// Parent gate: a password (or client-side biometric attestation) that must be
// satisfied before sensitive settings can be read or changed. On success it
// issues a short-lived gate token presented on protected settings routes.

const cryptoUtil = require('../utils/crypto');
const jwt = require('../utils/jwt');
const config = require('../config');
const errors = require('../utils/errors');
const settingsRepo = require('../repositories/settings.repo');
const auditRepo = require('../repositories/audit.repo');

async function setupGate(userId, payload) {
  const { type, secret } = payload || {};
  if (type !== 'password' && type !== 'biometric') {
    throw errors.badRequest('type must be password or biometric');
  }
  if (!secret || String(secret).length < 4) {
    throw errors.badRequest('secret must be at least 4 characters');
  }
  // Biometric unlock is performed on the device; the client passes a one-time
  // attestation secret that we store like a password for re-verification.
  const { salt, hash } = cryptoUtil.hashPassword(secret);
  await settingsRepo.upsert(userId, { gateType: type, gateSalt: salt, gateHash: hash });
  await auditRepo.write(userId, 'gate.setup', { type });
  return { setup: true, type };
}

async function verifyGate(userId, payload) {
  const { type, secret } = payload || {};
  const s = await settingsRepo.getByUser(userId);
  if (!s || !s.gateHash) {
    throw errors.badRequest('Parent gate is not set up');
  }
  if (type && s.gateType && s.gateType !== type) {
    throw errors.badRequest('Gate type mismatch');
  }
  if (!secret) throw errors.badRequest('secret is required');
  const ok = cryptoUtil.verifyPassword(secret, s.gateSalt, s.gateHash);
  if (!ok) throw errors.forbidden('Parent gate verification failed');
  const gateToken = jwt.sign({ uid: userId, scope: 'gate' }, config.gateTokenTtlSec);
  await auditRepo.write(userId, 'gate.verify', { type: s.gateType });
  return { gateToken, expiresInSec: config.gateTokenTtlSec };
}

module.exports = { setupGate, verifyGate };
