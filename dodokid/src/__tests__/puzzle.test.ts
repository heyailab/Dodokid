/**
 * 益智游戏（记忆翻牌）单测：难度配置、建局、翻牌状态机、清盘结算与星级/得分。
 * 纯逻辑测试，不依赖 React。
 */
import { FACE_KEYS, levelFor, perfectFlips, type PuzzleLevel } from '../features/puzzle/memoryData';
import {
  createBoard,
  flipCard,
  isCleared,
  isFaceUp,
  resolveMismatch,
  scoreFor,
  starFor,
  type BoardState,
} from '../features/puzzle/memoryLogic';

const rng = () => 0.37;
const seeds = [0.05, 0.2, 0.37, 0.55, 0.77, 0.93];
const rngs = seeds.map((s) => () => s);

/** 取一组同面卡的两个卡位，便于构造确定场景 */
function firstPair(board: BoardState): [number, number] {
  const seen = new Map<string, number>();
  for (let i = 0; i < board.cards.length; i += 1) {
    const face = board.cards[i]!.face;
    const hit = seen.get(face);
    if (hit !== undefined) return [hit, i];
    seen.set(face, i);
  }
  throw new Error('建局异常：未找到同面卡对');
}

/** 取一对异面卡位 */
function firstMismatch(board: BoardState): [number, number] {
  const a = 0;
  const b = board.cards.findIndex((c, i) => i !== a && c.face !== board.cards[a]!.face);
  return [a, b];
}

/** 逐组配对直到清盘（模拟「零失误」的完美一局） */
function playPerfect(level: PuzzleLevel, r: () => number): BoardState {
  let board = createBoard(level, r);
  while (!isCleared(board)) {
    const open = board.cards.map((c, i) => ({ c, i })).filter((x) => !x.c.matched);
    const first = open[0]!;
    const mate = open.find((x) => x.i !== first.i && x.c.face === first.c.face)!;
    board = flipCard(flipCard(board, first.i), mate.i);
  }
  return board;
}

describe('memoryData 难度配置', () => {
  it('分龄难度：4-6 比 3-4 多一组；未指定回落 3-4', () => {
    expect(levelFor('3-4').pairs).toBe(4);
    expect(levelFor('4-6').pairs).toBe(6);
    expect(levelFor(undefined)).toEqual(levelFor('3-4'));
    expect(levelFor('4-6').columns).toBe(4);
    expect(levelFor('3-4').columns).toBe(4);
  });

  it('候选面足够支撑最高难度且互不重复', () => {
    expect(FACE_KEYS.length).toBeGreaterThanOrEqual(levelFor('4-6').pairs);
    expect(new Set(FACE_KEYS).size).toBe(FACE_KEYS.length);
  });

  it('理论最少翻牌次数 = 组数 × 2', () => {
    expect(perfectFlips(levelFor('3-4'))).toBe(8);
    expect(perfectFlips(levelFor('4-6'))).toBe(12);
  });
});

describe('createBoard 建局', () => {
  it('牌数 = 组数 × 2，每个面恰好两张，初始全部未配对且未翻开', () => {
    rngs.forEach((r) => {
      const level = levelFor('4-6');
      const board = createBoard(level, r);
      expect(board.cards).toHaveLength(level.pairs * 2);

      const perFace = new Map<string, number>();
      board.cards.forEach((c) => perFace.set(c.face, (perFace.get(c.face) ?? 0) + 1));
      expect(perFace.size).toBe(level.pairs);
      perFace.forEach((n) => expect(n).toBe(2));

      expect(board.cards.every((c) => !c.matched)).toBe(true);
      expect(new Set(board.cards.map((c) => c.id)).size).toBe(board.cards.length);
      expect(board.flipped).toEqual([]);
      expect(board.flips).toBe(0);
      expect(board.matchedPairs).toBe(0);
      expect(board.locked).toBe(false);
    });
  });
});

