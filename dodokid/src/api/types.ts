/**
 * DodoKid API 类型契约（对齐 Spec §5 端点与后端 openapi.yaml）。
 * 后端工程师产出 openapi.yaml 后，本文件应保持字段一致。
 */

import type { ModuleKey } from '../design/tokens';

export type AgeGroup = '3-4' | '4-6';

/** 统一响应外壳（后端约定：成功 data 包裹，错误 code+message） */
export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

/* ----------------------------- 家长 / 鉴权 ----------------------------- */

export interface ParentRegisterReq {
  phone: string;
  smsCode: string;
  password: string;
}
export interface ParentLoginReq {
  phone: string;
  password: string;
}
export interface AuthResult {
  token: string;
  parentId: string;
}
export interface SendSmsReq {
  phone: string;
}
export interface VerifyCodeReq {
  phone: string;
  smsCode: string;
}

/* ----------------------------- 儿童档案 ----------------------------- */

export interface ChildProfile {
  id: string;
  name: string;
  ageGroup: AgeGroup;
  avatarColor: string; // 取 design token 模块色之一
  createdAt: string; // ISO
  /** 是否已写入家长同意记录（合规闸） */
  consentRecorded: boolean;
}

export interface ChildCreateReq {
  name: string;
  ageGroup: AgeGroup;
  /** 创建前必须已记录同意；不采集位置/麦克风/通讯录 */
  consentVersion: string;
}
export interface ChildSwitchReq {
  childId: string;
}

/* ----------------------------- 内容 / 绘本 ----------------------------- */

export interface QuizOption {
  label: string;
}
export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
  answerIndex: number;
}
export interface BookPage {
  index: number;
  imageUrl: string;
  text: string;
  /** 旁白音频（已缓存到本地则为本地产权路径） */
  audioUrl: string;
  questions: QuizQuestion[];
}
export interface ContentItem {
  id: string;
  title: string;
  module: ModuleKey;
  /** 内容版本号（离线缓存一致性比对用） */
  version: string;
  /** 适配年龄段（年龄路由：仅展示该龄内容） */
  ageGroups: AgeGroup[];
  coverUrl: string;
  /** 是否为试读样章（未登录/未购也可读） */
  sample: boolean;
  pageCount: number;
  summary: string;
  pages: BookPage[];
}
export interface ContentCategory {
  key: ModuleKey;
  label: string;
  color: string;
}
export interface ContentListQuery {
  ageGroup?: AgeGroup;
  module?: ModuleKey;
  keyword?: string;
}

/* ----------------------------- 进度 ----------------------------- */

export interface ReadProgress {
  childId: string;
  contentId: string;
  pageIndex: number;
  completed: boolean;
  score: number; // 跟读/问答累计得分 0-100
  updatedAt: string;
}
export interface ProgressSnapshot {
  childId: string;
  /** 各内容进度 map */
  items: Record<string, ReadProgress>;
  totalReadSec: number;
}
export interface ProgressUpsertReq {
  contentId: string;
  pageIndex: number;
  completed?: boolean;
  score?: number;
}

/* ----------------------------- 徽章 / 里程碑 ----------------------------- */

export type MilestoneType = 'star' | 'badge' | 'streak';
export interface Milestone {
  id: string;
  childId: string;
  type: MilestoneType;
  title: string;
  icon: string; // phosphor 图标名
  unlockedAt: string | null;
}

/* ----------------------------- 家长设置 / 护眼 ----------------------------- */

export interface ParentSettings {
  timeLimitSec: number; // 每日时长上限（秒）
  weekReportEnabled: boolean;
}
export interface TimeLimitUpdateReq {
  timeLimitSec: number;
}

/* ----------------------------- 家长锁验证 ----------------------------- */

export type GateMethod = 'biometric' | 'password';
export interface GateVerifyReq {
  method: GateMethod;
  /** password 时为家长密码；biometric 时由系统生物识别后置 true */
  payload?: string;
}
export interface GateVerifyResult {
  ok: boolean;
  /** 验证失败时给儿童的模糊提示，不暴露具体原因 */
  hint?: string;
}

/* ----------------------------- 同意 / 偏好 / 反馈 ----------------------------- */

export interface ConsentRecord {
  childId: string;
  category: 'data_processing' | 'audio_record' | 'analytics';
  grantedAt: string;
  version: string;
}
export interface PreferencesUpdateReq {
  childId: string;
  reducedMotion?: boolean;
  audioNarration?: boolean;
}
export interface FeedbackReq {
  childId: string;
  content: string;
  contact?: string;
}

/* ----------------------------- 系统 ----------------------------- */

export interface VersionInfo {
  latest: string;
  current: string;
  forceUpdate: boolean;
  /**
   * 媒体基址（如 `https://dodokid.heymf.cn/media`）。
   * 由后端环境变量 MEDIA_CDN_BASE_URL 下发，前端冷启动时读取并缓存，
   * 使更换媒体域名无需重新打包。字段可选：后端未配置时前端降级到兜底常量。
   */
  mediaBaseUrl?: string;
}
export interface PrivacyPolicy {
  version: string;
  url: string;
  updatedAt: string;
}
export interface WeekReport {
  childId: string;
  weekStart: string;
  readSec: number;
  completedCount: number;
  streakDays: number;
  milestones: Milestone[];
}
