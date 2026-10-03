/** 页面骨架原语：PageHeader + FilterBar + chip 回显 + format 工具。 */
import { Plus, X } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  count,
  actions,
  extra,
}: {
  title: string;
  count?: string;
  actions?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <h1 className="page-title">{title}</h1>
        {count && <span className="text-sm text-muted">{count}</span>}
        {extra}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>{actions}</div>
    </div>
  );
}

export interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

export function FilterBar({
  controls,
  onReset,
  onSearch,
  chips,
  primaryAction,
}: {
  controls: ReactNode;
  onReset: () => void;
  onSearch: () => void;
  chips?: FilterChip[];
  primaryAction?: ReactNode;
}) {
  return (
    <div className="filterbar">
      <div className="filterbar-row">
        <div className="filterbar-controls">{controls}</div>
        <div className="filterbar-actions">
          {primaryAction ?? (
            <>
              <button className="btn btn-secondary btn-sm" onClick={onReset}>重置</button>
              <button className="btn btn-primary btn-sm" onClick={onSearch}>查询</button>
            </>
          )}
        </div>
      </div>
      {chips && chips.length > 0 && (
        <div className="filterbar-chips">
          {chips.map((c) => (
            <span key={c.key} className="filter-chip">
              {c.label}
              <button className="icon-plain" aria-label={`移除筛选 ${c.label}`} onClick={c.onRemove}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function NewButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="btn btn-primary" onClick={onClick}>
      <Plus size={20} aria-hidden />
      {label}
    </button>
  );
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return '';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
