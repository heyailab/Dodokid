// smoke-admin.test.js
// Logic smoke tests for layers that do not require the CloudBase SDK at
// runtime: the appContext module is replaced with an in-memory fake before
// any api module is loaded. Run with: node tests/smoke-admin.test.js
//
// Covers (Spec AC-09/11/13/14/15, ADR-005/006):
//   - state machine: illegal transitions -> 409, in_review frozen -> 409
//   - optimistic lock: expectedVersion mismatch -> 409 with currentVersion
//   - revisions written on submit/approve/reject/restore, never on PUT
//   - restore is forward-only (new version, history untouched)
//   - RBAC: editor on admin-only -> 403; aud/app token on adminAuth -> 401
//   - C-end isolation: draft/in_review/archived invisible on list/search/detail
//   - passwordHash: bcrypt roundtrip, never present in API views

process.env.JWT_SECRET = 'smoke-test-secret';
process.env.NODE_ENV = 'development';

const path = require('path');

// ---- fake CloudBase database (shared module) ---------------------------------

const createFakeDb = require('./fake-db');
const fakeDb = createFakeDb(require('./fixtures/admin-seed.json'));
const appContextPath = require.resolve('../appContext');
require.cache[appContextPath] = { id: appContextPath, filename: appContextPath, loaded: true, exports: {
  app: {}, db: fakeDb, storage: {}, command: fakeDb.command, _: fakeDb.command,
} };

// ---- helpers ------------------------------------------------------------------

let passed = 0;
let failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('PASS ' + name); }
  else { failed++; console.log('FAIL ' + name + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : '')); }
}
async function throwsWith(name, fn, assert) {
  try { await fn(); check(name, false, 'no error thrown'); }
  catch (err) { check(name, assert(err), { code: err.code, message: err.message }); }
}
const adminUser = (id, role) => ({ id, role, phone: '13800000000' });

// ---- 1. state machine (ADR-006 TRANSITIONS, single source) ---------------------

const workflow = require('../services/admin/contentWorkflow.service');

