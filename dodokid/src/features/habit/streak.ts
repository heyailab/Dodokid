/**
 * 连续打卡天数计算（纯函数，抽出以便单测覆盖 AC-03）。
 * 规则：从今天起回溯；若今天没打卡则从昨天起算，逐日递减直到断档。
 *
 * 注意：全部按 UTC 做日期运算，与 todayKey()（toISOString().slice(0,10)）保持一致；
 * 若用本地时区解析 + UTC 序列化混用，会在非 UTC 时区产生 ±1 天偏移（已由单测锁定）。
 */

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 计算以今天（或昨天）为终点的连续打卡天数。 */
export function computeStreak(all: Set<string>, today: string = todayKey()): number {
  let cursor = today;
  if (!all.has(cursor)) cursor = addDays(cursor, -1);
  let streak = 0;
  while (all.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
