/**
 * 自研 Toast — 替代 AntD message/notification（项目裁决）。
 * 右下角，成功/错误两种语义底色，2.5s 自动消失，错误带重试。
 */
import { CheckCircle, WarningCircle, X } from '@phosphor-icons/react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface ToastItem {
  id: number;
  kind: 'success' | 'error';
  message: string;
  retry?: () => void;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string, retry?: () => void) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (kind: ToastItem['kind'], message: string, retry?: () => void) => {
      const id = nextId++;
      setItems((prev) => [...prev.slice(-3), { id, kind, message, retry }]);
      timers.current.set(
        id,
        setTimeout(() => remove(id), kind === 'success' ? 2500 : 4500),
      );
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m, retry) => push('error', m, retry),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        style={{ position: 'fixed', right: 24, bottom: 24, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 1200 }}
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 280,
              maxWidth: 420,
              padding: '10px 12px',
              borderRadius: 8,
              boxShadow: 'var(--elev-overlay)',
              background: t.kind === 'success' ? 'var(--success-soft)' : 'var(--danger-soft)',
              color: t.kind === 'success' ? 'var(--success-ink)' : 'var(--danger-ink)',
              fontSize: 13,
            }}
          >
            {t.kind === 'success' ? (
              <CheckCircle size={18} weight="fill" aria-hidden />
            ) : (
              <WarningCircle size={18} weight="fill" aria-hidden />
            )}
            <span style={{ flex: 1 }}>{t.message}</span>
            {t.retry && (
              <button className="link-btn" onClick={() => { t.retry?.(); remove(t.id); }}>
                重试
              </button>
            )}
            <button className="icon-plain" aria-label="关闭提示" onClick={() => remove(t.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
