/**
 * 本地 Mock 服务：与真实端点对齐的假数据 + 路由。
 * 联调阶段 USE_MOCK=false 后由真实后端接管，接口形状保持一致。
 */

import type {
  ChildCreateReq,
  ChildProfile,
  ConsentRecord,
  ContentCategory,
  ContentItem,
  GateVerifyReq,
  GateVerifyResult,
  Milestone,
  ParentSettings,
  ProgressSnapshot,
  ProgressUpsertReq,
  ReadProgress,
  TimeLimitUpdateReq,
  WeekReport,
} from './types';
import { colors } from '../design/tokens';

/* --------------------------------- 种子数据 --------------------------------- */

const categories: ContentCategory[] = [
  { key: 'book', label: '绘本共读', color: colors.module.book },
  { key: 'habit', label: '习惯养成', color: colors.module.habit },
  { key: 'song', label: '儿歌音频', color: colors.module.song },
  { key: 'literacy', label: '识字认知', color: colors.module.literacy },
  { key: 'math', label: '数学启蒙', color: colors.module.math },
  { key: 'english', label: '英语启蒙', color: colors.module.english },
];

function makeBook(
  id: string,
  title: string,
  module: ContentItem['module'],
  ageGroups: ContentItem['ageGroups'],
  sample: boolean,
): ContentItem {
  const pages = Array.from({ length: 4 }, (_, i) => ({
    index: i,
    imageUrl: `https://cdn.dodokid.example.com/book/${id}/p${i}.webp`,
    text: `${title}·第 ${i + 1} 页：多多和伙伴们一起探索奇妙世界。`,
    audioUrl: `https://cdn.dodokid.example.com/book/${id}/p${i}.mp3`,
    questions:
      i === 3
        ? [
            {
              id: `${id}-q1`,
              prompt: '多多在故事里学会了什么？',
              options: [{ label: '分享' }, { label: '独占' }, { label: '逃避' }],
              answerIndex: 0,
            },
          ]
        : [],
  }));
  return {
    id,
    title,
    module,
    version: '1.0.0',
    ageGroups,
    coverUrl: `https://cdn.dodokid.example.com/book/${id}/cover.webp`,
    sample,
    pageCount: pages.length,
    summary: `${title}：适合亲子共读的温暖小故事。`,
    pages,
  };
}

const books: ContentItem[] = [
  makeBook('b-sleep', '多多睡觉啦', 'book', ['3-4', '4-6'], true),
  makeBook('b-share', '多多的分享日', 'book', ['3-4'], false),
  makeBook('b-sea', '海底小探险', 'book', ['4-6'], false),
  makeBook('s-twinkle', '小星星', 'song', ['3-4', '4-6'], true),
  makeBook('l-cat', '小猫识字', 'literacy', ['4-6'], false),
];

/* --------------------------------- 内存态 --------------------------------- */

let children: ChildProfile[] = [];
let progress: Record<string, ProgressSnapshot> = {};
let milestones: Milestone[] = [];
let settings: ParentSettings = { timeLimitSec: 40 * 60, weekReportEnabled: true };
let gatePassed = false;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 120));
}

function snapshot(childId: string): ProgressSnapshot {
  if (!progress[childId]) {
    progress[childId] = { childId, items: {}, totalReadSec: 0 };
  }
  return progress[childId];
}

/* --------------------------------- 路由 --------------------------------- */

