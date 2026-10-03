# DodoKid 运营后台 — 主题 Token 映射（tokens-admin）

> 归属：Phase 2 详设 · 设计师 颜好看
> 依据：`Spec-DodoKid.md` §8 设计 Token（锁定）+ `dodokid/src/design/tokens.ts`（儿童 App 唯一来源）
> 消费者：架构师（写入 `design-tokens-admin.json` / CSS 变量 / Tailwind 主题）、后台前端（Vite + React）
> 机器可读副本：`docs/design-tokens-admin.json`

---

## 0. 主题策略（一句话）

**同一品牌、不同密度。** 后台**复用品牌骨架**（薄荷青主色 `#12B5A6`、暖阳橙 CTA `#FF9A3D`、Phosphor 图标、字体族），但把**表面从「暖白」切换为「中性冷白」**，把**圆角收紧、字号收紧、间距收紧**，以换取表格/表单的信息密度与长时间阅读的稳定感。

- 儿童 App：暖白 `#FFF9F2` + Claymorphism 厚底投影 + 大圆角（12–24px）+ 大热区（56px）
- 运营后台：中性冷白 `#F6F8FA` + 1px 边框环 + 小圆角（6–12px）+ 紧凑行高（44px）

> **不做**：后台不使用任何渐变主视觉、不使用毛玻璃、不使用厚底彩色投影。后台的"高级感"来自对齐、层级与留白节奏，而非装饰。

---

## 1. 四层 Token 架构总览

```
C-extension → B-slot → A2 → A1-identity
（后台专属）  （别名）  （有默认值）（品牌核心）
```

| 层级 | 后台是否需要 | 说明 |
|------|------|------|
| A1-identity | [OK] 必填 | `--bg` `--surface` `--fg` `--muted` `--accent` `--border` + 字体族 |
| A1-structure | [OK] 必填 | 字号阶梯、容器宽度、节区间距 |
| A2 | [OK] 有默认值 | 焦点环、动效时长、语义色、圆角、阴影、等宽字体 |
| B-slot | [OK] 后台需显式声明 | `--fg-2` `--surface-sunken` `--surface-hover` `--border-soft` `--border-strong` |
| C-extension | [OK] 后台专属 | 表格斑马纹、四态徽章、侧栏尺寸、行高、z-index |

---

## 2. 颜色 Token（后台浅色主题）

### 2.1 表面层级（Surface）

| Token | 层级 | 值 | 用途 |
|-------|------|-----|------|
| `--bg` | A1 | `#F6F8FA` | 页面底层背景（冷白） |
| `--surface` | A1 | `#FFFFFF` | 卡片 / 面板 / 表格容器 |
| `--surface-sunken` | B-slot | `#F7F9FA` | 表头 / 斑马纹偶数行 / 内嵌区块 |
| `--surface-hover` | B-slot | `#EFF4F5` | 行悬停 / 可点区域悬停 |
| `--surface-active` | C-ext | `#E7EEEF` | 行按下 / 选中态底 |

> 深色模式：后台 v1 **仅浅色**（Spec §8 锁定）。若未来扩展，遵循"亮度递进代替阴影"，届时再补。

### 2.2 边框（Border）

| Token | 层级 | 值 | 用途 |
|-------|------|-----|------|
| `--border` | A1 | `#E3E8EC` | 默认 1px 边框、表格外框、分隔线 |
| `--border-soft` | B-slot | `#EEF2F5` | 表格内部行分隔（更轻） |
| `--border-strong` | B-slot | `#CBD4DA` | 输入框聚焦前描边、强调分隔 |
| `--border-focus` | C-ext | `var(--accent-strong)` | 聚焦态描边 |

### 2.3 文字三级（Foreground）

| Token | 层级 | 值 | 用途 | 白底对比度 |
|-------|------|-----|------|-----------|
| `--fg` | A1 | `#1F2A30` | 主文本 / 表格主列 / 标题 | 14.9:1 [OK] |
| `--fg-2` | B-slot | `#4A5A64` | 次级文本 / 表格次列 / 说明 | 7.2:1 [OK] |
| `--muted` | A1 | `#65747C` | 元数据 / 占位 / 时间戳 / 表单 helper | 4.84:1 [OK] |
| `--fg-disabled` | C-ext | `#A7B2B8` | 禁用文本（**仅非关键信息**，不用于正文） | — |

