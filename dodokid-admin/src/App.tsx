import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AppThemeProvider } from './theme/AppThemeProvider';
import { AuthProvider, useAuth } from './stores/auth';
import type { Permission } from './stores/auth';
import { AdminShell, PermissionDeniedPage } from './layout/AdminShell';
import { ConfirmProvider, ToastProvider } from './shared/components';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ContentsListPage } from './features/contents/ContentsListPage';
import { ContentFormPage } from './features/contents/ContentFormPage';
import { RevisionsPage } from './features/contents/RevisionsPage';
import { MediaPage } from './features/media/MediaPage';
import { ModulesPage } from './features/modules/ModulesPage';
import { UsersPage } from './features/users/UsersPage';
import { AuditPage } from './features/audit/AuditPage';
import { SettingsPage } from './features/settings/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 },
  },
});

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequirePerm({ perm, label, children }: { perm: Permission; label: string; children: ReactNode }) {
  const { can } = useAuth();
  if (can(perm)) return <>{children}</>;
  return <PermissionDeniedPage permLabel={label} />;
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AdminShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'contents', element: <ContentsListPage /> },
      { path: 'contents/new', element: <ContentFormPage /> },
      { path: 'contents/:id/edit', element: <ContentFormPage /> },
      { path: 'contents/:id/revisions', element: <RevisionsPage /> },
      { path: 'media', element: <MediaPage /> },
      { path: 'modules', element: <ModulesPage /> },
      {
        path: 'users',
        element: (
          <RequirePerm perm={"users.manage" as Permission} label="用户与角色">
            <UsersPage />
          </RequirePerm>
        ),
      },
      {
        path: 'audit',
        element: (
          <RequirePerm perm={"audit.read" as Permission} label="审计日志">
            <AuditPage />
          </RequirePerm>
        ),
      },
      {
        path: 'settings',
        element: (
          <RequirePerm perm={"settings.manage" as Permission} label="后台设置">
            <SettingsPage />
          </RequirePerm>
        ),
      },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
]);

export default function App() {
  return (
    <AppThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <RouterProvider router={router} />
            </AuthProvider>
          </QueryClientProvider>
        </ConfirmProvider>
      </ToastProvider>
    </AppThemeProvider>
  );
}
