// content.service.js
// Content discovery: list by module+age group, detail with media, search,
// category list, and signed CDN media URLs.

const errors = require('../utils/errors');
const { storage } = require('../appContext');
const contentRepo = require('../repositories/content.repo');

const AGE_GROUPS = ['3-4', '4-6'];

async function listContent(params) {
  const { moduleKey, ageGroup } = params || {};
  if (ageGroup && !AGE_GROUPS.includes(ageGroup)) {
    throw errors.badRequest('ageGroup must be one of 3-4, 4-6');
  }
  return contentRepo.listByModuleAge(moduleKey, ageGroup);
}

async function getContentItem(id) {
  // C-end detail: published items only (AC-15). Non-published answers 404
  // with no existence signal.
  const item = await contentRepo.getPublishedById(id);
  if (!item) throw errors.notFound('Content item not found');
  const media = await contentRepo.getMediaByItem(id);
  return { item, media };
}

async function searchContent(q) {
  if (!q || !String(q).trim()) throw errors.badRequest('q is required');
  return contentRepo.search(q);
}

async function listCategories() {
  return contentRepo.listModules();
}

// v1.2.1: sample chapters. ageGroup may be a single value or a comma-separated
// list; the repo enforces status='published' + isSample=true (AC-13/AC-15).
async function listSamples(ageGroup) {
  const ageGroups =
    ageGroup && String(ageGroup).trim()
      ? String(ageGroup)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : null;
  return contentRepo.listSamples(ageGroups);
}

async function getMediaUrl(itemId, mediaAssetId) {
  const item = await contentRepo.getPublishedById(itemId);
  if (!item) throw errors.notFound('Content item not found');
  const media = await contentRepo.getMediaByItem(itemId);
  const asset = mediaAssetId ? media.find((m) => m._id === mediaAssetId) : media[0];
  if (!asset) throw errors.notFound('Media asset not found');
  const fileList = Array.isArray(asset.cdnKey) ? asset.cdnKey : [asset.cdnKey];
  const res = await storage.getTempFileURL({ fileList });
  const entry = res && res.fileList && res.fileList[0];
  if (!entry || !entry.tempFileURL) {
    throw errors.internal('Failed to sign media URL');
  }
  return { url: entry.tempFileURL, expiresAt: entry.expireTime || null };
}

module.exports = {
  AGE_GROUPS,
  listContent,
  getContentItem,
  searchContent,
  listCategories,
  listSamples,
  getMediaUrl,
};
