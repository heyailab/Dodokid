/**
 * 鉴权 / 儿童档案 Store（Zustand）。
 * 令牌持久化到 expo-secure-store；不采集位置/麦克风/通讯录。
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { childApi } from '../api/child';
import { parentApi } from '../api/parent';
import { systemApi } from '../api/system';
import { tokenStore } from '../api/token';
import type { AgeGroup, ChildProfile } from '../api/types';

const TOKEN_KEY = 'dodokid.token';
const CONSENT_VERSION = '2026-01';

async function readToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}
async function writeToken(token: string | null): Promise<void> {
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    /* web/不支持时忽略 */
  }
}

interface AuthState {
  token: string | null;
  parentId: string | null;
  children: ChildProfile[];
  currentChildId: string | null;
  gatePassed: boolean;
  bootstrapped: boolean;
  onboarded: boolean;
  bootstrap: () => Promise<void>;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  createChild: (
    name: string,
    ageGroup: AgeGroup,
  ) => Promise<ChildProfile>;
  switchChild: (id: string) => Promise<void>;
  refreshChildren: () => Promise<void>;
  setGatePassed: (v: boolean) => void;
  resetGate: () => void;
}

function deriveOnboarded(children: ChildProfile[], currentChildId: string | null) {
  return children.length > 0 && currentChildId !== null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  parentId: null,
  children: [],
  currentChildId: null,
  gatePassed: false,
  bootstrapped: false,
  onboarded: false,

  async bootstrap() {
    const token = await readToken();
    tokenStore.set(token);
    if (token) {
      try {
        const list = await childApi.list();
        set({
          token,
          children: list,
          currentChildId: list[0]?.id ?? null,
          bootstrapped: true,
          onboarded: deriveOnboarded(list, list[0]?.id ?? null),
        });
        return;
      } catch {
        /* 令牌失效则回落未登录态 */
      }
    }
    set({ bootstrapped: true, onboarded: false });
  },

  async login(phone, password) {
    const res = await parentApi.login({ phone, password });
    await writeToken(res.token);
    tokenStore.set(res.token);
    const list = await childApi.list();
    set({
      token: res.token,
      parentId: res.parentId,
      children: list,
      currentChildId: list[0]?.id ?? null,
      onboarded: deriveOnboarded(list, list[0]?.id ?? null),
    });
  },

  async logout() {
    try {
      await parentApi.logout();
    } catch {
      /* 忽略网络错误，本地清空 */
    }
    await writeToken(null);
    tokenStore.set(null);
    set({
      token: null,
      parentId: null,
      children: [],
      currentChildId: null,
      gatePassed: false,
      onboarded: false,
    });
  },

  async createChild(name, ageGroup) {
    const child = await childApi.create({
      name,
      ageGroup,
      consentVersion: CONSENT_VERSION,
    });
    // 创建档案即先写同意记录（合规闸），不采集任何敏感权限
    await systemApi.recordConsent({
      childId: child.id,
      category: 'data_processing',
      version: CONSENT_VERSION,
      grantedAt: new Date().toISOString(),
    });
    await get().refreshChildren();
    set({ currentChildId: child.id, onboarded: true, gatePassed: false });
    return child;
  },

  async switchChild(id) {
    const child = await childApi.switch(id);
    set({ currentChildId: child.id });
  },

  async refreshChildren() {
    const list = await childApi.list();
    set((s) => ({
      children: list,
      currentChildId: s.currentChildId ?? list[0]?.id ?? null,
      onboarded: deriveOnboarded(list, s.currentChildId ?? list[0]?.id ?? null),
    }));
  },

  setGatePassed(v) {
    set({ gatePassed: v });
  },
  resetGate() {
    set({ gatePassed: false });
  },
}));
