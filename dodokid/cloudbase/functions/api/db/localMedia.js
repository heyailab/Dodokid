// localMedia.js
// 「服务器本地磁盘」媒体存储驱动。
//
// 为什么需要它：绘本封面与音频总要有个地方存。自托管时最省事的就是服务器本地磁盘 ——
// 不用再买/开通对象存储。驱动负责三件事：
//   1. 写：putObject（配合 admin 直传端点）
//   2. 读：getTempFileURL 拼出公开地址，交给 Nginx alias 或本进程的 /media 路由
//   3. 删：deleteObject
//
// 安全要点：cdnKey 来自请求，必须**规范化后确认仍在 MEDIA_ROOT 之内**，
// 否则 ../.. 就能读写系统任意文件（路径穿越）。这是本文件最关键的一段。
//
// 注意：本地磁盘的可用性依赖单机。规模上来后把 MEDIA_DRIVER 切成 cos 即可，
// 业务代码无需改动（同一套 storage 接口）。

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const errors = require('../utils/errors');

/**
 * 把 cdnKey 解析成 mediaRoot 之内的绝对路径；越界即抛错。
 * 显式传 root（而不是读全局 config），便于测试与多实例使用不同根目录。
 */
function resolveLocalPath(cdnKey, mediaRoot) {
  const root = path.resolve(mediaRoot);
  const target = path.resolve(root, String(cdnKey || ''));
  // 目标必须严格在 root 之内。path.resolve 已消解 ../，
  // 这里再比较前缀，防止 `../media-evil` 这类同前缀绕过。
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw errors.badRequest('Invalid media key');
  }
  return target;
}

/** 扩展名 → Content-Type。取不到就用二进制流。 */
const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.json': 'application/json',
};

function contentTypeFor(cdnKey) {
  return MIME_BY_EXT[path.extname(String(cdnKey)).toLowerCase()] || 'application/octet-stream';
}

function publicBase(cfg) {
  const base = String(cfg.mediaCdnBaseUrl || '').replace(/\/+$/, '');
  if (!base) {
    throw errors.internal(
      'MEDIA_CDN_BASE_URL is required for local media storage (e.g. https://your-domain/media)'
    );
  }
  return base;
}

function createLocalMediaStorage(cfg) {
  const root = path.resolve(cfg.mediaRoot);

  return {
    /** 读：返回可直接访问的地址（不带签名 —— 绘本素材本身是公开的） */
    async getTempFileURL(params) {
      const input = params || {};
      const list = Array.isArray(input.fileList) ? input.fileList : [input.fileList];
      const base = publicBase(cfg);
      return {
        fileList: list
          .filter(Boolean)
          .map((key) => ({
            tempFileURL: base + '/' + String(key).replace(/^\/+/, ''),
            expireTime: null,
          })),
      };
    },

    /** 直传地址：后台拿到后把文件原样 PUT 上来（无需 COS 临时凭证） */
    uploadTargetFor(cdnKey, maxFileSize) {
      return {
        driver: 'local',
        method: 'PUT',
        uploadPath: '/api/v1/admin/media/blob?key=' + encodeURIComponent(cdnKey),
        storagePath: cdnKey,
        maxFileSize,
        headers: { 'Content-Type': contentTypeFor(cdnKey) },
      };
    },

    /** 写：把请求体落盘（同目录临时文件 + rename，避免半截文件被读到） */
    async putObject(cdnKey, buffer, mime) {
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw errors.badRequest('Empty upload body');
      }
      const maxBytes = Number(cfg.mediaMaxSizeMB || 50) * 1024 * 1024;
      if (buffer.length > maxBytes) {
        throw errors.badRequest('File too large: limit ' + cfg.mediaMaxSizeMB + 'MB');
      }
      const allowed = cfg.mediaAllowedMimeTypes || [];
      const type = mime || contentTypeFor(cdnKey);
      if (allowed.length > 0 && !allowed.includes(type)) {
        throw errors.badRequest('Unsupported media type: ' + type);
      }
      const target = resolveLocalPath(cdnKey, cfg.mediaRoot);
      await fsp.mkdir(path.dirname(target), { recursive: true });
      const tmp = target + '.' + crypto.randomBytes(6).toString('hex') + '.part';
      await fsp.writeFile(tmp, buffer);
      await fsp.rename(tmp, target);
      return { size: buffer.length, contentType: type };
    },

    async statObject(cdnKey) {
      try {
        const st = await fsp.stat(resolveLocalPath(cdnKey, cfg.mediaRoot));
        return { size: st.size, contentType: contentTypeFor(cdnKey) };
      } catch (err) {
        return null;
      }
    },

    async deleteObject(cdnKey) {
      try {
        await fsp.unlink(resolveLocalPath(cdnKey, cfg.mediaRoot));
        return true;
      } catch (err) {
        if (err && err.code === 'ENOENT') return false;
        throw err;
      }
    },

    /** 供 HTTP 读文件用：返回绝对路径，调用方负责 sendFile */
    resolvePath(cdnKey) {
      return resolveLocalPath(cdnKey, cfg.mediaRoot);
    },

    root,
  };
}

module.exports = { createLocalMediaStorage, resolveLocalPath, contentTypeFor };
