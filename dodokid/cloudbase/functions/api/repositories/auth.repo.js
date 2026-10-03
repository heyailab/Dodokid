// auth.repo.js
// Data access for the JWT revocation blacklist (supporting infrastructure collection).
const base = require('./base.repo');
const NAME = 'token_blacklist';

const revoke = (jti, exp) =>
  base.insert(NAME, { jti, exp, revokedAt: new Date().toISOString() });
const isRevoked = (jti) => base.findOneWhere(NAME, { jti });
const getById = (id) => base.getById(NAME, id);

module.exports = { NAME, revoke, isRevoked, getById };
