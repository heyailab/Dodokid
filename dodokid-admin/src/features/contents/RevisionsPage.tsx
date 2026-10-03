/** 版本历史 /contents/:id/revisions — 时间线 + 回滚（admin-only，高危确认）（§3.6）。 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowCounterClockwise } from '@phosphor-icons/react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminApi } from '../../lib/api';
import { useAuth } from '../../stores/auth';
import {
  Button, ContentStatusBadge, EmptyState, ErrorState, TableSkeleton, formatDateTime, useConfirm, useToast,
} from '../../shared/components';
import type { ContentRevision } from '../../types/api';

export function RevisionsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();

  const revisions = useQuery({
    queryKey: ['admin-revisions', id],
    queryFn: () => adminApi.listRevisions(id!),
  });
  const detail = useQuery({ queryKey: ['admin-content', id], queryFn: () => adminApi.getContent(id!) });

  const restore = useMutation({
    mutationFn: (rev: ContentRevision) => adminApi.restoreRevision(id!, rev._id),
    onSuccess: () => {
      toast.success('已回滚 · 当前内容恢复为草稿，历史未被改写');
      void qc.invalidateQueries({ queryKey: ['admin-revisions', id] });
      void qc.invalidateQueries({ queryKey: ['admin-content', id] });
      void qc.invalidateQueries({ queryKey: ['admin-contents'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (revisions.isPending || detail.isPending) return <TableSkeleton rows={6} />;
  if (revisions.isError) {
    return <ErrorState message={(revisions.error as Error).message} onRetry={() => void revisions.refetch()} />;
  }

  const items = revisions.data.items;
  const item = detail.data?.item;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 className="page-title">版本历史 · {item?.title ?? ''}</h1>
          {item && <ContentStatusBadge status={item.status} />}
        </div>
        <Button variant="secondary" onClick={() => navigate(item ? `/contents/${item._id}/edit` : '/contents')}>
          返回编辑
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, alignItems: 'start' }}>
        <div className="panel" style={{ padding: 12 }}>
          {items.length === 0 ? (
            <EmptyState title="暂无版本记录" hint="提交审核或发布后会自动生成版本快照。" />
          ) : (
            <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {items.map((rev, i) => (
                <li key={rev._id} style={{ display: 'flex', gap: 12, padding: '12px 8px', borderTop: i === 0 ? 'none' : '1px solid var(--border-soft)' }}>
                  <span className="mono" style={{ fontWeight: 590, minWidth: 36 }}>v{rev.version}</span>
                  <div style={{ flex: 1 }}>
                    <div className="text-sm" style={{ color: 'var(--fg-2)' }}>
                      {ACTION_LABEL[rev.action]} · <span className="mono">{rev.authorId}</span>
                    </div>
                    <div className="mono text-xs text-muted">{formatDateTime(rev.createdAt)}</div>
                    {rev.note && <div className="text-sm">{rev.note}</div>}
                  </div>
                  {i > 0 && can('content.lifecycle') && (
                    <Button
                      size="sm" variant="secondary" icon={<ArrowCounterClockwise size={14} />}
                      onClick={() => confirm({
                        title: `回滚到 v${rev.version} 后将生成新草稿`,
                        description: `当前版本 v${item?.version} 不会被删除：回滚是“向前恢复”，目标快照会成为新的工作副本，版本号 +1，状态变为草稿。`,
                        target: { name: `v${rev.version}`, id: rev._id },
                        confirmText: '回滚到此版本',
                        onConfirm: async () => { await restore.mutateAsync(rev); },
                      })}
                    >
                      回滚到此版本
                    </Button>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="panel" style={{ padding: 20, color: 'var(--fg-2)', fontSize: 13 }}>
          <div style={{ fontSize: 15, fontWeight: 590, color: 'var(--fg)', marginBottom: 8 }}>快照说明</div>
          版本快照在提交审核、审核通过、驳回与回滚时自动生成，记录当时的字段级状态与操作备注。
          回滚采用“向前恢复”：历史版本永远保留、不可改写，满足审计要求（Spec §14.2）。
        </div>
      </div>
    </div>
  );
}

const ACTION_LABEL: Record<ContentRevision['action'], string> = {
  submit: '提交审核',
  approve: '审核通过',
  publish: '直接发布',
  reject: '驳回',
  restore: '回滚',
};
