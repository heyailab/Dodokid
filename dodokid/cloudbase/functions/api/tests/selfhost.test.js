// selfhost.test.js
// 自托管形态（DB_DRIVER=mongo + server.js）的测试：
//   A. Mongo 查询翻译的单元测试（不需要真实 MongoDB）
//   B. 自托管 HTTP 层的真实请求测试（真起 HTTP 服务、用 fetch 打接口）
//
// B 部分注入内存假库（与 smoke-* 相同的 require.cache 手法），
// 因此它验证的是"HTTP 层 + 路由 + 错误契约"，不验证 Mongo 驱动本身；
// 真实 Mongo 的端到端验证请在部署环境跑 db/init-mongo.js + 冒烟清单。
//
// 运行：node tests/selfhost.test.js

process.env.JWT_SECRET = process.env.JWT_SECRET || 'selfhost-test-secret';
process.env.NODE_ENV = 'development';
process.env.PORT = '0'; // 让内核分配空闲端口，避免与本机真实服务冲突

const path = require('path');

// ---- 注入假库 + 真实本地存储驱动（在 require server 之前）----
const fs = require('fs');
const os = require('os');
const createFakeDb = require('./fake-db');
const fakeDb = createFakeDb(require('./fixtures/admin-seed.json'));

// 媒体用真实的 localMedia 驱动，指向临时目录 —— 这样 /media 分发与
// 路径穿越防护能被真正执行到，而不是只测一个空壳 storage
const mediaRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dodokid-media-'));
const { createLocalMediaStorage } = require('../db/localMedia');
const localStorage = createLocalMediaStorage({
  mediaRoot,
  mediaCdnBaseUrl: 'https://dodokid.test/media',
  mediaMaxSizeMB: 1,
  mediaAllowedMimeTypes: ['image/png'],
});

const appContextPath = require.resolve('../appContext');
require.cache[appContextPath] = {
  id: appContextPath,
  filename: appContextPath,
  loaded: true,
  exports: {
    app: {},
    db: fakeDb,
    storage: localStorage,
    command: fakeDb.command,
    _: fakeDb.command,
  },
};

const { toMongoFilter, toMongoUpdate, createCommand, createRegExp } = require('../db/mongo');

