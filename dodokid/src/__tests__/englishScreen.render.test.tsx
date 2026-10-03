/**
 * 英语启蒙 — 单词卡浏览屏（EnglishScreen）屏幕级渲染/交互测试（RNTL）。
 * 覆盖 AC-19 前半段：按年龄段出词卡、卡面五要素（图标/英文/音标/中文/读音入口）、
 * 环形翻卡与计数、切入「看义选词」小测模式、浏览进度回写、空态兜底。
 *
 * 说明：本文件为独立验证新增，不改动任何既有源码或测试；
 * 依赖外部 store / 导航钩子 / 进度服务均以 jest.mock 隔离，不触网。
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { AgeGroup, ChildProfile } from '../api/types';
import { EnglishScreen } from '../features/english/EnglishScreen';
import { WordIcon } from '../features/english/WordIcon';
import { wordsForAge } from '../features/english/englishData';
import { progressApi } from '../api/progress';

function makeChild(id: string, ageGroup: AgeGroup): ChildProfile {
  return {
    id,
    name: '多多',
    ageGroup,
    avatarColor: '#12B5A6',
    createdAt: '2026-01-01T00:00:00.000Z',
    consentRecorded: true,
  };
}

// 可控鉴权切片：EnglishScreen 通过选择器读取 currentChildId 与 children[].ageGroup。
// 变量名以 mock 前缀声明，满足 jest.mock 工厂的作用域约束。
const mockAuthState: {
  current: { currentChildId: string | null; children: ChildProfile[] };
} = {
  current: { currentChildId: 'c-34', children: [makeChild('c-34', '3-4')] },
};

jest.mock('../store/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector(mockAuthState.current),
}));

// 屏幕在焦点时启动护眼计时，依赖 navigation 上下文；此处以 noop 隔离。
jest.mock('../hooks/useContentActivity', () => ({ useContentActivity: () => {} }));

jest.mock('../api/progress', () => ({
  progressApi: { upsert: jest.fn(() => Promise.resolve({})) },
}));

// expo-audio 的原生模块在 jest 环境不可用；读音入口只验证渲染，播放能力不在此覆盖。
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({ play: jest.fn(), pause: jest.fn() }),
}));

// 保留真实词表与纯逻辑，仅让 wordsForAge 可被单次改写以覆盖空态分支。
jest.mock('../features/english/englishData', () => {
  const actual = jest.requireActual('../features/english/englishData');
  return {
    ...actual,
    wordsForAge: jest.fn((...args: unknown[]) => (actual as { wordsForAge: (...a: unknown[]) => unknown }).wordsForAge(...args)),
  };
});

const upsertMock = progressApi.upsert as unknown as jest.Mock;
const wordsForAgeMock = wordsForAge as unknown as jest.Mock;

function nav(): { goBack: jest.Mock } {
  return { goBack: jest.fn() };
}

function withAgeGroup(id: string, ageGroup: AgeGroup): void {
  mockAuthState.current = { currentChildId: id, children: [makeChild(id, ageGroup)] };
}

beforeEach(() => {
  upsertMock.mockClear();
  wordsForAgeMock.mockClear();
  withAgeGroup('c-34', '3-4');
});

describe('EnglishScreen 单词卡浏览屏', () => {
  it('3-4 档：首卡渲染图标/英文/音标/中文与读音入口，计数为 1 / 6', () => {
    const screen = render(<EnglishScreen navigation={nav()} />);

    expect(screen.getByText('英语启蒙')).toBeTruthy();
    expect(screen.getByText('1 / 6')).toBeTruthy();
    expect(screen.getByText('cake')).toBeTruthy();
    expect(screen.getByText('/keɪk/')).toBeTruthy();
    expect(screen.getByText('蛋糕')).toBeTruthy();
    // 读音入口（NarrationButton 未播放态文案）
    expect(screen.getByText('听多多讲')).toBeTruthy();
    // 卡面必须渲染图标组件（而非仅文案）
    expect(screen.UNSAFE_getAllByType(WordIcon)).toHaveLength(1);
  });

  it('4-6 档：按档案年龄段出词，首卡为 fish 且不出现 3-4 档的词', () => {
    withAgeGroup('c-46', '4-6');
    const screen = render(<EnglishScreen navigation={nav()} />);

    expect(screen.getByText('1 / 6')).toBeTruthy();
    expect(screen.getByText('fish')).toBeTruthy();
    expect(screen.getByText('/fɪʃ/')).toBeTruthy();
    expect(screen.getByText('小鱼')).toBeTruthy();
    expect(screen.queryByText('cake')).toBeNull();
    expect(screen.queryByText('蛋糕')).toBeNull();
  });

  it('下一个 / 上一个 可切换词卡，计数变化，且首张「上一个」环形回末张', () => {
    const screen = render(<EnglishScreen navigation={nav()} />);

    fireEvent.press(screen.getByText('下一个'));
    expect(screen.getByText('2 / 6')).toBeTruthy();
    expect(screen.getByText('cat')).toBeTruthy();

    fireEvent.press(screen.getByText('上一个'));
    expect(screen.getByText('1 / 6')).toBeTruthy();
    expect(screen.getByText('cake')).toBeTruthy();

    // 首张再点「上一个」→ wrapIndex 回环到末张
    fireEvent.press(screen.getByText('上一个'));
    expect(screen.getByText('6 / 6')).toBeTruthy();
    expect(screen.getByText('star')).toBeTruthy();
  });

  it('点「开始看义选词」切到小测模式，出现标题与第 1 题', () => {
    const screen = render(<EnglishScreen navigation={nav()} />);

    fireEvent.press(screen.getByText('开始看义选词'));
    expect(screen.getByText('看义选词')).toBeTruthy();
    expect(screen.getByText('第 1 / 6 题')).toBeTruthy();
  });

  it('浏览词卡按 english:<wordId> 回写进度，翻页后 contentId 随词变化', async () => {
    const screen = render(<EnglishScreen navigation={nav()} />);

    await waitFor(() =>
      expect(upsertMock).toHaveBeenCalledWith(
        'c-34',
        expect.objectContaining({ contentId: 'english:e-cake', pageIndex: 0, completed: false }),
      ),
    );

    fireEvent.press(screen.getByText('下一个'));
    await waitFor(() =>
      expect(upsertMock).toHaveBeenCalledWith(
        'c-34',
        expect.objectContaining({ contentId: 'english:e-cat', pageIndex: 1 }),
      ),
    );
  });

  it('wordsForAge 返回空数组时展示空态，且「返回」触发 goBack', () => {
    wordsForAgeMock.mockReturnValueOnce([]);
    const navigation = nav();
    const screen = render(<EnglishScreen navigation={navigation} />);

    expect(screen.getByText('这个年龄段正在准备单词卡～')).toBeTruthy();
    expect(screen.queryByText('英语启蒙')).toBeNull();
    fireEvent.press(screen.getByText('返回'));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});
