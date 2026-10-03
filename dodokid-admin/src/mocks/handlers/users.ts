/** Mock handler：运营用户（列表 / 角色变更 / 启停）。 */
import { audit, db, err, ok, paginate, requireRole } from '../store';

export async function tryUsers(req: Request, path: string, method: string, sp: URLSearchParams): Promise<Response | null> {
  if (path === '/admin/users' && method === 'GET') {
    const guard = requireRole(req, 'admin');
    if (guard instanceof Response) return guard;
    let list = db.users.map(({ password: _pw, ...u }) => u);
    const role = sp.get('role');
    if (role) list = list.filter((u) => u.role === role);
    const status = sp.get('status');
    if (status) list = list.filter((u) => u.status === status);
    return ok(paginate(list, Number(sp.get('page') ?? 1), Number(sp.get('limit') ?? 20)));
  }
  const um = path.match(/^\/admin\/users\/([^/]+)\/(role|status)$/);
  if (um && method === 'PUT') {
    const guard = requireRole(req, 'admin');
    if (guard instanceof Response) return guard;
    const u = db.users.find((x) => x.id === um[1]);
    if (!u) return err(40400, 'Not Found', 404);
    return req.json().then((raw) => {
      const b = raw as { role?: string; status?: string };
      const before = { role: u.role, status: u.status };
      if (um[2] === 'role') u.role = b.role as 'editor' | 'admin';
      else u.status = b.status as 'active' | 'disabled';
      audit(
        guard,
        um[2] === 'role' ? 'admin.user.role_change' : 'admin.user.status_change',
        'user', u.id, before, { role: u.role, status: u.status },
      );
      const { password: _pw, ...pub } = u;
      return ok(pub);
    });
  }
  return null;
}
