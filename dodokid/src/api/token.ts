/**
 * 访问令牌持有器（避免 api/client 与 store 形成循环依赖）。
 * authStore 登录后写入此处，并从 expo-secure-store 持久化；
 * 应用冷启动时由 authStore 从 secure-store 回填。
 */

let _token: string | null = null;

export const tokenStore = {
  get(): string | null {
    return _token;
  },
  set(token: string | null): void {
    _token = token;
  },
};
