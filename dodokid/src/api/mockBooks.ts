/**
 * 本地 Mock 的绘本种子数据。
 *
 * 与 mocks.ts 拆开的原因：mocks.ts 原有 283 行，逼近 300 行上限。
 *
 * 关键设计——**只存相对 key，不存绝对地址**：
 * 若在这里用 `mediaUrl(key)` 直接拼成绝对地址，拼接就发生在**模块加载时**，
 * 之后 `initMediaBase()` 拉到的新基址永远不会反映到界面上。
 * 因此本文件只持有 `coverKey` / `imageKey` / `audioKey`，
 * 由 `resolveBook()` 在**每次请求时**（routeMock 内）拼接。
 */

import { colors } from '../design/tokens';
import { mediaUrl } from '../shared/lib/mediaBase';
import type { AgeGroup, BookPage, ContentItem, QuizQuestion } from './types';

/** 未拼接的绘本种子：媒体字段一律是相对 key */
interface BookSeed {
  id: string;
  title: string;
  module: ContentItem['module'];
  ageGroups: AgeGroup[];
  sample: boolean;
  coverKey: string;
  summary: string;
  pages: {
    index: number;
    imageKey: string;
    audioKey: string;
    text: string;
    questions: QuizQuestion[];
  }[];
}

function makeSeed(
  id: string,
  title: string,
  module: ContentItem['module'],
  ageGroups: AgeGroup[],
  sample: boolean,
): BookSeed {
  const pages = Array.from({ length: 4 }, (_, i) => ({
    index: i,
    imageKey: `book/${id}/p${i}.webp`,
    audioKey: `book/${id}/p${i}.mp3`,
    text: `${title}·第 ${i + 1} 页：多多和伙伴们一起探索奇妙世界。`,
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
    ageGroups,
    sample,
    coverKey: `book/${id}/cover.webp`,
    summary: `${title}：适合亲子共读的温暖小故事。`,
    pages,
  };
}

export const BOOK_SEEDS: BookSeed[] = [
  makeSeed('b-sleep', '多多睡觉啦', 'book', ['3-4', '4-6'], true),
  makeSeed('b-share', '多多的分享日', 'book', ['3-4'], false),
  makeSeed('b-sea', '海底小探险', 'book', ['4-6'], false),
  makeSeed('s-twinkle', '小星星', 'song', ['3-4', '4-6'], true),
  makeSeed('l-cat', '小猫识字', 'literacy', ['4-6'], false),
];

/**
 * 种子 → ContentItem，在**请求时**用当前生效的基址拼接媒体地址。
 * 每次调用都重新读`getMediaBase()`，因此运行时基址更新后，
 * 后续请求拿到的就是新地址，不会被模块加载时的旧值永久锁死。
 */
export function resolveBook(seed: BookSeed): ContentItem {
  const pages: BookPage[] = seed.pages.map((p) => ({
    index: p.index,
    imageUrl: mediaUrl(p.imageKey),
    text: p.text,
    audioUrl: mediaUrl(p.audioKey),
    questions: p.questions,
  }));
  return {
    id: seed.id,
    title: seed.title,
    module: seed.module,
    version: '1.0.0',
    ageGroups: seed.ageGroups,
    coverUrl: mediaUrl(seed.coverKey),
    sample: seed.sample,
    pageCount: pages.length,
    summary: seed.summary,
    pages,
  };
}

/** 全部绘本（已拼接），按需过滤 */
export function resolvedBooks(
  filter?: (b: ContentItem) => boolean,
): ContentItem[] {
  const all = BOOK_SEEDS.map(resolveBook);
  return filter ? all.filter(filter) : all;
}

/** 绘本占位色，供未取到封面的场景兜底 */
export const bookFallbackColor = colors.module.book;