describe('flipCard 状态机', () => {
  it('翻第 1 张：翻牌次数 +1、记录卡位、未配对、未锁定', () => {
    const board = createBoard(levelFor('3-4'), rng);
    const next = flipCard(board, 0);
    expect(next.flips).toBe(1);
    expect(next.flipped).toEqual([0]);
    expect(next.matchedPairs).toBe(0);
    expect(next.locked).toBe(false);
  });

  it('同一卡位重复点击幂等（不重复计次）', () => {
    const board = createBoard(levelFor('3-4'), rng);
    const once = flipCard(board, 2);
    expect(flipCard(once, 2)).toBe(once);
  });

  it('越界卡位不改变状态', () => {
    const board = createBoard(levelFor('3-4'), rng);
    expect(flipCard(board, 999)).toBe(board);
  });

  it('两张同面：配对成功、matchedPairs+1、翻牌次数 +2、清空 flipped', () => {
    const board = createBoard(levelFor('3-4'), rng);
    const [a, b] = firstPair(board);
    const next = flipCard(flipCard(board, a), b);
    expect(next.matchedPairs).toBe(1);
    expect(next.flips).toBe(2);
    expect(next.flipped).toEqual([]);
    expect(next.locked).toBe(false);
    expect(next.cards[a]!.matched).toBe(true);
    expect(next.cards[b]!.matched).toBe(true);
  });

  it('两张异面：进入锁定态，锁定期间再翻无效，resolveMismatch 解锁并清空', () => {
    const board = createBoard(levelFor('3-4'), rng);
    const [a, b] = firstMismatch(board);
    const next = flipCard(flipCard(board, a), b);
    expect(next.locked).toBe(true);
    expect(next.flipped).toEqual([a, b]);
    expect(next.matchedPairs).toBe(0);

    const other = next.cards.findIndex((_c, i) => !next.flipped.includes(i));
    expect(flipCard(next, other)).toBe(next);

    const resolved = resolveMismatch(next);
    expect(resolved.locked).toBe(false);
    expect(resolved.flipped).toEqual([]);
    expect(resolved.matchedPairs).toBe(0);
    expect(resolved.cards.every((c) => !c.matched)).toBe(true);
  });

  it('未锁定时 resolveMismatch 是空操作', () => {
    const board = createBoard(levelFor('3-4'), rng);
    expect(resolveMismatch(board)).toBe(board);
  });

  it('已配对的卡不可再翻', () => {
    const board = createBoard(levelFor('3-4'), rng);
    const [a, b] = firstPair(board);
    const matched = flipCard(flipCard(board, a), b);
    expect(flipCard(matched, a)).toBe(matched);
    expect(flipCard(matched, b)).toBe(matched);
  });
});

describe('isFaceUp / isCleared', () => {
  it('isFaceUp：已配对或正翻开为真，其余与越界为假', () => {
    const board = createBoard(levelFor('3-4'), rng);
    const [a, b] = firstPair(board);
    const matched = flipCard(flipCard(board, a), b);
    expect(isFaceUp(matched, a)).toBe(true);
    expect(isFaceUp(matched, b)).toBe(true);
    expect(isFaceUp(matched, 999)).toBe(false);

    const open = matched.cards.findIndex((c) => !c.matched);
    expect(isFaceUp(matched, open)).toBe(false);
    expect(isFaceUp(flipCard(matched, open), open)).toBe(true);
  });

  it('未清盘（含空局）时 isCleared 为假', () => {
    const empty: BoardState = { cards: [], flipped: [], matchedPairs: 0, flips: 0, locked: false };
    expect(isCleared(empty)).toBe(false);
    expect(isCleared(createBoard(levelFor('3-4'), rng))).toBe(false);
  });
});

describe('清盘结算：星级与得分', () => {
  it('零失误一局：按理论最少次数清盘，满星满分', () => {
    rngs.forEach((r) => {
      const level = levelFor('3-4');
      const board = playPerfect(level, r);
      expect(isCleared(board)).toBe(true);
      expect(board.matchedPairs).toBe(level.pairs);
      expect(board.flips).toBe(perfectFlips(level));
      expect(starFor(board.flips, level)).toBe(3);
      expect(scoreFor(board.flips, level)).toBe(100);
    });
  });

  it('4-6 岁难度同样可清盘并满星', () => {
    const level = levelFor('4-6');
    const board = playPerfect(level, rng);
    expect(isCleared(board)).toBe(true);
    expect(board.flips).toBe(12);
    expect(starFor(board.flips, level)).toBe(3);
  });

  it('星级随多余翻牌次数递减（3-4 岁：8 为基准）', () => {
    const level = levelFor('3-4');
    expect(starFor(8, level)).toBe(3);
    expect(starFor(10, level)).toBe(3); // 容错 ceil(4/2)=2
    expect(starFor(11, level)).toBe(2);
    expect(starFor(12, level)).toBe(2);
    expect(starFor(13, level)).toBe(1);
  });

  it('得分随多余翻牌递减且下限 40', () => {
    const level = levelFor('3-4');
    expect(scoreFor(8, level)).toBe(100);
    expect(scoreFor(12, level)).toBe(80);
    expect(scoreFor(20, level)).toBe(40);
    expect(scoreFor(99, level)).toBe(40);
  });
});
