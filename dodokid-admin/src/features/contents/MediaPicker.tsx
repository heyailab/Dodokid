/** 媒体选择器抽屉 — 复用 /media 网格，选择态 + 就地上传（§3.5 / §5）。 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Images, LinkSimple, MusicNote, Plus } from '@phosphor-icons/react';
import { Drawer, Select } from 'antd';
import { useState } from 'react';
import { adminApi } from '../../lib/api';
import { uploadMediaFile, type MediaFolder } from '../media/uploadDirect';
import { EmptyState, ErrorState, TableSkeleton, formatBytes, formatDuration, useToast } from '../../shared/components';
import type { AdminMediaAsset } from '../../types/api';

const FOLDERS = [
  { value: 'covers', label: '封面' },
  { value: 'books', label: '绘本页' },
  { value: 'songs', label: '音频' },
  { value: 'icons', label: '图标' },
  { value: 'misc', label: '其他' },
];

export function MediaPickerDrawer({
  open,
  onClose,
  onSelect,
  acceptMimePrefix,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (cdnKey: string) => void;
  acceptMimePrefix?: string;
}) {
  const [folder, setFolder] = useState<string | undefined>();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const qc = useQueryClient();
  const toast = useToast();

  const list = useQuery({
    queryKey: ['admin-media', { folder, limit: 40 }],
    queryFn: () => adminApi.listMedia({ folder, limit: 40 }),
    enabled: open,
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      return uploadMediaFile(file, (folder ?? 'misc') as MediaFolder);
    },
    onSuccess: () => {
      toast.success('上传完成');
      void qc.invalidateQueries({ queryKey: ['admin-media'] });
    },
    onError: (e: Error) => toast.error(e.message, () => upload.reset()),
  });

  const items = (list.data?.items ?? []).filter(
    (m) => !acceptMimePrefix || m.mime.startsWith(acceptMimePrefix),
  );

  return (
    <Drawer open={open} onClose={onClose} width={720} title="选择媒体" destroyOnClose>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <Select
          allowClear placeholder="目录"
          style={{ width: 140 }}
          options={FOLDERS}
          value={folder}
          onChange={setFolder}
        />
        <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
          <Plus size={16} aria-hidden />
          就地上传
          <input
            type="file"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
              e.target.value = '';
            }}
          />
        </label>
        <span className="text-xs text-muted">上传受后台设置限制（类型 / 大小）</span>
      </div>

      {list.isPending ? (
        <TableSkeleton rows={4} />
      ) : list.isError ? (
        <ErrorState message={(list.error as Error).message} onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={<Images size={48} />} title="暂无媒体" hint="先上传一张图片或一段音频。" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {items.map((m) => (
            <MediaCell
              key={m._id}
              asset={m}
              copied={copiedId === m._id}
              onCopy={async () => {
                await navigator.clipboard.writeText(m.url);
                setCopiedId(m._id);
                toast.success('已复制链接');
                window.setTimeout(() => setCopiedId(null), 2000);
              }}
              onPick={() => {
                onSelect(m.cdnKey);
                onClose();
              }}
            />
          ))}
        </div>
      )}
    </Drawer>
  );
}

function MediaCell({
  asset, onPick, onCopy, copied,
}: { asset: AdminMediaAsset; onPick: () => void; onCopy: () => void; copied: boolean }) {
  const isAudio = asset.mime.startsWith('audio');
  return (
    <div className="panel" style={{ overflow: 'hidden' }}>
      <button
        onClick={onPick}
        aria-label={`选择 ${asset.fileName}`}
        style={{ display: 'block', width: '100%', border: 'none', padding: 0, cursor: 'pointer', background: 'var(--surface-sunken)' }}
      >
        {isAudio ? (
          <div style={{ height: 84, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--fg-2)' }}>
            <MusicNote size={22} aria-hidden />
            <span className="mono text-sm">{formatDuration(asset.durationMs)}</span>
          </div>
        ) : (
          <img src={asset.url} alt={asset.fileName} style={{ width: '100%', height: 84, objectFit: 'cover', display: 'block' }} />
        )}
      </button>
      <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span className="text-xs" title={asset.fileName} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {asset.fileName} · {formatBytes(asset.size)}
        </span>
        <button className="icon-plain" onClick={onCopy} aria-label="复制 CDN 链接">
          {copied ? <Check size={14} color="var(--success)" /> : <LinkSimple size={14} />}
        </button>
      </div>
    </div>
  );
}
