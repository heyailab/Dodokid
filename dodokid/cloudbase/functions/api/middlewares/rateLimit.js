// rateLimit.js
// Fixed-window rate limiting backed by the rate_limits collection.
// The key combines the route scope with a client identifier (IP + phone when
// available) so SMS and login abuse can be throttled per caller.

const config = require('../config');
const errors = require('../utils/errors');
const rateLimitRepo = require('../repositories/rateLimit.repo');

function clientKey(ctx) {
  const h = ctx.req.headers || {};
  const ip = h['x-forwarded-for'] || h['x-real-ip'] || 'unknown';
  const phone = (ctx.req.body && ctx.req.body.phone) || '';
  return String(ip) + ':' + String(phone);
}

function rateLimit(scope, limitPerMin) {
  const limit = limitPerMin || config.defaultRateLimitPerMin;
  return async (ctx) => {
    const windowSec = 60;
    const now = Date.now();
    const windowStart = Math.floor(now / (windowSec * 1000)) * windowSec * 1000;
    const key = scope + ':' + clientKey(ctx);
    const count = await rateLimitRepo.hit(key, windowStart);
    if (count > limit) {
      throw errors.rateLimited('Too many requests, please retry later');
    }
    ctx.rateLimit = { limit, remaining: Math.max(0, limit - count) };
  };
}

module.exports = { rateLimit, clientKey };
