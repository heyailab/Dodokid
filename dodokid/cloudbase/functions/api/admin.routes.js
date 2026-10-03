// admin.routes.js
// Operations console route table (openapi v1.1.0, Spec v0.2 section 5.2).
// Middleware order: logger -> (rate limit) -> adminAuth -> rbac -> validate ->
// handler. Every endpoint except adminLogin requires adminBearerAuth.
// Permission levels per ADR-005 section 2.

const config = require('./config');
const { logger } = require('./middlewares/logger');
const { adminAuthMiddleware } = require('./middlewares/adminAuth');
const { rbac } = require('./middlewares/rbac');
const { rateLimit } = require('./middlewares/rateLimit');
const { validate, adminOnlyFields } = require('./middlewares/validate');
const v = require('./validators/admin/schemas');

const adminAuthC = require('./controllers/admin/auth.controller');
const statsC = require('./controllers/admin/stats.controller');
const contentC = require('./controllers/admin/content.controller');
const catalogC = require('./controllers/admin/catalog.controller');
const mediaC = require('./controllers/admin/media.controller');
const userC = require('./controllers/admin/user.controller');
const auditC = require('./controllers/admin/audit.controller');
const settingsC = require('./controllers/admin/settings.controller');

const P = '/api/v1/admin';
const editor = rbac('editor');
const admin = rbac('admin');
const auth = adminAuthMiddleware;

const adminRoutes = [
  // --- auth ---------------------------------------------------------------
  {
    method: 'POST',
    path: P + '/auth/login',
    middlewares: [logger, rateLimit('adminLogin', config.adminLoginRateLimitPerMin), validate(v.vAdminLogin)],
    handler: adminAuthC.login,
  },
  { method: 'POST', path: P + '/auth/logout', middlewares: [logger, auth, editor], handler: adminAuthC.logout },
  { method: 'GET', path: P + '/auth/me', middlewares: [logger, auth, editor], handler: adminAuthC.me },

  // --- stats ---------------------------------------------------------------
  { method: 'GET', path: P + '/stats', middlewares: [logger, auth, editor], handler: statsC.get },

  // --- contents --------------------------------------------------------------
  { method: 'GET', path: P + '/contents', middlewares: [logger, auth, editor], handler: contentC.list },
  { method: 'POST', path: P + '/contents', middlewares: [logger, auth, editor, validate(v.vContentCreate), adminOnlyFields(['isSample'])], handler: contentC.create },
  { method: 'GET', path: P + '/contents/:id', middlewares: [logger, auth, editor], handler: contentC.get },
  { method: 'PUT', path: P + '/contents/:id', middlewares: [logger, auth, editor, validate(v.vContentUpdate), adminOnlyFields(['isSample'])], handler: contentC.update },
  { method: 'DELETE', path: P + '/contents/:id', middlewares: [logger, auth, admin], handler: contentC.remove },
  { method: 'POST', path: P + '/contents/:id/submit', middlewares: [logger, auth, editor, validate(v.vSubmit)], handler: contentC.submit },
  { method: 'POST', path: P + '/contents/:id/approve', middlewares: [logger, auth, admin], handler: contentC.approve },
  { method: 'POST', path: P + '/contents/:id/publish', middlewares: [logger, auth, admin, validate(v.vPublish)], handler: contentC.publish },
  { method: 'POST', path: P + '/contents/:id/withdraw', middlewares: [logger, auth, editor], handler: contentC.withdraw },
  { method: 'POST', path: P + '/contents/:id/duplicate', middlewares: [logger, auth, editor, validate(v.vDuplicate)], handler: contentC.duplicate },
  { method: 'POST', path: P + '/contents/:id/reject', middlewares: [logger, auth, admin, validate(v.vReject)], handler: contentC.reject },
  { method: 'POST', path: P + '/contents/:id/unpublish', middlewares: [logger, auth, admin], handler: contentC.unpublish },
  { method: 'POST', path: P + '/contents/:id/archive', middlewares: [logger, auth, admin], handler: contentC.archive },
  { method: 'GET', path: P + '/contents/:id/revisions', middlewares: [logger, auth, editor], handler: contentC.revisions },
  { method: 'POST', path: P + '/contents/:id/restore/:revisionId', middlewares: [logger, auth, admin], handler: contentC.restore },
  { method: 'GET', path: P + '/contents/:id/preview', middlewares: [logger, auth, editor], handler: contentC.preview },

  // --- modules (list open to editor+, writes admin only) ---------------------
  { method: 'GET', path: P + '/modules', middlewares: [logger, auth, editor], handler: catalogC.listModules },
  { method: 'POST', path: P + '/modules', middlewares: [logger, auth, admin, validate(v.vModuleUpsert)], handler: catalogC.createModule },
  { method: 'PUT', path: P + '/modules/:id', middlewares: [logger, auth, admin, validate(v.vModuleUpsert)], handler: catalogC.updateModule },
  { method: 'DELETE', path: P + '/modules/:id', middlewares: [logger, auth, admin], handler: catalogC.deleteModule },

  // --- categories (list open to editor+, writes admin only) ------------------
  { method: 'GET', path: P + '/categories', middlewares: [logger, auth, editor], handler: catalogC.listCategories },
  { method: 'POST', path: P + '/categories', middlewares: [logger, auth, admin, validate(v.vCategoryUpsert)], handler: catalogC.createCategory },
  { method: 'PUT', path: P + '/categories/:id', middlewares: [logger, auth, admin, validate(v.vCategoryUpsert)], handler: catalogC.updateCategory },
  { method: 'DELETE', path: P + '/categories/:id', middlewares: [logger, auth, admin], handler: catalogC.deleteCategory },

  // --- media -----------------------------------------------------------------
  { method: 'GET', path: P + '/media', middlewares: [logger, auth, editor], handler: mediaC.list },
  { method: 'POST', path: P + '/media', middlewares: [logger, auth, editor, validate(v.vMediaUpload)], handler: mediaC.upload },
  { method: 'GET', path: P + '/media/:id', middlewares: [logger, auth, editor], handler: mediaC.get },
  { method: 'DELETE', path: P + '/media/:id', middlewares: [logger, auth, admin], handler: mediaC.remove },

  // --- users (admin only) ----------------------------------------------------
  { method: 'GET', path: P + '/users', middlewares: [logger, auth, admin], handler: userC.list },
  { method: 'PUT', path: P + '/users/:id/role', middlewares: [logger, auth, admin, validate(v.vRoleChange)], handler: userC.changeRole },
  { method: 'PUT', path: P + '/users/:id/status', middlewares: [logger, auth, admin, validate(v.vStatusChange)], handler: userC.changeStatus },

  // --- audit + settings (admin only) ------------------------------------------
  { method: 'GET', path: P + '/audit', middlewares: [logger, auth, admin], handler: auditC.list },
  { method: 'GET', path: P + '/settings', middlewares: [logger, auth, admin], handler: settingsC.get },
  { method: 'PUT', path: P + '/settings', middlewares: [logger, auth, admin, validate(v.vSettings)], handler: settingsC.update },
];

module.exports = adminRoutes;
