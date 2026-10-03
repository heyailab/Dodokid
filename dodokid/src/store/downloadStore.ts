/**
 * 离线下载状态 Store（AC-07）：以 contentId 为键维护每个内容的下载态
 * idle / downloading / done / error，并透传版本可更新标记。真实落盘由
 * lib/offline 负责，本 store 只管理 UI 状态。
 */
import { create } from 'zustand';
import type { ContentItem } from '../api/types';
import * as offline from '../lib/offline';

export type DownloadStatus = 'idle' | 'downloading' | 'done' | 'error';

interface DownloadState {
  status: Record<string, DownloadStatus>;
  updatable: Record<string, boolean>;
  download: (item: ContentItem) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: (item: ContentItem) => Promise<void>;
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  status: {},
  updatable: {},
  download: async (item) => {
    set((s) => ({ status: { ...s.status, [item.id]: 'downloading' } }));
    try {
      await offline.cacheContent(item);
      await offline.downloadFiles(item);
      set((s) => ({ status: { ...s.status, [item.id]: 'done' }, updatable: { ...s.updatable, [item.id]: false } }));
    } catch {
      set((s) => ({ status: { ...s.status, [item.id]: 'error' } }));
    }
  },
  remove: async (id) => {
    await offline.removeCache(id);
    set((s) => ({ status: { ...s.status, [id]: 'idle' } }));
  },
  refresh: async (item) => {
    const [cached, stale] = await Promise.all([
      offline.isCached(item.id),
      offline.needsUpdate(item.id, item.version),
    ]);
    set((s) => ({
      status: { ...s.status, [item.id]: cached ? ('done' as DownloadStatus) : ('idle' as DownloadStatus) },
      updatable: { ...s.updatable, [item.id]: cached && stale },
    }));
  },
}));
