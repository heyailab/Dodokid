// sms.repo.js
// Data access for SMS verification codes (supporting infrastructure collection).
const base = require('./base.repo');
const NAME = 'sms_codes';

const create = (doc) => base.insert(NAME, doc);
const getLatestValid = (phone) =>
  base.findOneWhere(NAME, { phone, consumed: false }, { orderBy: { field: 'createdAt', dir: 'desc' } });
const markConsumed = (id) => base.updateById(NAME, id, { consumed: true });
const invalidateAll = (phone) => base.removeWhere(NAME, { phone });

module.exports = { NAME, create, getLatestValid, markConsumed, invalidateAll };
