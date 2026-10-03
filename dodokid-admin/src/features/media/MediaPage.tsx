/** 媒体库 /media — 上传 + 网格 + 复制 CDN 链接 + 删除（admin，§5）。 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Images, LinkSimple, MusicNote, Plus, Trash, UploadSimple } from '@phosphor-icons/react';
import { Pagination, Select } from 'antd';
import { useState } from 'react';
import { adminApi } from '../../lib/api';
import { useAuth } from '../../stores/auth';
import {
  Can, EmptyState, ErrorState, PageHeader, formatBytes, formatDuration, useConfirm, useToast,
} from '../../shared/components';
import type { AdminMediaAsset } from '../../types/api';
import { uploadMediaFile, type MediaFolder } from './uploadDirect';

const FOLDERS = [
  { value: 'books', label: '绘本页' },
  { value: 'songs', label: '音频' },
  { value: 'covers', label: '封面' },
  { value: 'icons', label: '图标' },
  { value: 'misc', label: '其他' },
];

export function MediaPage() {
  const [folder, setFolder] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['admin-media', { folder, page }],
    queryFn: () => adminApi.listMedia({ folder, page, limit: 20 }),
    placeholderData: (prev) => prev,
  });

  const upload = useMutation({
    mutationFn: async (files: FileList) => {
      const results = [];
      for (const file of Array.from(files)) {
        const folderKey = (folder ?? guessFolder(file)) as MediaFolder;
        results.push(await uploadMediaFile(file, folderKey));
      }
      return results;
    },
    onSuccess: () => {
      toast.success('上传完成');
      void qc.invalidateQueries({ queryKey: ['admin-media'] });
    },
    onError: (e: Error) => toast.error(e.message, () => upload.reset()),
  });

  const remove = useMutation({
    mutationFn: (m: AdminMediaAsset) => adminApi.deleteMedia(m._id),
    onSuccess: () => {
      toast.success('媒体已删除');
      void qc.invalidateQueries({ queryKey: ['admin-media'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = list.data?.items ?? [];
  const isAudioOnly = folder === 'songs';

  return (
    <div>
      <PageHeader
        title="媒体库"
        count={list.data ? `共 ${list.data.meta.total} 个文件` : undefined}
        actions={
          <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
            <Plus size={20} aria-hidden />
            上传媒体
            <input
              type="file" multiple style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files?.length) upload.mutate(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        }
      />
      <p className="text-sm text-muted" style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <UploadSimple size={14} aria-hidden />
        支持图片与音频（JPG/PNG/WebP/MP3 等），单文件大小上限与类型白名单由后台设置控制。
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Select
          allowClear placeholder="全部目录" style={{ width: 160 }}
          options={FOLDERS} value={folder}
          onChange={(v) => { setFolder(v); setPage(1); }}
        />
      </div>

      {list.isPending ? (
        <EmptyState title="加载中" hint="正在获取媒体列表…" />
      ) : list.isError ? (
        <ErrorState message={(list.error as Error).message} onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Images size={48} />}
          title="媒体库是空的"
          hint="拖入图片或音频，或点击右上角“上传媒体”。"
        />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
            {items.map((m) => {
              const audio = isAudioOnly || m.mime.startsWith('audio');
              return (
                <div key={m._id} className="panel" style={{ overflow: 'hidden' }}>
                  <div style={{ position: 'relative', background: 'var(--surface-sunken)' }}>
                    {audio ? (
                      <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--fg-2)' }}>
                        <MusicNote size={24} aria-hidden />
                        <span className="mono text-sm">{formatDuration(m.durationMs)}</span>
                      </div>
                    ) : (
                      <img src={m.url} alt={m.fileName} style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
                    )}
                    {audio && (
                      <span aria-hidden style={{ position: 'absolute', top: 6, right: 6 }}><MusicNote size={14} /></span>
                    )}
                    {!audio && m.width && (
                      <span className="mono text-xs" style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(255,255,255,0.9)', borderRadius: 4, padding: '0 4px' }}>
                        {m.width}×{m.height}
                      </span>
                    )}
                  </div>
                  <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span className="text-sm" title={`${m.fileName} · ${formatBytes(m.size)}`} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.fileName}
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className="icon-plain" aria-label="复制 CDN 链接"
                        onClick={async () => {
                          await navigator.clipboard.writeText(m.url);
                          setCopiedId(m._id);
                          toast.success('已复制链接');
                          window.setTimeout(() => setCopiedId(null), 2000);
                        }}
                      >
                        {copiedId === m._id ? <Check size={16} color="var(--success)" /> : <LinkSimple size={16} />}
                      </button>
                      <button className="icon-plain" aria-label="预览" onClick={() => window.open(m.url, '_blank')}>
                        <Images size={16} />
                      </button>
                      {can('media.delete') && (
                        <Can perm="media.delete">
                          <button
                            className="icon-plain" aria-label={`删除 ${m.fileName}`}
                            style={{ color: 'var(--danger)' }}
                            onClick={() => confirm({
                              title: '删除后引用此媒体的内容将缺图',
                              description: '若该媒体仍被已发布内容引用，删除会被后端拒绝（409）。此操作不可撤销。',
                              target: { name: m.fileName, id: m._id },
                              typeToConfirm: m.fileName,
                              confirmText: '删除',
                              danger: true,
                              onConfirm: () => remove.mutateAsync(m),
                            })}
                          >
                            <Trash size={16} />
                          </button>
                        </Can>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 16 }}>
            <Pagination
              current={page} pageSize={20} total={list.data?.meta.total ?? 0}
              showSizeChanger={false}
              showTotal={(t, r) => `第 ${r[0]}–${r[1]} 个，共 ${t} 个`}
              onChange={setPage}
            />
          </div>
        </>
      )}
    </div>
  );
}

function guessFolder(file: File): 'books' | 'songs' | 'covers' | 'icons' | 'misc' {
  if (file.type.startsWith('audio')) return 'songs';
  if (file.name.includes('cover')) return 'covers';
  return 'misc';
}
