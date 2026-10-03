// statsAdmin.service.js
// Dashboard overview. Aggregated counters only - never child-identifiable
// data (Spec 14.5).

const contentRepo = require('../../repositories/contentAdmin.repo');
const mediaRepo = require('../../repositories/mediaAdmin.repo');
const auditRepo = require('../../repositories/auditAdmin.repo');

async function getStats() {
  const [contentTotal, byStatus, mediaTotal, recentAudit] = await Promise.all([
    contentRepo.countAll(),
    contentRepo.countByStatus(),
    mediaRepo.countAll(),
    auditRepo.listRecent(10),
  ]);
  return {
    contentTotal,
    byStatus,
    pendingReview: byStatus.in_review,
    mediaTotal,
    recentAudit,
  };
}

module.exports = { getStats };
