/**
 * 英语启蒙 — 单词图标映射。
 * 数据层只存 icon key（保持纯数据可测），图标元素在此集中渲染。
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
import type { WordIconKey } from './englishData';

const MAP: Record<WordIconKey, React.ComponentType<{ size?: number; color?: string; weight?: 'fill' | 'bold' | 'regular' }>> = {
  cake: Cake,
  cat: Cat,
  dog: Dog,
  sun: Sun,
  moon: Moon,
  star: Star,
  fish: Fish,
  bird: Bird,
  tree: Tree,
  car: Car,
  house: House,
  heart: Heart,
};

export function WordIcon({
  icon,
  size = 40,
  color = '#FFFFFF',
}: {
  icon: WordIconKey;
  size?: number;
  color?: string;
}) {
  const Cmp = MAP[icon];
  return <Cmp size={size} color={color} weight="fill" />;
}
