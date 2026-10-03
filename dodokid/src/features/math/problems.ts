/**
 * 数学启蒙 — 出题纯逻辑（无 React 依赖，便于单测）。
 * 三类题：数一数 / 比大小 / 十以内加法，均由可注入 rng 生成以保证确定性。
 */
import { distinctNumberOptions, shuffle } from '../../shared/lib/quizCore';
import type { AgeGroup } from '../../api/types';
import { rangeFor, type MathKind } from './mathData';

export interface MathProblem {
  id: string;
  kind: MathKind;
  /** 题干文本 */
  title: string;
  /** 可视点阵：每个数字代表一组圆点个数 */
  groups: number[];
  options: string[];
  answer: string;
}

export const OPTION_COUNT = 4;

function intBetween(min: number, max: number, rng: () => number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** 数一数：给一组圆点，选数量。 */
export function countProblem(maxCount: number, rng: () => number, id = 'count-0'): MathProblem {
  const n = intBetween(1, maxCount, rng);
  const nums = distinctNumberOptions(n, maxCount, OPTION_COUNT, rng, 1);
  return {
    id,
    kind: 'count',
    title: '数一数，有几个圆点？',
    groups: [n],
    options: nums.map(String),
    answer: String(n),
  };
}

/** 比大小：比较两组圆点，选「左边多 / 右边多 / 一样多」。 */
export function compareProblem(maxCount: number, rng: () => number, id = 'compare-0'): MathProblem {
  const left = intBetween(1, maxCount, rng);
  const right = intBetween(1, maxCount, rng);
  const answer = left > right ? '左边多' : left < right ? '右边多' : '一样多';
  return {
    id,
    kind: 'compare',
    title: '哪边的圆点更多？',
    groups: [left, right],
    options: shuffle(['左边多', '右边多', '一样多'], rng),
    answer,
  };
}

/** 算一算：a + b（和不超过 maxSum）。 */
export function addProblem(
  maxAddend: number,
  maxSum: number,
  rng: () => number,
  id = 'add-0',
): MathProblem {
  const a = intBetween(1, Math.min(maxAddend, maxSum - 1), rng);
  const b = intBetween(1, Math.min(maxAddend, maxSum - a), rng);
  const sum = a + b;
  const nums = distinctNumberOptions(sum, maxSum, OPTION_COUNT, rng, 1);
  return {
    id,
    kind: 'add',
    title: `${a} + ${b} = ?`,
    groups: [a, b],
    options: nums.map(String),
    answer: String(sum),
  };
}

/** 按年龄与题型生成一次练习的题目列表。 */
export function buildPractice(age: AgeGroup | undefined, kind: MathKind, rng: () => number): MathProblem[] {
  const r = rangeFor(age);
  return Array.from({ length: r.sessionSize }, (_, i) => {
    const id = `${kind}-${i}`;
    if (kind === 'count') return countProblem(r.maxCount, rng, id);
    if (kind === 'compare') return compareProblem(r.maxCount, rng, id);
    return addProblem(r.maxAddend, r.maxSum, rng, id);
  });
}

export function gradeAnswer(problem: MathProblem, choice: string): boolean {
  return choice === problem.answer;
}
