/**
 * 识字认知 — 认读小测纯逻辑（无 React 依赖，便于单测）。
 * 规则：以拼音为题干，从字卡中取 4 个汉字选项（1 正确 + 3 干扰），单选取答。
 * 通用部分（洗牌/得分/索引）复用 shared/lib/quizCore。
 */
import { scoreOf, shuffle, wrapIndex } from '../../shared/lib/quizCore';
import type { LiteracyCard } from './literacyData';

export interface QuizQuestion {
  cardId: string;
  /** 题干：拼音 */
  prompt: string;
  /** 选项：汉字（含正确答案） */
  options: string[];
  answer: string;
}

export const OPTION_COUNT = 4;

export { scoreOf, wrapIndex };

/**
 * 由字卡生成题目。字卡数不足 OPTION_COUNT 时返回空数组（无法组成 4 选 1）。
 * rng 可注入以便测试确定性。
 */
export function buildQuestions(
  cards: LiteracyCard[],
  rng: () => number = Math.random,
): QuizQuestion[] {
  if (cards.length < OPTION_COUNT) return [];
  return cards.map((card) => {
    const others = cards.filter((c) => c.id !== card.id).map((c) => c.char);
    const distractors = shuffle(others, rng).slice(0, OPTION_COUNT - 1);
    return {
      cardId: card.id,
      prompt: card.pinyin,
      answer: card.char,
      options: shuffle([card.char, ...distractors], rng),
    };
  });
}

export function gradeAnswer(question: QuizQuestion, choice: string): boolean {
  return choice === question.answer;
}
