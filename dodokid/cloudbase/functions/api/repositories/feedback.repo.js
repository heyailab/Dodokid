// feedback.repo.js
// Data access for user feedback submissions.
const base = require('./base.repo');
const NAME = 'feedback';

const create = (doc) => base.insert(NAME, doc);

module.exports = { NAME, create };
