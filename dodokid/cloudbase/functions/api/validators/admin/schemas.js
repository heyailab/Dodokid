// validators/admin/schemas.js
// Input validation for /admin/* endpoints. Same contract as validators/
// schemas.js: each validator throws BAD_REQUEST on invalid input and returns
// a cleaned value.

const errors = require('../../utils/errors');
const { isValidPhone } = require('../../utils/phone');

const CONTENT_TYPES = ['book', 'song', 'habit'];
const AGE_GROUPS = ['3-4', '4-6'];
const STATUSES = ['draft', 'in_review', 'published', 'archived'];
const MEDIA_FOLDERS = ['books', 'songs', 'covers', 'icons', 'misc'];
const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

function reqString(body, field, opts) {
  opts = opts || {};
  const v = body[field];
  if (v === undefined || v === null || String(v).trim() === '') {
    throw errors.badRequest(field + ' is required');
  }
  const s = String(v).trim();
  if (opts.max && s.length > opts.max) {
    throw errors.badRequest(field + ' exceeds maximum length ' + opts.max);
  }
  return s;
}

function optString(body, field, max) {
  if (body[field] === undefined || body[field] === null) return undefined;
  const s = String(body[field]);
  if (max && s.length > max) throw errors.badRequest(field + ' exceeds maximum length ' + max);
  return s;
}

function reqInt(body, field, min, max) {
  const v = Number(body[field]);
  if (!Number.isInteger(v) || v < min || (max !== undefined && v > max)) {
    throw errors.badRequest(field + ' must be an integer between ' + min + ' and ' + (max || 'inf'));
  }
  return v;
}

function optTags(body) {
  if (body.tags === undefined) return undefined;
  if (!Array.isArray(body.tags) || body.tags.some((t) => typeof t !== 'string')) {
    throw errors.badRequest('tags must be an array of strings');
  }
  return body.tags;
}

function vAdminLogin(body) {
  const account = reqString(body, 'account');
  if (!isValidPhone(account)) throw errors.badRequest('account must be a valid phone number');
  const password = reqString(body, 'password');
  if (String(password).length < 8) throw errors.badRequest('password must be at least 8 characters');
  return { account, password };
}

function vContentCreate(body) {
  const moduleKey = reqString(body, 'moduleKey');
  const type = reqString(body, 'type');
  if (!CONTENT_TYPES.includes(type)) throw errors.badRequest('type must be one of ' + CONTENT_TYPES.join(', '));
  const ageGroup = reqString(body, 'ageGroup');
  if (!AGE_GROUPS.includes(ageGroup)) throw errors.badRequest('ageGroup must be one of 3-4, 4-6');
  const out = {
    moduleKey,
    type,
    ageGroup,
    title: reqString(body, 'title', { max: 80 }),
  };
  const summary = optString(body, 'summary', 300);
  if (summary !== undefined) out.summary = summary;
  const cover = optString(body, 'cover');
  if (cover !== undefined) out.cover = cover;
  const mediaRef = optString(body, 'mediaRef');
  if (mediaRef !== undefined) out.mediaRef = mediaRef;
  const tags = optTags(body);
  if (tags !== undefined) out.tags = tags;
  if (body.order !== undefined) out.order = Number(body.order) || 0;
  const locale = optString(body, 'locale', 10);
  if (locale !== undefined) out.locale = locale;
  return out;
}

function vContentUpdate(body) {
  const out = { expectedVersion: reqInt(body, 'expectedVersion', 1) };
  const title = optString(body, 'title', 80);
  if (title !== undefined) out.title = title;
  const summary = optString(body, 'summary', 300);
  if (summary !== undefined) out.summary = summary;
  ['cover', 'mediaRef', 'locale'].forEach((f) => {
    const v = optString(body, f, f === 'locale' ? 10 : undefined);
    if (v !== undefined) out[f] = v;
  });
  const tags = optTags(body);
  if (tags !== undefined) out.tags = tags;
  if (body.order !== undefined) out.order = Number(body.order) || 0;
  return out;
}

