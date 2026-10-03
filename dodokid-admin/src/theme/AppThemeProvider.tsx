/**
 * AppThemeProvider — AntD 5 ConfigProvider Token 严格映射 docs/design-tokens-admin.json。
 * 项目总监裁决：colorPrimary=accent.strong（AA 达标 4.95:1）、borderRadius=8、fontSize=14、
 * 表格行高 44px / 表头 40px；Ant 仅用于 Table/Form/Upload/Modal/Pagination/Select 重型组件。
 * Token 唯一来源：src/theme/design-tokens-admin.json（与 docs 同源拷贝）。
 */
import type { ReactNode } from 'react';
import { App as AntApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import tokens from './design-tokens-admin.json';

const c = {
  bg: tokens.color.surface.bg.value,
  surface: tokens.color.surface.default.value,
  sunken: tokens.color.surface.sunken.value,
  hover: tokens.color.surface.hover.value,
  border: tokens.color.border.default.value,
  borderSoft: tokens.color.border.soft.value,
  fg: tokens.color.fg.default.value,
  fg2: tokens.color.fg['2'].value,
  muted: tokens.color.fg.muted.value,
  disabled: tokens.color.fg.disabled.value,
  accentStrong: tokens.color.accent.strong.value,
  success: tokens.color.semantic.success.value,
  warn: tokens.color.semantic.warn.value,
  danger: tokens.color.semantic.danger.value,
};

export function AppThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          // 品牌色：accent-strong 才可作交互色（白字 4.95:1）；accent.default 禁白底小字
          colorPrimary: c.accentStrong,
          colorInfo: c.accentStrong,
          colorLink: c.accentStrong,
          colorSuccess: c.success,
          colorWarning: c.warn,
          colorError: c.danger,
          // 中性面
          colorBgLayout: c.bg,
          colorBgContainer: c.surface,
          colorBgElevated: c.surface,
          colorBorder: c.border,
          colorBorderSecondary: c.borderSoft,
          colorText: c.fg,
          colorTextSecondary: c.fg2,
          colorTextTertiary: c.muted,
          colorTextDisabled: c.disabled,
          // 形状与字号
          borderRadius: 8,
          controlHeight: 36,
          fontSize: 14,
          fontFamily: tokens.font.family.body.value,
        },
        components: {
          // 表格对齐设计：行高 44px、表头 40px、斑马纹与 hover 走 Token
          Table: {
            headerBg: c.sunken,
            cellPaddingBlock: 12,
            cellPaddingInline: 12,
            headerSplitColor: 'transparent',
            rowHoverBg: c.hover,
            rowSelectedBg: tokens.color.accent.soft.value,
            rowSelectedHoverBg: tokens.color.accent.soft.value,
          },
          Pagination: { itemSize: 32 },
          Modal: {
            borderRadiusLG: 12,
            contentBg: c.surface,
            headerBg: c.surface,
          },
        },
      }}
    >
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
}