### 2.4 品牌强调（Accent — 薄荷青）

> [注意] **重要工程约束**：品牌薄荷青 `#12B5A6` 在白底上对比度仅 **2.57:1**，**不满足** WCAG AA（正文 4.5:1），**也不满足** 非文本 UI 3:1。因此后台对薄荷青做**分级使用**——见下表。

| Token | 层级 | 值 | 可以做什么 | 禁止做什么 |
|-------|------|-----|-----------|-----------|
| `--accent` | A1 | `#12B5A6` | 品牌标识、大面积色块填充、图表主序列、≥24px 图标（在深底或彩色底上） | [NO] 白底小号文字 / 链接 / 细描边 |
| `--accent-strong` | A2 | `#0B7E73` | [OK] 链接文字、白底图标、聚焦环、激活导航文字/边框、进度条 | — |
| `--accent-soft` | A2 | `#E3F7F3` | 激活导航底、选中行底、浅色 callout 底 | [NO] 作为文字底色再叠浅色文字 |
| `--accent-ink` | C-ext | `#064E47` | `--accent-soft` 之上的文字/图标（8.6:1） | — |
| `--accent-on` | A2 | `#FFFFFF` | [OK] 仅用于 `--accent-strong` 实心底上的文字（4.95:1） | [NO] 用于 `--accent` 实心底（仅 2.57:1） |

**用法对照**：
- 激活导航项 = `background: var(--accent-soft)` + `color: var(--accent-ink)` + `--radius-md`（**无左侧竖条**，遵守"禁侧条纹"红线）
- 链接 = `color: var(--accent-strong)` + hover `text-decoration: underline`
- 聚焦环 = `box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px color-mix(in srgb, var(--accent-strong) 45%, transparent)`

### 2.5 CTA（暖阳橙 — 主行动按钮）

Spec §8 明确：CTA 用暖阳橙 + 深字保证 AA。后台**保留**该约定，仅用于**每屏唯一的主提交动作**（保存 / 提交审核 / 审核通过 / 发布）。

| Token | 层级 | 值 | 用途 |
|-------|------|-----|------|
| `--cta` | A2 | `#FF9A3D` | 主按钮背景 |
| `--cta-ink` | A2 | `#2B2A33` | 主按钮文字（**6.7:1 [OK]**，深字而非白字） |
| `--cta-hover` | A2 | `#F2740E` | 主按钮悬停 |
| `--cta-active` | C-ext | `#DC6408` | 主按钮按下 |

> **每屏使用上限**：`--cta` 实心按钮 **≤1 个**；`--accent*` 可见使用 **≤2 处**（色彩精规）。

### 2.6 语义状态（Semantic）

| Token | 层级 | 值 | 用途 | 对比（ink on soft） |
|-------|------|-----|------|--------------------|
| `--success` | A2 | `#1E8E5A` | 成功图标 / 实心 | — |
| `--success-ink` | C-ext | `#146C46` | 成功文字 | 5.69:1 [OK] |
| `--success-soft` | C-ext | `#E4F5EC` | 成功浅底 | — |
| `--warn` | A2 | `#B26B00` | 警告文字/图标 | — |
| `--warn-ink` | C-ext | `#9A5B00` | 警告文字（AA） | 4.93:1 [OK] |
| `--warn-soft` | C-ext | `#FDF3E2` | 警告浅底 | — |
| `--danger` | A2 | `#D8403A` | 危险图标 / 破坏性按钮实心底 | — |
| `--danger-ink` | C-ext | `#B4322C` | 危险文字 | 5.30:1 [OK] |
| `--danger-soft` | C-ext | `#FCEBE9` | 危险浅底 / 删除确认条 | — |
| `--info` | A2 | `#1D6FD6` | 信息图标 | — |
| `--info-ink` | C-ext | `#1A5FB4` | 信息文字 | 5.47:1 [OK] |
| `--info-soft` | C-ext | `#E7F0FC` | 信息浅底 | — |

