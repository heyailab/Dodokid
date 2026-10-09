/**
 * 订阅运行时媒体基址。
 *
 * 为什么必须有这个 hook：`initMediaBase()` 是在后台异步完成的，
 * 首屏渲染时基址往往还是兜底常量。若组件只在 mount 时算一次 URL，
 * 基址到位后界面不会自动更新，图片音频会一直指着旧域名。
 * 用 useSyncExternalStore 订阅 mediaBase 的变化，基址一变就重渲染，
 * 重渲染时再调 mediaUrl() 自然就拿到新地址。
 */
import { useSyncExternalStore } from 'react';
import { getMediaBase, subscribeMediaBase } from './mediaBase';

/** 当前生效的媒体基址；基址变化时触发所在组件重渲染 */
export function useMediaBase(): string {
  return useSyncExternalStore(subscribeMediaBase, getMediaBase, getMediaBase);
}