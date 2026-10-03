// content.controller.js
// Thin controller for content catalog endpoints.

const contentService = require('../services/content.service');

async function list(ctx) {
  const { moduleKey, ageGroup } = ctx.req.query || {};
  return contentService.listContent({ moduleKey, ageGroup });
}

async function search(ctx) {
  const { q } = ctx.req.query || {};
  return contentService.searchContent(q);
}

async function categories(ctx) {
  return contentService.listCategories();
}

// v1.2.1: sample chapters for the home try-read entry.
async function samples(ctx) {
  const { ageGroup } = ctx.req.query || {};
  return contentService.listSamples(ageGroup);
}

async function getItem(ctx) {
  return contentService.getContentItem(ctx.params.id);
}

async function mediaUrl(ctx) {
  const { mediaAssetId } = ctx.req.query || {};
  return contentService.getMediaUrl(ctx.params.id, mediaAssetId);
}

module.exports = { list, search, categories, samples, getItem, mediaUrl };
