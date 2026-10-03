/** Mock handler：模块与分类（catalog）。 */
import type { AdminModule, ContentCategory } from '../../types/api';
import { audit, db, err, nextId, ok, requireRole } from '../store';

export async function tryCatalog(req: Request, path: string, method: string): Promise<Response | null> {
  // ---- modules ----
  if (path === '/admin/modules' && method === 'GET') {
    const guard = requireRole(req, 'editor');
    if (guard instanceof Response) return guard;
    return ok(db.modules);
  }
  if (path === '/admin/modules' && method === 'POST') {
    const guard = requireRole(req, 'admin');
    if (guard instanceof Response) return guard;
    return req.json().then((raw) => {
      const b = raw as { key: string; name: string };
      if (db.modules.some((x) => x.key === b.key)) return err(40900, '模块 key 已存在', 409);
      const item: AdminModule = {
        _id: nextId('m'), key: b.key, name: b.name, colorToken: 'module.book',
        iconKey: 'SquaresFour', order: db.modules.length + 1, enabled: true,
      };
      db.modules.push(item);
      audit(guard, 'admin.module.create', 'module', item._id);
      return ok(item);
    });
  }
  const mm = path.match(/^\/admin\/modules\/([^/]+)$/);
  if (mm) {
    const guard = requireRole(req, 'admin');
    if (guard instanceof Response) return guard;
    const idx = db.modules.findIndex((x) => x._id === mm[1]);
    if (idx < 0) return err(40400, 'Not Found', 404);
    if (method === 'PUT') {
      return req.json().then((raw) => {
        db.modules[idx] = { ...db.modules[idx], ...(raw as object) };
        return ok(db.modules[idx]);
      });
    }
    if (method === 'DELETE') {
      // 删除保护：模块下有内容时阻断（§3.8）
      const count = db.contents.filter((c) => c.moduleKey === db.modules[idx].key).length;
      if (count > 0) return err(40900, `该模块下有 ${count} 条内容，无法删除`, 409);
      db.modules.splice(idx, 1);
      return ok(null);
    }
  }
  // ---- categories ----
  if (path === '/admin/categories' && method === 'GET') return ok(db.categories);
  if (path === '/admin/categories' && method === 'POST') {
    const guard = requireRole(req, 'admin');
    if (guard instanceof Response) return guard;
    return req.json().then((raw) => {
      const item: ContentCategory = {
        _id: nextId('c'),
        key: (raw as { key: string }).key,
        name: (raw as { name: string }).name,
        order: db.categories.length + 1,
        enabled: true,
      };
      db.categories.push(item);
      return ok(item);
    });
  }
  const cm = path.match(/^\/admin\/categories\/([^/]+)$/);
  if (cm) {
    const guard = requireRole(req, 'admin');
    if (guard instanceof Response) return guard;
    const idx = db.categories.findIndex((x) => x._id === cm[1]);
    if (idx < 0) return err(40400, 'Not Found', 404);
    if (method === 'PUT') {
      return req.json().then((raw) => {
        db.categories[idx] = { ...db.categories[idx], ...(raw as object) };
        return ok(db.categories[idx]);
      });
    }
    if (method === 'DELETE') {
      db.categories.splice(idx, 1);
      return ok(null);
    }
  }
  return null;
}
