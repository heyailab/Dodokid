/**
 * DodoKid 应用入口：仅做装配（QueryClient + 导航 + 状态栏）。
 * 业务逻辑全部下沉到 store / hook / feature 模块。
 */
import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from './src/navigation/RootNavigator';
import { initMediaBase } from './src/shared/lib/mediaBase';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  useEffect(() => {
    // 后台拉取媒体基址：故意不 await，不阻塞首屏。
    // 失败已在 initMediaBase 内部吞掉，这里再兜一层 catch，
    // 防止意外 reject 变成未处理的 Promise 拒绝。
    void initMediaBase().catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RootNavigator />
      <StatusBar style="dark" />
    </QueryClientProvider>
  );
}
