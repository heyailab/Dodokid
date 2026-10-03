// config.js —— db 工具脚本专用配置
//
// 与 functions/api/config.js 刻意分离：工具脚本不需要 JWT 强制校验，
// 也不该因为缺 MEDIA_CDN_BASE_URL 而启动失败（那只影响运行时读媒体）。
function str(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

module.exports = {
  env: str('TCB_ENV', str('CLOUDBASE_ENV', 'dodokid-env')),
  dbDriver: str('DB_DRIVER', 'cloudbase'),
  tcbSecretId: str('TCB_SECRET_ID', ''),
  tcbSecretKey: str('TCB_SECRET_KEY', ''),
  mongoUri: str('MONGODB_URI', 'mongodb://127.0.0.1:27017'),
  mongoDbName: str('MONGODB_DB', 'dodokid'),
  mediaCdnBaseUrl: str('MEDIA_CDN_BASE_URL', ''),
  cosSecretId: str('COS_SECRET_ID', ''),
  cosSecretKey: str('COS_SECRET_KEY', ''),
  cosBucket: str('COS_BUCKET', ''),
  cosRegion: str('COS_REGION', 'ap-guangzhou'),
};
