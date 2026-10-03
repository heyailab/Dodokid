/**
 * 品牌原语 Button — 自绘（Ant 默认视觉仅保留给重型组件）。
 * 状态矩阵：Default / Hover / Focus / Active / Disabled / Loading（§9）。
 */
import { CircleNotch } from '@phosphor-icons/react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'danger';
type Size = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
  loadingText?: string;
}

function classesFor(variant: Variant, size: Size, loading: boolean): string {
  const sizeCls = size === 'sm' ? 'btn-sm' : '';
  switch (variant) {
    case 'secondary':
      return `btn-secondary ${sizeCls}`;
    case 'danger':
      return `btn-danger ${sizeCls}`;
    default:
      return `btn-primary ${sizeCls} ${loading ? 'is-loading' : ''}`;
  }
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, loading, loadingText, children, disabled, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`btn ${classesFor(variant, size, Boolean(loading))} ${className ?? ''}`}
      {...rest}
    >
      {loading ? <CircleNotch size={16} className="btn-spin" /> : icon}
      <span>{loading && loadingText ? loadingText : children}</span>
    </button>
  );
});
