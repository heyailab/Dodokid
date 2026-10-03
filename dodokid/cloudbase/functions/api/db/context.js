// context.js
// 数据库 / 媒体存储上下文的**驱动选择**（唯一实现）。
//
// 两个维度彼此独立，可自由组合：
//   数据库   DB_DRIVER=cloudbase（默认）→ CloudBase 文档数据库
//                          mongo          → 自托管 MongoDB（mongo.js）
//   媒体存储 MEDIA_DRIVER=cos            → 腾讯云 COS（直传，后端只存元数据）
//                          local（auto 默认）→ 服务器本地磁盘（localMedia.js）
//
// 为什么拆成两个维度：常见组合是「自托管 MongoDB + 本地磁盘」——
// 不需要为了存绘本封面去额外开通对象存储。数据库与媒体互不依赖。
//
// 单独抽出来是因为 appContext.js（运行时）与 db/ 下的工具脚本都需要它，
// 两处各写一份必然漂移。配置由调用方传入（工具脚本的配置来源不同）。
const { createMongoContext } = require('./mongo');
const { createLocalMediaStorage } = require('./localMedia');

/** 媒体存储：cloudbase 形态且未显式指定时用云存储；其余按配置走。 */
function createStorage(config, tcbApp) {
  const driver = config.mediaDriver || (config.cosBucket ? 'cos' : 'local');
  if (driver === 'cos') {
    if (tcbApp && typeof tcbApp.storage === 'function') return tcbApp.storage();
    // 自托管 + COS：复用 storageCredential 里的 STS 直传，
    // 读取仍走 localMedia 的公开地址拼接（对象存储的公开域名填 MEDIA_CDN_BASE_URL）
    return createLocalMediaStorage(config);
  }
  if (driver === 'cloudbase' && tcbApp) return tcbApp.storage();
  return createLocalMediaStorage(config);
}

function createContext(config) {
  if (config.dbDriver === 'mongo') {
    const mongo = createMongoContext(config);
    return {
      app: mongo.app,
      db: mongo.db,
      storage: createStorage(config, null),
      command: mongo.command,
      _: mongo.command,
    };
  }

  const tcb = require('@cloudbase/node-sdk');
  // 云函数运行时不需要显式密钥（走平台注入）；本地跑工具脚本时按需传入。
  const initOptions = { env: config.env };
  if (config.tcbSecretId && config.tcbSecretKey) {
    initOptions.secretId = config.tcbSecretId;
    initOptions.secretKey = config.tcbSecretKey;
  }
  const app = tcb.init(initOptions);
  const db = app.database();
  const command = db.command;
  return { app, db, storage: createStorage(config, app), command, _: command };
}

module.exports = { createContext, createStorage };
