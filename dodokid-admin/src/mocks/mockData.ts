/** Mock 数据种子 — 仅开发/演示使用（VITE_API_BASE 未配置时启用）。 */
import type {
  AdminContent,
  AdminMediaAsset,
  AdminModule,
  AdminUser,
  AuditEntry,
  ContentCategory,
  ContentRevision,
} from '../types/api';

export interface MockUser extends AdminUser {
  password: string;
}

export const seedUsers: MockUser[] = [
  { id: 'u_admin', phone: '138****0001', role: 'admin', status: 'active', createdAt: '2025-11-02T09:00:00+08:00', password: 'dodokid2026' },
  { id: 'u_editor', phone: '139****0002', role: 'editor', status: 'active', createdAt: '2025-11-10T14:30:00+08:00', password: 'editor2026' },
  { id: 'u_editor2', phone: '137****0003', role: 'editor', status: 'active', createdAt: '2025-12-01T10:00:00+08:00', password: 'editor2026' },
  { id: 'u_admin2', phone: '136****0004', role: 'admin', status: 'disabled', createdAt: '2025-11-15T16:20:00+08:00', password: 'dodokid2026' },
];

export const seedModules: AdminModule[] = [
  { _id: 'm1', key: 'book', name: '绘本共读', colorToken: 'module.book', iconKey: 'BookOpen', order: 1, enabled: true },
  { _id: 'm2', key: 'habit', name: '习惯养成', colorToken: 'module.habit', iconKey: 'CalendarCheck', order: 2, enabled: true },
  { _id: 'm3', key: 'song', name: '儿歌音频', colorToken: 'module.song', iconKey: 'MusicNotes', order: 3, enabled: true },
  { _id: 'm4', key: 'literacy', name: '识字认知', colorToken: 'module.literacy', iconKey: 'PuzzlePiece', order: 4, enabled: true },
  { _id: 'm5', key: 'math', name: '数学启蒙', colorToken: 'module.math', iconKey: 'Calculator', order: 5, enabled: false },
];

export const seedCategories: ContentCategory[] = [
  { _id: 'c1', key: 'daily_routine', name: '日常作息', order: 1, enabled: true },
  { _id: 'c2', key: 'emotion', name: '情绪认知', order: 2, enabled: true },
  { _id: 'c3', key: 'nature', name: '自然探索', order: 3, enabled: true },
];

const TITLES: Array<[string, AdminContent['type'], AdminContent['status'], string, AdminContent['ageGroup']]> = [
  ['小熊刷牙记', 'book', 'published', 'book', '3-4'],
  ['小恐龙说早安', 'book', 'published', 'book', '3-4'],
  ['月亮晚安谣', 'song', 'published', 'song', '3-4'],
  ['饭前洗小手', 'habit', 'published', 'habit', '3-4'],
  ['数字小火车', 'book', 'published', 'math', '4-6'],
  ['第一次自己穿衣服', 'book', 'in_review', 'habit', '4-6'],
  ['四季的颜色', 'book', 'in_review', 'literacy', '4-6'],
  ['刷牙歌 · 30 秒版', 'song', 'draft', 'habit', '3-4'],
  ['动物园一日游', 'book', 'draft', 'literacy', '4-6'],
  ['收玩具大作战', 'habit', 'draft', 'habit', '3-4'],
  ['彩虹在哪里', 'book', 'archived', 'literacy', '3-4'],
  ['英文儿歌 · ABC Bath', 'song', 'published', 'song', '4-6'],
  ['不挑食的小兔子', 'book', 'published', 'habit', '3-4'],
  ['加法小超市', 'book', 'draft', 'math', '4-6'],
  ['小雨点旅行记', 'book', 'published', 'literacy', '4-6'],
  ['午睡前的摇篮曲', 'song', 'archived', 'song', '3-4'],
  ['认识星期几', 'book', 'in_review', 'math', '4-6'],
  ['自己吃饭真棒', 'habit', 'published', 'habit', '3-4'],
  ['形状捉迷藏', 'book', 'draft', 'math', '3-4'],
  ['晚安，小星星', 'song', 'published', 'song', '3-4'],
  ['逛菜市场', 'book', 'published', 'literacy', '4-6'],
  ['排队轮流真好玩', 'habit', 'published', 'habit', '4-6'],
  ['袜子去哪儿了', 'book', 'draft', 'book', '3-4'],
  ['数一数，有几只', 'book', 'published', 'math', '3-4'],
];

function iso(daysAgo: number, hour = 10): string {
  const d = new Date('2026-02-01T00:00:00+08:00');
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour);
  return d.toISOString();
}

