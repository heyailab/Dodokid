/**
 * 英语启蒙 — 选词小测纯逻辑（无 React 依赖，便于单测）。
 * 现阶段题干为「图标 + 中文释义」，四选一英文单词；听音版待音频资源接入。
 *
 * 命名说明：文件名刻意避开与组件 WordQuiz.tsx 的大小写差异（如 wordQuiz.ts），
 * 否则在 Windows/macOS 等大小写不敏感文件系统上会解析到错误模块。
 */
import { shuffle } from '../../shared/lib/quizCore';
import type { EnglishWord, WordIconKey } from './englishData';

export interface WordQuestion {
  wordId: string;
  /** 题干：中文释义 */
  promptZh: string;
  /** 题干图标 */
  icon: WordIconKey;
  /** 选项：英文单词（含正确答案） */
  options: string[];
  answer: string;
}

export const OPTION_COUNT = 4;

export function buildWordQuestions(
  words: EnglishWord[],
  rng: () => number = Math.random,
): WordQuestion[] {
  if (words.length < OPTION_COUNT) return [];
  return words.map((w) => {
    const others = words.filter((x) => x.id !== w.id).map((x) => x.word);
    const distractors = shuffle(others, rng).slice(0, OPTION_COUNT - 1);
    return {
      wordId: w.id,
      promptZh: w.zh,
      icon: w.icon,
      answer: w.word,
      options: shuffle([w.word, ...distractors], rng),
    };
  });
}

export function gradeWord(question: WordQuestion, choice: string): boolean {
  return choice === question.answer;
}
