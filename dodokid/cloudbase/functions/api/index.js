// index.js
// Cloud function entry. This file only assembles the request, dispatches to the
// matched route, and normalizes the response. No business logic lives here.

const { matchRoute } = require('./router');
const routes = require('./routes');
const { ok } = require('./utils/response');
const { handleError } = require('./middlewares/errorHandler');
const errors = require('./utils/errors');

// Normalize the CloudBase HTTP event (or SDK invocation) into a request object.
function buildRequest(event) {
  const e = event && event.http ? event.http : event || {};
  const method = (e.httpMethod || 'GET').toUpperCase();

  let path = e.path || '/';
  let query = {};
  if (typeof e.queryString === 'string') {
    query = parseQuery(e.queryString);
  } else if (e.queryString && typeof e.queryString === 'object') {
    query = e.queryString;
  }
  const qIdx = path.indexOf('?');
  if (qIdx >= 0) {
    query = Object.assign(parseQuery(path.slice(qIdx + 1)), query);
    path = path.slice(0, qIdx);
  }

  let body = e.body;
  if (typeof body === 'string') {
    if (e.isBase64Encoded) body = Buffer.from(body, 'base64').toString('utf8');
    try {
      body = body ? JSON.parse(body) : {};
    } catch (err) {
      body = {};
    }
  }
  if (!body || typeof body !== 'object') body = {};

  return { method, path, query, body, headers: e.headers || {} };
}

function parseQuery(qs) {
  const out = {};
  String(qs)
    .split('&')
    .forEach((pair) => {
      if (!pair) return;
      const idx = pair.indexOf('=');
      const k = decodeURIComponent(idx >= 0 ? pair.slice(0, idx) : pair);
      const val = idx >= 0 ? decodeURIComponent(pair.slice(idx + 1)) : '';
      out[k] = val;
    });
  return out;
}

exports.main = async (event, context) => {
  const req = buildRequest(event);
  const ctx = { req, params: {}, user: null, gate: null };
  try {
    const matched = matchRoute(routes, req.method, req.path);
    if (!matched) {
      throw errors.notFound('Route not found: ' + req.method + ' ' + req.path);
    }
    ctx.params = matched.params;
    const middlewares = matched.route.middlewares || [];
    for (let i = 0; i < middlewares.length; i += 1) {
      await middlewares[i](ctx);
    }
    const result = await matched.route.handler(ctx);
    if (req._start) {
      console.log('[response] ' + req.method + ' ' + req.path + ' ' + (Date.now() - req._start) + 'ms');
    }
    return ok(result);
  } catch (err) {
    if (req._start) {
      console.log('[error] ' + req.method + ' ' + req.path + ' ' + (Date.now() - req._start) + 'ms');
    }
    return handleError(err);
  }
};
