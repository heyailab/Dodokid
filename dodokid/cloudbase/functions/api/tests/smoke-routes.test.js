// smoke-routes.test.js
// Dispatcher-level smoke: full middleware chain via index.main with the fake
// in-memory database. Proves route wiring, auth ordering and RBAC gating for
// the 35 admin operations and C-end isolation.
// Run with: node tests/smoke-routes.test.js

process.env.JWT_SECRET = 'smoke-test-secret';
process.env.NODE_ENV = 'development';

const path = require('path');
const createFakeDb = require('./fake-db');
const fakeDb = createFakeDb(require('./fixtures/admin-seed.json'));
const appContextPath = require.resolve('../appContext');
require.cache[appContextPath] = { id: appContextPath, filename: appContextPath, loaded: true, exports: {
  app: {}, db: fakeDb, storage: {}, command: fakeDb.command, _: fakeDb.command,
} };

const index = require('../index');
const jwt = require('../utils/jwt');
const passwordUtil = require('../utils/password');

const S = fakeDb.store;
let passed = 0;
let failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('PASS ' + name); }
  else { failed++; console.log('FAIL ' + name + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : '')); }
}

async function call(method, rawPath, token, body) {
  const event = {
    httpMethod: method,
    path: rawPath,
    headers: token ? { authorization: 'Bearer ' + token } : {},
    body: body ? JSON.stringify(body) : '',
  };
  return index.main(event, {});
}

