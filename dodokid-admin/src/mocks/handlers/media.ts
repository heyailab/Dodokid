/** Mock handler：媒体库（列表 / 直传凭证 / 删除）。 */
import { audit, db, err, nextId, ok, paginate, requireRole } from '../store';
import type { MockUser } from '../mockData';

export async function tryMedia(req: Request, path: string, method: string, sp: URLSearchParams): Promise<Response | null> {
  if (path === '/admin/media' && method === 'GET') {
    const guard = requireRole(req, 'editor');
    if (guard instanceof Response) return guard;
    return ok(paginate(db.media, Number(sp.get('page') ?? 1), Number(sp.get('limit') ?? 20)));
  }
  if (path === '/admin/media' && method === 'POST') {
    const guard = requireRole(req, 'editor');
    if (guard instanceof Response) return guard;
    return req.json().then((raw) => {
      const b = raw as { folder: string; fileName: string; mime: string; size: number };
      // 校验口径与 AdminSettings 一致（openapi MediaUploadRequest）
      if (!db.settings.allowedMimeTypes.includes(b.mime)) return err(40000, `不支持的文件类型 ${b.mime}`, 400);
      if (b.size > db.settings.mediaMaxSizeMB * 1024 * 1024) return err(40000, `文件超过 ${db.settings.mediaMaxSizeMB}MB 限制`, 400);
      const cdnKey = `admin-media/${b.folder}/202602/mock-${Date.now()}-${b.fileName}`;
      const asset = {
        _id: nextId('md'),
        itemId: null,
        folder: b.folder,
        fileName: b.fileName,
        mime: b.mime,
        size: b.size,
        width: null,
        height: null,
        durationMs: null,
        cdnKey,
        url: `https://cdn.dodokid.example/${cdnKey}`,
        uploadedBy: (guard as MockUser).id,
        createdAt: new Date().toISOString(),
      };
      db.media.unshift(asset);
      audit(guard, 'admin.media.upload', 'media_asset', asset._id);
      return ok({
        mediaId: asset._id,
        cdnKey,
        cdnUrl: asset.url,
        upload: {
          tmpSecretId: 'mock-ak',
          tmpSecretKey: 'mock-sk',
          sessionToken: 'mock-token',
          storagePath: cdnKey,
          expiresInSec: 1800,
          maxFileSize: db.settings.mediaMaxSizeMB * 1024 * 1024,
        },
      });
    });
  }
  const mdm = path.match(/^\/admin\/media\/([^/]+)$/);
  if (mdm && method === 'DELETE') {
    const guard = requireRole(req, 'admin');
    if (guard instanceof Response) return guard;
    db.media = db.media.filter((x) => x._id !== mdm[1]);
    audit(guard, 'admin.media.delete', 'media_asset', mdm[1]);
    return ok(null);
  }
  return null;
}
