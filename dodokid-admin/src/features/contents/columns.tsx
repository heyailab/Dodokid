/** 内容列表表格列定义 — 排序图标、主列、状态徽章、等宽时间（§3.3(c)）。 */
import { CaretDown, CaretUp, CaretUpDown } from '@phosphor-icons/react';
import type { ColumnsType } from 'antd/es/table';
import { Link } from 'react-router-dom';
import { ContentStatusBadge, formatDateTime } from '../../shared/components';
import type { AdminContent, ContentStatus, SortField } from '../../types/api';

export type SortFn = (field: SortField) => void;

export function buildColumns(sort: SortField, order: 'asc' | 'desc', onSort: SortFn): ColumnsType<AdminContent> {
  const sortTitle = (label: string, field: SortField) => {
    const active = sort === field;
    const icon = !active
      ? <CaretUpDown size={12} aria-hidden />
      : order === 'desc' ? <CaretDown size={12} aria-hidden /> : <CaretUp size={12} aria-hidden />;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: active ? 'var(--fg)' : undefined }}>
        {label} {icon}
      </span>
    );
  };

  return [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      onHeaderCell: () => ({ onClick: () => onSort('title'), style: { cursor: 'pointer' } }),
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
          <div
            aria-hidden
            style={{ width: 40, height: 28, borderRadius: 4, background: 'var(--surface-sunken)', flexShrink: 0, boxShadow: 'var(--elev-ring)' }}
          />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <Link to={`/contents/${r._id}/edit`} style={{ color: 'var(--fg)', fontWeight: 500 }}>{r.title}</Link>
            {/* v1.2.1 试读样章标识（复用现有 Tag 样式，无新增硬编码色） */}
            {r.isSample && <span className="module-tag" style={{ height: 18 }}>样章</span>}
          </span>
        </div>
      ),
    },
    {
      title: '模块',
      dataIndex: 'moduleKey',
      key: 'moduleKey',
      width: 110,
      render: (v: string) => <span className="module-tag">{v}</span>,
    },
    { title: '年龄段', dataIndex: 'ageGroup', key: 'ageGroup', width: 84 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s: ContentStatus) => <ContentStatusBadge status={s} />,
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 72,
      render: (v: number) => <span className="mono">v{v}</span>,
    },
    { title: '更新人', dataIndex: 'authorId', key: 'authorId', width: 110, className: 'mono text-sm' },
    {
      title: sortTitle('更新时间', 'updatedAt'),
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 150,
      className: 'mono text-sm',
      onHeaderCell: () => ({ onClick: () => onSort('updatedAt'), style: { cursor: 'pointer' } }),
      render: (v: string) => formatDateTime(v),
    },
  ];
}
