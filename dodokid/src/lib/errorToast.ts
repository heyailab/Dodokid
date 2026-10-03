/**
 * 把 ApiError 翻译成儿童/家长友好的提示（防 happy-path 偏差：
 * 网络/超时/鉴权/越权/未找到/校验/服务端各有对应文案）。
 */
import { ApiError } from '../api/client';
import { useUiStore } from '../store/uiStore';

const MESSAGES: Record<ApiError['code'], string> = {
  NETWORK: '网络开了小差，请检查一下再试',
  TIMEOUT: '等太久了，换个网络试试吧',
  UNAUTHORIZED: '登录已失效，请重新登录',
  FORBIDDEN: '没有权限访问，请让家长确认',
  NOT_FOUND: '内容走丢了，换一本看看吧',
  VALIDATION: '信息填错啦，检查一下再提交',
  SERVER: '服务器打了个盹，稍后再来',
  UNKNOWN: '出了点小问题，请稍后再试',
};

export function reportError(err: unknown): void {
  const msg =
    err instanceof ApiError
      ? MESSAGES[err.code] ?? err.message
      : err instanceof Error
        ? err.message
        : '出了点小问题，请稍后再试';
  useUiStore.getState().show(msg, 'danger');
}
