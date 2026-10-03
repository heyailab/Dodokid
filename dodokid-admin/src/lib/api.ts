/** Admin API 客户端 — 与 openapi.yaml admin 端点一一对应。 */
import { del, get, post, put, qs } from './http';
import type {
  AdminContent,
  AdminMediaAsset,
  AdminModule,
  AdminSettings,
  AdminStats,
  AdminUser,
  AuditEntry,
  AuthTokens,
  CategoryUpsert,
  ContentCategory,
  ContentCreate,
  ContentRevision,
  ContentUpdate,
  ContentsQuery,
  MediaUploadRequest,
  MediaUploadResult,
  ModuleUpsert,
  Paged,
} from '../types/api';

export interface LoginResult {
  user: AdminUser;
  tokens: AuthTokens;
}

export const adminApi = {
  // ---- auth ----
  login: (account: string, password: string) =>
    post<LoginResult>('/admin/auth/login', { account, password }),
  logout: () => post<void>('/admin/auth/logout'),
  me: () => get<AdminUser>('/admin/auth/me'),

  // ---- stats ----
  stats: () => get<AdminStats>('/admin/stats'),

  // ---- contents ----
  listContents: (q: ContentsQuery) =>
    get<Paged<AdminContent>>(
      `/admin/contents${qs({
        moduleKey: q.moduleKey,
        type: q.type,
        ageGroup: q.ageGroup,
        status: q.status,
        q: q.q,
        page: q.page,
        limit: q.limit,
        sort: q.sort,
        order: q.order,
      })}`,
    ),
  getContent: (id: string) => get<{ item: AdminContent; media: AdminMediaAsset[] }>(`/admin/contents/${id}`),
  createContent: (body: ContentCreate) => post<AdminContent>('/admin/contents', body),
  updateContent: (id: string, body: ContentUpdate) => put<AdminContent>(`/admin/contents/${id}`, body),
  deleteContent: (id: string) => del<void>(`/admin/contents/${id}`),
  submitContent: (id: string, note?: string) => post<AdminContent>(`/admin/contents/${id}/submit`, { note }),
  approveContent: (id: string) => post<AdminContent>(`/admin/contents/${id}/approve`),
  /** v1.2.0：draft → published（admin-only），可选乐观锁，409 表示版本冲突 */
  publishContent: (id: string, expectedVersion?: number) =>
    post<AdminContent>(`/admin/contents/${id}/publish`, expectedVersion === undefined ? undefined : { expectedVersion }),
  /** v1.2.0：in_review → draft（editor+），无新版本快照，清 reviewerId */
  withdrawContent: (id: string) => post<AdminContent>(`/admin/contents/${id}/withdraw`),
  /** v1.2.0：复制为新草稿（editor+，源任意态），title 缺省由后端生成「{title} (副本)」 */
  duplicateContent: (id: string, title?: string) =>
    post<AdminContent>(`/admin/contents/${id}/duplicate`, title ? { title } : undefined),
  rejectContent: (id: string, reason: string) => post<AdminContent>(`/admin/contents/${id}/reject`, { reason }),
  unpublishContent: (id: string) => post<AdminContent>(`/admin/contents/${id}/unpublish`),
  archiveContent: (id: string) => post<AdminContent>(`/admin/contents/${id}/archive`),
  listRevisions: (id: string, page = 1, limit = 20) =>
    get<Paged<ContentRevision>>(`/admin/contents/${id}/revisions${qs({ page, limit })}`),
  restoreRevision: (id: string, revisionId: string) =>
    post<AdminContent>(`/admin/contents/${id}/restore/${revisionId}`),
  previewContent: (id: string) => get<unknown>(`/admin/contents/${id}/preview`),

  // ---- catalog ----
  listModules: () => get<AdminModule[]>('/admin/modules'),
  createModule: (body: ModuleUpsert) => post<AdminModule>('/admin/modules', body),
  updateModule: (id: string, body: ModuleUpsert) => put<AdminModule>(`/admin/modules/${id}`, body),
  deleteModule: (id: string) => del<void>(`/admin/modules/${id}`),
  listCategories: () => get<ContentCategory[]>('/admin/categories'),
  createCategory: (body: CategoryUpsert) => post<ContentCategory>('/admin/categories', body),
  updateCategory: (id: string, body: CategoryUpsert) => put<ContentCategory>(`/admin/categories/${id}`, body),
  deleteCategory: (id: string) => del<void>(`/admin/categories/${id}`),

  // ---- media ----
  listMedia: (params: { folder?: string; itemId?: string; mime?: string; page?: number; limit?: number }) =>
    get<Paged<AdminMediaAsset>>(`/admin/media${qs(params)}`),
  requestUpload: (body: MediaUploadRequest) => post<MediaUploadResult>('/admin/media', body),
  getMedia: (id: string) => get<AdminMediaAsset>(`/admin/media/${id}`),
  deleteMedia: (id: string) => del<void>(`/admin/media/${id}`),

  // ---- users ----
  listUsers: (params: { role?: string; status?: string; page?: number; limit?: number }) =>
    get<Paged<AdminUser>>(`/admin/users${qs(params)}`),
  changeUserRole: (id: string, role: 'editor' | 'admin') =>
    put<AdminUser>(`/admin/users/${id}/role`, { role }),
  changeUserStatus: (id: string, status: 'active' | 'disabled') =>
    put<AdminUser>(`/admin/users/${id}/status`, { status }),

  // ---- audit ----
  listAudit: (params: {
    actor?: string;
    action?: string;
    targetType?: string;
    targetId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) => get<Paged<AuditEntry>>(`/admin/audit${qs(params)}`),

  // ---- settings ----
  getSettings: () => get<AdminSettings>('/admin/settings'),
  updateSettings: (body: AdminSettings) => put<AdminSettings>('/admin/settings', body),
};
