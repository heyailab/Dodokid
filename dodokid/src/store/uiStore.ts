/** 轻量 UI Store：全局 Toast 提示 */
import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'warn' | 'danger';

interface ToastState {
  message: string | null;
  kind: ToastKind;
  seq: number;
  show: (message: string, kind?: ToastKind) => void;
  hide: () => void;
}

export const useUiStore = create<ToastState>((set) => ({
  message: null,
  kind: 'info',
  seq: 0,
  show(message, kind = 'info') {
    set((s) => ({ message, kind, seq: s.seq + 1 }));
  },
  hide() {
    set({ message: null });
  },
}));
