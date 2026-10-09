/**
 * 后端地址与 Mock 开关 —— 三级取值，优先级由高到低：
 *   1. 构建期环境变量（Metro 会把 process.env.EXPO_PUBLIC_* 内联为字面量）
 *   2. app.json 的 extra.apiBaseUrl / extra.useMock
 *   3. 兜底常量
 *
 * 为什么需要 1：本地开发走 Mock（app.json 未设 useMock 时缺省 true），
 * 而 CI 产出的正式包必须连真实后端。用环境变量区分两者，
 * 就不必为"发正式包"去改动代码库里的 app.json。
 *
 * 单独成文件的原因：client.ts 与 mocks.ts 互相需要对方的产物
 * （client 路由到 mocks，mocks 要读 API_BASE_URL 推导隐私政策地址），
 * 放在 client.ts 里会构成循环依赖。抽到本文件后两者都只依赖 config。
 */
import Constants from 'expo-constants';

const envApiBase = process.env.EXPO_PUBLIC_API_BASE_URL;
const envUseMock = process.env.EXPO_PUBLIC_USE_MOCK;

export const API_BASE_URL: string =
  envApiBase && envApiBase.trim()
    ? envApiBase.trim()
    : ((Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
      'https://dodokid.heymf.cn/api/v1');

/** 开发期默认走本地 mock，与真实端点对齐；联调/正式包置 false */
export const USE_MOCK: boolean =
  envUseMock === undefined
    ? ((Constants.expoConfig?.extra?.useMock as boolean | undefined) ?? true)
    : envUseMock === 'true';