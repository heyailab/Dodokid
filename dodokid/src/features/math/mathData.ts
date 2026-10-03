/**
 * 数学启蒙 — 年龄段难度配置与活动元数据（路线图 P2 第二个模块）。
 */
import type { AgeGroup } from '../../api/types';

export type MathKind = 'count' | 'compare' | 'add';

export interface MathRange {
  /** 数一数/比大小的最大数量 */
  maxCount: number;
  /** 加法的加数上限（和不超过 maxSum） */
  maxAddend: number;
  maxSum: number;
  /** 一次练习的题量 */
  sessionSize: number;
}

export interface MathActivity {
  kind: MathKind;
  label: string;
  desc: string;
}

export const MATH_ACTIVITIES: MathActivity[] = [
  { kind: 'count', label: '数一数', desc: '看图数圆点，选出正确数量' },
  { kind: 'compare', label: '比大小', desc: '看看哪边的圆点更多' },
  { kind: 'add', label: '算一算', desc: '十以内的加法小闯关' },
];

const RANGES: Record<AgeGroup, MathRange> = {
  '3-4': { maxCount: 5, maxAddend: 3, maxSum: 5, sessionSize: 6 },
  '4-6': { maxCount: 10, maxAddend: 5, maxSum: 10, sessionSize: 8 },
};

/** 按年龄取难度；未指定按最小难度（更稳妥）。 */
export function rangeFor(age?: AgeGroup): MathRange {
  return age ? RANGES[age] : RANGES['3-4'];
}

export function activityLabel(kind: MathKind): string {
  return MATH_ACTIVITIES.find((a) => a.kind === kind)?.label ?? '练习';
}
