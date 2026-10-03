/**
 * 益智游戏 — 记忆翻牌纯逻辑（无 React 依赖，便于单测）。
 *
 * 状态机：
 *   翻第 1 张 → flipped=[i]
 *   翻第 2 张 → 同面：两张标记 matched、flipped 清空、matchedPairs+1
 *               异面：flipped=[a,b] 且 locked=true（禁止继续翻，等 UI 延时翻回）
 *   翻回       → resolveMismatch 清空 flipped 并解锁
 *
 * 翻牌次数 flips 按「每一次翻牌」计（AC-20「按翻牌次数结算」）；
 * 因此理论最少次数 = pairs × 2。
 */
import { shuffle } from '../../shared/lib/quizCore';
import { FACE_KEYS, perfectFlips, type FaceKey, type PuzzleLevel } from './memoryData';

export interface Card {
  id: string;
  face: FaceKey;
  matched: boolean;
}

export interface BoardState {
  cards: Card[];
  /** 已翻开、尚未判定完成的卡位（0/1/2 张） */
  flipped: number[];
  matchedPairs: number;
  /** 累计翻牌次数 */
  flips: number;
  /** 两张异面已翻开、等待翻回；此期间禁止再翻 */
  locked: boolean;
}

/** 洗牌建局：从候选面中取 pairs 个，每个面两张，整体再洗一次 */
export function createBoard(
  level: PuzzleLevel,
  rng: () => number = Math.random,
): BoardState {
  const faces = shuffle(FACE_KEYS, rng).slice(0, level.pairs);
  const cards: Card[] = faces.flatMap((face) => [
    { id: `${face}-a`, face, matched: false },
    { id: `${face}-b`, face, matched: false },
  ]);
  return {
    cards: shuffle(cards, rng),
    flipped: [],
    matchedPairs: 0,
    flips: 0,
    locked: false,
  };
}

export function flipCard(state: BoardState, index: number): BoardState {
  const card = state.cards[index];
  // 锁定中 / 越界 / 已配对 / 已翻开 → 原状态返回（幂等）
  if (state.locked || !card || card.matched || state.flipped.includes(index)) {
    return state;
  }

  const flipped = [...state.flipped, index];
  const flips = state.flips + 1;

  if (flipped.length < 2) {
    return { ...state, flipped, flips };
  }

  const [a, b] = flipped as [number, number];
  if (state.cards[a]!.face === state.cards[b]!.face) {
    return {
      cards: state.cards.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c)),
      flipped: [],
      matchedPairs: state.matchedPairs + 1,
      flips,
      locked: false,
    };
  }
  return { ...state, flipped, flips, locked: true };
}

/** 翻回两张异面卡（由 UI 在短暂展示后调用）；未锁定时为空操作 */
export function resolveMismatch(state: BoardState): BoardState {
  if (!state.locked) return state;
  return { ...state, flipped: [], locked: false };
}

export function isCleared(state: BoardState): boolean {
  return state.cards.length > 0 && state.cards.every((c) => c.matched);
}

/** 某卡位当前是否应显示正面（已配对 或 正被翻开） */
export function isFaceUp(state: BoardState, index: number): boolean {
  const card = state.cards[index];
  if (!card) return false;
  return card.matched || state.flipped.includes(index);
}

/** 星级：越接近理论最少翻牌次数越高（3/2/1） */
export function starFor(flips: number, level: PuzzleLevel): number {
  const perfect = perfectFlips(level);
  if (flips <= perfect + Math.ceil(level.pairs / 2)) return 3;
  if (flips <= perfect + level.pairs) return 2;
  return 1;
}

/** 百分制得分：理论最少翻牌次数为满分，每多翻一次扣 5 分，下限 40 */
export function scoreFor(flips: number, level: PuzzleLevel): number {
  const extra = Math.max(0, flips - perfectFlips(level));
  return Math.max(40, 100 - extra * 5);
}
