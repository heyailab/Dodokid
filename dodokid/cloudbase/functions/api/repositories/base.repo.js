// base.repo.js
// Generic data-access helpers over the CloudBase document database.
// Repositories contain only read/write logic; business rules live in services.

const { db } = require('../appContext');

function col(name) {
  return db.collection(name);
}

function nowIso() {
  return new Date().toISOString();
}

async function insert(name, doc) {
  const record = Object.assign({ createdAt: nowIso(), updatedAt: nowIso() }, doc);
  const res = await col(name).add({ data: record });
  return Object.assign({ _id: res._id || res.id }, record);
}

async function getById(name, id) {
  const res = await col(name).doc(id).get();
  if (res && res.data && res.data.length > 0) return res.data[0];
  return null;
}

async function findWhere(name, where, options) {
  const opts = options || {};
  let query = col(name).where(where);
  if (opts.orderBy) {
    query = query.orderBy(opts.orderBy.field, opts.orderBy.dir || 'desc');
  }
  if (opts.skip) query = query.skip(opts.skip);
  if (opts.limit) query = query.limit(opts.limit);
  const res = await query.get();
  return (res && res.data) || [];
}

async function findOneWhere(name, where, options) {
  const list = await findWhere(name, where, Object.assign({ limit: 1 }, options));
  return list[0] || null;
}

async function updateById(name, id, patch) {
  const data = Object.assign({ updatedAt: nowIso() }, patch);
  await col(name).doc(id).update({ data });
  return getById(name, id);
}

async function removeById(name, id) {
  await col(name).doc(id).remove();
  return true;
}

async function removeWhere(name, where) {
  await col(name).where(where).remove();
  return true;
}

async function countWhere(name, where) {
  const res = await col(name).where(where).count();
  return res.total || 0;
}

module.exports = {
  col,
  insert,
  getById,
  findWhere,
  findOneWhere,
  updateById,
  removeById,
  removeWhere,
  countWhere,
};
