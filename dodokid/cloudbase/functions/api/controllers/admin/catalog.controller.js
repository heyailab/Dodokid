// controllers/admin/catalog.controller.js
// Module and category management endpoints.

const catalogService = require('../../services/admin/catalogAdmin.service');

async function listModules(ctx) {
  return catalogService.listModules();
}

async function createModule(ctx) {
  return catalogService.createEntry('modules', ctx.adminUser, ctx.clientIp, ctx.validated);
}

async function updateModule(ctx) {
  return catalogService.updateEntry('modules', ctx.adminUser, ctx.clientIp, ctx.params.id, ctx.validated);
}

async function deleteModule(ctx) {
  return catalogService.deleteEntry('modules', ctx.adminUser, ctx.clientIp, ctx.params.id);
}

async function listCategories(ctx) {
  return catalogService.listCategories();
}

async function createCategory(ctx) {
  return catalogService.createEntry('categories', ctx.adminUser, ctx.clientIp, ctx.validated);
}

async function updateCategory(ctx) {
  return catalogService.updateEntry('categories', ctx.adminUser, ctx.clientIp, ctx.params.id, ctx.validated);
}

async function deleteCategory(ctx) {
  return catalogService.deleteEntry('categories', ctx.adminUser, ctx.clientIp, ctx.params.id);
}

module.exports = {
  listModules,
  createModule,
  updateModule,
  deleteModule,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
