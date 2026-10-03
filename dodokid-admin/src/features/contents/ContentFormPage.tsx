/** 内容新建/编辑 — 装配层：状态编排 + 动作区 + 分组表单区段（§3.4 / §3.5 / §14.3）。 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminApi } from '../../lib/api';
import { ApiError } from '../../lib/http';
import { useAuth } from '../../stores/auth';
import {
  ConfirmProvider, ContentStatusBadge, ErrorState, PageHeader,
  TableSkeleton, statusStyle, useConfirm, useToast,
} from '../../shared/components';
import type { AgeGroup, ContentStatus } from '../../types/api';
import { ContentActionBar } from './action-bar';
import { MediaPickerDrawer } from './MediaPicker';
import {
  AttributionSection, BasicInfoSection, MediaSection, PublishSidebar,
} from './form-sections';
import type { FormValues } from './form-sections';

export function ContentFormPage() {
  return (
    <ConfirmProvider>
      <Inner />
    </ConfirmProvider>
  );
}

function Inner() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [pickerField, setPickerField] = useState<'cover' | 'mediaRef' | null>(null);
  const [cover, setCover] = useState('');
  const [mediaRef, setMediaRef] = useState('');
  const [form, setForm] = useState<Partial<FormValues>>({});
  const [dirty, setDirty] = useState(false);

  const detail = useQuery({
    queryKey: ['admin-content', id],
    queryFn: () => adminApi.getContent(id!),
    enabled: isEdit,
  });
  const modules = useQuery({ queryKey: ['admin-modules'], queryFn: adminApi.listModules });
  const item = detail.data?.item;

  useEffect(() => {
    if (item) {
      setForm({ ...item, summary: item.summary ?? '', cover: item.cover ?? '', mediaRef: item.mediaRef ?? '' });
      setCover(item.cover ?? '');
      setMediaRef(item.mediaRef ?? '');
      setDirty(false);
    }
  }, [item]);

  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);

  const patch = (k: keyof FormValues, v: unknown) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    setDirty(true);
  };

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin-content', id] });
    void qc.invalidateQueries({ queryKey: ['admin-contents'] });
  };

  const isAdmin = user?.role === 'admin';

  const save = useMutation({
    mutationFn: async (after?: () => void) => {
      // v1.2.1：isSample 仅 admin 场景携带（editor 携带会被后端 40300 拒绝）
      const sampleField = isAdmin ? { isSample: form.isSample ?? false } : {};
      if (!item) {
        const created = await adminApi.createContent({
          moduleKey: form.moduleKey!,
          type: form.type!,
          ageGroup: form.ageGroup as AgeGroup,
          title: form.title!,
          summary: form.summary || undefined,
          cover: cover || undefined,
          mediaRef: mediaRef || undefined,
          tags: [],
          order: form.order ?? 0,
          locale: form.locale || 'zh-CN',
          ...sampleField,
        });
        return { item: created, after };
      }
      const updated = await adminApi.updateContent(item._id, {
        expectedVersion: item.version,
        title: form.title,
        summary: form.summary ?? null,
        cover: cover || null,
        mediaRef: mediaRef || null,
        order: form.order,
        locale: form.locale,
        ...sampleField,
      });
      return { item: updated, after };
    },
    onSuccess: ({ item: saved, after }) => {
      toast.success('已保存');
      setDirty(false);
      invalidate();
      if (!isEdit && saved) navigate(`/contents/${saved._id}/edit`, { replace: true });
      after?.();
    },
    onError: (e: Error) => {
      toast.error(
        e instanceof ApiError && e.code === 40900 ? '版本冲突：他人已修改，请刷新页面后重试' : e.message,
      );
    },
  });

  const transition = useMutation({
    mutationFn: (action: 'submit' | 'approve' | 'publish' | 'withdraw') => {
      const cid = item!._id;
      switch (action) {
        case 'submit': return adminApi.submitContent(cid);
        case 'approve': return adminApi.approveContent(cid);
        // v1.2.0：draft 直发带乐观锁；409 时 onError 提示并 invalidate 刷新 currentVersion
        case 'publish': return adminApi.publishContent(cid, item!.version);
        case 'withdraw': return adminApi.withdrawContent(cid);
      }
    },
    onSuccess: (_d, action) => {
      const msg: Record<'submit' | 'approve' | 'publish' | 'withdraw', string> = {
        submit: '已提交审核',
        approve: '审核通过 · 已发布，App 端可见',
        publish: '已发布 · App 端可见',
        withdraw: '已撤回 · 回到草稿',
      };
      toast.success(msg[action]);
      setDirty(false);
      invalidate();
      void qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      // 乐观锁冲突：刷新当前版本
      invalidate();
    },
  });

  if (isEdit && detail.isPending) return <TableSkeleton rows={6} />;
  if (isEdit && detail.isError) {
    return <ErrorState message={(detail.error as Error)?.message ?? '加载失败'} onRetry={() => void detail.refetch()} />;
  }

  const status: ContentStatus = item?.status ?? 'draft';
  const statusMeta = { status, isEdit, dirty, isAdmin, saving: save.isPending, transitioning: transition.isPending, item };

  const onSaveThen = (after?: () => void) => {
    if (!form.title?.trim()) {
      toast.error('标题不能为空');
      return;
    }
    if (form.title.length > 80) {
      toast.error('标题不能超过 80 字');
      return;
    }
    if (dirty || !isEdit) save.mutate(after);
    else after?.();
  };

  const bar = {
    ...statusMeta,
    onOpenRevisions: () => item && navigate(`/contents/${item._id}/revisions`),
    onPreview: () => toast.success('预览已生成（C 端渲染契约）'),
    onSave: () => onSaveThen(),
    onSubmit: () => transition.mutate('submit'),
    onPublish: () => confirm({
      title: '直接发布后此内容将立即在 App 端可见',
      description: '跳过审核流程（admin 专权）。发布后可在 C 端内容列表看到，可随时下架。',
      target: item ? { name: item.title, id: item._id } : undefined,
      confirmText: '直接发布',
      onConfirm: async () => { await transition.mutateAsync('publish'); },
    }),
    onWithdraw: () => confirm({
      title: '撤回后此内容将离开审核队列',
      description: '回到草稿后可继续编辑，再次提交审核。审核人记录将被清除。',
      target: item ? { name: item.title, id: item._id } : undefined,
      confirmText: '撤回',
      onConfirm: async () => { await transition.mutateAsync('withdraw'); },
    }),
    onApprove: () => confirm({
      title: '通过后此内容将立即在 App 端可见',
      description: '发布内容会出现在 C 端内容列表。可在发布后下架。',
      confirmText: '审核通过',
      onConfirm: async () => { await transition.mutateAsync('approve'); },
    }),
    onUnpublish: () => item && confirm({
      title: '下架后 App 将不再展示此内容',
      description: '此操作会立即生效，可重新提交审核上架。',
      target: { name: item.title, id: item._id },
      confirmText: '下架',
      danger: true,
      onConfirm: async () => {
        await adminApi.unpublishContent(item._id);
        toast.success('已下架 · App 端不再展示');
        invalidate();
      },
    }),
  };

  const onClearCover = () => { setCover(''); setDirty(true); };
  const onClearMedia = () => { setMediaRef(''); setDirty(true); };
  const onPickCover = () => setPickerField('cover');
  const onPickMedia = () => setPickerField('mediaRef');

  return (
    <div>
      <PageHeader
        title={isEdit ? `编辑 · ${item?.title ?? ''}` : '新建内容'}
        extra={
          isEdit ? (
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <ContentStatusBadge status={status} withIcon />
              {item && <span className="mono text-sm text-muted">v{item.version}</span>}
              {dirty && <span className="text-xs text-muted">● 未保存</span>}
              <span className="text-xs text-muted">{statusStyle(status).desc}</span>
            </span>
          ) : undefined
        }
        actions={<ContentActionBar {...bar} />}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
        <div className="panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <BasicInfoSection values={form} patch={patch} />
          {!isEdit && <AttributionSection values={form} patch={patch} modules={modules.data ?? []} />}
          <MediaSection
            type={form.type}
            cover={cover}
            mediaRef={mediaRef}
            onPickCover={onPickCover}
            onClearCover={onClearCover}
            onPickMedia={onPickMedia}
            onClearMedia={onClearMedia}
          />
        </div>
        <PublishSidebar status={status} values={form} patch={patch} item={item} showSample={isAdmin} />
      </div>

      <MediaPickerDrawer
        open={pickerField !== null}
        onClose={() => setPickerField(null)}
        acceptMimePrefix={pickerField === 'cover' ? 'image' : pickerField === 'mediaRef' ? (form.type === 'song' ? 'audio' : undefined) : undefined}
        onSelect={(cdnKey) => {
          if (pickerField === 'cover') setCover(cdnKey);
          if (pickerField === 'mediaRef') setMediaRef(cdnKey);
          setDirty(true);
        }}
      />
    </div>
  );
}