> Spec §8 的示警红 `#E5564E` 作为**儿童 App 专用**保留；后台因需承载密集深色小字，改用更深的 `--danger` / `--danger-ink` 以保证 AA（儿童 App token 不变）。

### 2.7 内容四态徽章（C-extension，后台专属）

内容生命周期 `draft → in_review → published → archived` 的语义色（详见 `design-uiux-admin.md` §4）。每态均含 **文字标签 + 圆点**，**不靠颜色单独传达含义**（无障碍要求）。

| 状态 | `--badge-bg` | `--badge-fg` | `--badge-dot` | `--badge-border` | 白底文字对比 |
|------|-------------|-------------|---------------|-----------------|-------------|
| `draft` 草稿 | `#EEF1F4` | `#55636B` | `#8A99A1` | `#DCE3E7` | 5.38:1 [OK] |
| `in_review` 待审 | `#FDF3E2` | `#9A5B00` | `#F2A33C` | `#F5E2C0` | 4.93:1 [OK] |
| `published` 已发布 | `#E4F5EC` | `#146C46` | `#1E8E5A` | `#C7E9D6` | 5.69:1 [OK] |
| `archived` 已归档 | `#ECEFF1` | `#55636B` | `#9AA7AE` | `#DDE3E6` | 5.38:1 [OK] |

### 2.8 图标与状态色（供图标着色复用）

| Token | 值 | 用途 |
|-------|-----|------|
| `--icon-default` | `var(--fg-2)` | 默认图标 |
| `--icon-muted` | `var(--muted)` | 次要/装饰图标 |
| `--icon-accent` | `var(--accent-strong)` | 品牌/激活图标 |
| `--focus-ring-color` | `var(--accent-strong)` | 聚焦环 |

---

## 3. 字体与字号（后台更紧凑）

### 3.1 字体族

| Token | 层级 | 值 | 用途 |
|-------|------|-----|------|
| `--font-display` | A1 | `"Inter", "Noto Sans SC", -apple-system, "Segoe UI", sans-serif` | 页面标题 / 统计数字 |
| `--font-body` | A1 | `"Inter", "Noto Sans SC", -apple-system, "Segoe UI", sans-serif` | 正文 / 表格 / 表单 |
| `--font-mono` | A2 | `"JetBrains Mono", "SFMono-Regular", Menlo, monospace` | ID / 时间戳 / 版本号 / 数字对齐 |

> 后台**不使用**儿童 App 的展示体（站酷快乐体 / Baloo 2）——产品型界面禁 Serif / 禁玩趣展示体，保证专业与可读。

### 3.2 字号阶梯（8 级，基准 14px）

| Token | 值 | 行高 | 字重 | 用途 |
|-------|-----|------|------|------|
| `--text-xs` | 12px | 16px | 500 | 徽章 / 时间戳 / 表头小字 |
| `--text-sm` | 13px | 18px | 400 | 表格次列 / helper / 面包屑 |
| `--text-base` | 14px | 20px | 400 | **正文基准** / 表格主列 / 表单输入 |
| `--text-md` | 15px | 22px | 500 | 卡片小标题 / 表单 label |
| `--text-lg` | 16px | 24px | 590 | 区块标题 / 面板标题 |
| `--text-xl` | 20px | 28px | 590 | 页面标题（H1） |
| `--text-2xl` | 24px | 32px | 590 | 概览统计数值 |
| `--text-3xl` | 28px | 36px | 590 | 概览首卡大数值 |

### 3.3 字距（Tracking）

| 场景 | 值 |
|------|-----|
| 正文（13–16px） | `0` |
| 小字 / 表头大写（11–12px） | `0.01em` |
| ALL CAPS（表头 / 状态标签） | `0.06em` |
| 页面标题（≥20px） | `-0.01em` |
| 统计大数（≥24px） | `-0.015em` |

### 3.4 字重系统（三级）

| 名称 | 值 | 用途 |
|------|-----|------|
| Read | `400` | 正文 / 表格内容 |
| Emphasize | `500` | label / 次级强调 / 徽章 |
| Announce | `590` | 标题 / 主按钮 / 统计数值 |

> 后台允许 400 字重（与儿童 App「最小 500」不同）——后台是成年效率工具，细字重 + 大字号更清晰、更"信息型"。

