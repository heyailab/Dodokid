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

/**
 * 核心分发：与运行形态无关。CloudBase 云函数（exports.main）与自托管 HTTP 层
 * （server.js）都调用它，确保两种部署下路由、中间件与错误行为完全一致 ——
 * 不允许出现两套路由实现，否则行为会随部署形态漂移。
 */
async function handleRequest(req) {
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
}

/** CloudBase 云函数入口：把云函数 HTTP 事件规整为请求后交给 handleRequest。 */
exports.main = async (event) => handleRequest(buildRequest(event));

// 供自托管 HTTP 层复用（server.js）
exports.handleRequest = handleRequest;
exports.buildRequest = buildRequest;
