// controllers/admin/audit.controller.js
const auditService = require('../../services/admin/auditAdmin.service');

async function list(ctx) {
  const q = ctx.req.query || {};
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20));
  return auditService.listAudit(
    {
      actor: q.actor,
      action: q.action,
      targetType: q.targetType,
      targetId: q.targetId,
      from: q.from,
      to: q.to,
    },
    page,
    limit
  );
}

module.exports = { list };
