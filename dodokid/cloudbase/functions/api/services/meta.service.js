// meta.service.js
// Build-level metadata: app version and privacy policy reference.

const config = require('../config');

function getVersion() {
  return {
    version: config.appVersion,
    minVersion: config.minAppVersion,
    updateRequired: false,
  };
}

function getPrivacyPolicy() {
  return {
    url: config.privacyPolicyUrl,
    text: config.privacyPolicyText || null,
    updatedAt: new Date().toISOString(),
  };
}

module.exports = { getVersion, getPrivacyPolicy };
