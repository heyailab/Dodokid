/**
 * <Can> 权限门控 — 封装设计契约 §7.4 三档策略：
 * - when="hide"（默认）：不渲染；
 * - when="disable"：保留可见，禁用 + Tooltip 解释（LockSimple）。
 * 前端仅做展示裁剪，真实权限以后端 403 为准（AC-11）。
 */
import { LockSimple } from '@phosphor-icons/react';
import { Tooltip } from 'antd';
import type { ReactElement, ReactNode } from 'react';
import { useAuth } from '../../stores/auth';
import type { Permission } from '../../stores/auth';

interface CanProps {
  perm: Permission;
  children: ReactNode;
  when?: 'hide' | 'disable';
  /** disable 模式下的解释文案 */
  reason?: string;
  /** 禁用时包一层的元素（如按钮），会注入 disabled + aria */
  wrap?: (node: ReactElement, disabled: boolean) => ReactElement;
}

const DEFAULT_REASON = '需要“内容负责人(admin)”权限';

export function Can({ perm, children, when = 'hide', reason = DEFAULT_REASON, wrap }: CanProps) {
  const { can } = useAuth();
  if (can(perm)) return <>{children}</>;
  if (when === 'disable' && wrap) {
    return wrap(
      <span className="can-disabled-hint">
        <LockSimple size={12} aria-hidden /> {reason}
      </span>,
      true,
    );
  }
  if (when === 'disable') {
    return (
      <Tooltip title={<span><LockSimple size={12} aria-hidden /> {reason}</span>}>
        <span aria-disabled className="can-disabled-slot">{children}</span>
      </Tooltip>
    );
  }
  return null;
}
