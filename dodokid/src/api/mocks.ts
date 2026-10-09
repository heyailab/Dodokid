/**
 * 本地 Mock 服务：与真实端点对齐的假数据 + 路由。
 * 联调阶段 USE_MOCK=false 后由真实后端接管，接口形状保持一致。
 */

import type {
  AgeGroup,
  ChildCreateReq,
  ChildProfile,
  ConsentRecord,
  ContentCategory,
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
import { BOOK_SEEDS, resolveBook, resolvedBooks } from './mockBooks';
import { getMediaBase } from '../shared/lib/mediaBase';
import { API_BASE_URL } from './config';

/* --------------------------------- 种子数据 --------------------------------- */

const categories: ContentCategory[] = [
  { key: 'book', label: '绘本共读', color: colors.module.book },
  { key: 'habit', label: '习惯养成', color: colors.module.habit },
  { key: 'song', label: '儿歌音频', color: colors.module.song },
  { key: 'literacy', label: '识字认知', color: colors.module.literacy },
  { key: 'math', label: '数学启蒙', color: colors.module.math },
  { key: 'english', label: '英语启蒙', color: colors.module.english },
];

/**
 * 隐私政策页地址。
 *
 * 不用 `process.env.EXPO_PUBLIC_PRIVACY_URL`：隐私政策属于**后端管辖的运营内容**，
 * 已有 `GET /privacyPolicy` 端点由后端下发真实地址，前端不该再持有一份会过期的副本
 * （多一份配置就多一处漂移源，换域名时容易只改一处）。
 * 这里在 mock 模式下按 API 基址的 origin 推导，仅用于让本地联调有可点的链接；
 * 正式环境该字段由后端返回，不经过这段代码。
 */
function privacyPolicyUrl(): string {
  try {
    return `${new URL(API_BASE_URL).origin}/privacy`;
  } catch {
    return '/privacy';
  }
}

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
  // 注意：统一走 resolvedBooks()，它在**每次请求时**用当前基址拼接媒体地址，
  // 因此运行时基址更新后无需重启即可生效。
  if (method === 'GET' && p === '/content/categories') return delay(categories);
  if (method === 'GET' && p === '/content/samples') {
    const age = params?.ageGroup as AgeGroup | undefined;
    return delay(
      resolvedBooks((b) => b.sample && (age ? b.ageGroups.includes(age) : true)),
    );
  }
  if (method === 'GET' && p === '/content/list') {
    const age = params?.ageGroup as AgeGroup | undefined;
    return delay(
      resolvedBooks((b) => (age ? b.ageGroups.includes(age) || b.sample : true)),
    );
  }
  if (method === 'GET' && p === '/content/search') {
    const kw = ((params?.keyword as string) ?? '').toLowerCase();
    return delay(resolvedBooks((b) => b.title.toLowerCase().includes(kw)));
  }
  if (method === 'GET' && p === '/content/mediaUrl') {
    const contentId = (params?.contentId as string) ?? '';
    const page = Number(params?.page ?? 0);
    const seed = BOOK_SEEDS.find((x) => x.id === contentId);
    const key = seed?.pages[page]?.audioKey;
    return delay(key ? resolveBook(seed).pages[page]?.audioUrl ?? '' : '');
  }
  if (method === 'GET' && p.startsWith('/content/')) {
    const id = p.split('/')[2] ?? '';
    const seed = BOOK_SEEDS.find((b) => b.id === id);
    return delay(seed ? resolveBook(seed) : null);
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
  // /version 带上 mediaBaseUrl，与真实后端契约一致：
  // 前端 initMediaBase() 启动时读它，从而在不改包的前提下切换媒体域名。
  if (method === 'GET' && p === '/version')
    return delay({
      latest: '1.0.0',
      current: '1.0.0',
      forceUpdate: false,
      mediaBaseUrl: getMediaBase(),
    });
  if (method === 'GET' && p === '/privacyPolicy')
    return delay({
      version: '2026-01',
      url: privacyPolicyUrl(),
      updatedAt: '2026-01-01',
    });

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
