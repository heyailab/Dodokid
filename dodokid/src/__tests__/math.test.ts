/**
 * 数学启蒙模块单测：难度配置、出题纯逻辑（数一数/比大小/加法）、
 * 选项生成约束与一次练习的构成。
 */
import { rangeFor, MATH_ACTIVITIES } from '../features/math/mathData';
import {
  OPTION_COUNT,
  addProblem,
  buildPractice,
  compareProblem,
  countProblem,
  gradeAnswer,
} from '../features/math/problems';
import { distinctNumberOptions } from '../shared/lib/quizCore';

const rng = () => 0.37;

/** 用多组种子跑一遍，覆盖随机分支 */
const seeds = [0.05, 0.2, 0.37, 0.55, 0.77, 0.93];
const rngs = seeds.map((s) => () => s);

describe('mathData 难度配置', () => {
  it('按年龄返回不同难度', () => {
    expect(rangeFor('3-4').maxCount).toBe(5);
    expect(rangeFor('4-6').maxCount).toBe(10);
    expect(rangeFor('4-6').sessionSize).toBeGreaterThan(rangeFor('3-4').sessionSize);
  });

  it('未指定年龄回落基础难度', () => {
    expect(rangeFor(undefined)).toEqual(rangeFor('3-4'));
  });

  it('三个玩法元数据齐备', () => {
    expect(MATH_ACTIVITIES.map((a) => a.kind)).toEqual(['count', 'compare', 'add']);
  });
});

describe('distinctNumberOptions', () => {
  it('必含答案、数量正确、互不重复且在范围内', () => {
    rngs.forEach((r) => {
      const opts = distinctNumberOptions(4, 10, OPTION_COUNT, r);
      expect(opts).toHaveLength(OPTION_COUNT);
      expect(opts).toContain(4);
      expect(new Set(opts).size).toBe(OPTION_COUNT);
      opts.forEach((n) => {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(10);
      });
    });
  });

  it('取值范围不足时返回范围内全部整数', () => {
    const opts = distinctNumberOptions(2, 4, OPTION_COUNT, rng, 1);
    expect(opts.sort()).toEqual([1, 2, 3, 4]);
  });
});

describe('出题逻辑', () => {
  it('数一数：答案等于点阵个数', () => {
    rngs.forEach((r) => {
      const p = countProblem(5, r);
      expect(p.kind).toBe('count');
      expect(p.groups).toHaveLength(1);
      expect(p.answer).toBe(String(p.groups[0]));
      expect(p.options).toContain(p.answer);
      expect(p.options).toHaveLength(OPTION_COUNT);
    });
  });

  it('比大小：答案与两组点数的关系一致', () => {
    rngs.forEach((r) => {
      const p = compareProblem(10, r);
      const [left, right] = p.groups as [number, number];
      expect(p.groups).toHaveLength(2);
      const expected = left > right ? '左边多' : left < right ? '右边多' : '一样多';
      expect(p.answer).toBe(expected);
      expect(p.options).toEqual(expect.arrayContaining(['左边多', '右边多', '一样多']));
    });
  });

  it('算一算：和不超过上限，答案等于两加数之和', () => {
    rngs.forEach((r) => {
      const p = addProblem(5, 10, r);
      const [a, b] = p.groups as [number, number];
      expect(a).toBeGreaterThanOrEqual(1);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(a + b).toBeLessThanOrEqual(10);
      expect(p.answer).toBe(String(a + b));
      expect(p.title).toBe(`${a} + ${b} = ?`);
      expect(p.options).toContain(p.answer);
    });
  });
});

describe('buildPractice', () => {
  it('题量与题型符合配置，题号唯一', () => {
    (['count', 'compare', 'add'] as const).forEach((kind) => {
      const list = buildPractice('3-4', kind, rng);
      expect(list).toHaveLength(rangeFor('3-4').sessionSize);
      expect(list.every((p) => p.kind === kind)).toBe(true);
      expect(new Set(list.map((p) => p.id)).size).toBe(list.length);
    });
  });

  it('判分：选项正确为真，其余为假', () => {
    rngs.forEach((r) => {
      const p = addProblem(5, 10, r);
      expect(gradeAnswer(p, p.answer)).toBe(true);
      const wrong = p.options.find((o) => o !== p.answer);
      if (wrong) expect(gradeAnswer(p, wrong)).toBe(false);
    });
  });
});
