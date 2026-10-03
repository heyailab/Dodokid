/** Mock 内存数据库与共享工具 — 信封响应 / 会话 / RBAC / 审计 / 分页。 */
import type { ApiEnvelope } from '../types/api';
import {
  seedAudit,
  seedCategories,
  seedContents,
  seedMedia,
  seedModules,
  seedRevisions,
  seedSettings,
  seedUsers,
  type MockUser,
} from './mockData';

export const db = {
  users: [...seedUsers],
  modules: [...seedModules],
  categories: [...seedCategories],
  contents: [...seedContents],
  revisions: [...seedRevisions],
  media: [...seedMedia],
  audit: [...seedAudit],
  settings: { ...seedSettings },
};

let sessionToken: string | null = null;

export function setSessionToken(id: string | null): void {
  sessionToken = id;
}

export function ok<T>(data: T): Response {
  return Response.json({ success: true, code: 0, message: 'ok', data } satisfies ApiEnvelope<T>);
}

export function err(code: number, message: string, status: number): Response {
  return Response.json({ success: false, code, message, data: null } satisfies ApiEnvelope<null>, { status });
}

export function auth(_req: Request): MockUser | null {
  if (!sessionToken) return null;
  return db.users.find((u) => u.id === sessionToken) ?? null;
}

/** RBAC 守卫：返回 Response = 拒绝（401/403）；返回 MockUser = 通过 */
export function requireRole(req: Request, min: 'editor' | 'admin'): MockUser | Response {
  const u = auth(req);
  if (!u) return err(40100, 'Unauthorized', 401);
  if (min === 'admin' && u.role !== 'admin') return err(40300, 'Forbidden: admin only', 403);
  return u;
}

export function audit(
  u: MockUser, action: string, targetType: string, targetId: string,
  before: unknown = null, after: unknown = null,
): void {
  db.audit.unshift({
    _id: `au_${Date.now()}`,
    actor: u.id,
    actorRole: u.role as 'editor' | 'admin',
    action,
    targetType,
    targetId,
    before: before as Record<string, unknown> | null,
    after: after as Record<string, unknown> | null,
    ip: '10.8.24.42',
    ts: new Date().toISOString(),
  });
}

export function nextId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export function paginate<T>(
  items: T[], page = 1, limit = 20,
): { items: T[]; meta: { total: number; page: number; limit: number; hasMore: boolean } } {
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    meta: { total: items.length, page, limit, hasMore: start + limit < items.length },
  };
}
