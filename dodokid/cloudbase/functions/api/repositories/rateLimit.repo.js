// rateLimit.repo.js
// Data access for the rate-limit counters (supporting infrastructure collection).
const base = require('./base.repo');
const { command } = require('../appContext');
const NAME = 'rate_limits';

// Fixed-window counter. Returns the count after this hit.
// Concurrency note: this is a read-modify-write; a small race is acceptable for
// MVP. For stricter limits, move to a Redis-backed limiter in production.
const hit = async (key, windowStart) => {
  const id = `${key}:${windowStart}`;
  const current = await base.getById(NAME, id);
  if (!current) {
    await base.col(NAME).doc(id).set({
      data: { _id: id, key, windowStart, count: 1, updatedAt: new Date().toISOString() },
    });
    return 1;
  }
  await base.col(NAME).doc(id).update({ data: { count: command.inc(1), updatedAt: new Date().toISOString() } });
  const refreshed = await base.getById(NAME, id);
  return refreshed ? refreshed.count : 1;
};

module.exports = { NAME, hit };
