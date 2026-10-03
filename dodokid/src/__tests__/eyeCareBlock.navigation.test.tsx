/**
 * 护眼阻断 P0 —— 集成验证（独立新增，不改动任何源码/既有测试）。
 *
 * 待证命题：当用户已压栈进入内容页（Math）后触达日限（isBlocked: false → true），
 * RootNavigator 必须把导航栈显式 reset 到 Blocked，界面切到阻断屏且不再渲染 Math 内容。
 *
 * 本测试**真实渲染** RootNavigator（不 mock 导航、不 mock 状态），仅隔离以下外部副作用：
 * - useAppBootstrap（网络/安全存储）；
 * - useEyeCareTicker（setInterval）；
 * - contentApi.samples（首页试读样章请求，测试中保持 pending）。
 * 状态由真实 zustand store（authStore / eyeCareStore）驱动。
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { AgeGroup, ChildProfile } from '../api/types';
import { RootNavigator } from '../navigation/RootNavigator';
import { useAuthStore } from '../store/authStore';
import { useEyeCareStore } from '../store/eyeCareStore';

// jest.mock 被 babel-jest 提升到所有 import 之前，此处 import 全部置于顶部以满足 import/first。
jest.mock('../hooks/useAppBootstrap', () => ({ useAppBootstrap: () => {} }));
jest.mock('../hooks/useEyeCareTicker', () => ({ useEyeCareTicker: () => {} }));
jest.mock('../api/content', () => ({
  // 首页试读样章：保持 pending，避免异步 resolve 触发 HomeScreen 的 act 告警。
  contentApi: { samples: () => new Promise(() => {}) },
}));
// 本地 node_modules 缺 expo-asset（expo-sqlite 的传递依赖），jest 无法解析该原生模块；
// 此处仅隔离原生存储入口（offline.ts 懒加载，本用例不会真正调用）。
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(() => Promise.resolve(null)),
}));
// expo-audio 原生模块在 jest 环境不可用；本用例不覆盖音频播放，仅需模块可解析。
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({ play: jest.fn(), pause: jest.fn() }),
}));
// 家长锁验证：真实 ParentGateScreen 会调用后端；此处令验证恒成功以走通解锁流程。
jest.mock('../api/parent', () => ({
  parentApi: {
    verifyGate: () => Promise.resolve({ ok: true }),
    login: jest.fn(),
    logout: jest.fn(),
  },
}));

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

function renderRoot() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RootNavigator />
    </QueryClientProvider>,
  );
}

/** Math 屏独有文案（见 src/features/math/MathScreen.tsx 的 MATH_ACTIVITIES[0].desc）。 */
const MATH_ONLY = '看图数圆点，选出正确数量';
/** 阻断屏独有文案（见 src/shared/components/EyeCareBlockedOverlay.tsx）。 */
const BLOCKED_TITLE = '今天玩够啦';

beforeEach(() => {
  useAuthStore.setState({
    bootstrapped: true,
    onboarded: true,
    currentChildId: 'c-34',
    children: [makeChild('c-34', '3-4')],
  });
  useEyeCareStore.setState({ isBlocked: false, dailyUsedSec: 0 });
});

describe('护眼阻断 P0：内容页（Math）达限必须被切走', () => {
  it('处于 Math 路由时 isBlocked 置 true → 切到阻断屏，且 Math 内容消失', async () => {
    const screen = renderRoot();

    // 1) 已引导 → 首页宫格渲染，点击「数学启蒙」进入独立模块路由
    fireEvent.press(await screen.findByText('数学启蒙'));

    // 2) 断言确实进入了 Math 路由（Math 屏独有文案出现）
    await waitFor(() => expect(screen.getByText(MATH_ONLY)).toBeTruthy());
    expect(screen.queryByText(BLOCKED_TITLE)).toBeNull();

    // 3) 触达日限：isBlocked false → true
    act(() => {
      useEyeCareStore.setState({ isBlocked: true });
    });

    // 4) 修复生效：切到阻断屏，且 Math 屏已卸载（独有文案消失）
    await waitFor(() => expect(screen.getByText(BLOCKED_TITLE)).toBeTruthy());
    expect(screen.queryByText(MATH_ONLY)).toBeNull();
  });

  it('解除阻断（家长验证成功）后回落到 MainTabs 而非残留在 Blocked', async () => {
    const screen = renderRoot();
    fireEvent.press(await screen.findByText('数学启蒙'));
    await waitFor(() => expect(screen.getByText(MATH_ONLY)).toBeTruthy());

    act(() => {
      useEyeCareStore.setState({ isBlocked: true });
    });
    await waitFor(() => expect(screen.getByText(BLOCKED_TITLE)).toBeTruthy());

    act(() => {
      useEyeCareStore.getState().unblock();
    });

    // 阻断屏随声明移除，导航器回落初始路由 MainTabs → 首页宫格重新可见
    await waitFor(() => expect(screen.getByText('数学启蒙')).toBeTruthy());
    expect(screen.queryByText(BLOCKED_TITLE)).toBeNull();
  });

  it('阻断屏「家长验证」→ 真实 ParentGate 模态验证通过 → 回到 MainTabs', async () => {
    const screen = renderRoot();
    fireEvent.press(await screen.findByText('数学启蒙'));
    await waitFor(() => expect(screen.getByText(MATH_ONLY)).toBeTruthy());

    act(() => {
      useEyeCareStore.setState({ isBlocked: true });
    });
    await waitFor(() => expect(screen.getByText(BLOCKED_TITLE)).toBeTruthy());

    // 阻断屏上的唯一入口：家长验证（导航到 ParentGate 模态）
    fireEvent.press(screen.getByText('家长验证'));
    // ParentGate 独有文案，证明模态已覆盖在 Blocked 之上
    await waitFor(() =>
      expect(screen.getByText('今天的使用时间到了，请家长验证后继续。')).toBeTruthy(),
    );

    // 指纹验证（mock 恒成功）→ unblock + goBack
    fireEvent.press(screen.getByText('使用指纹 / 面容验证'));

    // 解除阻断后应回落到 MainTabs（首页宫格可见），而非停留在阻断屏
    await waitFor(() => expect(screen.getByText('数学启蒙')).toBeTruthy());
    expect(screen.queryByText(BLOCKED_TITLE)).toBeNull();
    expect(useEyeCareStore.getState().isBlocked).toBe(false);
  });
});
