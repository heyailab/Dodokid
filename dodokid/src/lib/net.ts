/** 网络状态封装（基于 @react-native-community/netinfo）。 */
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/** React 钩子：返回当前是否在线（用于离线读取分支判断）。 */
export function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => setOnline(!!state.isConnected));
    return unsub;
  }, []);
  return online;
}

/** 一次性探测当前是否联网（异步）。 */
export async function isConnected(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return !!state.isConnected;
  } catch {
    return true; // 探测失败按在线处理，避免误判离线
  }
}