(async () => {
  const S = fakeDb.store;
  const editorU = adminUser('u_editor', 'editor');
  const adminU = adminUser('u_admin', 'admin');
  const IP = '10.0.0.1';

  // 1a. illegal transitions -> 409 with currentStatus + allowed actions
  await throwsWith('submit on published -> 409', () =>
    workflow.submit(editorU, IP, 'c_published'), (e) => e.code === 40900 && e.details.currentStatus === 'published');
  await throwsWith('approve on draft -> 409', () =>
    workflow.approve(adminU, IP, 'c_draft'), (e) => e.code === 40900);
  await throwsWith('unpublish on draft -> 409', () =>
    workflow.unpublish(adminU, IP, 'c_draft'), (e) => e.code === 40900);
  check('allowedActions(draft) excludes approve',
    !workflow.allowedActions('draft').includes('approve') &&
    workflow.allowedActions('draft').includes('submit'));

  // 1b. happy path: draft -> submit (revision + audit) -> approve (revision)
  const s1 = await workflow.submit(editorU, IP, 'c_draft', 'ready for review');
  check('submit sets in_review + version+1', s1.status === 'in_review' && s1.version === 2, s1);
  check('submit wrote revision (AC-09)',
    S.content_revisions.some((r) => r.contentId === 'c_draft' && r.action === 'submit' && r.version === 2));
  check('submit wrote audit (AC-14)',
    S.audit_log.some((a) => a.action === 'admin.content.submit' && a.actorRole === 'editor' && a.ip === IP));
  const a1 = await workflow.approve(adminU, IP, 'c_draft');
  check('approve sets published + publishedAt', a1.status === 'published' && !!a1.publishedAt && a1.reviewerId === 'u_admin');
  check('approve wrote revision snapshot',
    S.content_revisions.some((r) => r.contentId === 'c_draft' && r.action === 'approve' && r.version === 3));

  // 1c. in_review frozen: PUT -> 409 (via contentAdmin.service.updateContent)
  const contentAdmin = require('../services/admin/contentAdmin.service');
  await contentAdmin.createContent(editorU, IP, {
    moduleKey: 'books', type: 'book', ageGroup: '3-4', title: 'Freeze test',
  }).then(async (created) => {
    await workflow.submit(editorU, IP, created._id);
    await throwsWith('PUT on in_review -> 409 (frozen)', () =>
      contentAdmin.updateContent(editorU, IP, created._id, { expectedVersion: 2, title: 'x' }),
      (e) => e.code === 40900);
    // reject -> draft, revision with reason
    const r1 = await workflow.reject(adminU, IP, created._id, 'too hard for 3-4');
    check('reject -> draft', r1.status === 'draft');
    check('reject revision carries reason',
      S.content_revisions.some((r) => r.action === 'reject' && r.note === 'too hard for 3-4'));
  });

  // 1d. optimistic lock: stale expectedVersion -> 409 with currentVersion
  await throwsWith('CAS mismatch -> 409 + currentVersion', () =>
    contentAdmin.updateContent(editorU, IP, 'c_published', { expectedVersion: 1, title: 'stale' }),
    (e) => e.code === 40900 && e.details.currentVersion === 2);

  // 1e. reEdit: PUT on archived -> draft
  const archived = await workflow.archive(adminU, IP, 'c_published');
  check('archive published -> archived', archived.status === 'archived');
  const reEd = await contentAdmin.updateContent(editorU, IP, 'c_published', {
    expectedVersion: archived.version, title: 'Re-edited title',
  });
  check('reEdit archived -> draft via PUT', reEd.status === 'draft' && reEd.title === 'Re-edited title');
  check('PUT/reEdit writes NO revision',
    !S.content_revisions.some((r) => r.contentId === 'c_published' && ['update', 'reEdit'].includes(r.action)));

  // 1f. restore: forward-only, history never rewritten
  const beforeCount = S.content_revisions.filter((r) => r.contentId === 'c_draft').length;
  const target = S.content_revisions.find((r) => r.contentId === 'c_draft' && r.action === 'submit');
  const restored = await workflow.restore(adminU, IP, 'c_draft', target._id);
  check('restore -> draft with version+1', restored.status === 'draft');
  const afterCount = S.content_revisions.filter((r) => r.contentId === 'c_draft').length;
  check('restore appends revision, history intact', afterCount === beforeCount + 1);
  check('restore wrote audit', S.audit_log.some((a) => a.action === 'admin.content.restore'));

  // 1g. publish (draft -> published, openapi v1.2.0)
  // c_draft is draft after the restore in 1f: put it back into review first
  // so the negative case (publish only allowed from draft) can be exercised.
  await workflow.submit(editorU, IP, 'c_draft');
  await throwsWith('publish on in_review -> 409', () =>
    workflow.publish(adminU, IP, 'c_draft'), (e) => e.code === 40900);
  const pub = await contentAdmin.createContent(editorU, IP, {
    moduleKey: 'books', type: 'book', ageGroup: '4-6', title: 'Direct publish',
  });
  await throwsWith('publish with stale expectedVersion -> 409', () =>
    workflow.publish(adminU, IP, pub._id, pub.version + 5), (e) => e.code === 40900);
  const published = await workflow.publish(adminU, IP, pub._id, pub.version);
  check('publish draft -> published + publishedAt', published.status === 'published' && !!published.publishedAt);
  check('publish wrote revision action=publish',
    S.content_revisions.some((r) => r.contentId === pub._id && r.action === 'publish' && r.version === published.version));
  check('publish wrote audit admin.content.publish',
    S.audit_log.some((a) => a.action === 'admin.content.publish'));

  // 1h. withdraw (in_review -> draft, editor+, no revision)
  const wd = await contentAdmin.createContent(editorU, IP, {
    moduleKey: 'books', type: 'book', ageGroup: '3-4', title: 'Withdraw me',
  });
  await workflow.submit(editorU, IP, wd._id);
  const wdCountBefore = S.content_revisions.filter((r) => r.contentId === wd._id).length;
  const withdrawn = await workflow.withdraw(editorU, IP, wd._id);
  check('withdraw -> draft, reviewerId cleared, version+1',
    withdrawn.status === 'draft' && withdrawn.reviewerId === null && withdrawn.version === 3);
  const wdCountAfter = S.content_revisions.filter((r) => r.contentId === wd._id).length;
  check('withdraw writes NO revision snapshot', wdCountBefore === wdCountAfter);
  check('withdraw wrote audit admin.content.withdraw',
    S.audit_log.some((a) => a.action === 'admin.content.withdraw' && a.actorRole === 'editor'));
  await throwsWith('withdraw on draft -> 409', () =>
    workflow.withdraw(editorU, IP, wd._id), (e) => e.code === 40900);

  // 1i. duplicate (editor+, any source status, openapi v1.2.0)
  const dup = await contentAdmin.duplicateContent(editorU, IP, 'c_published', {});
  check('duplicate -> new draft v1, default title has (副本)',
    dup._id !== 'c_published' && dup.status === 'draft' && dup.version === 1 &&
    dup.title === 'Re-edited title (副本)' && dup.publishedAt === null);
  const sourceAfter = await contentAdmin.getContent('c_published');
  check('duplicate leaves source untouched', sourceAfter.item.title === 'Re-edited title');
  const dupCustom = await contentAdmin.duplicateContent(editorU, IP, 'c_published', { title: 'Custom copy' });
  check('duplicate honors title override', dupCustom.title === 'Custom copy');
  check('duplicate audit carries after.sourceId',
    S.audit_log.some((a) => a.action === 'admin.content.duplicate' && a.targetId === dup._id &&
      a.after && a.after.sourceId === 'c_published'));

  // ---- 2. RBAC + adminAuth (ADR-005) --------------------------------------------

  const { rbac } = require('../middlewares/rbac');
  await throwsWith('rbac(admin) on editor -> 403 (AC-11)', () =>
    rbac('admin')({ adminUser: { id: 'u_editor', role: 'editor' } }), (e) => e.code === 40300);
  let okCtx = { adminUser: { id: 'u_admin', role: 'admin' } };
  await rbac('admin')(okCtx);
  await rbac('editor')({ adminUser: { id: 'u_editor', role: 'editor' } });
  check('rbac(admin) passes for admin, rbac(editor) passes for editor', true);

  const { adminAuthMiddleware } = require('../middlewares/adminAuth');
  const jwt = require('../utils/jwt');
  async function authAs(payload) {
    const ctx = { req: { headers: { authorization: 'Bearer ' + jwt.sign(payload, 900) } } };
    await adminAuthMiddleware(ctx);
    return ctx;
  }
  const good = await authAs({ uid: 'u_editor', aud: 'admin' });
  check('adminAuth accepts aud=admin active editor', good.adminUser.role === 'editor');
  await throwsWith('parent token (aud=app) -> 401', () =>
    authAs({ uid: 'u_parent', aud: 'app' }), (e) => e.code === 40100);
  await throwsWith('admin aud but parent uid -> 401', () =>
    authAs({ uid: 'u_parent', aud: 'admin' }), (e) => e.code === 40100);
  await throwsWith('disabled ops user -> 401', () =>
    authAs({ uid: 'u_disabled', aud: 'admin' }), (e) => e.code === 40100);

  // ---- 3. admin login (bcrypt) + passwordHash never leaks -----------------------

  const passwordUtil = require('../utils/password');
  const hash = await passwordUtil.hashPassword('password-123');
  check('bcrypt hash roundtrip', await passwordUtil.verifyPassword('password-123', hash));
  check('bcrypt rejects wrong password', !(await passwordUtil.verifyPassword('wrong-pass', hash)));

  const adminAuthService = require('../services/admin/adminAuth.service');
  // Provision a bcrypt passwordHash on the seed editor (as the ops bootstrap
  // script would) before exercising login.
  S.users.find((u) => u._id === 'u_editor').passwordHash = await passwordUtil.hashPassword('password-123');
  await throwsWith('login wrong password -> 401', () =>
    adminAuthService.login('13800000001', 'wrong-password-1', IP), (e) => e.code === 40100);
  const loginRes = await adminAuthService.login('13800000001', 'password-123', IP);
  check('login returns tokens + masked phone', !!loginRes.tokens.accessToken &&
    loginRes.user.phone.indexOf('****') > 0 && loginRes.user.role === 'editor');
  check('login audit written with ip', S.audit_log.some((a) => a.action === 'admin.auth.login' && a.ip === IP));
  check('adminUserView has no passwordHash', !('passwordHash' in adminAuthService.adminUserView(S.users[0])));

  const userService = require('../services/admin/userAdmin.service');
  const userList = await userService.listUsers({}, 1, 20);
  check('user list excludes parents + no passwordHash',
    userList.items.every((u) => u.role !== 'parent' && !('passwordHash' in u)));
  await throwsWith('promote parent via role endpoint -> 409', () =>
    userService.changeRole(adminU, IP, 'u_parent', 'editor'), (e) => e.code === 40900);
  const roleChanged = await userService.changeRole(adminU, IP, 'u_editor', 'admin');
  check('editor->admin role change ok + audit', roleChanged.role === 'admin' &&
    S.audit_log.some((a) => a.action === 'admin.user.role_change' && a.before.role === 'editor' && a.after.role === 'admin'));

  // ---- 4. C-end isolation (AC-13 / AC-15) ---------------------------------------

  const contentRepo = require('../repositories/content.repo');
  const listAll = await contentRepo.listByModuleAge();
  check('C-end list returns published only',
    listAll.every((i) => i.status === 'published') && listAll.length === S.content_items.filter((i) => i.status === 'published').length);
  check('C-end search hides draft/in_review/archived',
    (await contentRepo.search('Secret')).length === 0);
  check('C-end detail of draft -> null (404 upstream)',
    (await contentRepo.getPublishedById('c_draft')) === null);
  // c_published was re-edited to draft in section 1e; make a fresh published
  // item through the full workflow to prove published detail visibility.
  const fresh = await contentAdmin.createContent(editorU, IP, {
    moduleKey: 'books', type: 'book', ageGroup: '4-6', title: 'Fresh live story',
  });
  await workflow.submit(editorU, IP, fresh._id);
  await workflow.approve(adminU, IP, fresh._id);
  check('C-end detail of published -> found',
    (await contentRepo.getPublishedById(fresh._id)) !== null);
  check('C-end categories hide disabled modules',
    (await contentRepo.listModules()).every((m) => m.enabled));

  // ---- 5. media service validation (AC-12 metadata path) -------------------------

  const mediaService = require('../services/admin/mediaAdmin.service');
  await throwsWith('upload disallowed mime -> 40000', () =>
    mediaService.uploadMedia(editorU, IP, { folder: 'books', fileName: 'a.exe', mime: 'application/x-msdownload', size: 10 }),
    (e) => e.code === 40000);
  await throwsWith('upload oversize -> 40000', () =>
    mediaService.uploadMedia(editorU, IP, { folder: 'books', fileName: 'a.png', mime: 'image/png', size: 999 * 1024 * 1024 }),
    (e) => e.code === 40000);
  await throwsWith('upload without COS config -> clear config error, metadata kept', () =>
    mediaService.uploadMedia(editorU, IP, { folder: 'books', fileName: 'a.png', mime: 'image/png', size: 1000 }),
    (e) => e.code === 50000 && /COS_SECRET_ID/.test(e.message));
  check('media metadata record persisted before credentials (AC-12)',
    S.media_assets.some((m) => m.fileName === 'a.png' && m.uploadedBy === 'u_editor'));

  console.log('\nRESULT: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed > 0 ? 1 : 0);
})().catch((err) => {
  console.error('smoke crashed:', err);
  process.exit(1);
});
