// controllers/admin/stats.controller.js
const statsService = require('../../services/admin/statsAdmin.service');

async function get(ctx) {
  return statsService.getStats();
}

module.exports = { get };
