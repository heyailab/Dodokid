// catalogAdmin.repo.js
// Data access for content_modules and content_categories (Spec 6.1/6.2).

const base = require('./base.repo');

const MODULES = 'content_modules';
const CATEGORIES = 'content_categories';

const listModules = () =>
  base.findWhere(MODULES, {}, { orderBy: { field: 'order', dir: 'asc' } });

const findModuleByKey = (key) => base.findOneWhere(MODULES, { key });
const getModuleById = (id) => base.getById(MODULES, id);
const createModule = (doc) => base.insert(MODULES, doc);
const updateModule = (id, patch) => base.updateById(MODULES, id, patch);
const removeModule = (id) => base.removeById(MODULES, id);

const listCategories = () =>
  base.findWhere(CATEGORIES, {}, { orderBy: { field: 'order', dir: 'asc' } });

const findCategoryByKey = (key) => base.findOneWhere(CATEGORIES, { key });
const getCategoryById = (id) => base.getById(CATEGORIES, id);
const createCategory = (doc) => base.insert(CATEGORIES, doc);
const updateCategory = (id, patch) => base.updateById(CATEGORIES, id, patch);
const removeCategory = (id) => base.removeById(CATEGORIES, id);

module.exports = {
  MODULES,
  CATEGORIES,
  listModules,
  findModuleByKey,
  getModuleById,
  createModule,
  updateModule,
  removeModule,
  listCategories,
  findCategoryByKey,
  getCategoryById,
  createCategory,
  updateCategory,
  removeCategory,
};
