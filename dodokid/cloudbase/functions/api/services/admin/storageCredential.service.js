// storageCredential.service.js
// 签发「直传目标」：临时 COS 凭证（对象存储）或服务器本地磁盘的上传地址。
// 两种形态都遵循 Spec 14.5 的顺序 —— **先建元数据、再传文件**，后端只落元数据。

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
  // 本地磁盘：不需要临时凭证，给后台一个 PUT 直传地址即可。
  // 自托管通常没有 COS，这一分支让「存绘本封面」不依赖任何外部服务。
  if (config.mediaDriver === 'local') {
    // 复用 appContext 里已初始化的 storage 实例，避免两处配置
    const { storage } = require('../../appContext');
    if (typeof storage.uploadTargetFor !== 'function') {
      throw errors.internal(
        'MEDIA_DRIVER=' + config.mediaDriver + ' requires a local media storage, but it is not active'
      );
    }
    return storage.uploadTargetFor(cdnKey, maxFileSize);
  }

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
