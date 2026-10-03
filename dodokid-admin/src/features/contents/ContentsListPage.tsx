/** 内容列表 — 装配层：URL query 状态 + 数据/变更 mutation + 行操作 + 表格（§3.3）。 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DotsThree } from '@phosphor-icons/react';
import { Dropdown, Table } from 'antd';
import { useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { adminApi } from '../../lib/api';
import { useAuth } from '../../stores/auth';
import {
  Button, Can, EmptyState, ErrorState, NewButton, PageHeader,
  TableSkeleton, TopProgressBar, useConfirm, useToast,
} from '../../shared/components';
import type { AdminContent, AgeGroup, ContentStatus, SortField } from '../../types/api';
import { buildColumns } from './columns';
import { ContentsFilter } from './ContentsFilter';

type RowAction = 'submit' | 'approve' | 'reject' | 'publish' | 'withdraw' | 'unpublish' | 'archive' | 'delete' | 'duplicate';
const ACTION_MSG: Record<RowAction, string> = {
  submit: '已提交审核',
  approve: '审核通过 · 已发布，App 端可见',
  reject: '已驳回 · 回到草稿',
  publish: '已发布 · App 端可见',
  withdraw: '已撤回 · 回到草稿',
  unpublish: '已下架 · App 端不再展示',
  archive: '已归档 · App 不可见',
  delete: '内容已删除',
  duplicate: '',
};

export function ContentsListPage() {
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterQ, setFilterQ] = useState(sp.get('q') ?? '');

  const moduleKey = sp.get('moduleKey')?.split(',').filter(Boolean) ?? [];
  const ageGroup = (sp.get('ageGroup') ?? '') as AgeGroup | '';
  const status = (sp.get('status') ?? '') as ContentStatus | '';
  const q = sp.get('q') ?? '';
  const page = Number(sp.get('page') ?? 1);
  const sort = (sp.get('sort') ?? 'updatedAt') as SortField;
  const order = (sp.get('order') ?? 'desc') as 'asc' | 'desc';

  const setParam = (patch: Record<string, string | string[] | undefined>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      const val = Array.isArray(v) ? v.filter(Boolean).join(',') : (v ?? '');
      if (val) next.set(k, val);
      else next.delete(k);
      if (k === 'q') setFilterQ(val);
    }
    if (!('page' in patch)) next.delete('page');
    setSp(next, { replace: true });
  };
  const resetAll = () => {
    setFilterQ('');
    setSp(new URLSearchParams(), { replace: true });
  };

  const list = useQuery({
    queryKey: ['admin-contents', { moduleKey, ageGroup, status, q, page, sort, order }],
    queryFn: () => adminApi.listContents({ moduleKey, ageGroup: ageGroup || undefined, status: status || undefined, q: q || undefined, page, limit: 20, sort, order }),
    placeholderData: (prev) => prev,
  });
  const modules = useQuery({ queryKey: ['admin-modules'], queryFn: adminApi.listModules });

  const runAction = useMutation<unknown, Error, { id: string; action: RowAction }>({
    mutationFn: async (v) => {
      const { id: cid, action } = v;
      switch (action) {
        case 'submit': return adminApi.submitContent(cid);
        case 'approve': return adminApi.approveContent(cid);
        case 'reject': return adminApi.rejectContent(cid, '驳回：请修改后重新提交');
        // v1.2.0
        case 'publish': return adminApi.publishContent(cid);
        case 'withdraw': return adminApi.withdrawContent(cid);
        case 'duplicate': return adminApi.duplicateContent(cid);
        case 'unpublish': return adminApi.unpublishContent(cid);
        case 'archive': return adminApi.archiveContent(cid);
        case 'delete': return adminApi.deleteContent(cid);
      }
    },
    onSuccess: (_d, v) => {
      if (v.action === 'duplicate') toast.success('已复制为新草稿 · 可在列表中找到「(副本)」条目');
      else toast.success(ACTION_MSG[v.action]);
      setSelectedIds([]);
      void qc.invalidateQueries({ queryKey: ['admin-contents'] });
      void qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withConfirm = (row: AdminContent, action: 'unpublish' | 'archive' | 'delete' | 'publish' | 'withdraw') => {
    const spec = {
      publish: { t: '直接发布后 App 将立即展示此内容', d: '跳过审核流程（admin 专权）。发布后可随时下架。', c: '直接发布', high: false, danger: false },
      withdraw: { t: '撤回后此内容将离开审核队列', d: '回到草稿后可继续编辑，再次提交审核。审核人记录将被清除。', c: '撤回', high: false, danger: false },
      unpublish: { t: '下架后 App 将不再展示此内容', d: '可在版本历史或编辑页恢复流程。', c: '下架', high: false, danger: true },
      archive: { t: '归档后此内容将从工作流退出', d: '归档内容可再编辑，编辑后回到草稿。', c: '归档', high: false, danger: false },
      delete: { t: '删除后此内容及其版本历史不可恢复', d: '此操作不可撤销。', c: '删除', high: true, danger: true },
    }[action];
    confirm({
      title: spec.t,
      description: spec.d,
      target: { name: row.title, id: row._id },
      typeToConfirm: spec.high ? row.title : undefined,
      confirmText: spec.c,
      danger: spec.danger,
      onConfirm: async () => { await runAction.mutateAsync({ id: row._id, action }); },
    });
  };

  const rowMenu = (row: AdminContent) => ({
    items: rowMenuItems(row, can('content.review'), can('content.write'), can('content.lifecycle')),
    onClick: ({ key }: { key: string }) => {
      if (key === 'edit') return navigate(`/contents/${row._id}/edit`);
      if (key === 'revisions') return navigate(`/contents/${row._id}/revisions`);
      const a = key as RowAction;
      if (a === 'duplicate') return runAction.mutate({ id: row._id, action: a });
      if (['unpublish', 'archive', 'delete', 'publish', 'withdraw'].includes(a)) return withConfirm(row, a as 'unpublish' | 'archive' | 'delete' | 'publish' | 'withdraw');
      runAction.mutate({ id: row._id, action: a });
    },
  });

  const columns: ColumnsType<AdminContent> = [
    ...buildColumns(sort, order, (field) =>
      setParam({ sort: field, order: sort === field && order === 'desc' ? 'asc' : 'desc' })),
    {
      title: '', key: 'actions', width: 60, align: 'right',
      render: (_, r) => (
        <Dropdown trigger={['click']} menu={rowMenu(r)}>
          <button className="icon-plain" aria-label={`更多操作：${r.title}`}>
            <DotsThree size={18} weight="bold" />
          </button>
        </Dropdown>
      ),
    },
  ];

  const items = list.data?.items ?? [];
  const hasFilter = moduleKey.length > 0 || Boolean(ageGroup) || Boolean(status) || Boolean(q);

  return (
    <div>
      <PageHeader
        title="内容列表"
        count={list.data ? `共 ${list.data.meta.total} 条` : undefined}
        actions={<Can perm="content.write"><NewButton label="新建内容" onClick={() => navigate('/contents/new')} /></Can>}
      />
      <ContentsFilter
        moduleKey={moduleKey}
        ageGroup={ageGroup}
        status={status}
        filterQ={filterQ}
        modules={modules.data ?? []}
        onParam={setParam}
        onReset={resetAll}
        onRefetch={() => void list.refetch()}
        onSearchText={setFilterQ}
      />
      <TopProgressBar active={list.isFetching && !list.isPending} />

      {list.isPending ? (
        <div className="table-wrap"><TableSkeleton rows={8} /></div>
      ) : list.isError ? (
        <ErrorState message={(list.error as Error).message} onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        hasFilter ? (
          <EmptyState
            title="没有符合条件的内容"
            hint="试试放宽筛选条件。"
            action={<Button variant="secondary" onClick={resetAll}>清除筛选</Button>}
          />
        ) : (
          <EmptyState
            title="还没有内容"
            hint="创建第一篇绘本或儿歌，审核通过后即可在 App 展示。"
            action={<Can perm="content.write"><NewButton label="新建内容" onClick={() => navigate('/contents/new')} /></Can>}
          />
        )
      ) : (
        <div className="table-wrap">
          <Table
            rowKey="_id"
            columns={columns}
            dataSource={items}
            rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys as string[]) }}
            pagination={{
              current: page,
              pageSize: 20,
              total: list.data.meta.total,
              showSizeChanger: false,
              showTotal: (total, range) => `第 ${range[0]}–${range[1]} 条，共 ${total} 条`,
              onChange: (p) => setParam({ page: String(p) }),
              style: { padding: 16 },
            }}
          />
        </div>
      )}
    </div>
  );
}

/** 行操作菜单项：按角色裁剪（§7.4 第二档——默认隐藏；publish/withdraw/duplicate 为 v1.2.0 新增） */
function rowMenuItems(row: AdminContent, canReview: boolean, canWrite: boolean, canLifecycle: boolean) {
  const menu: Array<{ key: RowAction | 'edit' | 'revisions'; label: string; danger?: boolean }> = [
    { key: 'edit', label: '编辑' },
    { key: 'revisions', label: '版本历史' },
  ];
  if (canWrite && row.status === 'draft') menu.push({ key: 'submit', label: '提交审核' });
  // v1.2.0 publish：draft → published，admin-only（用 content.review 权限位判别 admin）
  if (canReview && row.status === 'draft') menu.push({ key: 'publish', label: '直接发布' });
  if (canReview && row.status === 'in_review') {
    menu.push({ key: 'approve', label: '审核通过' });
    menu.push({ key: 'reject', label: '驳回' });
  }
  // v1.2.0 withdraw：in_review → draft，editor+
  if (canWrite && row.status === 'in_review') menu.push({ key: 'withdraw', label: '撤回' });
  // v1.2.0 duplicate：源任意态，editor+
  if (canWrite) menu.push({ key: 'duplicate', label: '复制为新草稿' });
  if (canLifecycle) {
    if (row.status === 'published') menu.push({ key: 'unpublish', label: '下架' });
    if (row.status !== 'archived') menu.push({ key: 'archive', label: '归档' });
    menu.push({ key: 'delete', label: '删除', danger: true });
  }
  return menu;
}
