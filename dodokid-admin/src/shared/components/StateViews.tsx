/** 空态 / 错误态 / 骨架 — 所有数据区域必须覆盖（§7.1–7.3）。 */
import { ArrowClockwise, Tray, WarningCircle } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { Button } from './Button';

interface EmptyProps {
  icon?: ReactNode;
  title: string;
  hint: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, hint, action }: EmptyProps) {
  return (
    <div className="state-view">
      <div className="state-icon" aria-hidden>{icon ?? <Tray size={48} />}</div>
      <div className="state-title">{title}</div>
      <div className="state-hint">{hint}</div>
      {action}
    </div>
  );
}

interface ErrorProps {
  message: string;
  errorCode?: number;
  onRetry?: () => void;
}

export function ErrorState({ message, errorCode, onRetry }: ErrorProps) {
  return (
    <div className="state-view">
      <div className="state-icon state-icon-danger" aria-hidden>
        <WarningCircle size={48} />
      </div>
      <div className="state-title">加载失败</div>
      <div className="state-hint">{message}</div>
      {onRetry && (
        <Button variant="secondary" icon={<ArrowClockwise size={16} />} onClick={onRetry}>
          重试
        </Button>
      )}
      {errorCode !== undefined && <div className="text-xs text-muted mono">错误码 {errorCode}</div>}
    </div>
  );
}

/** 表格骨架：与最终行形状一致的条块 */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="skeleton-wrap" aria-label="加载中">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </div>
  );
}

/** 列表顶部不定长进度条（分页/筛选时不整页闪白） */
export function TopProgressBar({ active }: { active: boolean }) {
  return <div className={`top-progress ${active ? 'active' : ''}`} aria-hidden />;
}
