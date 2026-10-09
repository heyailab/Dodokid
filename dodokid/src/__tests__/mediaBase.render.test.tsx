/**
 * 媒体基址在**渲染时**生效的屏幕级验证。
 *
 * 这是本次改造最容易被改坏的一点：若把 mediaUrl() 的结果写进模块顶层常量，
 * 基址在运行时更新后界面永远不会跟着变。因此这里从屏幕层验证两件事：
 *   1. 首屏用的是当时生效的基址；
 *   2. 基址在渲染之后变化，屏幕会重渲染并用上新域名。
 */
import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import type { AgeGroup, ChildProfile } from '../api/types';
import { EnglishScreen } from '../features/english/EnglishScreen';
import { getMediaBase, setMediaBase } from '../shared/lib/mediaBase';

const child: ChildProfile = {
  id: 'c-34',
  name: '多多',
  ageGroup: '3-4' as AgeGroup,
  avatarColor: '#12B5A6',
  createdAt: '2026-01-01T00:00:00.000Z',
  consentRecorded: true,
};

const mockAuthState = {
  current: { currentChildId: 'c-34', children: [child] },
};

jest.mock('../store/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector(mockAuthState.current),
}));

jest.mock('../hooks/useContentActivity', () => ({ useContentActivity: () => {} }));

jest.mock('../api/progress', () => ({
  progressApi: { upsert: jest.fn(() => Promise.resolve({})) },
}));

// 记录 useAudioPlayer 收到的 uri —— 它就是「渲染时拼出来的最终地址」
const playerUris: string[] = [];
jest.mock('expo-audio', () => ({
  useAudioPlayer: (uri: string) => {
    playerUris.push(uri);
    return { play: jest.fn(), pause: jest.fn() };
  },
}));

beforeEach(() => {
  playerUris.length = 0;
  delete process.env.EXPO_PUBLIC_MEDIA_BASE_URL;
  setMediaBase(null);
});

afterEach(() => {
  setMediaBase(null);
});

describe('EnglishScreen 媒体地址在渲染时解析', () => {
  it('首屏使用当时生效的基址拼接音频地址', async () => {
    setMediaBase('https://first.example/media');
    render(<EnglishScreen navigation={{ goBack: jest.fn() }} />);

    await waitFor(() => expect(playerUris.length).toBeGreaterThan(0));
    expect(playerUris[0]).toBe('https://first.example/media/english/e-cake.mp3');
  });

  it('基址在渲染后更新，屏幕重渲染并换用新域名', async () => {
    setMediaBase('https://old.example/media');
    render(<EnglishScreen navigation={{ goBack: jest.fn() }} />);

    await waitFor(() => expect(playerUris.length).toBeGreaterThan(0));
    expect(playerUris[0]).toContain('old.example');

    // 模拟后台 initMediaBase() 拉到新域名
    await act(async () => {
      setMediaBase('https://new.example/media');
    });

    await waitFor(() =>
      expect(playerUris.some((u) => u.startsWith('https://new.example/media/'))).toBe(true),
    );
    // 首屏那次渲染仍是旧地址，说明没有把结果缓存成常量
    expect(playerUris[0]).toBe('https://old.example/media/english/e-cake.mp3');
  });

  it('未注入基址时回落到兜底常量，不抛错', async () => {
    const fallback = getMediaBase();
    render(<EnglishScreen navigation={{ goBack: jest.fn() }} />);
    await waitFor(() => expect(playerUris.length).toBeGreaterThan(0));
    expect(playerUris[0]).toBe(`${fallback}/english/e-cake.mp3`);
  });
});