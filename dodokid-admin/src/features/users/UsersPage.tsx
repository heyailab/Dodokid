/** 用户与角色 /users — admin-only。角色变更与启停走确认弹窗并写审计（§3.9）。不展示儿童 PII。 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Select, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { adminApi } from '../../lib/api';
import { useAuth } from '../../stores/auth';
import { ErrorState, PageHeader, TableSkeleton, formatDateTime, useConfirm, useToast } from '../../shared/components';
import type { AdminUser, UserStatus } from '../../types/api';

const ROLE_OPTIONS = [
  { value: 'editor', label: '内容编辑(editor)' },
  { value: 'admin', label: '内容负责人(admin)' },
];
const STATUS_OPTIONS = [
  { value: 'active', label: '启用' },
  { value: 'disabled', label: '停用' },
];

export function UsersPage() {
  const { user: me } = useAuth();
  const [role, setRole] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['admin-users', { role, status, page }],
    queryFn: () => adminApi.listUsers({ role, status, page, limit: 20 }),
    placeholderData: (prev) => prev,
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin-users'] });

  const changeRole = useMutation<unknown, Error, { u: AdminUser; role: 'editor' | 'admin' }>({
    mutationFn: async (v) => adminApi.changeUserRole(v.u.id, v.role),
    onSuccess: () => { toast.success('角色已变更，操作已写入审计日志'); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const changeStatus = useMutation<unknown, Error, { u: AdminUser; status: UserStatus }>({
    mutationFn: async (v) => adminApi.changeUserStatus(v.u.id, v.status),
    onSuccess: () => { toast.success('账号状态已变更，操作已写入审计日志'); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cols: ColumnsType<AdminUser> = [
    { title: '联系方式', dataIndex: 'phone', key: 'phone', width: 160, className: 'mono' },
    {
      title: '角色', dataIndex: 'role', key: 'role', width: 220,
      render: (v: AdminUser['role'], r) =>
        r.id === me?.id ? (
          <span className="module-tag">{v}（当前账号）</span>
        ) : (
          <Select
            size="small" style={{ width: 180 }} value={v}
            options={ROLE_OPTIONS}
            onChange={(nv) => confirm({
              title: `将该账号角色变更为 ${nv === 'admin' ? '内容负责人(admin)' : '内容编辑(editor)'}？`,
              description: '角色决定其可见页面与可执行操作，变更会写入审计日志。',
              target: { name: r.phone, id: r.id },
              confirmText: '变更角色',
              onConfirm: async () => { await changeRole.mutateAsync({ u: r, role: nv as 'editor' | 'admin' }); },
            })}
          />
        ),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 120,
      render: (v: UserStatus, r) =>
        r.id === me?.id ? (
          <span className="module-tag">{v === 'active' ? '启用' : '停用'}</span>
        ) : (
          <Select
            size="small" style={{ width: 110 }} value={v}
            options={STATUS_OPTIONS}
            onChange={(nv) => confirm({
              title: nv === 'disabled' ? '停用后该账号将立即无法登录后台' : '恢复该账号的后台访问？',
              description: '已登录会话中的令牌会立即失效，操作写入审计日志。',
              target: { name: r.phone, id: r.id },
              confirmText: nv === 'disabled' ? '停用' : '启用',
              danger: nv === 'disabled',
              onConfirm: async () => { await changeStatus.mutateAsync({ u: r, status: nv as UserStatus }); },
            })}
          />
        ),
    },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 170, className: 'mono text-sm', render: (v: string) => formatDateTime(v) },
  ];

  return (
    <div>
      <PageHeader
        title="用户与角色"
        count={list.data ? `共 ${list.data.meta.total} 个运营账号` : undefined}
      />
      <p className="text-sm text-muted" style={{ margin: '0 0 12px' }}>
        仅运营账号（editor / admin）。儿童与家长数据不在此展示（Spec §10 数据最小化）。
      </p>

      <div className="filterbar" style={{ marginBottom: 16 }}>
        <div className="filterbar-row">
          <div className="filterbar-controls">
            <Select allowClear placeholder="角色" style={{ width: 160 }} options={ROLE_OPTIONS} value={role} onChange={(v) => { setRole(v); setPage(1); }} />
            <Select allowClear placeholder="状态" style={{ width: 120 }} options={STATUS_OPTIONS} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
          </div>
        </div>
      </div>

      {list.isPending ? (
        <div className="table-wrap"><TableSkeleton rows={5} /></div>
      ) : list.isError ? (
        <ErrorState message={(list.error as Error).message} onRetry={() => void list.refetch()} />
      ) : (
        <div className="table-wrap">
          <Table
            rowKey="id" columns={cols} dataSource={list.data.items} pagination={false}
            footer={() => (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <span className="text-sm text-muted">共 {list.data.meta.total} 条</span>
              </div>
            )}
          />
        </div>
      )}
    </div>
  );
}
