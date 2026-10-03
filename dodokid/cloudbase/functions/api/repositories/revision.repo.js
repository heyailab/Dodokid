// revision.repo.js
// Data access for content_revisions (Spec 6.2 / ADR-006).
// Revisions are append-only: no update or delete is exposed by design, so
// history can never be rewritten.

const base = require('./base.repo');
const NAME = 'content_revisions';

const create = (doc) => base.insert(NAME, doc);

const getById = (id) => base.getById(NAME, id);

const listByContent = (contentId, opts) =>
  base.findWhere(
    NAME,
    { contentId },
    Object.assign({ orderBy: { field: 'version', dir: 'desc' } }, opts)
  );

const countByContent = (contentId) => base.countWhere(NAME, { contentId });

module.exports = { NAME, create, getById, listByContent, countByContent };
