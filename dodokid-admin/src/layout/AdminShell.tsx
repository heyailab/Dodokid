/**
 * AdminShell — 侧边栏 + 顶栏 + 面包屑 + 权限受限页（§2 / §7.4）。
 * editor 遇 admin-only 路由：整页 LockSimple + 原因 + 返回概览。
 */
import {
  Article, CaretLeft, ChartLineUp, ClipboardText, GearSix, Images,
  List as ListIcon, SignOut, SquaresFour, UsersThree,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { Dropdown } from 'antd';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../stores/auth';
import type { Permission } from '../stores/auth';
import { useToast } from '../shared/components';

interface NavEntry {
  to: string;
  label: string;
  icon: Icon;
  perm?: Permission;
}

const NAV_GROUPS: Array<{ label: string; items: NavEntry[] }> = [
  {
    label: '内容',
    items: [{ to: '/contents', label: '内容列表', icon: Article, perm: 'content.read' }],
  },
  {
    label: '资源',
    items: [
      { to: '/media', label: '媒体库', icon: Images, perm: 'media.read' },
      { to: '/modules', label: '模块与分类', icon: SquaresFour },
    ],
  },
  {
    label: '管理',
    items: [
      { to: '/users', label: '用户与角色', icon: UsersThree, perm: 'users.manage' },
      { to: '/audit', label: '审计日志', icon: ClipboardText, perm: 'audit.read' },
      { to: '/settings', label: '后台设置', icon: GearSix, perm: 'settings.manage' },
    ],
  },
];

const OVERVIEW: NavEntry = { to: '/dashboard', label: '概览', icon: ChartLineUp };

export function PermissionDeniedPage({ permLabel }: { permLabel?: string }) {
  const { user } = useAuth();
  return (
    <div className="state-view" style={{ paddingTop: 96 }}>
      <div className="state-icon" aria-hidden><Lock48 /></div>
      <div className="state-title">无权访问</div>
      <div className="state-hint">
        当前身份：{user?.role ?? '未知'}，此页面仅 admin 可见
        {permLabel ? `（${permLabel}）` : ''}。
      </div>
      <Link className="btn btn-secondary" to="/dashboard">返回概览</Link>
    </div>
  );
}

function Lock48() {
  return (
    <svg width="48" height="48" viewBox="0 0 256 256" fill="currentColor" aria-hidden>
      <path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96Z" />
    </svg>
  );
}

export function AdminShell() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === '1');

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  const doLogout = async () => {
    await logout();
    toast.success('已退出登录');
    navigate('/login');
  };

  const userMenu = {
    items: [
      { key: 'role', label: `当前身份：${user?.role}`, disabled: true },
      { key: 'logout', label: '登出', icon: <SignOut size={16} /> },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'logout') void doLogout();
    },
  };

  return (
    <div className="admin-shell">
      <nav className={`sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="主导航">
        <div className="sidebar-brand">
          <SquaresFour size={20} color="var(--accent-strong)" aria-hidden />
          {!collapsed && <span>DodoKid 后台</span>}
        </div>
        <NavLink to={OVERVIEW.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <OVERVIEW.icon size={20} aria-hidden />
          {!collapsed && OVERVIEW.label}
        </NavLink>
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((it) => !it.perm || userNavVisible(it.perm));
          if (items.length === 0) return null;
          return (
            <div key={group.label}>
              <div className="sidebar-group-label">{group.label}</div>
              {items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  title={collapsed ? it.label : undefined}
                  className={({ isActive }) => `nav-item ${isActive || location.pathname.startsWith(it.to) ? 'active' : ''}`}
                >
                  <it.icon size={20} aria-hidden />
                  {!collapsed && it.label}
                </NavLink>
              ))}
            </div>
          );
        })}
        <div className="sidebar-footer">
          <button
            className="icon-plain"
            aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
            onClick={() => setCollapsed((c) => !c)}
          >
            <ListIcon size={18} />
          </button>
          {!collapsed && <span className="text-sm text-muted">{user?.phone}</span>}
        </div>
      </nav>
      <div className="admin-main">
        <header className="topbar">
          <div className="breadcrumb" aria-label="面包屑">
            <button className="icon-plain" aria-label="返回" onClick={() => navigate(-1)}>
              <CaretLeft size={16} />
            </button>
            <span>DodoKid 运营后台</span>
            <span aria-hidden>/</span>
            <span className="current">{crumbLabel(location.pathname)}</span>
          </div>
          <Dropdown menu={userMenu} trigger={['click']}>
            <button className="btn btn-secondary btn-sm" aria-label="当前用户菜单">
              {user?.phone}
              <span className="module-tag" style={{ height: 18 }}>{user?.role}</span>
            </button>
          </Dropdown>
        </header>
        <main className="admin-content" id="main">
          <Outlet />
        </main>
      </div>
    </div>
  );

  function userNavVisible(perm: Permission): boolean {
    return navPerms(user?.role).includes(perm);
  }
}

function navPerms(role: AdminShellRole | undefined): Permission[] {
  if (role === 'admin') {
    return ['content.read', 'media.read', 'users.manage', 'audit.read', 'settings.manage'];
  }
  if (role === 'editor') return ['content.read', 'media.read'];
  return [];
}
type AdminShellRole = 'editor' | 'admin' | 'parent';

function crumbLabel(path: string): string {
  if (path.startsWith('/dashboard')) return '概览';
  if (path.startsWith('/contents/new')) return '新建内容';
  if (path.includes('/revisions')) return '版本历史';
  if (path.includes('/edit')) return '编辑内容';
  if (path.startsWith('/contents')) return '内容列表';
  if (path.startsWith('/media')) return '媒体库';
  if (path.startsWith('/modules')) return '模块与分类';
  if (path.startsWith('/users')) return '用户与角色';
  if (path.startsWith('/audit')) return '审计日志';
  if (path.startsWith('/settings')) return '后台设置';
  return '';
}
