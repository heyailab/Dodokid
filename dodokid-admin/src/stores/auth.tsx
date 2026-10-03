/** 会话与权限 — 前端仅做展示裁剪，真实权限以后端 403 为准（AC-11）。 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { adminApi } from '../lib/api';
import { getToken, registerUnauthorizedHandler, setToken } from '../lib/http';
import type { AdminUser } from '../types/api';

export type Permission =
  | 'content.read'
  | 'content.write'
  | 'content.submit'
  | 'content.review' // approve / reject
  | 'content.lifecycle' // unpublish / archive / delete
  | 'media.read'
  | 'media.write'
  | 'media.delete'
  | 'catalog.write'
  | 'users.manage'
  | 'audit.read'
  | 'settings.manage';

const EDITOR_ALLOW: Permission[] = [
  'content.read',
  'content.write',
  'content.submit',
  'media.read',
  'media.write',
];

export function permissionsFor(role: AdminUser['role']): Permission[] {
  if (role === 'admin') {
    return [
      ...EDITOR_ALLOW,
      'content.review',
      'content.lifecycle',
      'media.delete',
      'catalog.write',
      'users.manage',
      'audit.read',
      'settings.manage',
    ];
  }
  return EDITOR_ALLOW;
}

interface AuthState {
  user: AdminUser | null;
  ready: boolean;
  can: (p: Permission) => boolean;
  login: (account: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [ready, setReady] = useState(false);

  const can = useCallback(
    (p: Permission) => (user ? permissionsFor(user.role).includes(p) : false),
    [user],
  );

  const bootstrap = useCallback(async () => {
    if (getToken()) {
      try {
        setUser(await adminApi.me());
      } catch {
        setToken(null);
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const login = useCallback(async (account: string, password: string) => {
    const res = await adminApi.login(account, password);
    setToken(res.tokens.accessToken);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminApi.logout();
    } finally {
      setToken(null);
      setUser(null);
    }
  }, []);

  // 401 全局处理：清会话回登录
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
      window.location.assign('/login');
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, can, login, logout, bootstrap }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
