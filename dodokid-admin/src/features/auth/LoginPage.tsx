/** 登录页 — 左表单 480px / 右品牌区（§3.1）。凭证错不区分账号/密码（防枚举）。 */
import { WarningCircle } from '@phosphor-icons/react';
import { useForm } from 'react-hook-form';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../../stores/auth';
import { Button } from '../../shared/components';
import { ApiError } from '../../lib/http';
import { zodResolver } from '../../lib/zodResolver';

const schema = z.object({
  account: z.string().min(1, '请输入账号'),
  password: z.string().min(8, '密码长度至少 8 位'),
  remember: z.boolean().optional(),
});
type FormValues = z.infer<typeof schema>;

const MAX_FAILS = 5;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [fails, setFails] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { account: '', password: '', remember: false } });

  const locked = fails >= MAX_FAILS;
  const lockRemaining = MAX_FAILS - fails;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSubmitting(true);
    try {
      await login(values.account, values.password);
      navigate('/dashboard', { replace: true });
    } catch (e) {
      setFails((f) => f + 1);
      setFormError(
        e instanceof ApiError && e.code === 40300
          ? '账号已停用，请联系管理员'
          : '账号或密码不正确，请重试',
      );
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div style={{ width: 480, flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 64px' }}>
        <h1 style={{ fontSize: 24, lineHeight: '32px', fontWeight: 590, letterSpacing: '-0.01em', margin: '0 0 4px' }}>
          DodoKid 内容运营后台
        </h1>
        <p className="text-sm text-muted" style={{ margin: '0 0 28px' }}>使用运营账号登录，仅授权人员可访问。</p>

        {formError && (
          <div role="alert" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--danger-soft)', color: 'var(--danger-ink)', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 16 }}>
            <WarningCircle size={16} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              {formError}
              {fails >= 1 && fails < MAX_FAILS && <span className="text-xs" style={{ display: 'block', marginTop: 2 }}>连续失败 {fails} 次，失败 {MAX_FAILS} 次将临时锁定</span>}
            </span>
          </div>
        )}

        <form onSubmit={onSubmit} noValidate>
          <label htmlFor="account" style={labelStyle}>账号（手机号）</label>
          <input id="account" type="text" autoComplete="username" className="input-shell" aria-required {...register('account')} />
          {errors.account && <FieldError msg={errors.account.message} />}

          <label htmlFor="password" style={{ ...labelStyle, marginTop: 16 }}>密码</label>
          <input id="password" type="password" autoComplete="current-password" className="input-shell" aria-required {...register('password')} />
          {errors.password && <FieldError msg={errors.password.message} />}

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0 24px', fontSize: 13, color: 'var(--fg-2)' }}>
            <input type="checkbox" {...register('remember')} />
            记住此设备
          </label>

          <Button type="submit" loading={submitting} loadingText="登录中…" disabled={locked} style={{ width: '100%' }}>
            {locked ? `已锁定，请 ${lockRemaining > 0 ? '稍后' : ''}重试` : '登录'}
          </Button>
        </form>
      </div>
      <div
        aria-hidden
        style={{
          flex: 1,
          background: 'var(--surface-sunken)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 薄荷青单色几何纹理（非渐变、非插画） */}
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.5 }}>
          <g stroke="var(--accent)" strokeWidth="1.5" fill="none">
            {Array.from({ length: 9 }, (_, i) => (
              <circle key={`c${i}`} cx={`${18 + i * 9}%`} cy={`${20 + ((i * 13) % 60)}%`} r={40 + (i % 4) * 36} />
            ))}
          </g>
        </svg>
        <div style={{ position: 'absolute', left: 48, bottom: 48, fontSize: 14, color: 'var(--fg-2)', background: 'var(--surface)', padding: '8px 14px', borderRadius: 8, boxShadow: 'var(--elev-ring)' }}>
          内容运营后台 · 仅授权人员访问
        </div>
      </div>
    </div>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <div role="alert" className="text-sm" style={{ color: 'var(--danger-ink)', marginTop: 4 }}>
      {msg}
    </div>
  );
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--fg-2)',
  marginBottom: 6,
};
