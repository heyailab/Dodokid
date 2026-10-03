/** 概览 /dashboard — KPI 统计条 + 待审核队列 + 最近操作（§3.2）。数据即主体，无欢迎语。 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { adminApi } from '../../lib/api';
import { useAuth } from '../../stores/auth';
import { EmptyState, ErrorState, TableSkeleton, formatDateTime } from '../../shared/components';
import type { AdminContent } from '../../types/api';

const KPI_DEFS: Array<{ key: 'contentTotal' | 'pendingReview' | 'published' | 'weekNew'; label: string; note: string }> = [
  { key: 'contentTotal', label: '内容总数', note: '全部状态' },
  { key: 'pendingReview', label: '待审核', note: 'in_review 状态' },
  { key: 'published', label: '已发布', note: 'App 端可见' },
  { key: 'weekNew', label: '本周新增', note: '近 7 天（按最近 100 条估算）' },
];

export function DashboardPage() {
  const { user } = useAuth();
  const stats = useQuery({ queryKey: ['admin-stats'], queryFn: adminApi.stats });

  // “本周新增”按最近 100 条（createdAt 降序）中 7 天内的数量估算
  const weekQuery = useQuery({
    queryKey: ['admin-contents', { sort: 'createdAt', order: 'desc', limit: 100 }],
    queryFn: () => adminApi.listContents({ sort: 'createdAt', order: 'desc', limit: 100 }),
    staleTime: 60_000,
  });
  const s = stats.data;
  const weekNew = weekQuery.data
    ? weekQuery.data.items.filter((c) => Date.now() - new Date(c.createdAt).getTime() < 7 * 86_400_000).length
    : 0;

  if (stats.isError) {
    return <ErrorState message={(stats.error as Error).message} onRetry={() => void stats.refetch()} />;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">概览</h1>
        <span className="text-sm text-muted">统计口径：全站内容与媒体资产</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {KPI_DEFS.map((k) => (
          <div key={k.key} className="panel" style={{ padding: 20 }}>
            <div className="kpi-num">{s ? valueFor(k.key, s, weekNew) : '—'}</div>
            <div style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}>{k.label}</div>
            <div className="text-xs text-muted">{k.note}</div>
          </div>
        ))}
      </div>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 590, margin: '0 0 12px' }}>待审核队列</h2>
        <PendingReviewTable />
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 590, margin: '0 0 12px' }}>最近操作</h2>
        <div className="table-wrap">
          {s && s.recentAudit.length === 0 ? (
            <EmptyState title="暂无操作记录" hint="后台的登录、内容变更、上传等操作会记录在此。" />
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>时间</th>
                  <th style={thStyle}>操作人</th>
                  <th style={thStyle}>动作</th>
                  <th style={thStyle}>目标</th>
                </tr>
              </thead>
              <tbody>
                {(s?.recentAudit ?? []).slice(0, 20).map((a) => (
                  <tr key={a._id}>
                    <td className="mono" style={tdStyle}>{formatDateTime(a.ts)}</td>
                    <td style={tdStyle}>{a.actor} <span className="module-tag">{a.actorRole}</span></td>
                    <td className="mono text-sm" style={tdStyle}>{a.action}</td>
                    <td className="mono text-sm" style={tdStyle}>{a.targetType} · {a.targetId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {user?.role === 'editor' && (
        <p className="text-sm text-muted" style={{ marginTop: 24 }}>
          提示：审核通过/下架等操作需要内容负责人（admin）权限，如需处理请找管理员。
        </p>
      )}
    </div>
  );
}

function PendingReviewTable() {
  const q = useQuery({
    queryKey: ['admin-contents', { status: 'in_review', page: 1, limit: 10 }],
    queryFn: () => adminApi.listContents({ status: 'in_review', page: 1, limit: 10 }),
  });

  if (q.isPending) return <TableSkeleton rows={4} />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />;

  const items: AdminContent[] = q.data.items;
  if (items.length === 0) {
    return <EmptyState title="暂无待审内容" hint="编辑提交后，待审内容会出现在这里。" />;
  }
  return (
    <div className="table-wrap">
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>标题</th>
            <th style={thStyle}>模块</th>
            <th style={thStyle}>提交人</th>
            <th style={thStyle}>提交时间</th>
            <th style={thStyle}>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c._id}>
              <td style={tdStyle}>
                <Link to={`/contents/${c._id}/edit`} style={{ color: 'var(--fg)', fontWeight: 500 }}>{c.title}</Link>
              </td>
              <td style={tdStyle}><span className="module-tag">{c.moduleKey}</span></td>
              <td className="mono text-sm" style={tdStyle}>{c.authorId}</td>
              <td className="mono text-sm" style={tdStyle}>{formatDateTime(c.updatedAt)}</td>
              <td style={tdStyle}>
                <Link to={`/contents/${c._id}/edit`} className="link-btn">审核</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function valueFor(
  key: string,
  s: { contentTotal: number; pendingReview: number; byStatus: { published: number } },
  weekNew: number,
): number {
  switch (key) {
    case 'contentTotal': return s.contentTotal;
    case 'pendingReview': return s.pendingReview;
    case 'published': return s.byStatus.published;
    case 'weekNew': return weekNew;
    default: return 0;
  }
}

const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' };
const thStyle: CSSProperties = {
  textAlign: 'left', height: 40, padding: '0 12px', fontSize: 12, fontWeight: 500,
  letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)',
  background: 'var(--surface-sunken)',
};
const tdStyle: CSSProperties = {
  height: 44, padding: '0 12px', borderTop: '1px solid var(--border-soft)', fontSize: 14,
};
