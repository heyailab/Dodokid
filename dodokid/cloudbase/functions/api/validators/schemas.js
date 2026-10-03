// schemas.js
// Input validation for every endpoint. Each validator throws a BAD_REQUEST
// AppError on invalid input and returns a cleaned value on success. Kept in its
// own file, separate from controllers and services.

const errors = require('../utils/errors');
const phoneUtil = require('../utils/phone');

function reqString(body, field, opts) {
  opts = opts || {};
  const v = body[field];
  if (v === undefined || v === null || String(v).trim() === '') {
    throw errors.badRequest(opts.message || field + ' is required');
  }
  const s = String(v).trim();
  if (opts.max && s.length > opts.max) {
    throw errors.badRequest(field + ' exceeds maximum length ' + opts.max);
  }
  return s;
}

function vSendSmsCode(body) {
  const phone = reqString(body, 'phone');
  if (!phoneUtil.isValidPhone(phone)) throw errors.badRequest('Invalid phone number');
  return { phone };
}

function vVerifyCode(body) {
  const phone = reqString(body, 'phone');
  if (!phoneUtil.isValidPhone(phone)) throw errors.badRequest('Invalid phone number');
  const code = reqString(body, 'code');
  return { phone, code };
}

function vRegister(body) {
  const phone = reqString(body, 'phone');
  if (!phoneUtil.isValidPhone(phone)) throw errors.badRequest('Invalid phone number');
  const code = reqString(body, 'code');
  return { phone, code };
}

function vLogin(body) {
  const phone = reqString(body, 'phone');
  if (!phoneUtil.isValidPhone(phone)) throw errors.badRequest('Invalid phone number');
  const code = reqString(body, 'code');
  return { phone, code };
}

function vConsent(body) {
  const type = reqString(body, 'type');
  const method = reqString(body, 'method');
  const out = { type, method };
  if (body.childId !== undefined) out.childId = String(body.childId);
  return out;
}

function vChildCreate(body) {
  const consentId = reqString(body, 'consentId');
  const name = reqString(body, 'name', { max: 40 });
  const ageGroup = reqString(body, 'ageGroup');
  if (!['3-4', '4-6'].includes(ageGroup)) {
    throw errors.badRequest('ageGroup must be one of 3-4, 4-6');
  }
  const out = { consentId, name, ageGroup };
  if (body.avatar !== undefined) out.avatar = String(body.avatar);
  return out;
}

function vChildSwitch(body) {
  const childId = reqString(body, 'childId');
  return { childId };
}

function vChildUpdate(body) {
  const out = {};
  if (body.name !== undefined) out.name = reqString(body, 'name', { max: 40 });
  if (body.avatar !== undefined) out.avatar = String(body.avatar);
  if (body.ageGroup !== undefined) {
    if (!['3-4', '4-6'].includes(String(body.ageGroup))) {
      throw errors.badRequest('ageGroup must be one of 3-4, 4-6');
    }
    out.ageGroup = String(body.ageGroup);
  }
  if (Object.keys(out).length === 0) throw errors.badRequest('No updatable fields provided');
  return out;
}

function vProgressUpsert(body) {
  const itemId = reqString(body, 'itemId');
  const status = reqString(body, 'status');
  if (!['not_started', 'in_progress', 'completed'].includes(status)) {
    throw errors.badRequest('status must be one of not_started, in_progress, completed');
  }
  const out = { itemId, status };
  if (body.score !== undefined) {
    const s = Number(body.score);
    if (Number.isNaN(s) || s < 0 || s > 100) {
      throw errors.badRequest('score must be between 0 and 100');
    }
    out.score = s;
  }
  return out;
}

function vPreferences(body) {
  const out = {};
  if (body.lang !== undefined) {
    if (!['zh-CN', 'en', 'zh-TW'].includes(body.lang)) {
      throw errors.badRequest('lang must be one of zh-CN, en, zh-TW');
    }
    out.lang = body.lang;
  }
  if (body.theme !== undefined) {
    if (!['light', 'dark', 'system'].includes(body.theme)) {
      throw errors.badRequest('theme must be light, dark, or system');
    }
    out.theme = body.theme;
  }
  if (Object.keys(out).length === 0) throw errors.badRequest('No valid preference fields provided');
  return out;
}

function vFeedback(body) {
  const text = reqString(body, 'text', { max: 1000 });
  return { text };
}

function vGateSetup(body) {
  const type = reqString(body, 'type');
  if (!['password', 'biometric'].includes(type)) {
    throw errors.badRequest('type must be password or biometric');
  }
  const secret = reqString(body, 'secret');
  if (secret.length < 4) throw errors.badRequest('secret must be at least 4 characters');
  return { type, secret };
}

function vGateVerify(body) {
  const secret = reqString(body, 'secret');
  const out = { secret };
  if (body.type !== undefined) out.type = String(body.type);
  return out;
}

function vTimeLimit(body) {
  if (body.dailyLimitMin === undefined || body.dailyLimitMin === null) {
    throw errors.badRequest('dailyLimitMin is required');
  }
  const v = Number(body.dailyLimitMin);
  if (Number.isNaN(v) || v < 0 || v > 1440) {
    throw errors.badRequest('dailyLimitMin must be between 0 and 1440');
  }
  const out = { dailyLimitMin: v };
  if (body.mode !== undefined) {
    if (!['strict', 'balanced', 'free'].includes(body.mode)) {
      throw errors.badRequest('mode must be strict, balanced, or free');
    }
    out.mode = body.mode;
  }
  return out;
}

module.exports = {
  vSendSmsCode,
  vVerifyCode,
  vRegister,
  vLogin,
  vConsent,
  vChildCreate,
  vChildSwitch,
  vChildUpdate,
  vProgressUpsert,
  vPreferences,
  vFeedback,
  vGateSetup,
  vGateVerify,
  vTimeLimit,
};
