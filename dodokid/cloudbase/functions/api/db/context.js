// context.js
// 数据库 / 存储上下文的**驱动选择**（唯一实现）。
//
// 两种部署形态返回同一套接口，下游（repositories / services / db 工具脚本）无感知：
//   DB_DRIVER=cloudbase（默认）→ 腾讯 CloudBase：文档数据库 + 云存储
//   DB_DRIVER=mongo            → 自托管：MongoDB（mongo.js）+ 媒体 CDN（localMedia.js）
//
// 单独抽出来是因为 appContext.js（云函数运行时）与 db/ 下的工具脚本都需要它，
// 两处各写一份必然漂移。
//
// 注意：这里不 require ../../config —— 工具脚本的配置来源不同（db/config.js），
// 且云函数配置带 JWT 强制校验，工具脚本不该被牵连。配置由调用方传入。

function createContext(config) {
  if (config.dbDriver === 'mongo') {
    const { createMongoContext } = require('./mongo');
    const { createLocalMediaStorage } = require('./localMedia');
    const mongo = createMongoContext(config);
    return {
      app: mongo.app,
      db: mongo.db,
      storage: createLocalMediaStorage(config),
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
  return { app, db, storage: app.storage(), command, _: command };
}

module.exports = { createContext };