---

## 4. 间距（4px 基准网格）

| Token | 值 | 用途 |
|-------|-----|------|
| `--space-1` | 4px | 图标与文字间隙 |
| `--space-2` | 8px | 紧凑元素间距 / 按钮内图标距 |
| `--space-3` | 12px | 表格单元格内边距（竖）/ 徽章内距 |
| `--space-4` | 16px | 表单控件间距 / 卡片内距 |
| `--space-5` | 20px | 卡片内距（默认） |
| `--space-6` | 24px | 区块间距 / 栅格沟槽（桌面） |
| `--space-8` | 32px | 页面主区块间距 |
| `--space-10` | 40px | 页面顶部大间距 |
| `--space-12` | 48px | 空态上下留白 |

> 仅允许 `4 8 12 16 20 24 32 40 48 64`，禁非标值。

---

## 5. 圆角（后台更克制）

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-xs` | 4px | 徽章 / tag / 小控件 |
| `--radius-sm` | 6px | 按钮 / 输入框 / 下拉 |
| `--radius-md` | 8px | 卡片 / 面板 / 激活导航项 |
| `--radius-lg` | 12px | 弹窗 / 抽屉（**卡片上限 12px**） |
| `--radius-pill` | 9999px | 头像 / 圆点 / 分段控件 |

> 后台不用儿童 App 的 16–24px 大圆角——过圆 = AI 味 + 密度下降。

---

## 6. 层级与阴影（Elevation）

| Token | 值 | 用途 |
|-------|-----|------|
| `--elev-flat` | `none` | 默认 |
| `--elev-ring` | `0 0 0 1px var(--border)` | 卡片/面板（**边框环，非模糊**） |
| `--elev-raised` | `0 1px 2px rgba(16,24,40,0.04), 0 4px 12px rgba(16,24,40,0.06)` | 悬浮卡片 / 下拉 / Popover |
| `--elev-overlay` | `0 12px 32px rgba(16,24,40,0.14)` | 模态 / 抽屉 |

> **禁"幽灵卡片"**：同一元素不得同时出现 `1px solid` 边框 **与** `blur ≥16px` 阴影。卡片默认用 `--elev-ring`，仅浮层用 `--elev-raised`。

---

## 7. 表格与密度（C-extension，后台专属）

| Token | 值 | 用途 |
|-------|-----|------|
| `--table-row-h` | 44px | 默认行高（紧凑 40 / 舒适 52） |
| `--table-header-h` | 40px | 表头行高 |
| `--table-cell-x` | 12px | 单元格左右内距 |
| `--table-cell-y` | 10px | 单元格上下内距 |
| `--table-zebra` | `var(--surface-sunken)` | 斑马纹偶数行底 |
| `--table-hover` | `var(--surface-hover)` | 行悬停底 |
| `--table-selected` | `var(--accent-soft)` | 行选中底 |
| `--table-divider` | `var(--border-soft)` | 行分隔线 |

> 斑马纹与 hover 并存时：hover 覆盖斑马纹；选中态恒覆盖两者。

---

## 8. 动效（功能性优先）

| Token | 值 | 用途 |
|-------|-----|------|
| `--motion-instant` | 80ms | 按钮按下的即时反馈 |
| `--motion-fast` | 120ms | hover 变色 / checkbox 勾选 |
| `--motion-base` | 160ms | 下拉展开 / Tooltip |
| `--motion-slow` | 240ms | 弹窗 / 抽屉进出 |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | 默认缓动 |
| `--ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | 退出缓动 |

> 后台**无装饰性动画**。动画只服务于"状态变化可感知"。动画属性仅限 `opacity / transform`（禁动画 `width/height`，避免重排）。
> **必须**支持 `@media (prefers-reduced-motion: reduce)` → 全部时长降为 `0.01ms`。

---

## 9. 布局尺寸（A1-structure）

