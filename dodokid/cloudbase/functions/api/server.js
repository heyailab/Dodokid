// server.js
// 自托管 HTTP 入口（DB_DRIVER=mongo 形态专用）。
//
// 为什么不复用 CloudBase：云函数是 `exports.main(event)` 形态，没有监听端口。
// 这里起一个 Express，把请求规整成与云函数事件相同的结构后，交给 index.handleRequest ——
// 路由表、中间件顺序、错误契约全部复用同一份实现，不会出现"两套行为"。
//
// 相比云函数形态的一个额外收益：能返回**真实的 HTTP 状态码**
// （云函数 HTTP 触发器只能返回 200 + body）。业务错误码高位即状态码：40000→400。

const express = require('express');
const config = require('./config');
const { handleRequest } = require('./index');
const { db, storage } = require('./appContext');

const app = express();

// 反向代理后取真实客户端 IP（限流按调用方计数，拿到错 IP 会导致限流失效）
app.set('trust proxy', config.trustProxy);
app.disable('x-powered-by');

/**
 * 媒体直传端点必须在 JSON 解析**之前**处理：请求体是图片/音频的原始字节，
 * 走 express.json 会被解析失败。body-parser 解析过��会打标记，
 * 因此后面的 express.json 不会再重复处理这个请求。
 */
const blobPath = config.httpBasePath + '/admin/media/blob';
app.use(
  blobPath,
  express.raw({ type: '*/*', limit: (config.mediaMaxSizeMB || 50) + 'mb' }),
  (req, _res, next) => {
    req.rawBody = Buffer.isBuffer(req.body) ? req.body : null;
    next();
  }
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

/**
 * 本地媒体分发（MEDIA_DRIVER=local 时的默认读路径）。
 * 生产建议让 Nginx 用 alias 直接托管（见 deploy/nginx/dodokid.conf），
 * Node 侧这份实现的价值在于：本地开发无需额外配 Nginx 也能跑通全链路。
 */
if (config.mediaPublicPath && storage && typeof storage.resolvePath === 'function') {
  const mediaPrefix = config.mediaPublicPath;
  app.get(mediaPrefix + '/*', (req, res) => {
    // 注意：app.get 带路径参数时**不会**剥掉挂载前缀（只有 app.use 会），
    // 所以这里要自己切掉 /media 前缀，否则解析出的路径会多一层 media/。
    const key = decodeURIComponent(req.path.slice(mediaPrefix.length).replace(/^\//, ''));
    let file;
    try {
      file = storage.resolvePath(key); // 内部已做路径穿越校验
    } catch (err) {
      return res.status(400).json({ success: false, code: 40000, message: 'Invalid media key', data: null });
    }
    res.sendFile(
      file,
      {
        // cdnKey 里带 uuid，文件内容变更即换名，可长期强缓存
        headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
      },
      (err) => {
        if (err && !res.headersSent) {
          res.status(404).json({ success: false, code: 40400, message: 'Media not found', data: null });
        }
      }
    );
  });
}

/** 业务码 → HTTP 状态码。code 0 表示成功；其余取高位（40000 → 400）。 */
function statusFor(code) {
  if (!code) return 200;
  const derived = Math.floor(Number(code) / 100);
  return derived >= 400 && derived <= 599 ? derived : 500;
}

app.get('/health', async (req, res) => {
  if (typeof db.ping === 'function') {
    try {
      await db.ping();
    } catch (err) {
      return res.status(503).json({ success: false, code: 50300, message: 'database unavailable', data: null });
    }
  }
  res.json({ success: true, code: 0, message: 'ok', data: { driver: config.dbDriver } });
});

// 路由表里注册的是**完整路径**（如 /api/v1/content/list），与 CloudBase 事件里的
// path 语义一致。Express 的 app.use 会剥掉挂载前缀，所以这里显式补回去 ——
// 不依赖"恰好没被剥掉"这种偶然行为。
app.use(config.httpBasePath, async (req, res) => {
  const path = req.path === '/' ? config.httpBasePath : config.httpBasePath + req.path;
  try {
    const result = await handleRequest({
      method: req.method,
      path,
      query: req.query,
      body: req.body,
      // 直传端点的原始字节（其余请求为 undefined）
      rawBody: req.rawBody,
      headers: req.headers,
    });
    res.status(statusFor(result.code)).json(result);
  } catch (err) {
    // handleRequest 内部已兜底所有业务异常；走到这里说明框架级问题
    console.error('Unhandled request error', err);
    res.status(500).json({ success: false, code: 50000, message: 'Internal server error', data: null });
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, code: 40400, message: 'Route not found', data: null });
});

const server = app.listen(config.httpPort, () => {
  console.log(
    '[server] listening on :' + config.httpPort +
    ' base=' + config.httpBasePath +
    ' driver=' + config.dbDriver +
    ' db=' + (config.dbDriver === 'mongo' ? config.mongoDbName : config.env)
  );
});

async function shutdown(signal) {
  console.log('[server] ' + signal + ' received, shutting down');
  server.close();
  if (typeof db.close === 'function') {
    await db.close().catch(() => {});
  }
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

module.exports = { app, server };
