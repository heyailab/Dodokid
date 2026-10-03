/**
 * 绘本共读 — 阅读器（BookReaderScreen）屏幕级渲染/交互测试（RNTL）。
 * 覆盖 AC-02 主路径：分页阅读 / 首页边界 / 末页完成 / 跟读加分 / 互动问答 / 进度回写 / 续读定位。
 *
 * 说明：本文件为独立验证新增，不改动任何源码或既有测试。
 * - useContent（TanStack Query）以固定 fixture 隔离，不触网；
 * - progressApi.snapshot / upsert 以 jest.fn 隔离并断言回写入参；
 * - useContentActivity 依赖导航上下文，脱离导航器渲染会报错，故 noop 隔离；
 * - expo-audio 原生模块在 jest 环境不可用，仅需模块可解析；
 * - useAuthStore 以可控选择器切片驱动；useUiStore 用真实 store 并读取 state 断言提示文案。
 */
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ContentItem } from '../api/types';
import { BookReaderScreen } from '../features/book/BookReaderScreen';
import { progressApi } from '../api/progress';
import { useUiStore } from '../store/uiStore';

// fixture 定义在 jest.mock 之前、名称以 mock 前缀声明，满足 jest.mock 工厂的作用域约束；
// 工厂仅在渲染时读取（模块加载时只返回箭头函数），故不存在初始化时序问题。
const mockContent: ContentItem = {
  id: 'b-fix',
  title: '小恐龙多多',
  module: 'book',
  version: '1.0.0',
  ageGroups: ['3-4'],
  coverUrl: 'mock://cover/b-fix',
  sample: false,
  pageCount: 3,
  summary: '多多在森林里的第一天',
  pages: [
    {
      index: 0,
      imageUrl: 'mock://page/0',
      text: '第一页：多多在森林里醒来。',
      audioUrl: 'mock://audio/0',
      questions: [],
    },
    {
      index: 1,
      imageUrl: 'mock://page/1',
      text: '第二页：多多遇见一只小兔子。',
      audioUrl: 'mock://audio/1',
      questions: [
        {
          id: 'q1',
          prompt: '多多遇见了谁？',
          options: [{ label: '小兔子' }, { label: '大灰狼' }],
          answerIndex: 0,
        },
      ],
    },
    {
      index: 2,
      imageUrl: 'mock://page/2',
      text: '第三页：他们成了好朋友。',
      audioUrl: 'mock://audio/2',
      questions: [],
    },
  ],
};

const mockAuth: { currentChildId: string | null } = { currentChildId: 'c-34' };

jest.mock('../api/hooks', () => ({
  useContent: () => ({ data: mockContent, isLoading: false }),
}));

jest.mock('../api/progress', () => ({
  progressApi: {
    snapshot: jest.fn(),
    upsert: jest.fn(() => Promise.resolve({})),
  },
}));

jest.mock('../store/authStore', () => ({
  useAuthStore: (selector: (s: typeof mockAuth) => unknown) => selector(mockAuth),
}));

// 屏幕在焦点时启动护眼计时，依赖 navigation 上下文；此处以 noop 隔离。
jest.mock('../hooks/useContentActivity', () => ({ useContentActivity: () => {} }));

// expo-audio 原生模块在 jest 环境不可用；旁白入口只验证渲染，播放能力不在此覆盖。
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({ play: jest.fn(), pause: jest.fn() }),
}));

const upsertMock = progressApi.upsert as unknown as jest.Mock;
const snapshotMock = progressApi.snapshot as unknown as jest.Mock;

async function renderReader() {
  const navigation = { goBack: jest.fn() };
  const utils = render(
    <BookReaderScreen route={{ params: { id: 'b-fix' } }} navigation={navigation} />,
  );
  // 冲掉续读快照（useEffect → .then → setPageIndex）这一微任务，避免 act 告警。
  await act(async () => {});
  return utils;
}

beforeEach(() => {
  upsertMock.mockClear();
  snapshotMock.mockClear();
  snapshotMock.mockResolvedValue({ childId: 'c-34', items: {}, totalReadSec: 0 });
  useUiStore.setState({ message: null, kind: 'info', seq: 0 });
});

