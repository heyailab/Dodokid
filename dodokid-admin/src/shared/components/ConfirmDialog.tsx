/**
 * 破坏性确认弹窗 ConfirmDialog（§8）— 基于 AntD Modal（重型组件白名单）。
 * 分级：中危单次确认；高危需输入目标名（防误删）。焦点默认落"取消"，Esc = 取消。
 */
import { WarningCircle } from '@phosphor-icons/react';
import { Modal, Input } from 'antd';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';

export interface ConfirmRequest {
  title: string;
  description: string;
  /** 对象卡：目标名 / ID */
  target?: { name: string; id?: string };
  /** 高危：需输入该文本才可确认 */
  typeToConfirm?: string;
  confirmText: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setText('');
    setLoading(false);
  }, [request]);

  if (!request) return null;
  const blocked = Boolean(request.typeToConfirm) && text.trim() !== request.typeToConfirm;

  const confirm = async () => {
    setLoading(true);
    try {
      await request.onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open
      onCancel={onClose}
      width={440}
      maskClosable={false}
      cancelButtonProps={{ style: { display: 'none' } }}
      okButtonProps={{ style: { display: 'none' } }}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <WarningCircle size={22} color="var(--danger)" aria-hidden />
          {request.title}
        </span>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button
            variant={request.danger ? 'danger' : 'primary'}
            loading={loading}
            disabled={blocked}
            onClick={confirm}
          >
            {request.confirmText}
          </Button>
        </div>
      }
    >
      <p style={{ margin: '8px 0 12px', color: 'var(--fg-2)' }}>{request.description}</p>
      {request.target && (
        <div style={{ background: 'var(--surface-sunken)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
          <div style={{ fontWeight: 590 }}>{request.target.name}</div>
          {request.target.id && <div className="text-xs text-muted mono">{request.target.id}</div>}
        </div>
      )}
      {request.typeToConfirm && (
        <Input
          aria-label={`输入 ${request.typeToConfirm} 以确认`}
          placeholder={`输入“${request.typeToConfirm}”以确认`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      )}
    </Modal>
  );
}

/** useConfirm — 在页面级挂载一次，全局调用 */
const ConfirmContext = createContext<(req: ConfirmRequest) => void>(() => {});

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<ConfirmRequest | null>(null);
  const api = useMemo<(r: ConfirmRequest) => void>(() => setReq, []);
  return (
    <ConfirmContext.Provider value={api}>
      {children}
      <ConfirmDialog request={req} onClose={() => setReq(null)} />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
