/** Mock handler：内容域（列表 / 详情 / 增删改 / 状态机 / 版本回滚）+ 统计。 */
import { audit, db, err, nextId, ok, paginate, requireRole } from '../store';
import type { MockUser } from '../mockData';

export async function tryContents(req: Request, path: string, method: string, sp: URLSearchParams): Promise<Response | null> {
  // GET /admin/contents
  if (path === '/admin/contents' && method === 'GET') {
    const guard = requireRole(req, 'editor');
    if (guard instanceof Response) return guard;
    let list = [...db.contents];
    const moduleKey = sp.get('moduleKey');
    if (moduleKey) list = list.filter((c) => moduleKey.split(',').includes(c.moduleKey));
    const status = sp.get('status');
    if (status) list = list.filter((c) => c.status === status);
    const ageGroup = sp.get('ageGroup');
    if (ageGroup) list = list.filter((c) => c.ageGroup === ageGroup);
    const q = sp.get('q');
    if (q) list = list.filter((c) => c.title.includes(q));
    const sort = (sp.get('sort') ?? 'updatedAt') as 'updatedAt' | 'createdAt' | 'title' | 'order';
    const dir = sp.get('order') === 'asc' ? 1 : -1;
    list.sort((a, b) => (a[sort] > b[sort] ? dir : a[sort] < b[sort] ? -dir : 0));
    return ok(paginate(list, Number(sp.get('page') ?? 1), Number(sp.get('limit') ?? 20)));
  }
  // POST /admin/contents
  if (path === '/admin/contents' && method === 'POST') {
    const u = requireRole(req, 'editor');
    if (u instanceof Response) return u;
    return req.json().then((raw) => {
      const body = raw as Record<string, unknown>;
      // v1.2.1：isSample admin-only 可写，editor 提交返回 40300（对齐后端 RBAC）
      if ('isSample' in body && u.role !== 'admin') {
        return err(40300, 'Forbidden: isSample is admin-writable', 403);
      }
      const now = new Date().toISOString();
      const item = {
        _id: nextId('ct'),
        moduleKey: String(body.moduleKey ?? 'book'),
        type: (body.type ?? 'book') as 'book' | 'song' | 'habit',
        ageGroup: (body.ageGroup ?? '3-4') as '3-4' | '4-6',
        title: String(body.title ?? '未命名'),
        summary: (body.summary as string) ?? null,
        cover: (body.cover as string) ?? null,
        mediaRef: (body.mediaRef as string) ?? null,
        tags: (body.tags as string[]) ?? [],
        order: Number(body.order ?? 0),
        locale: String(body.locale ?? 'zh-CN'),
        isSample: Boolean(body.isSample),
        status: 'draft' as const,
        version: 1,
        authorId: u.id,
        reviewerId: null,
        publishedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      db.contents.unshift(item);
      audit(u, 'admin.content.create', 'content_item', item._id, null, { title: item.title });
      return ok(item);
    });
  }
  // /admin/contents/{id}(/{action})
  const m = path.match(/^\/admin\/contents\/([^/]+)(?:\/(\w+)(?:\/([\w-]+))?)?$/);
  if (!m) return null;
  const [, id, action] = m;
  const item = db.contents.find((c) => c._id === id);
  if (!item) return err(40400, 'Not Found', 404);

  if (!action && method === 'GET') {
    const guard = requireRole(req, 'editor');
    if (guard instanceof Response) return guard;
    return ok({ item, media: db.media.filter((md) => md.itemId === id) });
  }
  if (!action && method === 'PUT') {
    const guard = requireRole(req, 'editor');
    if (guard instanceof Response) return guard;
    return req.json().then((raw) => {
      const body = raw as { expectedVersion: number } & Record<string, unknown>;
      // v1.2.1：isSample admin-only 可写，editor 提交返回 40300（对齐后端 RBAC）
      if ('isSample' in body && (guard as MockUser).role !== 'admin') {
        return err(40300, 'Forbidden: isSample is admin-writable', 403);
      }
      if (item.status === 'in_review') return err(40900, '待审内容只读，请先撤回或驳回', 409);
      if (body.expectedVersion !== item.version) return err(40900, `版本冲突：当前 v${item.version}，请刷新后重试`, 409);
      for (const k of ['title', 'summary', 'cover', 'mediaRef', 'tags', 'order', 'locale', 'isSample']) {
        if (k in body) (item as unknown as Record<string, unknown>)[k] = body[k];
      }
      item.version += 1;
      // 归档内容再编辑 → 回到草稿（Spec 14.2）
      if (item.status === 'archived') item.status = 'draft';
      item.updatedAt = new Date().toISOString();
      audit(guard, 'admin.content.update', 'content_item', id, null, { title: item.title });
      return ok(item);
    });
  }
  if (!action && method === 'DELETE') {
    const guard = requireRole(req, 'admin');
    if (guard instanceof Response) return guard;
    db.contents = db.contents.filter((c) => c._id !== id);
    audit(guard, 'admin.content.delete', 'content_item', id);
    return ok(null);
  }
  const state = await tryTransition(req, item, id, action, method);
  if (state) return state;
  // v1.2.0 duplicate：复制为新草稿（editor+，源任意态）
  if (action === 'duplicate' && method === 'POST') {
    const guard = requireRole(req, 'editor');
    if (guard instanceof Response) return guard;
    return req.json().then((raw) => {
      const body = (raw ?? {}) as { title?: string };
      const now = new Date().toISOString();
      const dup = {
        ...item,
        _id: nextId('ct'),
        title: body.title ?? `${item.title} (副本)`,
        status: 'draft' as const,
        version: 1,
        authorId: (guard as MockUser).id,
        reviewerId: null,
        publishedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      db.contents.unshift(dup);
      // 审计 targetId = 新条目，after.sourceId = 源 id（openapi v1.2.0）
      audit(guard, 'admin.content.duplicate', 'content_item', dup._id, null, { sourceId: item._id });
      return ok(dup);
    });
  }
  if (action === 'revisions' && method === 'GET') {
    const guard = requireRole(req, 'editor');
    if (guard instanceof Response) return guard;
    const list = db.revisions.filter((r) => r.contentId === id);
    return ok(paginate(list, Number(sp.get('page') ?? 1), Number(sp.get('limit') ?? 20)));
  }
  if (action === 'restore' && method === 'POST') {
    const guard = requireRole(req, 'admin');
    if (guard instanceof Response) return guard;
    const rev = db.revisions.find((r) => r._id === m[3]);
    if (!rev) return err(40400, '版本不存在', 404);
    item.version += 1;
    item.status = 'draft';
    item.updatedAt = new Date().toISOString();
    db.revisions.unshift({
      _id: nextId('rv'),
      contentId: id,
      version: item.version,
      action: 'restore',
      note: `回滚至 v${rev.version}`,
      authorId: (guard as MockUser).id,
      createdAt: new Date().toISOString(),
    });
    audit(guard, 'admin.content.restore', 'content_item', id, { version: item.version - 1 }, { version: item.version });
    return ok(item);
  }
  if (action === 'preview' && method === 'GET') {
    const guard = requireRole(req, 'editor');
    if (guard instanceof Response) return guard;
    return ok({ item, media: db.media.filter((md) => md.itemId === id) });
  }
  return null;
}

/** 状态机动作（Spec §14.2 + v1.2.0）：submit / approve / reject / unpublish / archive / publish / withdraw */
async function tryTransition(req: Request, item: (typeof db.contents)[number], id: string, action: string | undefined, method: string): Promise<Response | null> {
  const transitions: Record<string, { from: string[]; to: 'draft' | 'in_review' | 'published' | 'archived'; min: 'editor' | 'admin'; ev: string; snapshot?: boolean }> = {
    submit: { from: ['draft'], to: 'in_review', min: 'editor', ev: 'admin.content.submit' },
    approve: { from: ['in_review'], to: 'published', min: 'admin', ev: 'admin.content.approve' },
    reject: { from: ['in_review'], to: 'draft', min: 'admin', ev: 'admin.content.reject' },
    unpublish: { from: ['published'], to: 'archived', min: 'admin', ev: 'admin.content.unpublish' },
    archive: { from: ['draft', 'in_review', 'published'], to: 'archived', min: 'admin', ev: 'admin.content.archive' },
    // v1.2.0：publish（draft→published，admin-only，可选乐观锁）；withdraw（in_review→draft，editor+，无快照）
    publish: { from: ['draft'], to: 'published', min: 'admin', ev: 'admin.content.publish' },
    withdraw: { from: ['in_review'], to: 'draft', min: 'editor', ev: 'admin.content.withdraw', snapshot: false },
  };
  if (!action || !transitions[action] || method !== 'POST') return null;
  const t = transitions[action];
  const guard = requireRole(req, t.min);
  if (guard instanceof Response) return guard;
  // publish 的可选乐观锁：expectedVersion 不匹配 → 409
  if (action === 'publish') {
    const text = await req.text();
    if (text) {
      const body = JSON.parse(text) as { expectedVersion?: number };
      if (body.expectedVersion !== undefined && body.expectedVersion !== item.version) {
        return err(40900, `版本冲突：当前 v${item.version}，请刷新后重试`, 409);
      }
    }
  }
  if (!t.from.includes(item.status)) return err(40900, `当前状态 ${item.status} 不允许执行 ${action}`, 409);
  const before = { status: item.status };
  item.status = t.to;
  item.version += 1;
  if (t.to === 'published') item.publishedAt = new Date().toISOString();
  if (t.to === 'draft') item.publishedAt = null;
  if (t.to === 'in_review') item.reviewerId = null;
  if (action === 'withdraw') item.reviewerId = null;
  item.updatedAt = new Date().toISOString();
  if (t.snapshot !== false) {
    db.revisions.unshift({
      _id: nextId('rv'),
      contentId: id,
      version: item.version,
      action: action === 'unpublish' ? 'submit' : (action as 'submit' | 'approve' | 'publish' | 'reject'),
      note: null,
      authorId: (guard as MockUser).id,
      createdAt: new Date().toISOString(),
    });
  }
  audit(guard, t.ev, 'content_item', id, before, { status: item.status });
  return ok(item);
}

/** GET /admin/stats */
export function tryStats(req: Request, path: string, method: string): Response | null {
  if (path !== '/admin/stats' || method !== 'GET') return null;
  const guard = requireRole(req, 'editor');
  if (guard instanceof Response) return guard;
  const byStatus = { draft: 0, in_review: 0, published: 0, archived: 0 };
  for (const c of db.contents) byStatus[c.status] += 1;
  return ok({
    contentTotal: db.contents.length,
    byStatus,
    pendingReview: byStatus.in_review,
    mediaTotal: db.media.length,
    recentAudit: db.audit.slice(0, 10),
  });
}
