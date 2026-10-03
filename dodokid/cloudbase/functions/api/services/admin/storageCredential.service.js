// storageCredential.service.js
// Issues temporary COS upload credentials scoped to a single object path
// (Spec 14.5: temporary credentials, frontend direct upload, backend only
// stores metadata). Uses Tencent COS STS; requires COS_* env configuration.

const crypto = require('crypto');
const config = require('../../config');
const errors = require('../../utils/errors');

function deriveAppid(bucket) {
  const idx = String(bucket).lastIndexOf('-');
  return idx > 0 ? String(bucket).slice(idx + 1) : '';
}

function cdnUrlFor(cdnKey) {
  if (config.mediaCdnBaseUrl) {
    return config.mediaCdnBaseUrl.replace(/\/$/, '') + '/' + cdnKey;
  }
  return 'https://' + config.env + '.tcb.qcloud.la/' + cdnKey;
}

// Deterministic object path per openapi MediaUploadResult.cdnKey:
// "admin-media/{folder}/{yyyymm}/{uuid}-{fileName}"
function buildCdnKey(folder, fileName) {
  const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
  const now = new Date();
  const yyyymm =
    String(now.getUTCFullYear()) + String(now.getUTCMonth() + 1).padStart(2, '0');
  const uuid = crypto.randomUUID();
  return 'admin-media/' + folder + '/' + yyyymm + '/' + uuid + '-' + safeName;
}

async function issueUploadCredentials(cdnKey, maxFileSize) {
  if (!config.cosSecretId || !config.cosSecretKey || !config.cosBucket) {
    throw errors.internal(
      'Media upload credentials are not configured; set COS_SECRET_ID, COS_SECRET_KEY and COS_BUCKET'
    );
  }
  let STS;
  try {
    // Official Tencent COS STS SDK. Required lazily so environments without
    // the dependency still pass syntax checks and unrelated smoke tests.
    STS = require('qcloud-cos-sts');
  } catch (e) {
    throw errors.internal('Dependency qcloud-cos-sts is not installed');
  }
  const sts = new STS({
    secretId: config.cosSecretId,
    secretKey: config.cosSecretKey,
  });
  const appid = deriveAppid(config.cosBucket);
  const scope = appid
    ? 'qcs::cos:' + config.cosRegion + ':uid/' + appid + ':' + config.cosBucket + '/' + cdnKey
    : 'qcs::cos:' + config.cosRegion + ':uid/*:' + config.cosBucket + '/' + cdnKey;
  const policy = {
    version: '2.0',
    statement: [
      {
        action: ['name/cos:PutObject'],
        effect: 'allow',
        resource: [scope],
      },
    ],
  };
  return new Promise((resolve, reject) => {
    sts.getCredential(
      {
        region: config.cosRegion,
        durationSeconds: config.uploadCredTtlSec,
        policy,
      },
      (err, data) => {
        if (err) return reject(errors.internal('Failed to issue upload credentials: ' + err.message));
        const c = (data && data.credentials) || {};
        resolve({
          tmpSecretId: c.tmpSecretId,
          tmpSecretKey: c.tmpSecretKey,
          sessionToken: c.sessionToken,
          storagePath: cdnKey,
          expiresInSec: config.uploadCredTtlSec,
          maxFileSize,
        });
      }
    );
  });
}

module.exports = { buildCdnKey, cdnUrlFor, issueUploadCredentials };
