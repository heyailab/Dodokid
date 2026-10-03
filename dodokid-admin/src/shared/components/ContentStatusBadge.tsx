/**
 * 内容四态徽章 ContentStatusBadge — 唯一实现，列表/编辑页/版本页共用（§4）。
 * 文字 + 圆点双通道（不靠颜色单独传达）；纯展示，无 hover。
 */
import { Archive, ClockCountdown, PencilSimpleLine, SealCheck } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import type { CSSProperties } from 'react';
import type { ContentStatus } from '../../types/api';

interface StatusStyle {
  label: string;
  bg: string;
  fg: string;
  dot: string;
  border: string;
  icon: Icon;
  desc: string;
}

// 四态样式集中定义（值取自 design-tokens-admin.json contentStatus）
const STATUS: Record<ContentStatus, StatusStyle> = {
  draft: {
    label: '草稿', bg: '#EEF1F4', fg: '#55636B', dot: '#8A99A1', border: '#DCE3E7',
    icon: PencilSimpleLine, desc: 'App 端不可见',
  },
  in_review: {
    label: '待审', bg: '#FDF3E2', fg: '#9A5B00', dot: '#F2A33C', border: '#F5E2C0',
    icon: ClockCountdown, desc: 'App 端不可见',
  },
  published: {
    label: '已发布', bg: '#E4F5EC', fg: '#146C46', dot: '#1E8E5A', border: '#C7E9D6',
    icon: SealCheck, desc: '已上线，App 可见',
  },
  archived: {
    label: '已归档', bg: '#ECEFF1', fg: '#55636B', dot: '#9AA7AE', border: '#DDE3E6',
    icon: Archive, desc: '已下架，App 不可见',
  },
};

export function statusStyle(status: ContentStatus): StatusStyle {
  return STATUS[status];
}

interface Props {
  status: ContentStatus;
  withIcon?: boolean;
}

export function ContentStatusBadge({ status, withIcon = false }: Props) {
  const s = STATUS[status];
  const IconCmp = s.icon;
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 20,
    padding: '0 8px',
    borderRadius: 4,
    background: s.bg,
    color: s.fg,
    border: `1px solid ${s.border}`,
    fontSize: 12,
    fontWeight: 500,
    lineHeight: '16px',
    whiteSpace: 'nowrap',
  };
  return (
    <span style={style} title={s.desc}>
      {withIcon && <IconCmp size={14} weight="bold" aria-hidden />}
      <span
        aria-hidden
        style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }}
      />
      {s.label}
    </span>
  );
}