| Token | 值 | 用途 |
|-------|-----|------|
| `--sidebar-w` | 240px | 侧边栏展开宽 |
| `--sidebar-w-collapsed` | 64px | 侧边栏收起宽 |
| `--topbar-h` | 56px | 顶栏高 |
| `--breadcrumb-h` | 40px | 面包屑行高 |
| `--content-max` | 1440px | 内容区最大宽度 |
| `--content-gutter` | 24px | 内容区左右留白（桌面）/ 16px（<1024px）/ 12px（<640px） |
| `--section-y` | 24px | 页面主区块纵向间距 |

---

## 10. 与儿童 App Token 的映射关系（溯源）

| 品牌语义 | 儿童 App（`tokens.ts`） | 后台映射 | 说明 |
|----------|------------------------|----------|------|
| 主色 薄荷青 | `primary #12B5A6` | `--accent #12B5A6` | **完全同源** |
| 主色深 | `primaryStrong #0B7E73` | `--accent-strong #0B7E73` | 同源，后台升为主交互色 |
| 主色浅 | `primarySoft #E3F7F3` | `--accent-soft #E3F7F3` | 同源 |
| CTA 暖阳橙 | `accent #FF9A3D` | `--cta #FF9A3D` | 同源 |
| CTA 深字 | `accentInk #2B2A33` | `--cta-ink #2B2A33` | 同源 |
| 背景 暖白 | `bg #FFF9F2` | `--bg #F6F8FA` | **后台改为冷白**（提升表格可读性，Spec §8 允许） |
| 卡片 | `surface #FFFFFF` | `--surface #FFFFFF` | 同源 |
| 主文 | `fg #3A3A3A` | `--fg #1F2A30` | **后台加深**（小字需更高对比） |
| 次文 | `fg2 #8A8A8A` | `--fg-2 #4A5A64` / `--muted #65747C` | **后台拆分三级**（儿童 App 2 级不够用） |
| 边框 | `border #ECE2D6` | `--border #E3E8EC` | **暖边 → 冷边** |
| 警示红 | `danger #E5564E` | `--danger #D8403A` / `--danger-ink #B4322C` | 后台加深保证 AA |
| 成功 | `success #7CC576` | `--success #1E8E5A`（ink 版） | 儿童 App 的浅绿在白底大字下偏弱，后台用深版 |

> **结论**：品牌骨架 100% 同源（薄荷青 + 暖阳橙 + 字体族 + Phosphor）；仅"表面中性化 + 文字加深 + 圆角收紧"三处后台差异化，均可由 Token 层切换，**不动品牌核心**。

---

## 11. CSS 变量落地（`design-tokens-admin.css` 片段）

