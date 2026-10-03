/**
 * AC-03 连续打卡天数单测：抽出为纯函数后可直接覆盖含今/不含今、
 * 断档、空集合与跨月场景。
 */
import { addDays, computeStreak } from '../features/habit/streak';

const T = '2026-10-02';

describe('computeStreak (AC-03)', () => {
  it('今天起连续三天 -> 3', () => {
    const all = new Set([T, addDays(T, -1), addDays(T, -2)]);
    expect(computeStreak(all, T)).toBe(3);
  });

  it('今天未打卡但昨天起连续 -> 2（离线续算）', () => {
    const all = new Set([addDays(T, -1), addDays(T, -2)]);
    expect(computeStreak(all, T)).toBe(2);
  });

  it('断档（昨天未打卡）-> 0', () => {
    const all = new Set([addDays(T, -2), addDays(T, -3)]);
    expect(computeStreak(all, T)).toBe(0);
  });

  it('空集合 -> 0', () => {
    expect(computeStreak(new Set<string>(), T)).toBe(0);
  });

  it('addDays 跨月正确', () => {
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
});
