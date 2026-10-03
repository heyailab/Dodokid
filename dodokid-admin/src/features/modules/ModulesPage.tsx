/** 模块与分类 /modules — 双栏表 + 内联编辑 + 开关 + 删除保护（§3.8）。 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from '@phosphor-icons/react';
import { Switch, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { adminApi } from '../../lib/api';
import { useAuth } from '../../stores/auth';
import { Can, EmptyState, ErrorState, PageHeader, useConfirm, useToast } from '../../shared/components';
import type { AdminModule, ContentCategory } from '../../types/api';

export function ModulesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();

  const modules = useQuery({ queryKey: ['admin-modules'], queryFn: adminApi.listModules });
  const categories = useQuery({ queryKey: ['admin-categories'], queryFn: adminApi.listCategories });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin-modules'] });
    void qc.invalidateQueries({ queryKey: ['admin-categories'] });
  };

  const saveModule = useMutation({
    mutationFn: (v: { id: string; patch: Partial<AdminModule> }) => {
      const m = modules.data!.find((x) => x._id === v.id)!;
      return adminApi.updateModule(v.id, { key: m.key, name: v.patch.name ?? m.name, colorToken: m.colorToken, iconKey: v.patch.iconKey ?? m.iconKey, order: v.patch.order ?? m.order, enabled: v.patch.enabled ?? m.enabled });
    },
    onSuccess: () => { toast.success('模块已更新'); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteModule = useMutation({
    mutationFn: adminApi.deleteModule,
    onSuccess: () => { toast.success('模块已删除'); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveCategory = useMutation({
    mutationFn: (v: { id: string; patch: Partial<ContentCategory> }) => {
      const c = categories.data!.find((x) => x._id === v.id)!;
      return adminApi.updateCategory(v.id, { key: c.key, name: v.patch.name ?? c.name, order: v.patch.order ?? c.order, enabled: v.patch.enabled ?? c.enabled });
    },
    onSuccess: () => { toast.success('分类已更新'); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const moduleCols: ColumnsType<AdminModule> = [
    { title: 'KEY', dataIndex: 'key', key: 'key', width: 130, className: 'mono text-sm' },
    {
      title: '名称', dataIndex: 'name', key: 'name', width: 180,
      render: (v: string, r) => (
        <InlineEdit value={v} onCommit={(nv) => saveModule.mutate({ id: r._id, patch: { name: nv } })} editable={can('catalog.write')} />
      ),
    },
    { title: '图标 iconKey', dataIndex: 'iconKey', key: 'iconKey', width: 140, className: 'mono text-sm', render: (v: string) => <span title="Phosphor 图标名">{v}</span> },
    { title: '排序', dataIndex: 'order', key: 'order', width: 80, className: 'mono' },
    {
      title: '启用', dataIndex: 'enabled', key: 'enabled', width: 90,
      render: (v: boolean, r) => (
        <Switch size="small" checked={v} disabled={!can('catalog.write')}
          onChange={(nv) => saveModule.mutate({ id: r._id, patch: { enabled: nv } })} />
      ),
    },
    {
      title: '', key: 'op', width: 90,
      render: (_, r) => can('catalog.write') && (
        <Can perm="catalog.write">
          <button
            className="icon-plain" aria-label={`删除模块 ${r.name}`} style={{ color: 'var(--danger)' }}
            onClick={() => confirm({
              title: `删除模块“${r.name}”？`,
              description: '若该模块下仍有内容，后端会拒绝删除（409）并提示内容数量。',
              target: { name: r.name, id: r._id },
              confirmText: '删除',
              danger: true,
              onConfirm: () => deleteModule.mutateAsync(r._id),
            })}
          >
            删除
          </button>
        </Can>
      ),
    },
  ];

  const categoryCols: ColumnsType<ContentCategory> = [
    { title: 'KEY', dataIndex: 'key', key: 'key', width: 130, className: 'mono text-sm' },
    {
      title: '名称', dataIndex: 'name', key: 'name', width: 150,
      render: (v: string, r) => (
        <InlineEdit value={v} onCommit={(nv) => saveCategory.mutate({ id: r._id, patch: { name: nv } })} editable={can('catalog.write')} />
      ),
    },
    {
      title: '启用', dataIndex: 'enabled', key: 'enabled', width: 80,
      render: (v: boolean, r) => (
        <Switch size="small" checked={v} disabled={!can('catalog.write')}
          onChange={(nv) => saveCategory.mutate({ id: r._id, patch: { enabled: nv } })} />
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="模块与分类" count="内容模块决定 App 首页入口；分类用于运营归类" />
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 24, alignItems: 'start' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 590, margin: '0 0 12px' }}>内容模块</h2>
          {modules.isError ? (
            <ErrorState message={(modules.error as Error).message} onRetry={() => void modules.refetch()} />
          ) : (
            <div className="table-wrap">
              <Table rowKey="_id" columns={moduleCols} dataSource={modules.data ?? []} pagination={false} loading={modules.isPending} />
              {can('catalog.write') && <NewRow label="新增模块" onAdd={(name) => {
                void adminApi.createModule({ key: `mod_${Date.now()}`, name }).then(() => {
                  toast.success('模块已创建'); refresh();
                }).catch((e: Error) => toast.error(e.message));
              }} />}
            </div>
          )}
        </div>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 590, margin: '0 0 12px' }}>分类</h2>
          {categories.isError ? (
            <ErrorState message={(categories.error as Error).message} onRetry={() => void categories.refetch()} />
          ) : (categories.data ?? []).length === 0 && !categories.isPending ? (
            <EmptyState title="暂无分类" hint="新增一个分类便于运营归类内容。" />
          ) : (
            <div className="table-wrap">
              <Table rowKey="_id" columns={categoryCols} dataSource={categories.data ?? []} pagination={false} loading={categories.isPending} />
              {can('catalog.write') && <NewRow label="新增分类" onAdd={(name) => {
                void adminApi.createCategory({ key: `cat_${Date.now()}`, name }).then(() => {
                  toast.success('分类已创建'); refresh();
                }).catch((e: Error) => toast.error(e.message));
              }} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InlineEdit({ value, onCommit, editable }: { value: string; onCommit: (v: string) => void; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) {
    return editable ? (
      <button className="link-btn" style={{ textDecoration: 'none' }} title="点击编辑" onClick={() => { setDraft(value); setEditing(true); }}>
        {value}
      </button>
    ) : <span>{value}</span>;
  }
  return (
    <input
      className="input-shell" style={{ height: 28 }} autoFocus value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && draft.trim()) { onCommit(draft.trim()); setEditing(false); }
        if (e.key === 'Escape') setEditing(false);
      }}
      onBlur={() => { if (draft.trim() && draft !== value) onCommit(draft.trim()); setEditing(false); }}
      aria-label="编辑名称"
    />
  );
}

function NewRow({ label, onAdd }: { label: string; onAdd: (name: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  if (!adding) {
    return (
      <button className="nav-item" style={{ width: '100%', color: 'var(--accent-strong)' }} onClick={() => setAdding(true)}>
        <Plus size={16} aria-hidden /> {label}
      </button>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 8, padding: 12 }}>
      <input className="input-shell" autoFocus placeholder="名称" value={name} onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { onAdd(name.trim()); setName(''); setAdding(false); } }} />
      <button className="btn btn-primary btn-sm" onClick={() => { if (name.trim()) { onAdd(name.trim()); setName(''); setAdding(false); } }}>保存</button>
      <button className="btn btn-secondary btn-sm" onClick={() => setAdding(false)}>取消</button>
    </div>
  );
}
