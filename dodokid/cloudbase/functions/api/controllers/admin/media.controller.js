// controllers/admin/media.controller.js
const mediaService = require('../../services/admin/mediaAdmin.service');

function paging(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit };
}

async function list(ctx) {
  const q = ctx.req.query || {};
  const { page, limit } = paging(q);
  return mediaService.listMedia(
    { folder: q.folder, itemId: q.itemId, mime: q.mime },
    page,
    limit
  );
}

async function upload(ctx) {
  return mediaService.uploadMedia(ctx.adminUser, ctx.clientIp, ctx.validated);
}

/** 直传落盘：请求体是原始字节，key 走查询参数（server.js 用 express.raw 解析）。 */
async function storeBlob(ctx) {
  return mediaService.storeBlob(
    ctx.adminUser,
    ctx.clientIp,
    (ctx.req.query || {}).key,
    ctx.req.rawBody,
    ctx.req.headers['content-type']
  );
}

async function get(ctx) {
  return mediaService.getMedia(ctx.params.id);
}

async function remove(ctx) {
  return mediaService.deleteMedia(ctx.adminUser, ctx.clientIp, ctx.params.id);
}

module.exports = { list, upload, storeBlob, get, remove };
