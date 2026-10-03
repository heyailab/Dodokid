/**
 * DodoKid Design Tokens — 唯一颜色/圆角/字体/阴影/间距来源。
 *
 * 反 P0-2 规则：除 #fff / #000 外，组件内禁止出现任何十六进制字面量，
 * 一律从这里 import 命名常量。本文件是 token 定义处，允许出现十六进制。
 */

export const colors = {
  // 主色 品牌 薄荷青
  primary: '#12B5A6',
  primaryStrong: '#0B7E73',
  primarySoft: '#E3F7F3',

  // 强调 CTA 暖阳橙
  accent: '#FF9A3D',
  accentInk: '#2B2A33',
  accentStrong: '#F2740E',

  // 成功 / 奖励
  success: '#7CC576',

  // 背景层级
  bg: '#FFF9F2',
  surface: '#FFFFFF',
  surfaceWarm: '#FFF1E6',

  // 文字
  fg: '#3A3A3A',
  fg2: '#8A8A8A',
  border: '#ECE2D6',

  // 语义状态
  warn: '#F2A33C',
  danger: '#E5564E',
  info: '#4DA3FF',

  // 模块内容标签色（仅作标签，不用于主视觉渐变）
  module: {
    book: '#FF7A85', // 绘本共读
    habit: '#FF9F43', // 习惯养成
    song: '#FFD166', // 儿歌音频
    literacy: '#6BCB77', // 识字认知
    math: '#4D96FF', // 数学启蒙
    english: '#9B5DE5', // 英语启蒙
    puzzle: '#FF6F9C', // 益智游戏
  },

  /**
   * 模块强色（无障碍分级，P0）：
   * 白色图标/白字落在 moduleStrong 上均 ≥4.7:1（图标非文本要求 ≥3:1）。
   * module 浅标签色上直接叠白图标只有 1.44–2.95:1，禁止再使用。
   */
  moduleStrong: {
    book: '#B33A47',
    habit: '#B05E12',
    song: '#8A6A14',
    literacy: '#2E7D46',
    math: '#1D5FBF',
    english: '#6C3FC9',
    puzzle: '#B23A6E',
  },
} as const;

export type ThemeColor = (typeof colors)[keyof typeof colors];

/** 圆角体系（Claymorphism 糖果圆润风） */
export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 9999,
} as const;

/** 间距基准（4pt 栅格） */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  x2l: 24,
  x3l: 32,
  x4l: 40,
} as const;

/** 字号（px） */
export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  x2l: 26,
  x3l: 32,
  display: 40,
} as const;

/** 字重（最小 500，禁止更细的正文字重） */
export const fontWeight = {
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
} as const;

/** 字体族：展示 ZCOOL KuaiLe + Baloo 2；正文 Noto Sans SC + Nunito */
export const fontFamily = {
  display: 'ZCOOLKuaiLe',
  displayLatin: 'Baloo2',
  body: 'NotoSansSC',
  bodyLatin: 'Nunito',
} as const;

/** 厚底柔和投影（Claymorphism 关键），按层级递进 */
export const shadow = {
  soft: {
    shadowColor: '#C9A98A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  raised: {
    shadowColor: '#C9A98A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  pressed: {
    shadowColor: '#C9A98A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
} as const;

/** 最小点击热区（P0 可访问性） */
export const hitMin = 56;

/** 护眼常量 */
export const eyeCare = {
  /** 单次连续使用软提示阈值（秒）= 15 分钟 */
  singleSessionSoftLimitSec: 15 * 60,
  /** 默认每日上限（秒）= 40 分钟，家长可改 */
  defaultDailyLimitSec: 40 * 60,
} as const;

/** 将模块 key 映射到其标签色 */
export type ModuleKey =
  | 'book'
  | 'habit'
  | 'song'
  | 'literacy'
  | 'math'
  | 'english'
  | 'puzzle';

export function moduleColor(key: ModuleKey): string {
  return colors.module[key];
}

/** 模块强色：承载白色图标/白字的深色底（对比度 ≥4.7:1，P0 无障碍） */
export function moduleStrongColor(key: ModuleKey): string {
  return colors.moduleStrong[key];
}
