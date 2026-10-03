/** 内容消费路由聚焦时计入护眼计时；失焦（如家长锁弹层）不计。 */
import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useEyeCareStore } from '../store/eyeCareStore';

export function useContentActivity(): void {
  const setContentActive = useEyeCareStore((s) => s.setContentActive);
  useFocusEffect(
    useCallback(() => {
      setContentActive(true);
      return () => setContentActive(false);
    }, [setContentActive]),
  );
}
