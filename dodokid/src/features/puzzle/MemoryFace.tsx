/**
 * 益智游戏 — 卡面图标映射。
 * 数据层只存 face key（保持纯数据可测），图标元素在此集中渲染。
 */
import React from 'react';
import {
  Bird,
  Cake,
  Car,
  Cat,
  Dog,
  Fish,
  Heart,
  House,
  Moon,
  Star,
  Sun,
  Tree,
} from 'phosphor-react-native';
import type { FaceKey } from './memoryData';

type IconCmp = React.ComponentType<{
  size?: number;
  color?: string;
  weight?: 'fill' | 'bold' | 'regular';
}>;

const MAP: Record<FaceKey, IconCmp> = {
  star: Star,
  heart: Heart,
  moon: Moon,
  sun: Sun,
  cat: Cat,
  dog: Dog,
  fish: Fish,
  bird: Bird,
  tree: Tree,
  car: Car,
  house: House,
  cake: Cake,
};

export function MemoryFace({
  face,
  size = 34,
  color = '#FFFFFF',
}: {
  face: FaceKey;
  size?: number;
  color?: string;
}) {
  const Cmp = MAP[face];
  return <Cmp size={size} color={color} weight="fill" />;
}
