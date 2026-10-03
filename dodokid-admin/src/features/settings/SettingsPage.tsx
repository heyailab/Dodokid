/** 后台设置 /settings — admin-only 分组表单（§3.11）。字段与 openapi AdminSettings 契约一致。 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { adminApi } from '../../lib/api';
import { Button, ErrorState, PageHeader, TableSkeleton, useToast } from '../../shared/components';
import type { AdminSettings } from '../../types/api';

const MIME_PRESETS = [
  'image/png', 'image/jpeg', 'image/webp', 'audio/mpeg', 'audio/mp4',
];

export function SettingsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['admin-settings'], queryFn: adminApi.getSettings });
  const [draft, setDraft] = useState<AdminSettings | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settings.data && !draft) setDraft({ ...settings.data });
  }, [settings.data, draft]);

  const save = useMutation({
    mutationFn: (d: AdminSettings) => adminApi.updateSettings(d),
    onSuccess: (d) => {
      toast.success('设置已保存');
      setDraft({ ...d });
      setDirty(false);
      void qc.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (settings.isPending) return <TableSkeleton rows={5} />;
  if (settings.isError) {
    return <ErrorState message={(settings.error as Error).message} onRetry={() => void settings.refetch()} />;
  }

  const patch = (p: Partial<AdminSettings>) => {
    setDraft((prev) => (prev ? { ...prev, ...p } : prev));
    setDirty(true);
  };

  return (
    <div>
      <PageHeader
        title="后台设置"
        actions={
          <Button
            loading={save.isPending} loadingText="保存中…"
            disabled={!dirty}
            onClick={() => draft && save.mutate(draft)}
          >
            保存设置
          </Button>
        }
      />

      {draft && (
        <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Group title="上传限制" hint="媒体上传的类型白名单与单文件大小上限，上传接口按此校验（40000 拒绝）。">
            <Field label="单文件上限（MB）">
              <input
                className="input-shell" type="number" min={1} max={200} value={draft.mediaMaxSizeMB}
                onChange={(e) => patch({ mediaMaxSizeMB: Number(e.target.value) })}
              />
            </Field>
            <Field label="允许的 MIME 类型">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {MIME_PRESETS.map((m) => (
                  <label key={m} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={draft.allowedMimeTypes.includes(m)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...draft.allowedMimeTypes, m]
                          : draft.allowedMimeTypes.filter((x) => x !== m);
                        patch({ allowedMimeTypes: next });
                      }}
                    />
                    <span className="mono text-sm">{m}</span>
                  </label>
                ))}
              </div>
            </Field>
          </Group>

          <Group title="内容默认值">
            <Field label="默认语言">
              <select className="input-shell" value={draft.defaultLocale} onChange={(e) => patch({ defaultLocale: e.target.value })}>
                <option value="zh-CN">简体中文（zh-CN）</option>
                <option value="en">English（en）</option>
              </select>
            </Field>
            <Field label="默认分页条数">
              <input
                className="input-shell" type="number" min={10} max={100} value={draft.paginationLimit}
                onChange={(e) => patch({ paginationLimit: Number(e.target.value) })}
              />
            </Field>
          </Group>

          <p className="text-xs text-muted">
            修改将写入审计日志（admin.settings.update），对所有运营成员生效。
          </p>
        </div>
      )}
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="panel" style={{ padding: 20 }}>
      <h2 style={{ fontSize: 16, fontWeight: 590, margin: '0 0 4px' }}>{title}</h2>
      {hint && <p className="text-sm text-muted" style={{ margin: '0 0 12px' }}>{hint}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--fg-2)', marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}
