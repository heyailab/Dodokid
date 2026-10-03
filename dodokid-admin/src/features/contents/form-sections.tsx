/** 内容表单分组区段 — 基本信息 / 归属 / 媒体 / 发布侧栏（§3.4(b)(c)）。页面文件只做装配。 */
import type { ReactNode } from 'react';
import { Switch } from 'antd';
import { ContentStatusBadge, formatDateTime } from '../../shared/components';
import type { AdminContent, AdminModule, AgeGroup, ContentStatus } from '../../types/api';

export interface FormValues {
  title?: string;
  summary?: string;
  cover?: string;
  mediaRef?: string;
  moduleKey?: string;
  type?: 'book' | 'song' | 'habit';
  ageGroup?: AgeGroup;
  order?: number;
  locale?: string;
  /** v1.2.1 试读样章（admin-only 可写） */
  isSample?: boolean;
}

export type PatchFn = (k: keyof FormValues, v: unknown) => void;

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 style={{ fontSize: 16, fontWeight: 590, margin: '0 0 12px' }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--fg-2)', marginBottom: 6 }}>
        {label}{required && <span aria-hidden> *</span>}
      </span>
      {children}
    </label>
  );
}

/** 基本信息：标题 / 摘要 */
export function BasicInfoSection({ values, patch }: { values: FormValues; patch: PatchFn }) {
  return (
    <Group title="基本信息">
      <Field label="标题" required>
        <input className="input-shell" value={values.title ?? ''} maxLength={80} onChange={(e) => patch('title', e.target.value)} />
      </Field>
      <Field label="摘要">
        <textarea className="input-shell" style={{ height: 72, paddingTop: 8 }} value={values.summary ?? ''} maxLength={300} onChange={(e) => patch('summary', e.target.value)} />
      </Field>
    </Group>
  );
}

/** 归属（仅新建可改）：类型 / 模块 / 年龄段 */
export function AttributionSection({
  values, patch, modules,
}: { values: FormValues; patch: PatchFn; modules: AdminModule[] }) {
  return (
    <Group title="归属">
      <Field label="内容类型" required>
        <select className="input-shell" value={values.type ?? 'book'} onChange={(e) => patch('type', e.target.value)}>
          <option value="book">绘本</option>
          <option value="song">儿歌</option>
          <option value="habit">习惯</option>
        </select>
      </Field>
      <Field label="所属模块" required>
        <select className="input-shell" value={values.moduleKey ?? ''} onChange={(e) => patch('moduleKey', e.target.value)}>
          <option value="">请选择</option>
          {modules.filter((m) => m.enabled).map((m) => (
            <option key={m.key} value={m.key}>{m.name}</option>
          ))}
        </select>
      </Field>
      <Field label="年龄段" required>
        <select className="input-shell" value={values.ageGroup ?? '3-4'} onChange={(e) => patch('ageGroup', e.target.value)}>
          <option value="3-4">3-4 岁</option>
          <option value="4-6">4-6 岁</option>
        </select>
      </Field>
    </Group>
  );
}

function MediaField({ value, onPick, onClear, accept }: {
  value: string; onPick: () => void; onClear: () => void; accept?: 'image' | 'audio';
}) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input className="input-shell mono text-sm" value={value} readOnly placeholder="未选择，点击右侧按钮从媒体库选择" aria-label="媒体 CDN key" />
      <button type="button" className="btn btn-secondary btn-sm" onClick={onPick}>
        {accept === 'audio' ? '选择音频' : '选择媒体'}
      </button>
      {value && <button type="button" className="btn btn-secondary btn-sm" onClick={onClear}>清除</button>}
    </div>
  );
}

/** 媒体区：按内容类型给字段命名与 mime 过滤（§3.5 类型分支） */
export function MediaSection({
  type, cover, mediaRef, onPickCover, onClearCover, onPickMedia, onClearMedia,
}: {
  type: FormValues['type'];
  cover: string;
  mediaRef: string;
  onPickCover: () => void;
  onClearCover: () => void;
  onPickMedia: () => void;
  onClearMedia: () => void;
}) {
  const isSong = type === 'song';
  return (
    <Group title="媒体">
      <Field label="封面图">
        <MediaField value={cover} onPick={onPickCover} onClear={onClearCover} accept="image" />
      </Field>
      <Field label={isSong ? '音频文件' : '正文媒体'}>
        <MediaField value={mediaRef} onPick={onPickMedia} onClear={onClearMedia} accept={isSong ? 'audio' : undefined} />
      </Field>
    </Group>
  );
}

/** 右侧栏：发布设置（只读状态徽章 + 排序/语言 + 试读样章开关）+ 归属信息 */
export function PublishSidebar({
  status, values, patch, item, showSample = false,
}: {
  status: ContentStatus;
  values: FormValues;
  patch: PatchFn;
  item?: AdminContent;
  /** v1.2.1：isSample 为 admin-only 可写；editor 不渲染（AC-11 前端展示裁剪策略） */
  showSample?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 590 }}>发布设置</div>
        <Field label="状态">
          <ContentStatusBadge status={status} withIcon />
        </Field>
        <Field label="排序值">
          <input className="input-shell" type="number" min={0} value={values.order ?? 0} onChange={(e) => patch('order', Number(e.target.value))} />
        </Field>
        <Field label="语言">
          <select className="input-shell" value={values.locale ?? 'zh-CN'} onChange={(e) => patch('locale', e.target.value)}>
            <option value="zh-CN">简体中文</option>
            <option value="en">English</option>
          </select>
        </Field>
        {showSample && (
          <Field label="试读样章">
            <Switch
              size="small"
              checked={values.isSample ?? false}
              onChange={(v) => patch('isSample', v)}
              aria-label="设为试读样章"
            />
            <span className="text-xs text-muted" style={{ display: 'block', marginTop: 4 }}>
              样章将展示在 App 首页试读入口
            </span>
          </Field>
        )}
      </div>
      {item && (
        <div className="panel" style={{ padding: 16, fontSize: 13, color: 'var(--fg-2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 590, color: 'var(--fg)' }}>归属信息</div>
          <div>作者：<span className="mono">{item.authorId}</span></div>
          <div>版本：<span className="mono">v{item.version}</span></div>
          <div>更新时间：<span className="mono">{formatDateTime(item.updatedAt)}</span></div>
          {item.publishedAt && <div>发布时间：<span className="mono">{formatDateTime(item.publishedAt)}</span></div>}
        </div>
      )}
    </div>
  );
}
