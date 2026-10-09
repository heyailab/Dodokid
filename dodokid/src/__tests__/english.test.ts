/**
 * 英语启蒙模块单测：年龄选词、词卡字段完整性、看义选词出题约束与判分。
 * 纯逻辑测试，不依赖 React。
 */
import { ENGLISH_WORDS, wordsForAge } from '../features/english/englishData';
import { OPTION_COUNT, buildWordQuestions, gradeWord } from '../features/english/wordQuestions';
import { mediaUrl } from '../shared/lib/mediaBase';

const rng = () => 0.37;

/** 多组种子跑一遍，覆盖洗牌的不同分支 */
const seeds = [0.05, 0.2, 0.37, 0.55, 0.77, 0.93];
const rngs = seeds.map((s) => () => s);

describe('englishData 单词卡', () => {
  it('按年龄过滤：3-4 与 4-6 各 6 张，未指定返回全部 12 张', () => {
    expect(wordsForAge('3-4')).toHaveLength(6);
    expect(wordsForAge('4-6')).toHaveLength(6);
    expect(wordsForAge(undefined)).toHaveLength(ENGLISH_WORDS.length);
    expect(wordsForAge('3-4').every((w) => w.ageGroups.includes('3-4'))).toBe(true);
    expect(wordsForAge('4-6').every((w) => w.ageGroups.includes('4-6'))).toBe(true);
  });

  it('两个年龄段互不重叠，且合计覆盖全部词卡', () => {
    const low = wordsForAge('3-4').map((w) => w.id);
    const high = wordsForAge('4-6').map((w) => w.id);
    expect(low.filter((id) => high.includes(id))).toEqual([]);
    expect(low.length + high.length).toBe(ENGLISH_WORDS.length);
  });

  it('词卡字段齐备，id 与英文单词均唯一', () => {
    ENGLISH_WORDS.forEach((w) => {
      expect(w.id).toBeTruthy();
      expect(w.word).toMatch(/^[a-z]+$/);
      expect(w.phonetic).toMatch(/^\/.+\/$/);
      expect(w.zh).toBeTruthy();
      // 数据文件只存相对 key（不含域名），经 mediaUrl 渲染时才拼成绝对地址
      expect(w.audioKey).not.toMatch(/^https?:\/\//);
      expect(w.audioKey).toMatch(/^english\/.+\.mp3$/);
      expect(mediaUrl(w.audioKey)).toMatch(/^https:\/\/.+\/english\/.+\.mp3$/);
    });
    expect(new Set(ENGLISH_WORDS.map((w) => w.id)).size).toBe(ENGLISH_WORDS.length);
    expect(new Set(ENGLISH_WORDS.map((w) => w.word)).size).toBe(ENGLISH_WORDS.length);
  });
});

describe('buildWordQuestions', () => {
  it('词卡不足 4 张时不出题（干扰项不够）', () => {
    expect(buildWordQuestions(wordsForAge('3-4').slice(0, 3), rng)).toEqual([]);
  });

  it('每张词卡出 1 题，题序与词序一致，题干取自该词', () => {
    const words = wordsForAge('3-4');
    const qs = buildWordQuestions(words, rng);
    expect(qs).toHaveLength(words.length);
    qs.forEach((q, i) => {
      const w = words[i]!;
      expect(q.wordId).toBe(w.id);
      expect(q.promptZh).toBe(w.zh);
      expect(q.icon).toBe(w.icon);
      expect(q.answer).toBe(w.word);
    });
  });

  it('选项恒为 4 个互不相同的英文单词，且必含正确答案', () => {
    const words = wordsForAge('4-6');
    const vocabulary = words.map((w) => w.word);
    rngs.forEach((r) => {
      buildWordQuestions(words, r).forEach((q) => {
        expect(q.options).toHaveLength(OPTION_COUNT);
        expect(new Set(q.options).size).toBe(OPTION_COUNT);
        expect(q.options).toContain(q.answer);
        q.options.forEach((o) => expect(vocabulary).toContain(o));
      });
    });
  });

  it('判分：选中答案通过，其余所有选项均不通过', () => {
    buildWordQuestions(wordsForAge('3-4'), rng).forEach((q) => {
      expect(gradeWord(q, q.answer)).toBe(true);
      q.options
        .filter((o) => o !== q.answer)
        .forEach((o) => expect(gradeWord(q, o)).toBe(false));
    });
  });
});