function vSubmit(body) {
  const out = {};
  const note = optString(body, 'note', 500);
  if (note !== undefined) out.note = note;
  return out;
}

function vReject(body) {
  return { reason: reqString(body, 'reason', { max: 500 }) };
}

// POST /admin/contents/:id/publish (openapi v1.2.0): body optional.
function vPublish(body) {
  const out = {};
  if (body && body.expectedVersion !== undefined && body.expectedVersion !== null) {
    out.expectedVersion = reqInt(body, 'expectedVersion', 1);
  }
  return out;
}

// POST /admin/contents/:id/duplicate (openapi v1.2.0): body optional.
function vDuplicate(body) {
  const out = {};
  const title = body ? optString(body, 'title', 80) : undefined;
  if (title !== undefined) out.title = title;
  return out;
}

function vUpsert(kind) {
  return (body) => {
    const key = reqString(body, 'key');
    if (!KEY_PATTERN.test(key)) {
      throw errors.badRequest('key must match ^[a-z][a-z0-9_]*$');
    }
    const out = { key, name: reqString(body, 'name', { max: 40 }) };
    if (kind === 'module') {
      const colorToken = optString(body, 'colorToken', 40);
      if (colorToken !== undefined) out.colorToken = colorToken;
      const iconKey = optString(body, 'iconKey', 40);
      if (iconKey !== undefined) out.iconKey = iconKey;
    }
    if (body.order !== undefined) out.order = Number(body.order) || 0;
    if (body.enabled !== undefined) out.enabled = !!body.enabled;
    return out;
  };
}

function vMediaUpload(body) {
  const folder = reqString(body, 'folder');
  if (!MEDIA_FOLDERS.includes(folder)) {
    throw errors.badRequest('folder must be one of ' + MEDIA_FOLDERS.join(', '));
  }
  const out = {
    folder,
    fileName: reqString(body, 'fileName', { max: 200 }),
    mime: reqString(body, 'mime', { max: 100 }),
    size: reqInt(body, 'size', 1),
  };
  const itemId = optString(body, 'itemId');
  if (itemId !== undefined) out.itemId = itemId;
  ['width', 'height', 'durationMs'].forEach((f) => {
    if (body[f] !== undefined) {
      const v = Number(body[f]);
      if (!Number.isInteger(v) || v < 0) throw errors.badRequest(f + ' must be a non-negative integer');
      out[f] = v;
    }
  });
  return out;
}

function vRoleChange(body) {
  const role = reqString(body, 'role');
  if (!['editor', 'admin'].includes(role)) {
    throw errors.badRequest('role must be editor or admin');
  }
  return { role };
}

function vStatusChange(body) {
  const status = reqString(body, 'status');
  if (!['active', 'disabled'].includes(status)) {
    throw errors.badRequest('status must be active or disabled');
  }
  return { status };
}

function vSettings(body) {
  return {
    mediaMaxSizeMB: reqInt(body, 'mediaMaxSizeMB', 1, 200),
    allowedMimeTypes: (function () {
      if (!Array.isArray(body.allowedMimeTypes) || body.allowedMimeTypes.length === 0) {
        throw errors.badRequest('allowedMimeTypes must be a non-empty array of strings');
      }
      return body.allowedMimeTypes.map(String);
    })(),
    defaultLocale: reqString(body, 'defaultLocale', { max: 10 }),
    paginationLimit: reqInt(body, 'paginationLimit', 10, 100),
  };
}

module.exports = {
  vAdminLogin,
  vContentCreate,
  vContentUpdate,
  vSubmit,
  vReject,
  vPublish,
  vDuplicate,
  vModuleUpsert: vUpsert('module'),
  vCategoryUpsert: vUpsert('category'),
  vMediaUpload,
  vRoleChange,
  vStatusChange,
  vSettings,
  STATUSES,
};
