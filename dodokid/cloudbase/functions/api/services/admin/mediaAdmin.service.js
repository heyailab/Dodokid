// mediaAdmin.service.js
// Media library: metadata list/detail, direct-upload credential issuance
// (metadata persisted up-front, AC-12), and guarded deletion.

const errors = require('../../utils/errors');
const mediaRepo = require('../../repositories/mediaAdmin.repo');
const contentRepo = require('../../repositories/contentAdmin.repo');
const auditService = require('./auditAdmin.service');
const credentials = require('./storageCredential.service');
const settingsService = require('./settingsAdmin.service');

function buildMeta(total, page, limit) {
  return auditService.buildMeta(total, page, limit);
}

async function listMedia(filters, page, limit) {
  const { items, total } = await mediaRepo.listMedia(filters, page, limit);
  return { items, meta: buildMeta(total, page, limit) };
}

async function getMedia(id) {
  const asset = await mediaRepo.getById(id);
  if (!asset) throw errors.notFound('Media asset not found');
  return asset;
}

async function uploadMedia(adminUser, ip, body) {
  // Policy comes from console settings (AdminSettings), not raw env config.
  const settings = await settingsService.getMediaPolicy();
  const mime = String(body.mime || '').toLowerCase();
  if (!settings.allowedMimeTypes.includes(mime)) {
    throw errors.badRequest('MIME type not allowed: ' + mime);
  }
  const maxBytes = settings.mediaMaxSizeMB * 1024 * 1024;
  if (!Number.isInteger(body.size) || body.size <= 0 || body.size > maxBytes) {
    throw errors.badRequest('File size exceeds the limit of ' + settings.mediaMaxSizeMB + ' MB');
  }
  const cdnKey = credentials.buildCdnKey(body.folder, body.fileName);
  const record = {
    itemId: body.itemId || null,
    folder: body.folder,
    fileName: body.fileName,
    mime,
    size: body.size,
    width: body.width || null,
    height: body.height || null,
    durationMs: body.durationMs || null,
    cdnKey,
    url: credentials.cdnUrlFor(cdnKey),
    uploadedBy: adminUser.id,
  };
  const created = await mediaRepo.create(record); // metadata first (AC-12)
  let upload;
  try {
    upload = await credentials.issueUploadCredentials(cdnKey, maxBytes);
  } catch (err) {
    // The record stays; the console can clean it up via DELETE /admin/media/:id
    // (documented in the openapi upload flow description).
    throw err;
  }
  await auditService.writeAudit({
    actor: adminUser.id,
    actorRole: adminUser.role,
    action: 'admin.media.upload',
    targetType: 'media_asset',
    targetId: created._id,
    before: null,
    after: { cdnKey, folder: created.folder, mime, size: created.size },
    ip,
  });
  return {
    mediaId: created._id,
    cdnKey: created.cdnKey,
    cdnUrl: created.url,
    upload,
  };
}

async function deleteMedia(adminUser, ip, id) {
  const asset = await mediaRepo.getById(id);
  if (!asset) throw errors.notFound('Media asset not found');
  // Never silently break a live page: published references block deletion.
  const [coverRefs, mediaRefRefs] = await Promise.all([
    contentRepo.countPublishedReferringCover(asset.cdnKey),
    contentRepo.countPublishedReferringMediaRef(asset.cdnKey),
  ]);
  if (coverRefs + mediaRefRefs > 0) {
    throw errors.conflict('Media asset is still referenced by published content');
  }
  await mediaRepo.removeById(id);
  await auditService.writeAudit({
    actor: adminUser.id,
    actorRole: adminUser.role,
    action: 'admin.media.delete',
    targetType: 'media_asset',
    targetId: id,
    before: { cdnKey: asset.cdnKey, folder: asset.folder, mime: asset.mime, size: asset.size },
    after: null,
    ip,
  });
  return { deleted: true };
}

module.exports = { listMedia, getMedia, uploadMedia, deleteMedia };
