/**
 * Mock 后端 — 拦截 window.fetch，按 openapi.yaml admin 端点契约模拟。
 * 路由分发装配层：具体域逻辑在 ./handlers/*（contents / catalog / media / users / misc），
 * 共享内存库与工具在 ./store.ts。仅当 VITE_API_BASE 未配置时启用。
 */
import { tryContents, tryStats } from './handlers/contents';
import { tryCatalog } from './handlers/catalog';
import { tryMedia } from './handlers/media';
import { tryUsers } from './handlers/users';
import { tryAudit, tryAuth, trySettings } from './handlers/misc';

type Handler = (req: Request, path: string, method: string, sp: URLSearchParams) => Promise<Response | null> | Response | null;

const HANDLERS: Handler[] = [
  tryAuth,
  tryStats,
  tryContents,
  tryCatalog,
  tryMedia,
  tryUsers,
  tryAudit,
  trySettings,
];

export function installMockFetch(): void {
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = req.method.toUpperCase();
    const sp = url.searchParams;

    for (const handler of HANDLERS) {
      const res = await handler(req, path, method, sp);
      if (res) return res;
    }
    return original(input, init);
  };
}
