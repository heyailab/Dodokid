// meta.service.js
// Build-level metadata: app version and privacy policy reference.

const config = require('../config');

function getVersion() {
  return {
    version: config.appVersion,
    minVersion: config.minAppVersion,
    updateRequired: false,
    // 媒体公开地址前缀随运行时配置下发：换域名只改后端 MEDIA_CDN_BASE_URL，
    // 不需要重新编译前端。未配置时下发空字符串，前端按自己的兜底值处理。
    // 绝不下发 null/undefined，避免客户端把 "null" 拼进 URL。
    mediaBaseUrl: config.mediaCdnBaseUrl || '',
  };
}

function getPrivacyPolicy() {
  return {
    url: config.privacyPolicyUrl,
    text: config.privacyPolicyText || null,
    updatedAt: new Date().toISOString(),
  };
}

module.exports = { getVersion, getPrivacyPolicy };
