/**
 * 运行时媒体基址（media base）。
 *
 * 背景：绘本封面 / 音频放在运营方自有服务器的本地磁盘，域名会变（迁移、换 CDN）。
 * 若把地址写死在前端常量里，每换一次域名就要重新编译 APK。因此基址必须在**运行时**
 * 从后端拉取并缓存，本模块负责「取值 → 缓存 → 拼接」三件事。
 *
 * 三级取值链（优先级由高到低）：
 *   1. 运行时缓存（`initMediaBase` 从 `GET /version` 的 `mediaBaseUrl` 写入）
 *   2. `process.env.EXPO_PUBLIC_MEDIA_BASE_URL`（构建期内联，仅作覆盖 / 应急）
 *   3. 兜底常量（与 `api/client.ts` 的 API_BASE_URL 兜底风格一致）
 *
 * 关键约束：`process.env.EXPO_PUBLIC_*` 会被 Metro 在打包时内联为字面量，
 * 所以第2 级是**构建期固定**的，真正的运行时动态能力只来自第 1 级。
 * 为此第 2 级刻意写成函数体内读取（内联依然生效，但可被测试注入）。
 *
 * 另一关键约束：数据文件（englishData / literacyData / mockBooks）只存**相对 key**，
 * 绝对地址一律由调用方在**渲染时**调用 `mediaUrl(key)` 得到。
 * 若在模块顶层常量里就把 URL 拼好，基址后续更新不会反映到已渲染的界面上。
 */

// 只依赖 config，不依赖 api/client：
// client → mocks → mockBooks → mediaBase，若这里引client 就成环了。
import { API_BASE_URL } from '../../api/config';

/** 兜底媒体基址；与 API 兜底同域，便于内网直连同一台服务器 */
export const FALLBACK_MEDIA_BASE = 'https://dodokid.heymf.cn/media';

/** 拉取版本信息的超时；比业务请求短，避免拖慢冷启动 */
export const MEDIA_BASE_TIMEOUT_MS = 8_000;

/** 运行时缓存；null 表示尚未从后端取到 */
let runtimeBase: string | null = null;

const listeners = new Set<() => void>();

function notify(): void {
  // 复制一份再遍历：监听器内部可能增删监听器
  for (const listener of Array.from(listeners)) listener();
}

/** 去掉尾部斜杠，保证拼接结果里不会出双斜杠 */
function normalize(base: string): string {
  return base.trim().replace(/\/+$/, '');
}

/**
 * 写入运行时基址。传null / 空串视为「清空缓存」，回落到第 2、3 级。
 * 值未变化时不通知，避免无谓的重渲染。
 */
export function setMediaBase(base: string | null): void {
  const next = base && base.trim() ? normalize(base) : null;
  if (next === runtimeBase) return;
  runtimeBase = next;
  notify();
}

/** 订阅基址变化，返回取消订阅函数。供 useSyncExternalStore 使用。 */
export function subscribeMediaBase(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 第 2 级：构建期环境变量。在函数体内读取，便于单测注入。 */
function envMediaBase(): string | null {
  const raw = process.env.EXPO_PUBLIC_MEDIA_BASE_URL;
  return raw && raw.trim() ? normalize(raw) : null;
}

/** 当前生效的媒体基址（三级取值链的出口）。 */
export function getMediaBase(): string {
  return runtimeBase ?? envMediaBase() ?? FALLBACK_MEDIA_BASE;
}

/** 形如 `scheme://` 的绝对地址，或以 `/` 开头的绝对路径 */
const ABSOLUTE = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * 把媒体 key 拼成可用地址。
 *
 * 原样返回（不拼基址）的输入：
 * - 空串 → 空串（调用方据此隐藏音频按钮）
 * - 已是绝对地址（`https://…`）→ 后端直接下发完整 URL 时不重复拼
 * - 本地 / mock 协议（`file://…`、`mock://…`）→ 离线缓存产物的本地路径
 * - 以 `/` 开头的绝对路径
 *
 * 上面几条不是防御性冗余，而是必需：离线下载（lib/offline）会把封面与音频
 * 换成本地 file:// 路径，若无条件拼接会得到形如
 * `https://…/media/file:///data/…` 的废URL，音频静默失效。
 */
export function mediaUrl(pathOrKey: string): string {
  const raw = typeof pathOrKey === 'string' ? pathOrKey.trim() : '';
  if (!raw) return '';
  if (ABSOLUTE.test(raw) || raw.startsWith('/')) return raw;
  return `${getMediaBase()}/${raw.replace(/^\/+/, '')}`;
}

/** 版本接口地址；容忍 API_BASE_URL 末尾多余的斜杠 */
function versionEndpoint(): string {
  return `${API_BASE_URL.replace(/\/+$/, '')}/version`;
}

/** 从响应体里取出 mediaBaseUrl，兼容 `{data:…}` 外壳与裸对象 */
function extractMediaBase(json: unknown): string | null {
  const payload =
    json && typeof json === 'object' && 'data' in json
      ? (json as { data: unknown }).data
      : json;
  if (!payload || typeof payload !== 'object') return null;
  const base = (payload as { mediaBaseUrl?: unknown }).mediaBaseUrl;
  return typeof base === 'string' && base.trim() ? base : null;
}

/**
 * 冷启动时拉取运行时基址。
 *
 * **本函数永不抛错**：网络失败、超时、非 2xx、JSON 解析失败、字段缺失
 * 全部静默降级，保留第 2 / 3 级取值。理由是媒体基址属于增强项，
 * 拿不到时用兜底常量渲染图片音频即可，绝不能因此崩掉 App 启动。
 *
 * fetcher 参数仅供单测注入；生产走全局 fetch。
 */
export async function initMediaBase(fetcher?: typeof fetch): Promise<void> {
  const doFetch = fetcher ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MEDIA_BASE_TIMEOUT_MS);
  try {
    const res = await doFetch(versionEndpoint(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return;
    const text = await res.text();
    const base = extractMediaBase(text ? (JSON.parse(text) as unknown) : null);
    if (base) setMediaBase(base);
  } catch {
    /* 降级：沿用 env /兜底常量 */
  } finally {
    clearTimeout(timer);
  }
}