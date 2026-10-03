// localMedia.js
// 自托管形态下的媒体存储适配器。
//
// CloudBase 分支用 app.storage().getTempFileURL() 换取带签名的临时链接；
// 自托管没有云存储可签，但内容服务（services/content.service.js 的 getMediaUrl）
// 只依赖同一套返回结构：{ fileList: [{ tempFileURL, expireTime }] }。
//
// 这里直接拼公开媒体地址（COS / 对象存储 / CDN 域名，由 MEDIA_CDN_BASE_URL 提供）。
// 未配置时**显式报错**而不是返回一个坏 URL —— 静默返回错地址会让绘本封面 404，
// 排查成本远高于启动即失败。

function createLocalMediaStorage(config) {
  return {
    async getTempFileURL(params) {
      const input = params || {};
      const list = Array.isArray(input.fileList) ? input.fileList : [input.fileList];
      const keys = list.filter(Boolean);
      const base = String(config.mediaCdnBaseUrl || '').replace(/\/+$/, '');
      if (!base) {
        throw new Error(
          'MEDIA_CDN_BASE_URL is required when DB_DRIVER=mongo (self-hosted): ' +
            'set it to the public base URL of your object storage / CDN'
        );
      }
      return {
        fileList: keys.map((key) => ({
          tempFileURL: base + '/' + String(key).replace(/^\/+/, ''),
          expireTime: null,
        })),
      };
    },
  };
}

module.exports = { createLocalMediaStorage };
