/** 审计日志 /audit — admin-only，只读，行展开 before/after diff（§3.10）。 */
import { useQuery } from '@tanstack/react-query';
import { Table } from 'antd';
import { useState } from 'react';
import { adminApi } from '../../lib/api';
import { EmptyState, ErrorState, PageHeader, TableSkeleton, TopProgressBar, formatDateTime } from '../../shared/components';
import type { AuditEntry } from '../../types/api';
import type { ColumnsType } from 'antd/es/table';

const ACTION_OPTIONS = [
  'admin.auth.login', 'admin.content.create', 'admin.content.update', 'admin.content.submit',
  'admin.content.approve', 'admin.content.reject', 'admin.content.unpublish', 'admin.content.archive',
  'admin.content.delete', 'admin.content.restore', 'admin.media.upload', 'admin.media.delete',
  'admin.user.role_change', 'admin.user.status_change', 'admin.settings.update',
].map((v) => ({ value: v, label: v }));

export function AuditPage() {
  const [action, setAction] = useState<string | undefined>();
  const [actor, setActor] = useState('');
  const [targetId, setTargetId] = useState('');
  const [page, setPage] = useState(1);

  const list = useQuery({
    queryKey: ['admin-audit', { action, actor, targetId, page }],
    queryFn: () => adminApi.listAudit({ action, actor: actor || undefined, targetId: targetId || undefined, page, limit: 20 }),
    placeholderData: (prev) => prev,
  });

  const cols: ColumnsType<AuditEntry> = [
    { title: '时间', dataIndex: 'ts', key: 'ts', width: 170, className: 'mono text-sm', defaultSortOrder: 'descend', sorter: (a, b) => a.ts.localeCompare(b.ts), render: (v: string) => formatDateTime(v) },
    {
      title: '操作人', dataIndex: 'actor', key: 'actor', width: 180,
      render: (v: string, r) => (
        <span>
          <span className="mono text-sm">{v}</span>{' '}
          <span className="module-tag" style={{ height: 18 }}>{r.actorRole}</span>
        </span>
      ),
    },
    { title: '动作', dataIndex: 'action', key: 'action', width: 220, className: 'mono text-sm' },
    {
      title: '目标', dataIndex: 'targetId', key: 'targetId', width: 200, className: 'mono text-sm',
      render: (v: string, r) => `${r.targetType} · ${v}`,
    },
    { title: 'IP', dataIndex: 'ip', key: 'ip', width: 140, className: 'mono text-sm' },
  ];

  return (
    <div>
      <PageHeader title="审计日志" count={list.data ? `共 ${list.data.meta.total} 条` : undefined} />
      <p className="text-sm text-muted" style={{ margin: '0 0 12px' }}>日志只读、不可篡改；展开行可查看变更前后快照。</p>

      <div className="filterbar" style={{ marginBottom: 16 }}>
        <div className="filterbar-row">
          <div className="filterbar-controls">
            <select
              className="input-shell" style={{ width: 240 }} value={action ?? ''}
              onChange={(e) => { setAction(e.target.value || undefined); setPage(1); }}
              aria-label="按动作筛选"
            >
              <option value="">全部动作</option>
              {ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.value}</option>)}
            </select>
            <input className="input-shell" style={{ width: 160 }} placeholder="操作人 ID" value={actor}
              onChange={(e) => { setActor(e.target.value); setPage(1); }} aria-label="按操作人筛选" />
            <input className="input-shell" style={{ width: 160 }} placeholder="目标 ID" value={targetId}
              onChange={(e) => { setTargetId(e.target.value); setPage(1); }} aria-label="按目标 ID 筛选" />
          </div>
        </div>
      </div>
      <TopProgressBar active={list.isFetching && !list.isPending} />

      {list.isPending ? (
        <div className="table-wrap"><TableSkeleton rows={8} /></div>
      ) : list.isError ? (
        <ErrorState message={(list.error as Error).message} onRetry={() => void list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState title="暂无操作记录" hint="后台的登录与变更操作会记录在此。" />
      ) : (
        <div className="table-wrap">
          <Table
            rowKey="_id" columns={cols} dataSource={list.data.items}
            expandable={{
              expandedRowRender: (r) =>
                r.before || r.after ? <DiffView before={r.before} after={r.after} /> : <span className="text-sm text-muted">此事件无结构化变更快照。</span>,
              rowExpandable: (r) => Boolean(r.before || r.after),
            }}
            pagination={{
              current: page, pageSize: 20, total: list.data.meta.total, showSizeChanger: false,
              showTotal: (t, r) => `第 ${r[0]}–${r[1]} 条，共 ${t} 条`,
              onChange: setPage, style: { padding: 16 },
            }}
          />
        </div>
      )}
    </div>
  );
}

function DiffView({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div>
        <div className="text-xs" style={{ color: 'var(--danger-ink)', marginBottom: 4 }}>变更前</div>
        <pre className="mono text-xs" style={{ background: 'var(--danger-soft)', color: 'var(--danger-ink)', borderRadius: 8, padding: 12, overflow: 'auto', margin: 0 }}>
          {JSON.stringify(before ?? {}, null, 2)}
        </pre>
      </div>
      <div>
        <div className="text-xs" style={{ color: 'var(--success-ink)', marginBottom: 4 }}>变更后</div>
        <pre className="mono text-xs" style={{ background: 'var(--success-soft)', color: 'var(--success-ink)', borderRadius: 8, padding: 12, overflow: 'auto', margin: 0 }}>
          {JSON.stringify(after ?? {}, null, 2)}
        </pre>
      </div>
    </div>
  );
}