describe('BookReaderScreen 绘本共读阅读器', () => {
  it('正常渲染：标题与第 1 页正文出现，且有「第 1 页」标识', async () => {
    const screen = await renderReader();

    expect(screen.getByText('小恐龙多多')).toBeTruthy();
    expect(screen.getByText('第一页：多多在森林里醒来。')).toBeTruthy();
    expect(screen.getByText('第 1 页')).toBeTruthy();
  });

  it('翻页：「下一页」进入第 2 页并回写 { pageIndex: 1, completed: false }', async () => {
    const screen = await renderReader();

    fireEvent.press(screen.getByText('下一页'));

    await waitFor(() =>
      expect(screen.getByText('第二页：多多遇见一只小兔子。')).toBeTruthy(),
    );
    expect(screen.getByText('第 2 页')).toBeTruthy();
    await waitFor(() =>
      expect(upsertMock).toHaveBeenCalledWith('c-34', {
        contentId: 'b-fix',
        pageIndex: 1,
        completed: false,
        score: 0,
      }),
    );
  });

  it('首页边界：第 1 页按「上一页」不生效——页面不变且不产生 upsert', async () => {
    const screen = await renderReader();

    fireEvent.press(screen.getByText('上一页'));

    expect(screen.getByText('第 1 页')).toBeTruthy();
    expect(screen.getByText('第一页：多多在森林里醒来。')).toBeTruthy();
    expect(screen.queryByText('第 2 页')).toBeNull();
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('末页：翻到最后一页出现「读完啦」、不再有「下一页」，且该次 upsert completed: true', async () => {
    const screen = await renderReader();

    fireEvent.press(screen.getByText('下一页'));
    await waitFor(() =>
      expect(screen.getByText('第二页：多多遇见一只小兔子。')).toBeTruthy(),
    );

    fireEvent.press(screen.getByText('下一页'));

    await waitFor(() => expect(screen.getByText('读完啦')).toBeTruthy());
    expect(screen.getByText('第三页：他们成了好朋友。')).toBeTruthy();
    expect(screen.queryByText('下一页')).toBeNull();
    await waitFor(() =>
      expect(upsertMock).toHaveBeenCalledWith('c-34', {
        contentId: 'b-fix',
        pageIndex: 2,
        completed: true,
        score: 0,
      }),
    );
  });

  it('跟读加分：pressIn 切到松手文案，pressOut 弹提示并回写 score: 10', async () => {
    const screen = await renderReader();

    fireEvent(screen.getByText('按住跟读'), 'pressIn');
    expect(screen.getByText('说给多多听…松手完成')).toBeTruthy();

    fireEvent(screen.getByText('说给多多听…松手完成'), 'pressOut');

    await waitFor(() =>
      expect(useUiStore.getState().message).toBe('跟读完成，多多给你加 10 分！'),
    );
    expect(useUiStore.getState().kind).toBe('success');
    await waitFor(() =>
      expect(upsertMock).toHaveBeenCalledWith('c-34', {
        contentId: 'b-fix',
        pageIndex: 0,
        completed: false,
        score: 10,
      }),
    );
  });

  it('互动问答：答对弹成功提示并回写 score: 10', async () => {
    const screen = await renderReader();

    fireEvent.press(screen.getByText('下一页'));
    await waitFor(() => expect(screen.getByText('多多遇见了谁？')).toBeTruthy());

    // answerIndex=0 → 正确答案为「小兔子」
    fireEvent.press(screen.getByText('小兔子'));

    await waitFor(() => expect(useUiStore.getState().message).toBe('答对啦，真棒！'));
    expect(useUiStore.getState().kind).toBe('success');
    await waitFor(() =>
      expect(upsertMock).toHaveBeenCalledWith('c-34', {
        contentId: 'b-fix',
        pageIndex: 1,
        completed: false,
        score: 10,
      }),
    );
  });

  it('互动问答：答错弹鼓励提示且不进分', async () => {
    const screen = await renderReader();

    fireEvent.press(screen.getByText('下一页'));
    await waitFor(() => expect(screen.getByText('多多遇见了谁？')).toBeTruthy());

    // answerIndex=0 → 「大灰狼」为错误项
    fireEvent.press(screen.getByText('大灰狼'));

    await waitFor(() => expect(useUiStore.getState().message).toBe('再想想，多多相信你～'));
    expect(useUiStore.getState().kind).toBe('warn');
    // 错答不产生得分回写
    expect(
      upsertMock.mock.calls.some((call) => (call[1] as { score?: number }).score === 10),
    ).toBe(false);
  });

  it('续读：snapshot 返回第 2 页进度时，首屏直接显示第 2 页', async () => {
    snapshotMock.mockResolvedValue({
      childId: 'c-34',
      items: {
        'b-fix': {
          childId: 'c-34',
          contentId: 'b-fix',
          pageIndex: 1,
          completed: false,
          score: 0,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      totalReadSec: 0,
    });

    const screen = await renderReader();

    await waitFor(() => expect(screen.getByText('第 2 页')).toBeTruthy());
    expect(screen.getByText('第二页：多多遇见一只小兔子。')).toBeTruthy();
    expect(screen.queryByText('第 1 页')).toBeNull();
  });
});