export async function routeMock(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | undefined>,
): Promise<unknown> {
  const p = path.replace(/^\/api\/v1/, '');

  // 家长 / 鉴权
  if (method === 'POST' && p === '/parent/register') {
    return delay({ token: 'mock-token', parentId: 'p1' });
  }
  if (method === 'POST' && p === '/parent/login') {
    return delay({ token: 'mock-token', parentId: 'p1' });
  }
  if (method === 'POST' && p === '/parent/logout') return delay(null);
  if (method === 'POST' && p === '/parent/sendSmsCode') return delay({ sent: true });
  if (method === 'POST' && p === '/parent/verifyCode') return delay({ ok: true });

  // 儿童档案
  if (method === 'POST' && p === '/child/create') {
    const req = body as ChildCreateReq;
    const child: ChildProfile = {
      id: `c-${children.length + 1}`,
      name: req.name,
      ageGroup: req.ageGroup,
      avatarColor: colors.module[req.ageGroup === '3-4' ? 'book' : 'math'],
      createdAt: new Date().toISOString(),
      consentRecorded: true,
    };
    children = [...children, child];
    snapshot(child.id);
    return delay(child);
  }
  if (method === 'POST' && p === '/child/switch') {
    const req = body as { childId: string };
    return delay(children.find((c) => c.id === req.childId) ?? children[0]!);
  }
  if (method === 'GET' && p === '/child/list') return delay(children);
  if (method === 'GET' && p.startsWith('/child/')) {
    const id = p.split('/')[2] ?? '';
    return delay(children.find((c) => c.id === id) ?? null);
  }
  if (method === 'PUT' && p.startsWith('/child/')) {
    const id = p.split('/')[2] ?? '';
    const idx = children.findIndex((c) => c.id === id);
    if (idx >= 0 && children[idx]) {
      const cur = children[idx]!;
      children[idx] = { ...cur, ...(body as Partial<ChildProfile>) };
    }
    return delay(children[idx] ?? null);
  }
  if (method === 'DELETE' && p.startsWith('/child/')) {
    const id = p.split('/')[2] ?? '';
    children = children.filter((c) => c.id !== id);
    return delay(null);
  }

  // 内容
  if (method === 'GET' && p === '/content/categories') return delay(categories);
  if (method === 'GET' && p === '/content/samples') {
    const age = params?.ageGroup as string | undefined;
    const list = age ? books.filter((b) => b.sample && b.ageGroups.includes(age as ContentItem['ageGroups'][number])) : books.filter((b) => b.sample);
    return delay(list);
  }
  if (method === 'GET' && p === '/content/list') {
    const age = params?.ageGroup as ContentItem['ageGroups'][number] | undefined;
    const list = age ? books.filter((b) => b.ageGroups.includes(age) || b.sample) : books;
    return delay(list);
  }
  if (method === 'GET' && p === '/content/search') {
    const kw = ((params?.keyword as string) ?? '').toLowerCase();
    return delay(books.filter((b) => b.title.toLowerCase().includes(kw)));
  }
  if (method === 'GET' && p === '/content/mediaUrl') {
    const contentId = (params?.contentId as string) ?? '';
    const page = Number(params?.page ?? 0);
    const b = books.find((x) => x.id === contentId);
    return delay(b?.pages[page]?.audioUrl ?? '');
  }
  if (method === 'GET' && p.startsWith('/content/')) {
    const id = p.split('/')[2] ?? '';
    return delay(books.find((b) => b.id === id) ?? null);
  }

  // 进度
  if (method === 'GET' && p.startsWith('/progress/') && p.endsWith('/list')) {
    const id = p.split('/')[2] ?? '';
    return delay(Object.values(snapshot(id).items));
  }
  if (method === 'GET' && p.startsWith('/progress/')) {
    const id = p.split('/')[2] ?? '';
    return delay(snapshot(id));
  }
  if (method === 'PUT' && p.startsWith('/progress/')) {
    const id = p.split('/')[2] ?? '';
    const req = body as ProgressUpsertReq;
    const cur = snapshot(id);
    const prev = cur.items[req.contentId];
    const next: ReadProgress = {
      childId: id,
      contentId: req.contentId,
      pageIndex: req.pageIndex,
      completed: req.completed ?? prev?.completed ?? false,
      score: req.score ?? prev?.score ?? 0,
      updatedAt: new Date().toISOString(),
    };
    cur.items[req.contentId] = next;
    return delay(next);
  }

  // 里程碑
  if (method === 'GET' && p.startsWith('/milestones/')) {
    const id = p.split('/')[2] ?? '';
    const list: Milestone[] = milestones.filter((m) => m.childId === id);
    if (list.length === 0) {
      list.push(
        {
          id: 'm1',
          childId: id,
          type: 'streak',
          title: '坚持 3 天',
          icon: 'Flame',
          unlockedAt: new Date().toISOString(),
        },
        { id: 'm2', childId: id, type: 'badge', title: '读完第一本', icon: 'Medal', unlockedAt: null },
      );
    }
    return delay(list);
  }

  // 家长设置 / 护眼
  if (method === 'GET' && p === '/parent/settings') return delay(settings);
  if (method === 'PUT' && p === '/parent/settings/timeLimit') {
    const req = body as TimeLimitUpdateReq;
    settings = { ...settings, timeLimitSec: req.timeLimitSec };
    return delay(settings);
  }

  // 家长锁
  if (method === 'POST' && p === '/parent/gate/verify') {
    const req = body as GateVerifyReq;
    const ok = req.method === 'biometric' ? true : (req.payload ?? '') === '123456';
    gatePassed = ok;
    const res: GateVerifyResult = ok ? { ok: true } : { ok: false, hint: '验证未通过，请让家长协助' };
    return delay(res);
  }

  // 同意 / 偏好 / 反馈
  if (method === 'POST' && p === '/consent/record') {
    const req = body as ConsentRecord;
    return delay({ ...req, grantedAt: new Date().toISOString() });
  }
  if (method === 'PUT' && p === '/preferences') return delay(null);
  if (method === 'POST' && p === '/feedback') return delay(null);

  // 系统
  if (method === 'GET' && p === '/version')
    return delay({ latest: '1.0.0', current: '1.0.0', forceUpdate: false });
  if (method === 'GET' && p === '/privacyPolicy')
    return delay({ version: '2026-01', url: 'https://dodokid.example.com/privacy', updatedAt: '2026-01-01' });

  // 周报（家长中心使用）
  if (method === 'GET' && p.startsWith('/report/week/')) {
    const id = p.split('/')[3] ?? '';
    const rep: WeekReport = {
      childId: id,
      weekStart: new Date().toISOString().slice(0, 10),
      readSec: snapshot(id).totalReadSec,
      completedCount: Object.values(snapshot(id).items).filter((i) => i.completed).length,
      streakDays: 3,
      milestones: milestones.filter((m) => m.childId === id),
    };
    return delay(rep);
  }

  throw new Error(`Mock 未覆盖端点: ${method} ${path}`);
}

export function isGatePassed(): boolean {
  return gatePassed;
}
