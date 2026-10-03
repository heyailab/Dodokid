// logger.js
// Minimal request logger. Records the inbound request; the dispatcher logs
// completion with latency. No sensitive payload data is logged.

function logger(ctx) {
  ctx._start = Date.now();
  console.log('[request] ' + ctx.req.method + ' ' + ctx.req.path);
}

module.exports = { logger };
