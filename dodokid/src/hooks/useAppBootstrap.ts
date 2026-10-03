/** 应用冷启动：回填令牌与儿童档案 */
import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

export function useAppBootstrap(): void {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const bootstrapped = useAuthStore((s) => s.bootstrapped);

  useEffect(() => {
    if (!bootstrapped) void bootstrap();
  }, [bootstrapped, bootstrap]);
}
