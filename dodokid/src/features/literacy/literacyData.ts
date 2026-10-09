/**
 * 识字认知模块 — 字卡种子数据（路线图 P2 首个模块）。
 * 内容后续可由运营后台扩展；此处为内置字卡，字段与 content_items 对齐思路一致。
 *
 * 媒体字段：只存**相对 key**，绝对地址由调用方在渲染时经 mediaUrl() 拼接，
 * 以便运行时基址（后端 /version 下发）更新后能生效。
 */
import type { AgeGroup } from '../../api/types';

export interface LiteracyCard {
  id: string;
  /** 汉字 */
  char: string;
  /** 拼音（认读提示） */
  pinyin: string;
  /** 组词 */
  word: string;
  /** 例句 */
  sentence: string;
  /** 读音音频的相对 key；渲染时经 mediaUrl() 拼成绝对地址 */
  audioKey: string;
  ageGroups: AgeGroup[];
}

export const LITERACY_CARDS: LiteracyCard[] = [
  { id: 'l-ren', char: '人', pinyin: 'rén', word: '大人', sentence: '多多是一个懂事的**人**。', audioKey: 'literacy/l-ren.mp3', ageGroups: ['3-4'] },
  { id: 'l-kou', char: '口', pinyin: 'kǒu', word: '门口', sentence: '我们在大**口**等妈妈。', audioKey: 'literacy/l-kou.mp3', ageGroups: ['3-4'] },
  { id: 'l-shou', char: '手', pinyin: 'shǒu', word: '小手', sentence: '饭前要洗干净**手**。', audioKey: 'literacy/l-shou.mp3', ageGroups: ['3-4'] },
  { id: 'l-da', char: '大', pinyin: 'dà', word: '大家好', sentence: '大象是**大**大的动物。', audioKey: 'literacy/l-da.mp3', ageGroups: ['3-4'] },
  { id: 'l-xiao', char: '小', pinyin: 'xiǎo', word: '小狗', sentence: '**小**猫在晒太阳。', audioKey: 'literacy/l-xiao.mp3', ageGroups: ['3-4'] },
  { id: 'l-shang', char: '上', pinyin: 'shàng', word: '上面', sentence: '星星在**上**面眨眼睛。', audioKey: 'literacy/l-shang.mp3', ageGroups: ['3-4'] },
  { id: 'l-zhong', char: '中', pinyin: 'zhōng', word: '中间', sentence: '多多站在**中**间。', audioKey: 'literacy/l-zhong.mp3', ageGroups: ['4-6'] },
  { id: 'l-shan', char: '山', pinyin: 'shān', word: '高山', sentence: '远处的**山**很青。', audioKey: 'literacy/l-shan.mp3', ageGroups: ['4-6'] },
  { id: 'l-huo', char: '火', pinyin: 'huǒ', word: '火苗', sentence: '**火**苗暖暖的，别靠太近。', audioKey: 'literacy/l-huo.mp3', ageGroups: ['4-6'] },
  { id: 'l-ri', char: '日', pinyin: 'rì', word: '日出', sentence: '**日**出的时候天空很美。', audioKey: 'literacy/l-ri.mp3', ageGroups: ['4-6'] },
  { id: 'l-yue', char: '月', pinyin: 'yuè', word: '月亮', sentence: '**月**亮弯弯像小船。', audioKey: 'literacy/l-yue.mp3', ageGroups: ['4-6'] },
  { id: 'l-mu', char: '木', pinyin: 'mù', word: '木头', sentence: '桌子是用**木**头做的。', audioKey: 'literacy/l-mu.mp3', ageGroups: ['4-6'] },
];

/** 按年龄段取字卡；未指定则返回全部。 */
export function cardsForAge(age?: AgeGroup): LiteracyCard[] {
  if (!age) return LITERACY_CARDS;
  return LITERACY_CARDS.filter((c) => c.ageGroups.includes(age));
}

/** 让例句中的目标字更醒目：按 ** 标记切分，返回片段数组。 */
export function splitHighlight(sentence: string): { text: string; highlight: boolean }[] {
  return sentence
    .split(/\*\*(.+?)\*\*/g)
    .map((text, i) => ({ text, highlight: i % 2 === 1 }))
    .filter((seg) => seg.text.length > 0);
}
