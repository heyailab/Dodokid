/** 离线下载行为封装：把下载 store 与单个内容的缓存态组合给 UI 使用。 */
import { useEffect } from 'react';
import type { ContentItem } from '../api/types';
import { useDownloadStore } from '../store/downloadStore';

export function useDownload(item: ContentItem | undefined) {
  const status = useDownloadStore((s) => (item ? s.status[item.id] ?? 'idle' : 'idle'));
  const updatable = useDownloadStore((s) => (item ? s.updatable[item.id] ?? false : false));
  const download = useDownloadStore((s) => s.download);
  const remove = useDownloadStore((s) => s.remove);
  const refresh = useDownloadStore((s) => s.refresh);

  useEffect(() => {
    if (item) void refresh(item);
  }, [item, refresh]);

  return {
    status,
    updatable,
    isDownloaded: status === 'done',
    isDownloading: status === 'downloading',
    download: () => item && download(item),
    remove: () => item && remove(item.id),
  };
}
