/**
 * 小测通用纯逻辑（识字 / 数学等学习模块共用），无 React 依赖，便于单测。
 */

/** Fisher-Yates 洗牌；rng 可注入以保证测试确定性。 */
export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}

/** 得分百分比（0-100 取整）；correct 会被夹取到 [0, total]。 */
export function scoreOf(total: number, correct: number): number {
  if (total <= 0) return 0;
  const c = Math.max(0, Math.min(correct, total));
  return Math.round((c / total) * 100);
}

/** 循环推进索引（卡片浏览与题目推进共用）。 */
export function wrapIndex(i: number, len: number): number {
  if (len <= 0) return 0;
  return ((i % len) + len) % len;
}

/**
 * 从 [min, max] 取一组合整数选项，必含 answer 且互不重复。
 * 取值范围不足时返回该范围内的全部整数（顺序随机）。
 */
export function distinctNumberOptions(
  answer: number,
  max: number,
  size: number,
  rng: () => number,
  min = 0,
): number[] {
  const pool: number[] = [];
  for (let n = min; n <= max; n += 1) pool.push(n);
  const rest = shuffle(pool.filter((n) => n !== answer), rng);
  return shuffle([answer, ...rest.slice(0, Math.max(0, size - 1))], rng);
}
