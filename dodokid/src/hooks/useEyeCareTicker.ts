/**
 * 护眼全局计时器：每秒推进累计时长。
 * 仅在内容消费路由（contentActive=true）时计时；达上限由 store 自动 blocked。
 */
import { useEffect } from 'react';
import { useEyeCareStore } from '../store/eyeCareStore';

export function useEyeCareTicker(): void {
  const tick = useEyeCareStore((s) => s.tick);
  const resetDailyIfNeeded = useEyeCareStore((s) => s.resetDailyIfNeeded);

  useEffect(() => {
    resetDailyIfNeeded();
    const id = setInterval(() => {
      resetDailyIfNeeded();
      if (useEyeCareStore.getState().contentActive) {
        tick();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [tick, resetDailyIfNeeded]);
}
