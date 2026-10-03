/**
 * HTTP 客户端 + 错误分类 + 超时 + Mock 开关。
 *
 * 防「happy-path 偏差」：统一抛出 ApiError，调用方必须处理
 * NETWORK / TIMEOUT / UNAUTHORIZED / FORBIDDEN / NOT_FOUND / VALIDATION / SERVER 分支。
 */

import Constants from 'expo-constants';
import { tokenStore } from './token';
import { routeMock } from './mocks';

export const API_BASE_URL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  'https://your-cloudbase-domain.example.com/api/v1';

/** 开发期默认走本地 mock，与真实端点对齐；联调时置 false */
export const USE_MOCK: boolean =
  (Constants.expoConfig?.extra?.useMock as boolean | undefined) ?? true;

export const REQUEST_TIMEOUT_MS = 12_000;

export type ApiErrorCode =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'SERVER'
  | 'UNKNOWN';

export class ApiError extends Error {
  code: ApiErrorCode;
  status?: number;
  constructor(code: ApiErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

function classify(status: number, message: string): ApiError {
  if (status === 401) return new ApiError('UNAUTHORIZED', message, status);
  if (status === 403) return new ApiError('FORBIDDEN', message, status);
  if (status === 404) return new ApiError('NOT_FOUND', message, status);
  if (status >= 400 && status < 500)
    return new ApiError('VALIDATION', message, status);
  return new ApiError('SERVER', message, status);
}

async function realRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(API_BASE_URL + path);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(tokenStore.get()
          ? { Authorization: `Bearer ${tokenStore.get()}` }
          : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    const json = text ? (JSON.parse(text) as unknown) : null;

    if (!res.ok) {
      const msg =
        (json && typeof json === 'object' && 'message' in json
          ? String((json as { message: unknown }).message)
          : res.statusText) || '请求失败';
      throw classify(res.status, msg);
    }

    // 兼容 { code, message, data } 外壳与裸数据
    if (json && typeof json === 'object' && 'data' in json) {
      return (json as { data: T }).data;
    }
    return json as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (
      typeof err === 'object' &&
      err !== null &&
      'name' in err &&
      (err as { name?: string }).name === 'AbortError'
    ) {
      throw new ApiError('TIMEOUT', '请求超时，请检查网络');
    }
    throw new ApiError('NETWORK', '网络连接失败，请稍后重试');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 统一请求入口：USE_MOCK 时走与真实端点对齐的本地 mock，
 * 否则走真实后端。返回解包后的 data 负载。
 */
export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  if (USE_MOCK) {
    return (await routeMock(method, path, body, params)) as T;
  }
  return realRequest<T>(method, path, body, params);
}