export const seedContents: AdminContent[] = TITLES.map(([title, type, status, moduleKey, ageGroup], i) => {
  const d = 30 - i;
  return {
    _id: `ct_${String(i + 1).padStart(3, '0')}`,
    moduleKey,
    type,
    ageGroup,
    title,
    summary: `${title}——适合 ${ageGroup} 岁段，共读与跟读结合。`,
    cover: `admin-media/covers/2026${(i % 12) + 1}/cover-${i + 1}.webp`,
    mediaRef: type === 'book' ? `admin-media/books/2026${(i % 12) + 1}/pages-${i + 1}/` : `admin-media/songs/2026${(i % 12) + 1}/audio-${i + 1}.mp4`,
    tags: [moduleKey === 'habit' ? '生活习惯' : '启蒙'],
    order: i + 1,
    // v1.2.1 isSample：试读样章（App 首页试读入口），种子数据标记 3 条
    isSample: i === 0 || i === 2 || i === 19,
    locale: 'zh-CN',
    status,
    version: 1 + (i % 5),
    authorId: i % 2 === 0 ? 'u_editor' : 'u_editor2',
    reviewerId: status === 'published' ? 'u_admin' : null,
    publishedAt: status === 'published' ? iso(d - 1, 15) : null,
    createdAt: iso(d, 9),
    updatedAt: iso(d, 14),
  };
});

export const seedRevisions: ContentRevision[] = seedContents
  .filter((c) => c.status !== 'draft')
  .flatMap((c, i) => {
    const list: ContentRevision[] = [
      { _id: `rv_${c._id}_1`, contentId: c._id, version: c.version, action: 'submit', note: '完成初稿并提交审核', authorId: c.authorId, createdAt: iso(20 - i, 11) },
    ];
    if (c.status === 'published') {
      list.push({ _id: `rv_${c._id}_2`, contentId: c._id, version: c.version + 1, action: 'approve', note: null, authorId: 'u_admin', createdAt: iso(18 - i, 16) });
    }
    return list;
  });

export const seedMedia: AdminMediaAsset[] = Array.from({ length: 14 }, (_, i) => {
  const isAudio = i % 5 === 4;
  return {
    _id: `md_${String(i + 1).padStart(3, '0')}`,
    itemId: i < 8 ? seedContents[i]._id : null,
    folder: isAudio ? 'songs' : 'covers',
    fileName: isAudio ? `narration-${i + 1}.mp4` : `cover-${i + 1}.webp`,
    mime: isAudio ? 'audio/mp4' : 'image/webp',
    size: isAudio ? 2_400_000 + i * 31_000 : 180_000 + i * 12_000,
    width: isAudio ? null : 1080,
    height: isAudio ? null : 720,
    durationMs: isAudio ? 42_000 + i * 1_500 : null,
    cdnKey: `admin-media/${isAudio ? 'songs' : 'covers'}/2026${(i % 12) + 1}/asset-${i + 1}`,
    url: `https://cdn.dodokid.example/admin-media/${isAudio ? 'songs' : 'covers'}/2026${(i % 12) + 1}/asset-${i + 1}`,
    uploadedBy: i % 2 === 0 ? 'u_editor' : 'u_admin',
    createdAt: iso(28 - i * 2, 13),
  };
});

const AUDIT_ACTIONS: Array<[string, string, string]> = [
  ['admin.content.approve', 'content_item', 'ct_001'],
  ['admin.content.submit', 'content_item', 'ct_006'],
  ['admin.content.unpublish', 'content_item', 'ct_011'],
  ['admin.media.upload', 'media_asset', 'md_003'],
  ['admin.user.role_change', 'user', 'u_editor2'],
  ['admin.content.reject', 'content_item', 'ct_007'],
  ['admin.settings.update', 'settings', 'global'],
  ['admin.content.update', 'content_item', 'ct_002'],
  ['admin.auth.login', 'session', 'u_admin'],
  ['admin.content.create', 'content_item', 'ct_009'],
];

export const seedAudit: AuditEntry[] = AUDIT_ACTIONS.map(([action, targetType, targetId], i) => ({
  _id: `au_${String(i + 1).padStart(3, '0')}`,
  actor: i % 2 === 0 ? 'u_admin' : 'u_editor',
  actorRole: i % 2 === 0 ? 'admin' : 'editor',
  action,
  targetType,
  targetId,
  before: action.includes('update') ? { title: '旧标题' } : null,
  after: action.includes('update') ? { title: '新标题' } : null,
  ip: i % 2 === 0 ? '10.8.24.131' : '10.8.24.87',
  ts: iso(i, 9 + (i % 8)),
}));

export const seedSettings = {
  mediaMaxSizeMB: 50,
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'audio/mpeg', 'audio/mp4'],
  defaultLocale: 'zh-CN',
  paginationLimit: 20,
};
