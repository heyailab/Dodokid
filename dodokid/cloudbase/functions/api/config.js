// config.js
// Environment configuration loader.
// All secrets and environment-specific values are read from process.env.
// No hardcoded credentials are allowed (P0 rule).

function str(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

const nodeEnv = str('NODE_ENV', 'production');

const config = {
  // CloudBase environment id. In a cloud function this is injected automatically;
  // it can be overridden for local/test execution.
  env: str('TCB_ENV', str('CLOUDBASE_ENV', 'dodokid-env')),

  // JWT signing secret. Required in production; an empty value triggers a dev
  // fallback only when NODE_ENV is not "production".
  jwtSecret: str('JWT_SECRET', ''),
  jwtAccessTtlSec: Number(str('JWT_ACCESS_TTL_SEC', '900')), // 15 minutes
  jwtRefreshTtlSec: Number(str('JWT_REFRESH_TTL_SEC', '604800')), // 7 days
  gateTokenTtlSec: Number(str('GATE_TOKEN_TTL_SEC', '300')), // 5 minutes parent gate

  // SMS verification code settings.
  smsCodeTtlSec: Number(str('SMS_CODE_TTL_SEC', '300')),
  smsCodeLength: Number(str('SMS_CODE_LENGTH', '6')),
  smsRateLimitPerMin: Number(str('SMS_RATE_LIMIT_PER_MIN', '10')),
  loginRateLimitPerMin: Number(str('LOGIN_RATE_LIMIT_PER_MIN', '10')),
  defaultRateLimitPerMin: Number(str('DEFAULT_RATE_LIMIT_PER_MIN', '60')),

  // Meta endpoints.
  appVersion: str('APP_VERSION', '1.0.0'),
  minAppVersion: str('MIN_APP_VERSION', '1.0.0'),
  privacyPolicyUrl: str('PRIVACY_POLICY_URL', 'https://dodokid.example.com/privacy'),
  privacyPolicyText: str('PRIVACY_POLICY_TEXT', ''),

  // SMS provider: "log" (development, prints code) or "tencent" (wire tencentcloud SDK).
  smsProvider: str('SMS_PROVIDER', 'log'),

  // Operations console (Spec v0.2 section 5.2, ADR-005). Admin tokens are
  // issued with audience "admin" and are cryptographically isolated from
  // parent tokens (audience "app").
  adminAccessTtlSec: Number(str('ADMIN_ACCESS_TTL_SEC', '900')), // 15 minutes
  adminRefreshTtlSec: Number(str('ADMIN_REFRESH_TTL_SEC', '604800')), // 7 days
  adminLoginRateLimitPerMin: Number(str('ADMIN_LOGIN_RATE_LIMIT_PER_MIN', '10')),

  // Media upload (Spec 14.5): the console uploads files directly to cloud
  // storage with temporary COS credentials; the backend only stores metadata.
  mediaMaxSizeMB: Number(str('MEDIA_MAX_SIZE_MB', '50')),
  mediaAllowedMimeTypes: str(
    'MEDIA_ALLOWED_MIME_TYPES',
    'image/png,image/jpeg,image/webp,audio/mpeg,audio/mp4'
  ).split(','),
  uploadCredTtlSec: Number(str('UPLOAD_CRED_TTL_SEC', '1800')),
  cosSecretId: str('COS_SECRET_ID', ''),
  cosSecretKey: str('COS_SECRET_KEY', ''),
  cosBucket: str('COS_BUCKET', ''), // full bucket name incl. APPID suffix, e.g. dodokid-1250000000
  cosRegion: str('COS_REGION', 'ap-guangzhou'),
  mediaCdnBaseUrl: str('MEDIA_CDN_BASE_URL', ''),

  devMode: nodeEnv !== 'production',
};

// Fail fast in production if the JWT secret is missing.
if (!config.jwtSecret && !config.devMode) {
  throw new Error('JWT_SECRET must be configured in production');
}

module.exports = config;
