// meta.controller.js
// Thin controller for build-level metadata (version, privacy policy).

const metaService = require('../services/meta.service');

function getVersion() {
  return metaService.getVersion();
}

function getPrivacyPolicy() {
  return metaService.getPrivacyPolicy();
}

module.exports = { getVersion, getPrivacyPolicy };
