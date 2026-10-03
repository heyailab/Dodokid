/**
 * 识字认知模块单测（路线图 P2 首个模块）：
 * 字卡按年龄过滤、例句高亮切分、认读小测组题/判分/得分、索引循环。
 */
import { LITERACY_CARDS, cardsForAge, splitHighlight } from '../features/literacy/literacyData';
import { OPTION_COUNT, buildQuestions, gradeAnswer, scoreOf, wrapIndex } from '../features/literacy/quiz';

describe('literacyData', () => {
  it('按年龄过滤字卡', () => {
    const c34 = cardsForAge('3-4');
    const c46 = cardsForAge('4-6');
    expect(c34.length).toBeGreaterThanOrEqual(OPTION_COUNT);
    expect(c46.length).toBeGreaterThanOrEqual(OPTION_COUNT);
    expect(c34.every((c) => c.ageGroups.includes('3-4'))).toBe(true);
    expect(c46.every((c) => c.ageGroups.includes('4-6'))).toBe(true);
    expect(c34.length + c46.length).toBe(LITERACY_CARDS.length);
  });

  it('未指定年龄返回全部字卡', () => {
    expect(cardsForAge(undefined)).toHaveLength(LITERACY_CARDS.length);
  });

  it('字卡 id 唯一', () => {
    const ids = new Set(LITERACY_CARDS.map((c) => c.id));
    expect(ids.size).toBe(LITERACY_CARDS.length);
  });

  it('例句高亮按 ** 标记切分', () => {
    const segs = splitHighlight('多多是一个懂事的**人**。');
    expect(segs.map((s) => s.text)).toEqual(['多多是一个懂事的', '人', '。']);
    expect(segs[1]?.highlight).toBe(true);
    expect(segs[0]?.highlight).toBe(false);
  });

  it('无标记的句子整体不高亮', () => {
    const segs = splitHighlight('没有标记的句子');
    expect(segs).toHaveLength(1);
    expect(segs[0]?.highlight).toBe(false);
  });
});

describe('literacy quiz logic', () => {
  // 固定 rng，保证组题确定（仍做结构性断言，不依赖具体顺序）
  const rng = () => 0.42;

  it('每题为 4 选 1，含正确答案且选项不重复', () => {
    const qs = buildQuestions(LITERACY_CARDS, rng);
    expect(qs).toHaveLength(LITERACY_CARDS.length);
    qs.forEach((q) => {
      expect(q.options).toHaveLength(OPTION_COUNT);
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size).toBe(OPTION_COUNT);
      expect(q.prompt.length).toBeGreaterThan(0);
    });
  });

  it('题干为拼音、答案与该字卡一致', () => {
    const qs = buildQuestions(LITERACY_CARDS, rng);
    qs.forEach((q) => {
      const card = LITERACY_CARDS.find((c) => c.id === q.cardId);
      expect(card?.pinyin).toBe(q.prompt);
      expect(card?.char).toBe(q.answer);
    });
  });

  it('字卡不足 4 张时无法组题，返回空数组', () => {
    expect(buildQuestions(LITERACY_CARDS.slice(0, 3), rng)).toEqual([]);
  });

  it('判分：选对为真，选错为假', () => {
    const q = buildQuestions(LITERACY_CARDS, rng)[0]!;
    expect(gradeAnswer(q, q.answer)).toBe(true);
    const wrong = q.options.find((o) => o !== q.answer)!;
    expect(gradeAnswer(q, wrong)).toBe(false);
  });

  it('得分百分比四舍五入并夹取范围', () => {
    expect(scoreOf(12, 12)).toBe(100);
    expect(scoreOf(12, 6)).toBe(50);
    expect(scoreOf(3, 1)).toBe(33);
    expect(scoreOf(12, 99)).toBe(100);
    expect(scoreOf(12, -1)).toBe(0);
    expect(scoreOf(0, 0)).toBe(0);
  });

  it('索引循环推进', () => {
    expect(wrapIndex(3, 3)).toBe(0);
    expect(wrapIndex(-1, 3)).toBe(2);
    expect(wrapIndex(1, 3)).toBe(1);
    expect(wrapIndex(0, 0)).toBe(0);
  });
});
