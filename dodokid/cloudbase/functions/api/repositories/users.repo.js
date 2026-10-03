// users.repo.js
// Data access for the parent user collection.
const base = require('./base.repo');
const NAME = 'users';

const findByPhone = (phone) => base.findOneWhere(NAME, { phone });
const findByWechat = (openid) => base.findOneWhere(NAME, { wechat: openid });
const getById = (id) => base.getById(NAME, id);
const create = (doc) => base.insert(NAME, doc);
const updateById = (id, patch) => base.updateById(NAME, id, patch);

module.exports = { NAME, findByPhone, findByWechat, getById, create, updateById };
