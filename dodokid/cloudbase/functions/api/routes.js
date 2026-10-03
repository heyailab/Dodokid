// routes.js
// Route table. Assembles endpoints with their middleware chains and handlers.
// Middleware order: logger -> rate limit / auth / gate -> validation -> handler.

const config = require('./config');
const { logger } = require('./middlewares/logger');
const authMw = require('./middlewares/auth');
const gateMw = require('./middlewares/gate');
const { rateLimit } = require('./middlewares/rateLimit');
const { validate } = require('./middlewares/validate');
const v = require('./validators/schemas');

const parentC = require('./controllers/parent.controller');
const childC = require('./controllers/child.controller');
const contentC = require('./controllers/content.controller');
const progressC = require('./controllers/progress.controller');
const milestonesC = require('./controllers/milestones.controller');
const consentC = require('./controllers/consent.controller');
const settingsC = require('./controllers/settings.controller');
const gateC = require('./controllers/gate.controller');
const prefsC = require('./controllers/preferences.controller');
const feedbackC = require('./controllers/feedback.controller');
const metaC = require('./controllers/meta.controller');

const auth = authMw.authMiddleware;
const gate = gateMw.gateMiddleware;

const routes = [
  // Parent authentication
  {
    method: 'POST',
    path: '/api/v1/parent/sendSmsCode',
    middlewares: [logger, rateLimit('sms', config.smsRateLimitPerMin), validate(v.vSendSmsCode)],
    handler: parentC.sendSmsCode,
  },
  {
    method: 'POST',
    path: '/api/v1/parent/verifyCode',
    middlewares: [logger, rateLimit('login', config.loginRateLimitPerMin), validate(v.vVerifyCode)],
    handler: parentC.verifyCode,
  },
  {
    method: 'POST',
    path: '/api/v1/parent/register',
    middlewares: [logger, rateLimit('login', config.loginRateLimitPerMin), validate(v.vRegister)],
    handler: parentC.register,
  },
  {
    method: 'POST',
    path: '/api/v1/parent/login',
    middlewares: [logger, rateLimit('login', config.loginRateLimitPerMin), validate(v.vLogin)],
    handler: parentC.login,
  },
  {
    method: 'POST',
    path: '/api/v1/parent/logout',
    middlewares: [logger, auth],
    handler: parentC.logout,
  },

  // Child profiles
  {
    method: 'POST',
    path: '/api/v1/child/create',
    middlewares: [logger, auth, validate(v.vChildCreate)],
    handler: childC.create,
  },
  {
    method: 'POST',
    path: '/api/v1/child/switch',
    middlewares: [logger, auth, validate(v.vChildSwitch)],
    handler: childC.switchActive,
  },
  {
    method: 'GET',
    path: '/api/v1/child/list',
    middlewares: [logger, auth],
    handler: childC.list,
  },
  {
    method: 'GET',
    path: '/api/v1/child/:id',
    middlewares: [logger, auth],
    handler: childC.get,
  },
  {
    method: 'PUT',
    path: '/api/v1/child/:id',
    middlewares: [logger, auth, validate(v.vChildUpdate)],
    handler: childC.update,
  },
  {
    method: 'DELETE',
    path: '/api/v1/child/:id',
    middlewares: [logger, auth],
    handler: childC.remove,
  },

  // Content catalog (requires auth; contains no child PII)
  {
    method: 'GET',
    path: '/api/v1/content/list',
    middlewares: [logger, auth],
    handler: contentC.list,
  },
  {
    method: 'GET',
    path: '/api/v1/content/search',
    middlewares: [logger, auth],
    handler: contentC.search,
  },
  {
    method: 'GET',
    path: '/api/v1/content/categories',
    middlewares: [logger, auth],
    handler: contentC.categories,
  },
  {
    method: 'GET',
    path: '/api/v1/content/samples',
    middlewares: [logger, auth],
    handler: contentC.samples,
  },
  {
    method: 'GET',
    path: '/api/v1/content/:id/mediaUrl',
    middlewares: [logger, auth],
    handler: contentC.mediaUrl,
  },
  {
    method: 'GET',
    path: '/api/v1/content/:id',
    middlewares: [logger, auth],
    handler: contentC.getItem,
  },

  // Progress
  {
    method: 'GET',
    path: '/api/v1/progress/:childId',
    middlewares: [logger, auth],
    handler: progressC.get,
  },
  {
    method: 'PUT',
    path: '/api/v1/progress/:childId',
    middlewares: [logger, auth, validate(v.vProgressUpsert)],
    handler: progressC.upsert,
  },
  {
    method: 'GET',
    path: '/api/v1/progress/:childId/list',
    middlewares: [logger, auth],
    handler: progressC.list,
  },

  // Milestones
  {
    method: 'GET',
    path: '/api/v1/milestones/:childId',
    middlewares: [logger, auth],
    handler: milestonesC.list,
  },

  // Parental settings (require parent gate)
  {
    method: 'GET',
    path: '/api/v1/parent/settings',
    middlewares: [logger, auth, gate],
    handler: settingsC.get,
  },
  {
    method: 'PUT',
    path: '/api/v1/parent/settings/timeLimit',
    middlewares: [logger, auth, gate, validate(v.vTimeLimit)],
    handler: settingsC.setTimeLimit,
  },

  // Parent gate (setup is a documented addition; verify is in the Spec)
  {
    method: 'POST',
    path: '/api/v1/parent/gate/setup',
    middlewares: [logger, auth, validate(v.vGateSetup)],
    handler: gateC.setup,
  },
  {
    method: 'POST',
    path: '/api/v1/parent/gate/verify',
    middlewares: [logger, auth, validate(v.vGateVerify)],
    handler: gateC.verify,
  },

  // Consent
  {
    method: 'POST',
    path: '/api/v1/consent/record',
    middlewares: [logger, auth, validate(v.vConsent)],
    handler: consentC.record,
  },

  // Preferences
  {
    method: 'PUT',
    path: '/api/v1/preferences',
    middlewares: [logger, auth, validate(v.vPreferences)],
    handler: prefsC.update,
  },

  // Feedback
  {
    method: 'POST',
    path: '/api/v1/feedback',
    middlewares: [logger, auth, validate(v.vFeedback)],
    handler: feedbackC.submit,
  },

  // Meta (public)
  {
    method: 'GET',
    path: '/api/v1/version',
    middlewares: [logger],
    handler: metaC.getVersion,
  },
  {
    method: 'GET',
    path: '/api/v1/privacyPolicy',
    middlewares: [logger],
    handler: metaC.getPrivacyPolicy,
  },
];

// Operations console routes (Spec v0.2 section 5.2) share the same dispatcher;
// admin routes carry their own adminAuth + rbac middleware chains.
const adminRoutes = require('./admin.routes');

module.exports = routes.concat(adminRoutes);
