/** 内容列表筛选栏 — 模块/年龄段多选、四态分段控件、防抖关键词、chip 回显（§3.3(b)）。 */
import { Select } from 'antd';
import { FilterBar, statusStyle } from '../../shared/components';
import type { AdminModule, AgeGroup, ContentStatus } from '../../types/api';

export const AGE_OPTIONS: Array<{ value: AgeGroup; label: string }> = [
  { value: '3-4', label: '3-4 岁' },
  { value: '4-6', label: '4-6 岁' },
];
const STATUS_TABS: Array<{ value: ContentStatus | ''; label: string }> = [
  { value: '', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'in_review', label: '待审' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已归档' },
];

export type ParamPatch = Record<string, string | string[] | undefined>;

interface Props {
  moduleKey: string[];
  ageGroup: AgeGroup | '';
  status: ContentStatus | '';
  filterQ: string;
  modules: AdminModule[];
  onParam: (patch: ParamPatch) => void;
  onReset: () => void;
  onRefetch: () => void;
  onSearchText: (v: string) => void;
}

export function ContentsFilter(props: Props) {
  const setFilterQ = props.onSearchText;
  return (
    <FilterBar
      controls={
        <>
          <Select
            mode="multiple" allowClear maxTagCount="responsive" placeholder="模块"
            style={{ minWidth: 160 }}
            options={props.modules.map((m) => ({ value: m.key, label: m.name }))}
            value={props.moduleKey}
            onChange={(v) => props.onParam({ moduleKey: v as string[] })}
          />
          <Select
            mode="multiple" allowClear maxTagCount="responsive" placeholder="年龄段"
            style={{ minWidth: 130 }} options={AGE_OPTIONS}
            value={props.ageGroup ? [props.ageGroup] : []}
            onChange={(v) => props.onParam({ ageGroup: (v as AgeGroup[])[0] ?? '' })}
          />
          <div
            role="tablist" aria-label="状态筛选"
            style={{ display: 'flex', gap: 2, background: 'var(--surface-sunken)', borderRadius: 8, padding: 2 }}
          >
            {STATUS_TABS.map((t) => (
              <button
                key={t.value} role="tab" aria-selected={props.status === t.value}
                onClick={() => props.onParam({ status: t.value })}
                style={{
                  border: 'none', cursor: 'pointer', height: 28, padding: '0 12px', borderRadius: 6,
                  fontSize: 13, fontWeight: props.status === t.value ? 500 : 400,
                  background: props.status === t.value ? 'var(--surface)' : 'transparent',
                  color: props.status === t.value ? 'var(--accent-ink)' : 'var(--fg-2)',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                {t.value && (
                  <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: statusStyle(t.value).dot }} />
                )}
                {t.label}
              </button>
            ))}
          </div>
          <input
            className="input-shell"
            style={{ width: 200 }}
            placeholder="搜索标题，回车查询"
            value={props.filterQ}
            onChange={(e) => setFilterQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') props.onParam({ q: props.filterQ });
            }}
            aria-label="按标题搜索"
          />
        </>
      }
      onReset={props.onReset}
      onSearch={props.onRefetch}
      chips={[
        ...props.moduleKey.map((k) => ({
          key: `mk-${k}`,
          label: props.modules.find((m) => m.key === k)?.name ?? k,
          onRemove: () => props.onParam({ moduleKey: props.moduleKey.filter((x) => x !== k) }),
        })),
        ...(props.ageGroup
          ? [{ key: 'ag', label: `${props.ageGroup} 岁`, onRemove: () => props.onParam({ ageGroup: '' }) }]
          : []),
        ...(props.status
          ? [{
              key: 'st',
              label: STATUS_TABS.find((t) => t.value === props.status)?.label ?? props.status,
              onRemove: () => props.onParam({ status: '' }),
            }]
          : []),
        ...(props.filterQ
          ? [{ key: 'q', label: `“${props.filterQ}”`, onRemove: () => props.onParam({ q: '' }) }]
          : []),
      ]}
    />
  );
}
