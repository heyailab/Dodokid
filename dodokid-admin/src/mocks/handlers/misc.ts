/** Mock handler：认证（登录 / 登出 / me）+ 审计日志 + 后台设置。 */
import { audit, auth, db, err, ok, paginate, requireRole, setSessionToken } from '../store';

export async function tryAuth(req: Request, path: string, method: string): Promise<Response | null> {
  if (path === '/admin/auth/login' && method === 'POST') {
    return req.json().then((raw) => {
      const { account, password } = raw as { account: string; password: string };
      // 防枚举：不区分账号不存在 / 密码错误
      const u = db.users.find((x) => x.phone.endsWith(account.slice(-4)));
      if (!u || u.password !== password) return err(40100, '账号或密码不正确，请重试', 401);
      if (u.status === 'disabled') return err(40300, '账号已停用，请联系管理员', 403);
      setSessionToken(u.id);
      const { password: _pw, ...pub } = u;
      return ok({ user: pub, tokens: { accessToken: u.id, refreshToken: 'mock-refresh' } });
    });
  }
  if (path === '/admin/auth/logout' && method === 'POST') {
    setSessionToken(null);
    return ok(null);
  }
  if (path === '/admin/auth/me' && method === 'GET') {
    const u = auth(req);
    if (!u) return err(40100, 'Unauthorized', 401);
    const { password: _pw, ...pub } = u;
    return ok(pub);
  }
  return null;
}

export function tryAudit(req: Request, path: string, method: string, sp: URLSearchParams): Response | null {
  if (path !== '/admin/audit' || method !== 'GET') return null;
  const guard = requireRole(req, 'admin');
  if (guard instanceof Response) return guard;
  let list = [...db.audit];
  const action = sp.get('action');
  if (action) list = list.filter((a) => a.action.includes(action));
  const actor = sp.get('actor');
  if (actor) list = list.filter((a) => a.actor === actor);
  const targetId = sp.get('targetId');
  if (targetId) list = list.filter((a) => a.targetId === targetId);
  return ok(paginate(list, Number(sp.get('page') ?? 1), Number(sp.get('limit') ?? 20)));
}

export async function trySettings(req: Request, path: string, method: string): Promise<Response | null> {
  if (path === '/admin/settings' && method === 'GET') {
    const guard = requireRole(req, 'admin');
    if (guard instanceof Response) return guard;
    return ok(db.settings);
  }
  if (path === '/admin/settings' && method === 'PUT') {
    const guard = requireRole(req, 'admin');
    if (guard instanceof Response) return guard;
    return req.json().then((raw) => {
      db.settings = { ...db.settings, ...(raw as object) };
      audit(guard, 'admin.settings.update', 'settings', 'global');
      return ok(db.settings);
    });
  }
  return null;
}
