/**
 * API 类型契约 — 依据 dodokid/cloudbase/openapi.yaml v1.1.0（admin 端点）。
 * 前后端类型不一致 = 编译错误；变更须经架构师同步 openapi.yaml。
 */

export type Role = 'parent' | 'editor' | 'admin';
export type UserStatus = 'active' | 'disabled';
export type ContentStatus = 'draft' | 'in_review' | 'published' | 'archived';
export type ContentType = 'book' | 'song' | 'habit';
export type AgeGroup = '3-4' | '4-6';
export type SortField = 'updatedAt' | 'createdAt' | 'title' | 'order';

export interface ApiEnvelope<T> {
  success: boolean;
  code: number; // 0 ok | 40000 validation | 40100 unauthorized | 40300 forbidden | 40400 not found | 40900 conflict | 42900 rate limit
  message: string;
  data: T;
}

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface Paged<T> {
  items: T[];
  meta: PageMeta;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AdminUser {
  id: string;
  phone: string; // masked
  role: Role;
  status: UserStatus;
  createdAt: string;
}

export interface AdminStats {
  contentTotal: number;
  byStatus: Record<ContentStatus, number>;
  pendingReview: number;
  mediaTotal: number;
  recentAudit: AuditEntry[];
}

export interface AdminContent {
  _id: string;
  moduleKey: string;
  type: ContentType;
  ageGroup: AgeGroup;
  title: string;
  summary: string | null;
  cover: string | null; // cdnKey
  mediaRef: string | null;
  tags: string[];
  order: number;
  locale: string;
  /** v1.2.1：试读样章（App 首页试读入口）；admin-only 可写，editor 写入返回 40300 */
  isSample: boolean;
  status: ContentStatus;
  version: number;
  authorId: string;
  reviewerId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentCreate {
  moduleKey: string;
  type: ContentType;
  ageGroup: AgeGroup;
  title: string;
  summary?: string;
  cover?: string;
  mediaRef?: string;
  tags?: string[];
  order?: number;
  locale?: string;
  /** v1.2.1：admin-only 可写 */
  isSample?: boolean;
}

export interface ContentUpdate {
  expectedVersion: number;
  title?: string;
  summary?: string | null;
  cover?: string | null;
  mediaRef?: string | null;
  tags?: string[];
  order?: number;
  locale?: string;
  /** v1.2.1：admin-only 可写 */
  isSample?: boolean;
}

export interface ContentRevision {
  _id: string;
  contentId: string;
  version: number;
  action: 'submit' | 'approve' | 'publish' | 'reject' | 'restore';
  note: string | null;
  authorId: string;
  createdAt: string;
}

/** POST /admin/contents/:id/publish（v1.2.0，draft→published，admin-only） */
export interface ContentPublishBody {
  expectedVersion?: number;
}

/** POST /admin/contents/:id/duplicate（v1.2.0，editor+，源任意态） */
export interface ContentDuplicateBody {
  title?: string;
}

export interface AdminModule {
  _id: string;
  key: string;
  name: string;
  colorToken: string;
  iconKey: string; // Phosphor icon name
  order: number;
  enabled: boolean;
}

export interface ModuleUpsert {
  key: string;
  name: string;
  colorToken?: string;
  iconKey?: string;
  order?: number;
  enabled?: boolean;
}

export interface ContentCategory {
  _id: string;
  key: string;
  name: string;
  order: number;
  enabled: boolean;
}

export interface CategoryUpsert {
  key: string;
  name: string;
  order?: number;
  enabled?: boolean;
}

export interface AdminMediaAsset {
  _id: string;
  itemId: string | null;
  folder: string;
  fileName: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  cdnKey: string;
  url: string;
  uploadedBy: string;
  createdAt: string;
}

export interface MediaUploadRequest {
  folder: 'books' | 'songs' | 'covers' | 'icons' | 'misc';
  fileName: string;
  mime: string;
  size: number;
  itemId?: string | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
}

export interface MediaUploadResult {
  mediaId: string;
  cdnKey: string;
  cdnUrl: string;
  upload: {
    tmpSecretId: string;
    tmpSecretKey: string;
    sessionToken: string;
    storagePath: string;
    expiresInSec: number;
    maxFileSize: number;
  };
}

export interface AuditEntry {
  _id: string;
  actor: string;
  actorRole: 'editor' | 'admin';
  action: string;
  targetType: string;
  targetId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  ts: string;
}

export interface AdminSettings {
  mediaMaxSizeMB: number;
  allowedMimeTypes: string[];
  defaultLocale: string;
  paginationLimit: number;
}

export interface ContentsQuery {
  moduleKey?: string[];
  type?: string;
  ageGroup?: string;
  status?: string;
  q?: string;
  page?: number;
  limit?: number;
  sort?: SortField;
  order?: 'asc' | 'desc';
}