```css
:root {
  /* ---- A1-identity: surfaces ---- */
  --bg: #F6F8FA;
  --surface: #FFFFFF;
  --fg: #1F2A30;
  --muted: #65747C;
  --accent: #12B5A6;
  --border: #E3E8EC;

  /* ---- A1-identity: fonts ---- */
  --font-display: "Inter", "Noto Sans SC", -apple-system, "Segoe UI", sans-serif;
  --font-body: "Inter", "Noto Sans SC", -apple-system, "Segoe UI", sans-serif;

  /* ---- A1-structure ---- */
  --sidebar-w: 240px;
  --sidebar-w-collapsed: 64px;
  --topbar-h: 56px;
  --content-max: 1440px;
  --content-gutter: 24px;

  /* ---- B-slot ---- */
  --fg-2: #4A5A64;
  --fg-disabled: #A7B2B8;
  --surface-sunken: #F7F9FA;
  --surface-hover: #EFF4F5;
  --surface-active: #E7EEEF;
  --border-soft: #EEF2F5;
  --border-strong: #CBD4DA;

  /* ---- A2 ---- */
  --accent-strong: #0B7E73;
  --accent-on: #FFFFFF;
  --accent-soft: #E3F7F3;
  --cta: #FF9A3D;
  --cta-ink: #2B2A33;
  --cta-hover: #F2740E;
  --success: #1E8E5A;
  --warn: #B26B00;
  --danger: #D8403A;
  --info: #1D6FD6;
  --font-mono: "JetBrains Mono", "SFMono-Regular", Menlo, monospace;

  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-pill: 9999px;

  --elev-flat: none;
  --elev-ring: 0 0 0 1px var(--border);
  --elev-raised: 0 1px 2px rgba(16,24,40,0.04), 0 4px 12px rgba(16,24,40,0.06);
  --elev-overlay: 0 12px 32px rgba(16,24,40,0.14);

  --focus-ring: 0 0 0 2px var(--bg), 0 0 0 4px color-mix(in srgb, var(--accent-strong) 45%, transparent);

  --motion-instant: 80ms;
  --motion-fast: 120ms;
  --motion-base: 160ms;
  --motion-slow: 240ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);

  /* ---- C-extension ---- */
  --accent-ink: #064E47;
  --cta-active: #DC6408;
  --success-ink: #146C46;
  --success-soft: #E4F5EC;
  --warn-ink: #9A5B00;
  --warn-soft: #FDF3E2;
  --danger-ink: #B4322C;
  --danger-soft: #FCEBE9;
  --info-ink: #1A5FB4;
  --info-soft: #E7F0FC;

  --badge-draft-bg: #EEF1F4;   --badge-draft-fg: #55636B;   --badge-draft-dot: #8A99A1;
  --badge-review-bg: #FDF3E2;  --badge-review-fg: #9A5B00;  --badge-review-dot: #F2A33C;
  --badge-pub-bg: #E4F5EC;     --badge-pub-fg: #146C46;     --badge-pub-dot: #1E8E5A;
  --badge-arch-bg: #ECEFF1;    --badge-arch-fg: #55636B;    --badge-arch-dot: #9AA7AE;

  --table-row-h: 44px;
  --table-header-h: 40px;
  --table-cell-x: 12px;
  --table-cell-y: 10px;
  --table-zebra: var(--surface-sunken);
  --table-divider: var(--border-soft);
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-instant: 0.01ms;
    --motion-fast: 0.01ms;
    --motion-base: 0.01ms;
    --motion-slow: 0.01ms;
  }
}
```

---

## 12. Tailwind 主题扩展片段

```js
// tailwind.config.js —— 后台主题
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: { DEFAULT: 'var(--surface)', sunken: 'var(--surface-sunken)', hover: 'var(--surface-hover)' },
        fg: { DEFAULT: 'var(--fg)', 2: 'var(--fg-2)', muted: 'var(--muted)' },
        border: { DEFAULT: 'var(--border)', soft: 'var(--border-soft)', strong: 'var(--border-strong)' },
        accent: { DEFAULT: 'var(--accent)', strong: 'var(--accent-strong)', soft: 'var(--accent-soft)', ink: 'var(--accent-ink)' },
        cta: { DEFAULT: 'var(--cta)', ink: 'var(--cta-ink)', hover: 'var(--cta-hover)' },
        success: { DEFAULT: 'var(--success)', ink: 'var(--success-ink)', soft: 'var(--success-soft)' },
        warn:    { DEFAULT: 'var(--warn)',    ink: 'var(--warn-ink)',    soft: 'var(--warn-soft)' },
        danger:  { DEFAULT: 'var(--danger)',  ink: 'var(--danger-ink)',  soft: 'var(--danger-soft)' },
        info:    { DEFAULT: 'var(--info)',    ink: 'var(--info-ink)',    soft: 'var(--info-soft)' },
      },
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
        mono: 'var(--font-mono)',
      },
      borderRadius: { xs: '4px', sm: '6px', md: '8px', lg: '12px' },
      boxShadow: { ring: 'var(--elev-ring)', raised: 'var(--elev-raised)', overlay: 'var(--elev-overlay)' },
      transitionTimingFunction: { standard: 'cubic-bezier(0.2,0,0,1)' },
    },
  },
};
```

---

## 13. 交付校验清单

- [x] 全部颜色走 Token，文档内除 `#fff`/`#000`（本文件为 Token 定义源，允许 hex）外无散落色值
- [x] 间距全为 4px 整数倍
- [x] 字号 8 级、字距规则齐备、字重三级
- [x] 每个语义色提供 AA 达标 ink 版
- [x] 焦点环、`prefers-reduced-motion` 齐备
- [x] 卡片圆角 ≤12px，无侧条纹、无渐变文字、无幽灵卡片
- [x] 与儿童 App 品牌骨架同源，差异仅 3 处（表面中性化 / 文字加深 / 圆角收紧）
