/**
 * 英语启蒙 — 单词卡数据（路线图 P2 第三个模块）。
 * 说明：现阶段无真实发音音频资源，卡面以「图标 + 英文 + 音标 + 中文」呈现，
 * 选词练习用「看图/看义选英文」保证在无音频时依然可练；听音选词待音频资源就绪后接入。
 *
 * 选词约束：词表只收录 phosphor 图标库中存在「语义精确」图标的词 —— 因为练习题干是图标，
 * 图标与词义不符会让低龄儿童产生错误联想。例如图标库只有品牌 logo `AppleLogo`（苹果公司标识）
 * 而无「苹果」水果图形，故未收录 apple；如需扩充，请先确认存在对应图标（见 WordIcon 的 MAP）。
 */
import type { AgeGroup } from '../../api/types';

export type WordIconKey =
  | 'cake'
  | 'cat'
  | 'dog'
  | 'sun'
  | 'moon'
  | 'star'
  | 'fish'
  | 'bird'
  | 'tree'
  | 'car'
  | 'house'
  | 'heart';

export interface EnglishWord {
  id: string;
  /** 英文单词 */
  word: string;
  /** 中文释义 */
  zh: string;
  /** 音标（简化展示） */
  phonetic: string;
  /** 图标键（渲染见 WordIcon） */
  icon: WordIconKey;
  /** 读音音频（生产环境由媒体库提供） */
  audioUrl: string;
  ageGroups: AgeGroup[];
}

export const ENGLISH_WORDS: EnglishWord[] = [
  { id: 'e-cake', word: 'cake', zh: '蛋糕', phonetic: '/keɪk/', icon: 'cake', audioUrl: 'https://cdn.dodokid.example.com/english/e-cake.mp3', ageGroups: ['3-4'] },
  { id: 'e-cat', word: 'cat', zh: '小猫', phonetic: '/kæt/', icon: 'cat', audioUrl: 'https://cdn.dodokid.example.com/english/e-cat.mp3', ageGroups: ['3-4'] },
  { id: 'e-dog', word: 'dog', zh: '小狗', phonetic: '/dɒɡ/', icon: 'dog', audioUrl: 'https://cdn.dodokid.example.com/english/e-dog.mp3', ageGroups: ['3-4'] },
  { id: 'e-sun', word: 'sun', zh: '太阳', phonetic: '/sʌn/', icon: 'sun', audioUrl: 'https://cdn.dodokid.example.com/english/e-sun.mp3', ageGroups: ['3-4'] },
  { id: 'e-moon', word: 'moon', zh: '月亮', phonetic: '/muːn/', icon: 'moon', audioUrl: 'https://cdn.dodokid.example.com/english/e-moon.mp3', ageGroups: ['3-4'] },
  { id: 'e-star', word: 'star', zh: '星星', phonetic: '/stɑː/', icon: 'star', audioUrl: 'https://cdn.dodokid.example.com/english/e-star.mp3', ageGroups: ['3-4'] },
  { id: 'e-fish', word: 'fish', zh: '小鱼', phonetic: '/fɪʃ/', icon: 'fish', audioUrl: 'https://cdn.dodokid.example.com/english/e-fish.mp3', ageGroups: ['4-6'] },
  { id: 'e-bird', word: 'bird', zh: '小鸟', phonetic: '/bɜːd/', icon: 'bird', audioUrl: 'https://cdn.dodokid.example.com/english/e-bird.mp3', ageGroups: ['4-6'] },
  { id: 'e-tree', word: 'tree', zh: '大树', phonetic: '/triː/', icon: 'tree', audioUrl: 'https://cdn.dodokid.example.com/english/e-tree.mp3', ageGroups: ['4-6'] },
  { id: 'e-car', word: 'car', zh: '汽车', phonetic: '/kɑː/', icon: 'car', audioUrl: 'https://cdn.dodokid.example.com/english/e-car.mp3', ageGroups: ['4-6'] },
  { id: 'e-house', word: 'house', zh: '房子', phonetic: '/haʊs/', icon: 'house', audioUrl: 'https://cdn.dodokid.example.com/english/e-house.mp3', ageGroups: ['4-6'] },
  { id: 'e-heart', word: 'heart', zh: '爱心', phonetic: '/hɑːt/', icon: 'heart', audioUrl: 'https://cdn.dodokid.example.com/english/e-heart.mp3', ageGroups: ['4-6'] },
];

/** 按年龄段取单词卡；未指定返回全部。 */
export function wordsForAge(age?: AgeGroup): EnglishWord[] {
  if (!age) return ENGLISH_WORDS;
  return ENGLISH_WORDS.filter((w) => w.ageGroups.includes(age));
}
