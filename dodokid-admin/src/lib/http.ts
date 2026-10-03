/**
 * HTTP 层 — 统一信封 { success, code, message, data }。
 * - 401：清除会话并跳登录；
 * - 403：触发全局回调（Toast + 数据刷新，AC-11 真实权限以后端为准）；
 * - 409：冲突（状态机/乐观锁），由调用方处理。
 */
import type { ApiEnvelope } from '../types/api';

const BASE = import.meta.env.VITE_API_BASE ?? '/api/v1';
const TOKEN_KEY = 'dodokid_admin_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

type UnauthorizedHandler = () => void;
type ForbiddenHandler = (message: string) => void;

let onUnauthorized: UnauthorizedHandler = () => {};
let onForbidden: ForbiddenHandler = () => {};

export function registerUnauthorizedHandler(fn: UnauthorizedHandler): void {
  onUnauthorized = fn;
}
export function registerForbiddenHandler(fn: ForbiddenHandler): void {
  onForbidden = fn;
}

export class ApiError extends Error {
  code: number;
  status: number;
  constructor(code: number, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function http<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, '网络请求超时，请检查网络后重试', 0);
  }

  const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (res.status === 401) {
    onUnauthorized();
    throw new ApiError(40100, '登录已过期，请重新登录', 401);
  }
  if (res.status === 403) {
    const msg = body?.message ?? '操作被拒绝，需要 admin 权限';
    onForbidden(msg);
    throw new ApiError(40300, msg, 403);
  }
  if (!res.ok || !body || !body.success) {
    throw new ApiError(
      body?.code ?? res.status,
      body?.message ?? `请求失败（${res.status}）`,
      res.status,
    );
  }
  return body.data;
}

export const get = <T>(path: string) => http<T>(path);
export const post = <T>(path: string, data?: unknown) =>
  http<T>(path, { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) });
export const put = <T>(path: string, data: unknown) =>
  http<T>(path, { method: 'PUT', body: JSON.stringify(data) });
export const del = <T>(path: string) => http<T>(path, { method: 'DELETE' });

/**
 * 二进制直传（媒体上传用）：请求体是文件字节，不能强制 JSON Content-Type。
 * 其余处理（Bearer 注入、信封解析、401/403 回调）与 http 完全一致。
 */
export const putBinary = <T>(path: string, body: Blob, contentType: string) =>
  http<T>(path, { method: 'PUT', body, headers: { 'Content-Type': contentType } });

export function qs(params: Record<string, string | number | string[] | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    if (Array.isArray(v)) sp.set(k, v.join(','));
    else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