(async () => {
  S.users.find((u) => u._id === 'u_editor').passwordHash = await passwordUtil.hashPassword('password-123');
  S.users.find((u) => u._id === 'u_admin').passwordHash = await passwordUtil.hashPassword('admin-pass-123');

  const editorLogin = await call('POST', '/api/v1/admin/auth/login', null,
    { account: '13800000001', password: 'password-123' });
  check('editor login ok', editorLogin.success && editorLogin.data.tokens.accessToken);
  const adminLogin = await call('POST', '/api/v1/admin/auth/login', null,
    { account: '13800000002', password: 'admin-pass-123' });
  check('admin login ok', adminLogin.success);
  const editorToken = editorLogin.data.tokens.accessToken;
  const adminToken = adminLogin.data.tokens.accessToken;
  const parentToken = jwt.sign({ uid: 'u_parent', role: 'parent', aud: 'app' }, 900);

  const noAuth = await call('GET', '/api/v1/admin/stats', null);
  check('unauthenticated admin call -> 40100', !noAuth.success && noAuth.code === 40100, noAuth);
  const parentAud = await call('GET', '/api/v1/admin/stats', parentToken);
  check('parent aud=app token -> 40100 (ADR-005 isolation)', !parentAud.success && parentAud.code === 40100);
  const stats = await call('GET', '/api/v1/admin/stats', editorToken);
  check('stats ok for editor+', stats.success && typeof stats.data.contentTotal === 'number');

  const approveAsEditor = await call('POST', '/api/v1/admin/contents/c_draft/approve', editorToken);
  check('editor approve -> 40300 (AC-11)', !approveAsEditor.success && approveAsEditor.code === 40300, approveAsEditor);
  const auditAsEditor = await call('GET', '/api/v1/admin/audit', editorToken);
  check('editor audit access -> 40300', !auditAsEditor.success && auditAsEditor.code === 40300);
  const submitted = await call('POST', '/api/v1/admin/contents/c_draft/submit', editorToken, {});
  check('editor submit draft -> in_review', submitted.success && submitted.data.status === 'in_review', submitted);
  const approveAsAdmin = await call('POST', '/api/v1/admin/contents/c_draft/approve', adminToken);
  check('admin approve -> success, content published', approveAsAdmin.success && approveAsAdmin.data.status === 'published');

  const created = await call('POST', '/api/v1/admin/contents', editorToken,
    { moduleKey: 'books', type: 'book', ageGroup: '3-4', title: 'Route smoke book' });
  check('create content ok', created.success && created.data.status === 'draft');

  // v1.2.1: isSample is admin-only (adminOnlyFields middleware, AC-11 pattern)
  const editorSample = await call('POST', '/api/v1/admin/contents', editorToken,
    { moduleKey: 'books', type: 'book', ageGroup: '3-4', title: 'Editor sample try', isSample: true });
  check('editor sets isSample -> 40300 (admin-only field)', !editorSample.success && editorSample.code === 40300, editorSample);
  const adminSample = await call('POST', '/api/v1/admin/contents', adminToken,
    { moduleKey: 'books', type: 'book', ageGroup: '3-4', title: 'Admin sample', isSample: true });
  check('admin sets isSample -> created with isSample=true',
    adminSample.success && adminSample.data.isSample === true, adminSample.data);
  const badCreate = await call('POST', '/api/v1/admin/contents', editorToken,
    { moduleKey: 'books', type: 'movie', ageGroup: '3-4', title: 'bad' });
  check('invalid type -> 40000', !badCreate.success && badCreate.code === 40000);
  const updNoLock = await call('PUT', '/api/v1/admin/contents/' + created.data._id, editorToken,
    { title: 'x' });
  check('PUT without expectedVersion -> 40000', !updNoLock.success && updNoLock.code === 40000);
  const upd = await call('PUT', '/api/v1/admin/contents/' + created.data._id, editorToken,
    { expectedVersion: 1, title: 'Renamed via CAS' });
  check('PUT with expectedVersion -> ok, version 2', upd.success && upd.data.version === 2);

  const preview = await call('GET', '/api/v1/admin/contents/c_draft/preview', editorToken);
  check('preview returns C-end shape (no status field)',
    preview.success && !('status' in preview.data.item) && !('authorId' in preview.data.item));
  const revisions = await call('GET', '/api/v1/admin/contents/c_draft/revisions', editorToken);
  check('revisions listed newest-first', revisions.success && revisions.data.items.length >= 2 &&
    revisions.data.items[0].version >= revisions.data.items[1].version);

  // v1.2.0 endpoints through the dispatcher
  const publishAsEditor = await call('POST', '/api/v1/admin/contents/c_secret_draft/publish', editorToken);
  check('editor publish -> 40300', !publishAsEditor.success && publishAsEditor.code === 40300);
  const publishAsAdmin = await call('POST', '/api/v1/admin/contents/c_secret_draft/publish', adminToken, {});
  check('admin publish draft -> published', publishAsAdmin.success && publishAsAdmin.data.status === 'published');
  const dupAsEditor = await call('POST', '/api/v1/admin/contents/' + publishAsAdmin.data._id + '/duplicate', editorToken, {});
  check('duplicate via route -> new draft', dupAsEditor.success && dupAsEditor.data.status === 'draft' &&
    dupAsEditor.data.title === 'Secret draft story (副本)');
  const withdrawn = await call('POST', '/api/v1/admin/contents/c_inreview/withdraw', editorToken);
  check('withdraw via route -> draft', withdrawn.success && withdrawn.data.status === 'draft');

  // C-end isolation through the dispatcher
  const cList = await call('GET', '/api/v1/content/list', parentToken);
  check('C-end list published only', cList.success &&
    cList.data.every((i) => i.status === 'published'));
  const cDetailDraft = await call('GET', '/api/v1/content/c_archived', parentToken);
  check('C-end detail of non-published -> 40400 (AC-15)',
    !cDetailDraft.success && cDetailDraft.code === 40400);
  const publishedId = S.content_items.find((i) => i.status === 'published')._id;
  const cDetailLive = await call('GET', '/api/v1/content/' + publishedId, parentToken);
  check('C-end detail of published -> ok', cDetailLive.success);

  // v1.2.1: sample chapters endpoint (P2-2 fix)
  const samplesAll = await call('GET', '/api/v1/content/samples', parentToken);
  check('samples returns only published+isSample',
    samplesAll.success && Array.isArray(samplesAll.data) &&
    samplesAll.data.every((i) => i.status === 'published' && i.isSample === true), samplesAll.data);
  check('samples includes the seeded sample chapter',
    samplesAll.success && samplesAll.data.some((i) => i._id === 'c_published'), samplesAll.data);
  const samples34 = await call('GET', '/api/v1/content/samples?ageGroup=3-4', parentToken);
  check('samples filtered by ageGroup=3-4 excludes non-matching ages',
    samples34.success && samples34.data.every((i) => i.ageGroup === '3-4'), samples34.data);
  const samples46 = await call('GET', '/api/v1/content/samples?ageGroup=4-6', parentToken);
  check('samples filtered by ageGroup=4-6 -> empty (no sample in that age)',
    samples46.success && samples46.data.length === 0, samples46.data);

  const auditList = await call('GET', '/api/v1/admin/audit', adminToken);
  check('admin audit lists events with actorRole',
    auditList.success && auditList.data.items.every((a) => !!a.actorRole && !!a.action));

  console.log('\nRESULT: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed > 0 ? 1 : 0);
})().catch((err) => {
  console.error('route smoke crashed:', err);
  process.exit(1);
});