let passed = 0;
let failed = 0;
function check(name, cond, extra) {
  if (cond) {
    passed += 1;
    console.log('PASS ' + name);
  } else {
    failed += 1;
    console.log('FAIL ' + name + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''));
  }
}
function eq(name, actual, expected) {
  check(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

// ============ A. 查询翻译 ============
const command = createCommand();
const db = { RegExp: createRegExp };

eq('in 操作符翻译为 $in', toMongoFilter({ role: command.in(['editor', 'admin']) }), {
  role: { $in: ['editor', 'admin'] },
});
eq(
  'RegExp 翻译为 $regex + $options',
  toMongoFilter({ title: db.RegExp({ regexp: '^a', options: 'i' }) }),
  { title: { $regex: '^a', $options: 'i' } }
);
eq('范围条件原样透传', toMongoFilter({ createdAt: { $gte: 'x', $lte: 'y' } }), {
  createdAt: { $gte: 'x', $lte: 'y' },
});
eq('等值条件不变', toMongoFilter({ status: 'published', n: 3 }), { status: 'published', n: 3 });
eq('空条件得到空 filter', toMongoFilter({}), {});

eq(
  'inc 操作符从 $set 中拆出到 $inc',
  toMongoUpdate({ count: command.inc(1), updatedAt: 'now' }),
  { $set: { updatedAt: 'now' }, $inc: { count: 1 } }
);
eq('纯更新只有 $set', toMongoUpdate({ title: 't' }), { $set: { title: 't' } });

// ============ A2. 本地磁盘媒体驱动 ============
(async () => {
  eq('本地媒体：公开地址按 MEDIA_CDN_BASE_URL 拼接',
    (await localStorage.getTempFileURL({ fileList: ['admin-media/covers/a.png'] })).fileList[0].tempFileURL,
    'https://dodokid.test/media/admin-media/covers/a.png');

  const put = await localStorage.putObject('admin-media/covers/x.png', Buffer.from('PNG-DATA'), 'image/png');
  check('本地媒体：写入返回字节数与类型', put.size === 8 && put.contentType === 'image/png', put);
  check('本地媒体：文件确实落盘',
    fs.existsSync(path.join(mediaRoot, 'admin-media/covers/x.png')));
  check('本地媒体：没有残留 .part 临时文件',
    fs.readdirSync(path.join(mediaRoot, 'admin-media/covers')).every((f) => !f.endsWith('.part')));

  const st = await localStorage.statObject('admin-media/covers/x.png');
  check('本地媒体：stat 返回大小', st && st.size === 8, st);

  // 路径穿越必须被挡住（../.. 能读到系统文件就是严重漏洞）
  let traversalBlocked = false;
  try {
    localStorage.resolvePath('../../etc/passwd');
  } catch (e) {
    traversalBlocked = true;
  }
  check('本地媒体：拒绝 ../ 路径穿越', traversalBlocked);
  let prefixBlocked = false;
  try {
    localStorage.resolvePath('../media-evil/x.png');
  } catch (e) {
    prefixBlocked = true;
  }
  check('本地媒体：拒绝同前缀绕过（../media-evil）', prefixBlocked);

  let rejected = null;
  try {
    await localStorage.putObject('admin-media/covers/big.png', Buffer.alloc(2 * 1024 * 1024), 'image/png');
  } catch (e) {
    rejected = e;
  }
  check('本地媒体：超限文件被拒', rejected !== null && rejected.code === 40000, rejected && rejected.code);

  let mimeRejected = null;
  try {
    await localStorage.putObject('admin-media/covers/x.exe', Buffer.from('MZ'), 'application/x-msdownload');
  } catch (e) {
    mimeRejected = e;
  }
  check('本地媒体：非白名单 MIME 被拒', mimeRejected !== null && mimeRejected.code === 40000, mimeRejected && mimeRejected.code);

  check('本地媒体：删除后 stat 为空', (await localStorage.deleteObject('admin-media/covers/x.png')) === true);
  check('本地媒体：删除不存在的文件返回 false',
    (await localStorage.deleteObject('admin-media/covers/none.png')) === false);
})();

// ============ B. 自托管 HTTP 层 ============
const { server } = require('../server');
const port = server.address().port;
const base = 'http://127.0.0.1:' + port;

async function call(method, urlPath, body, headers) {
  const res = await fetch(base + urlPath, {
    method,
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch (e) {
    json = null;
  }
  return { status: res.status, json };
}

async function main() {
  // 健康检查（含数据库探针；假库没有 ping 方法时应仍返回 200）
  const health = await call('GET', '/health');
  check('GET /health 返回 200', health.status === 200, health);
  check('健康检查遵循统一响应契约', health.json && health.json.success === true && health.json.code === 0, health.json);

  // 公开端点
  const version = await call('GET', '/api/v1/version');
  check('GET /api/v1/version 返回 200', version.status === 200, version);
  check(
    'version 返回版本号',
    version.json && version.json.data && version.json.data.version !== undefined,
    version.json
  );

  // 内容类接口全部需要鉴权（有意收紧的契约：App 侧未登录取不到任何内容）
  const list = await call('GET', '/api/v1/content/list');
  check('GET /api/v1/content/list 缺令牌返回 401', list.status === 401, list);
  eq('内容接口未授权业务码为 40100', list.json && list.json.code, 40100);

  // 隐私政策是公开端点
  const privacy = await call('GET', '/api/v1/privacyPolicy');
  check('GET /api/v1/privacyPolicy 返回 200', privacy.status === 200, privacy);

  // 未携带令牌 → 401（自托管能返回真实状态码；云函数形态做不到这点）
  const noAuth = await call('GET', '/api/v1/child/list');
  check('缺少令牌返回 HTTP 401', noAuth.status === 401, noAuth);
  eq('401 响应体业务码为 40100', noAuth.json && noAuth.json.code, 40100);
  check('401 响应体 success=false', noAuth.json && noAuth.json.success === false, noAuth.json);

  // 非法令牌 → 401
  const badToken = await call('GET', '/api/v1/child/list', undefined, { Authorization: 'Bearer nope' });
  check('非法令牌返回 HTTP 401', badToken.status === 401, badToken);

  // 未知路由 → 404（且是统一契约，不是 Express 默认 HTML）
  const missing = await call('GET', '/api/v1/definitely-not-a-route');
  check('未知路由返回 HTTP 404', missing.status === 404, missing);
  eq('404 响应体业务码为 40400', missing.json && missing.json.code, 40400);

  // 挂载点之外的路径 → 404 JSON
  const outside = await call('GET', '/definitely-not-a-route');
  check('挂载点外返回 404 JSON', outside.status === 404 && outside.json !== null, outside);

  // POST 正常分发：请求体被解析并进入中间件链（缺令牌 → 401，而不是 500）
  const post = await call('POST', '/api/v1/child/create', { nickname: 'x', ageGroup: '3-4' });
  check('POST 缺令牌返回 401 而非 500', post.status === 401, post);

  // ---- 本地媒体经 HTTP 分发（公开读） ----
  fs.mkdirSync(path.join(mediaRoot, 'admin-media/covers'), { recursive: true });
  fs.writeFileSync(path.join(mediaRoot, 'admin-media/covers/page1.png'), 'PNG-BYTES');
  const media = await fetch(base + '/media/admin-media/covers/page1.png');
  const mediaBody = await media.text();
  check('GET /media/<key> 返回 200', media.status === 200, media.status);
  eq('GET /media/<key> 返回文件内容', mediaBody, 'PNG-BYTES');
  check('GET /media/<key> 带强缓存头',
    (media.headers.get('cache-control') || '').includes('immutable'),
    media.headers.get('cache-control'));

  const missingMedia = await fetch(base + '/media/admin-media/covers/nope.png');
  check('GET /media/<不存在的文件> 返回 404', missingMedia.status === 404, missingMedia.status);

  // 路径穿越：URL 里的 ../ 会被 fetch/URL 归一化，所以用编码形式绕过
  const evil = await fetch(base + '/media/%2e%2e%2f%2e%2e%2fetc%2fpasswd');
  check('GET /media/<穿越路径> 不返回文件内容', evil.status !== 200, evil.status);

  server.close();
  console.log('\nRESULT: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('selfhost test crashed:', err);
  process.exit(1);
});
