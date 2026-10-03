/**
 * 益智游戏 — 记忆翻牌的数据与难度配置（路线图 P2 第四个模块）。
 *
 * 与英语模块的关键差异：卡面**只呈现图形、不承载文字语义**，
 * 因此不存在「图标语义必须与词义一致」的约束，可自由选取视觉区分度高的图标。
 */
import type { AgeGroup } from '../../api/types';

export type FaceKey =
  | 'star'
  | 'heart'
  | 'moon'
  | 'sun'
  | 'cat'
  | 'dog'
  | 'fish'
  | 'bird'
  | 'tree'
  | 'car'
  | 'house'
  | 'cake';

/** 卡面候选：轮廓差异大、低龄可辨识（渲染见 MemoryFace） */
export const FACE_KEYS: FaceKey[] = [
  'star',
  'heart',
  'moon',
  'sun',
  'cat',
  'dog',
  'fish',
  'bird',
  'tree',
  'car',
  'house',
  'cake',
];

export interface PuzzleLevel {
  /** 配对组数（牌数 = pairs × 2） */
  pairs: number;
  /** 网格列数 */
  columns: number;
}

/**
 * 分龄难度：
 * - 3-4 岁 → 4 组（8 张），单局显著短于 2 分钟，符合低龄注意力；
 * - 4-6 岁 → 6 组（12 张）。
 * 均按 4 列排布，保证低龄儿童一眼可数清列数。
 */
export function levelFor(age?: AgeGroup): PuzzleLevel {
  if (age === '4-6') return { pairs: 6, columns: 4 };
  return { pairs: 4, columns: 4 };
}

/** 一局理论最少翻牌次数（每组都要翻两次） */
export function perfectFlips(level: PuzzleLevel): number {
  return level.pairs * 2;
}
