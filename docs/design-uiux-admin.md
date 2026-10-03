# DodoKid 运营后台 — UI/UX 设计方向（design-uiux-admin）

> 归属：Phase 2 详设 · 设计师 颜好看
> 依据：`Spec-DodoKid.md` §7.2 / §8 / §14 · `docs/tokens-admin.md`
> 形态：**独立 Web App**（Vite + React + TS，与儿童 App 分域部署）
> 使用者：成年的**内容运营/编辑（editor）**与**内容负责人（admin）**
> 消费者：架构师（Token 落地 / 组件选型）、后台前端（页面实现）

---

## 1. 设计定位

### 1.1 设计寄存器
**Product 寄存器（产品型）**——设计服务产品，不是产品本身。
- 标杆不是"独特"，是**"赢得熟悉感"**：运营同事打开就知道表格在哪、筛选在哪、保存在哪。
- 参照对象：**Linear / Stripe Dashboard / Vercel / Retool / Sentry / GitHub / Contentful / Sanity Studio**。
- [NO] 不做营销式 Hero、不做品牌情绪页、不做装饰性动效、不做插画主视觉。

### 1.2 三轴刻度标定

| 轴 | 取值 | 后台含义 |
|----|------|----------|
| `DESIGN_VARIANCE` | **2** | 严格栅格、左对齐、对称、可预测。**禁非对称 Hero/艺术留白** |
| `MOTION_INTENSITY` | **2** | 仅 hover / focus / 弹窗进出等功能动效，无持续微动画 |
| `VISUAL_DENSITY` | **7** | 驾驶舱模式：紧凑行高、线分隔为主、少卡片盒子、数字等宽字体 |

### 1.3 平台正交轴
**web**（Chrome / Edge / Safari 最新 2 版，Spec §10）。最小视口 1280×720 为设计基准；≥1024px 为可用下限。

### 1.4 视觉原则（5 条）

1. **数据即主体**：直入表格/表单，无过渡页、无欢迎页。登录后第一屏就是概览数据。
2. **线优于框**：优先用 1px 分隔线（`--border-soft`）组织信息，而非层层卡片套卡片。
3. **动作可预期**：同一动作在全局语义与位置一致（保存恒在右上、危险恒在左且红色）。
4. **状态始终可见**：内容四态、脏值、保存中、权限受限，永远在界面上有明确反馈。
5. **克制用色**：每屏 `--cta` 实心按钮 ≤1、可见 `--accent*` ≤2；其余靠灰阶层级表达。

---

## 2. 信息架构与导航

### 2.1 IA 树（与 Spec §7.2 一一对应）

```
登录 /login
└─ 后台外壳 AdminShell（鉴权后）
   ├─ 概览        /dashboard         admin/stats
   ├─ 内容
   │  ├─ 内容列表  /contents          admin/contents
   │  ├─ 新建内容  /contents/new      admin/contents (POST)
   │  └─ 内容编辑  /contents/:id/edit admin/contents/:id
   │     └─ 版本历史 /contents/:id/revisions   admin/contents/:id/revisions
   ├─ 媒体库      /media             admin/media
   ├─ 模块与分类  /modules           admin/modules + categories
   ├─ 用户与角色  /users             admin/users
   ├─ 审计日志    /audit             admin/audit
   └─ 后台设置    /settings          admin/settings
```

### 2.2 侧边栏（Sidebar）

- 宽 `--sidebar-w` 240px；可收起至 64px（仅图标，Tooltip 补全名称）。收起状态持久化到 localStorage。
- 结构：**品牌区（顶部 56px）→ 主导航（分组）→ 底部身份区**。
- 主导航分组（每组 ≤5 项，符合工作记忆 ≤4±1 原则，超出即分组）：
  - **内容**：内容列表
  - **资源**：媒体库、模块与分类
  - **管理**（admin-only，整组对 editor 隐藏）：用户与角色、审计日志、后台设置
- 导航项：`Phosphor 20px 图标 + --text-base 文字`，行高 36px，圆角 `--radius-md`。
- 状态：
  - Default：`color: var(--fg-2)`，透明底
  - Hover：`background: var(--surface-hover)`，`color: var(--fg)`
  - **Active**：`background: var(--accent-soft)` + `color: var(--accent-ink)` + 图标 `--accent-strong`
    （**无左侧彩色竖条**——遵守"禁侧条纹边框"红线）
  - **权限受限**：见 §7.4，默认**整项隐藏**而非置灰（减少噪音）
- 收起态：仅图标居中；当前项同样用 `--accent-soft` 底 + `--radius-md`。

### 2.3 顶栏（Topbar）

高 `--topbar-h` 56px，`background: var(--surface)`，底部 `1px solid var(--border)`。

| 区域 | 内容 |
|------|------|
| 左 | 面包屑（见 2.4）；移动端折叠为返回箭头 |
| 中 | 全局搜索（仅内容列表页启用，`⌘/Ctrl + K` 唤起，Phosphor `MagnifyingGlass`） |
| 右 | 环境标识（"生产/预发" tag，admin-only）· 帮助入口 · 当前用户菜单（头像 + 姓名 + 角色徽章） |

- 用户菜单项：当前身份（`editor` / `admin` 徽章）、切换密码、登出。
- **不做**通知铃铛堆叠、不做多级下拉迷宫（认知负荷控制）。

### 2.4 面包屑（Breadcrumb）

- 位置：内容区顶部，高 `--breadcrumb-h` 40px，`--text-sm`。
- 规则：`后台名 / 一级 / 二级 / 当前页`；末项为当前页（`--fg` 加粗、不可点），其余项可点（`--accent-strong`）。
- 带状态的页面在面包屑右侧展示**页面态胶囊**（如内容编辑页显示四态徽章 + 版本号 `v3`）。
- 深度 ≤4 级；超过则中间折叠为 `…` + 下拉。

### 2.5 响应式导航策略

| 断点 | 侧边栏 | 表格 | 表单 |
|------|--------|------|------|
| ≥1280px | 常驻 240px | 全列 + 批量操作 | 双列分组 |
| 1024–1280px | 常驻，可收起为 64px | 隐藏次要列 | 双列→单列 |
| 768–1024px | 抽屉（汉堡唤起） | 卡片化行 | 单列 |
| <768px | 抽屉 + 底部主要动作条 | 卡片化行 | 单列 + 粘性保存条 |

> 后台**不做底部 TabBar**（那是移动 App 的范式）；移动端用抽屉侧栏 + 顶部返回。

---

## 3. 页面范式

### 3.1 登录页 `/login`

- 布局：**左表单 480px / 右品牌区**（`DESIGN_VARIANCE=2`，对称分栏，非居中卡片 Hero）。
  - 右品牌区：`background: var(--surface-sunken)` + 薄荷青单色几何纹理（非渐变、非 3D 插画）+ 一句真实定位文案"内容运营后台 · 仅授权人员访问"。
- 表单：`账号(邮箱/手机)` + `密码` + `记住此设备` checkbox。label 常驻可见（**非仅 placeholder**）。
- 校验态：
  - 空/格式错：字段下方 `--danger-ink` 行内错误，`--text-sm`，输入框描边 `--danger`
  - 凭证错：表单顶部 `--danger-soft` 条 + 图标"账号或密码不正确，请重试"（**不区分**账号不存在/密码错，防枚举）
  - 锁定：连续失败 ≥5 次，显示剩余锁定时间
- 提交：`--cta` 实心按钮，全宽；loading 态按钮内 spinner + 文案变"登录中…"且禁用重复提交。
- **禁止**："欢迎回来"式空洞大标题、"注册"入口（后台无自助注册）。

### 3.2 概览 `/dashboard`

- 主体是**真实数据**，不是欢迎语。
- 版块顺序：
  1. **统计条**（4 个 KPI，`--text-2xl` 等宽数字 + `--text-sm` 标签）：内容总数 / 待审核 / 已发布 / 本周新增。数值下方 `--text-xs --muted` 标注统计口径（如"近 7 天"）。
  2. **待审核队列**（admin 关注重点）：`in_review` 内容表（标题 / 模块 / 提交人 / 提交时间 / 操作"审核"）。空时显示 §7.1 空态。
  3. **最近操作**：取 `audit_log` 近 20 条，`时间 / 操作人 / 动作 / 目标`，等宽时间戳。
- 统计卡规格：`--surface` + `--elev-ring`（1px 边框环，**无模糊阴影**）+ `--radius-md` + `--space-5` 内距。
- [NO] 不放大数字渐变、不做环形进度装饰、不做"Hero 指标"套路。

### 3.3 列表页范式（`/contents` `/media` `/users` `/audit` `/modules`）

统一四段式：**页头 → 筛选栏 → 表格 → 分页**。所有列表页共用此骨架。

#### (a) 页头（Page Header）
- 左：页面标题（`--text-xl`）+ 结果计数（`--text-sm --muted`，如"共 128 条"）。
- 右：主操作 `--cta` 实心按钮（如"新建内容"，`Phosphor Plus 20px`）+ 次操作。

#### (b) 筛选栏（FilterBar）
- 布局：`flex wrap`，高 56px，底部 `1px solid var(--border-soft)`。左筛选控件，右"重置/查询"。
- 控件（`/contents`）：
  - 模块：下拉（多选）
  - 年龄段：下拉（多选，3-4 / 4-5 / 5-6）
  - 状态：分段控件（全部 / 草稿 / 待审 / 已发布 / 已归档）——每项带四态圆点
  - 关键词：输入框（防抖 300ms，回车即查）
- **已选筛选以可关闭 chip 回显**在筛选栏下方一行，避免"忘记自己筛了什么"。
- 状态：筛选变化即写 URL query（可分享/可刷新保持，符合"刷新不丢状态"）。

#### (c) 表格（DataTable）
- 结构：`thead`（`--table-header-h` 40px，`--surface-sunken` 底，`--text-xs` 大写追踪标签）+ `tbody` 行（`--table-row-h` 44px）。
- 列（`/contents`）：`checkbox` · `封面缩略图 40×28` · `标题(主列, --fg, 可点击进编辑)` · `模块(色标签)` · `年龄段` · `状态(四态徽章)` · `版本 v{n}` · `更新人` · `更新时间(等宽)` · `行操作(⋯)`。
- **排序**：可排序列头含 `CaretUpDown` 图标（默认 `--muted`），激活列显示 `CaretDown/CaretUp` + `--fg`。点击循环 `无 → 升 → 降`。排序状态写 URL。
- **斑马纹**：偶数行 `--table-zebra`；hover 行 `--table-hover`（覆盖斑马纹）；选中行 `--accent-soft`（覆盖两者）。
- **行分隔**：`1px solid var(--table-divider)`，无外框重描边（表格容器 `--surface` + `--elev-ring`）。
- **列宽**：主列自适应（`min 240px`），其余定宽；`table-layout: fixed` 防跳动；长文本单行省略 + `title` 全文。
- **批量操作**：勾选后，表格顶部**悬浮操作条**替换筛选栏位置（`--accent-soft` 底）："已选 3 项 · [批量下架] [批量归档] [取消]"。破坏性批量操作走 §8 确认弹窗。
- **行操作菜单**：`⋯` 打开 Popover（`--elev-raised`），按角色裁剪动作：
  - editor：编辑 / 提交审核 / 复制 / 预览
  - admin：以上 + 审核通过 / 驳回 / 下架 / 归档 / 删除（删除项 `--danger-ink`）
  - 无权限动作：默认不渲染（见 §7.4）

#### (d) 分页（Pagination）
- 位置：表格右下。构成：`每页条数选择(20/50/100)` · `上一页` · `页码` · `下一页` · `跳转`。
- 计数文案："第 21–40 条，共 128 条"（真实数字位置右对齐，等宽字体）。
- 状态：加载中表格 `--text-muted` 遮罩 + 顶部细进度条；无更多时禁用且 `--fg-disabled`。

#### (e) 空结果 vs 空数据（区分！）
- **空数据**（该集合天然无记录）：居中插画区（Phosphor 线性图标 48px + 引导文案 + `--cta` 主操作按钮）。见 §7.1。
- **空结果**（筛选后无匹配）：居中 + "没有符合条件的内容" + "清除筛选" 次按钮（**不显示**"新建"主按钮）。

### 3.4 表单页范式（`/contents/new` `/contents/:id/edit` `/settings` `/modules`）

统一结构：**页头 → 分组表单（左主区）→ 侧栏辅助（右）→ 粘性动作区**。

#### (a) 页头
- 左：标题 + 编辑对象名（如"编辑 · 小熊刷牙记"）+ 四态徽章 + 版本号。
- 右：动作区（见 d）。
- 二次确认：离开时有未保存改动 → 拦截并弹"未保存的更改将丢失"确认（见 §7.3 脏值）。

#### (b) 分组表单
- 每个分组：`--text-lg` 分组标题（无小写追踪标签堆叠）+ 组内字段。
- **字段标签恒常驻左侧或上方**（不用仅 placeholder 当 label）。
- 字段控件：输入框/文本域/下拉/单选/媒体选择器/标签选择器。
  - 输入框：高 36px，`--radius-sm`，边框 `--border`，内距 `--space-3`。
  - 聚焦：描边 `--border-focus` + `--focus-ring` 外环。
- **校验态**（字段级）：
  - Error：描边 `--danger` + 下方 `--danger-ink` 具体文案（"标题不能超过 40 字"而非"输入无效"）
  - Success（可选）：右侧 `CheckCircle` `--success`（仅用于异步校验如 slug 唯一性）
  - 校验时机：blur 时首次校验，之后随输入实时更新；提交时滚动并聚焦到首个错误字段。
- **分组内字段 ≤4 个**（认知负荷原则）；超出的字段用渐进披露（"高级设置"折叠区）。

#### (c) 侧栏辅助区（右列，宽 320px）
- 发布设置：状态徽章（只读）、所属模块、年龄段、排序值、locale。
- 归属信息：作者、最后编辑人、更新时间（等宽）。
- 标签选择器：`content_tags` 多选，已选 chips 可移除。

#### (d) 动作区（ActionBar — 粘性底部或页头右侧）
按状态与角色给出**唯一主按钮**，其余为次按钮：

| 当前状态 | editor 可做 | admin 可做 |
|----------|------------|-----------|
| draft | 保存草稿(次) · **提交审核(主--cta)** · 预览(次) | 同 editor + 直接发布(主) |
| in_review | 撤回(次) · 预览(次)（只读编辑） | **审核通过(主--cta)** · 驳回(次) · 预览 |
| published | 预览(次) · 复制为新草稿(次) | **下架(次-危险)** · 编辑生新版本(主) |
| archived | 预览(次) | **恢复为草稿(主--cta)** |

- **脏值提示（Dirty State）**：
  - 有未保存改动：页头标题旁出现 `--muted` 小圆点 + "未保存"文本；主按钮从 disabled 变 enabled。
  - 无改动：主按钮 disabled（`--fg-disabled`），Tooltip "没有需要保存的更改"。
  - 浏览器 `beforeunload` 兜底二次确认。
- **保存态**：点击后按钮变 loading（spinner + "保存中…"），期间禁用全表单；成功 → 右下 Toast（`--success-soft`，"已保存")；失败 → Toast `--danger-soft` + "重试" 按钮，**表单内容不丢失**。

### 3.5 内容编辑器特殊区（`/contents/:id/edit`）

- **内容类型分支**（Spec §14.3）：
  - `book` 绘本：封面（单图）· 分页图（有序多图列表，支持拖拽排序）· 旁白音频（单文件）
  - `song` 儿歌：音频（单文件）· 封面（单图）
  - `habit` 习惯：图标（Phosphor iconKey 选择器 — 从锁定集合中选，非自由上传）· 说明（富文本/纯文本）
- **媒体选择器**：字段旁"选择媒体"打开媒体库抽屉（复用 `/media` 网格，选择态），支持就地上传。
- **分页图列表**：每行 `缩略图 + 页码 + 拖拽手柄 (DotsSixVertical) + 删除`；拖拽排序时行浮起（`--elev-raised`），落位用 `transform` 过渡（非 height）。

### 3.6 版本历史 `/contents/:id/revisions`

- 左：版本时间线（`v3 当前` / `v2` / `v1`），每项 `版本号 + 作者 + 时间(等宽) + 变更摘要(note)`。
- 右：所选版本快照差异区（字段级 diff：新增 `--success-soft`、删除 `--danger-soft`、修改高亮）。
- 动作：`回滚到此版本`（admin-only，主按钮，走 §8 确认弹窗，文案明示"当前版本 v3 将被覆盖"）。

### 3.7 媒体库 `/media`

见 §5。

### 3.8 模块与分类 `/modules`

- 双栏：左"内容模块"表（key / name / Phosphor iconKey / 色标签 / order / enabled 开关），右"分类"表。
- 内联编辑：单元格点击变输入框（Enter 保存 / Esc 取消）。
- 新增行：表尾 `+ 新增模块` 行（admin-only）。
- 删除模块：受保护——若该模块下有内容，弹窗告知"该模块下有 N 条内容，无法删除"（阻断，非仅警告）。

### 3.9 用户与角色 `/users`（admin-only）

- 表：`用户名/联系方式` · `角色(下拉: parent/editor/admin)` · `状态(启用/停用 开关)` · `最近登录(等宽)` · `操作`。
- 角色变更与启停均走 §8 确认弹窗 + 写入 `audit_log`（Spec §14.4）。
- **合规**：列表**不展示儿童 PII**（Spec §10）；仅运营账号信息。

### 3.10 审计日志 `/audit`（admin-only）

- 筛选：动作类型（Spec §14.4 枚举下拉）、操作人、时间范围、目标 ID。
- 表：`时间(等宽, 主排序列)` · `操作人 + 角色徽章` · `动作(等宽 key)` · `目标(类型+ID)` · `变更(diff 展开)` · `IP`。
- 只读，**无删除/编辑**（日志不可篡改）。行展开显示 `before/after` JSON diff。

### 3.11 后台设置 `/settings`（admin-only）

- 分组表单：站点信息 / 内容默认值 / 上传限制 / 维护模式开关。
- 维护模式开启时，顶部全宽 `--warn-soft` 条常驻提示（含关闭入口）。

---

## 4. 内容四态徽章（Badge 规范）

内容生命周期四态在列表、编辑页、版本页**统一**使用同一徽章组件。每态**文字 + 圆点**双通道（不靠颜色单独传达，满足无障碍）。

### 4.1 视觉规格

| 状态 | 中文 | 底色 `bg` | 文字 `fg` | 圆点 `dot` | 描边 `border` |
|------|------|-----------|-----------|-----------|---------------|
| `draft` | 草稿 | `--badge-draft-bg` `#EEF1F4` | `--badge-draft-fg` `#55636B` | `#8A99A1` | `#DCE3E7` |
| `in_review` | 待审 | `--badge-review-bg` `#FDF3E2` | `--badge-review-fg` `#9A5B00` | `#F2A33C` | `#F5E2C0` |
| `published` | 已发布 | `--badge-pub-bg` `#E4F5EC` | `--badge-pub-fg` `#146C46` | `#1E8E5A` | `#C7E9D6` |
| `archived` | 已归档 | `--badge-arch-bg` `#ECEFF1` | `--badge-arch-fg` `#55636B` | `#9AA7AE` | `#DDE3E6` |

### 4.2 尺寸与形态
- 高 20px，内距 `4px 8px`，圆角 `--radius-xs`（4px，**方形 chip 而非胶囊**——胶囊留给 filter 与 tag，语义区分）。
- 字号 `--text-xs` (12px)，字重 500，圆点 6px，圆点与文字间距 6px。
- 徽章**不做 hover/点击**（纯展示）；需要筛选时用 §3.3 分段控件中的带点版本。

### 4.3 伴生图标（提升非色彩识别度）
在大尺寸场景（编辑页页头）徽章左侧补一个 Phosphor 图标：

| 状态 | Phosphor 图标 |
|------|---------------|
| draft | `PencilSimpleLine` |
| in_review | `ClockCountdown` |
| published | `SealCheck` |
| archived | `ArchiveBox` |

### 4.4 语义提示
- `draft` / `in_review` 徽章旁，在编辑页补一行 `--muted` 说明："App 端不可见"（呼应 AC-15 草稿隔离）。
- `published` 补："已上线，App 可见"。
- `archived` 补："已下架，App 不可见"。

---

## 5. 媒体上传与媒体网格 `/media`

### 5.1 上传区

- **拖拽上传**：整页可拖（`/media`）与字段级可拖（编辑器媒体选择器）。拖入时全屏叠 `--accent-soft` 40% 遮罩 + 虚线描边 + 中央 `UploadSimple 48px` + "松开以上传"。
- 也支持点击选择 / 粘贴（`Ctrl+V` 图片）。
- 约束提示常驻：`支持 JPG/PNG/WebP/MP3，单文件 ≤10MB`（值来自 `/admin/settings`，非硬编码）。
- **上传流程**（Spec §14.5 直传云存储）：请求临时凭证 → 直传 → 回写元数据。前端只展示进度与结果。

### 5.2 上传进度与失败

- 上传项卡片：`缩略图/波形图 + 文件名 + 进度条 + 状态`。
  - 进行中：`--accent-strong` 进度条 + 百分比（等宽）+ `X` 取消。
  - 成功：进度条变 `--success`，2s 后淡出并入网格。
  - **失败**：卡片描边 `--danger` + `--danger-soft` 底 + `WarningCircle` + 原因（"网络中断"/"文件过大"）+ **重试** 按钮（Phosphor `ArrowClockwise`）。**已上传成功的文件不受影响**，仅重试失败项。

### 5.3 媒体网格

- 网格：桌面 `repeat(auto-fill, minmax(180px, 1fr))`，gap `--space-4`；平板 3 列；移动 2 列。
- 每格：封面（16:9 or 1:1 按 mime 自适应）+ 悬停遮罩（底部渐变**仅遮罩层**，非主视觉）+ 操作条：`复制 CDN 链接` · `预览` · `删除(admin)`。
- 媒体类型标识：音频类格右上角 `MusicNote` 图标 + 时长；图片格右下角尺寸 `1080×720`（等宽）。
- **复制 CDN 链接**：点击后图标变 `Check` + Toast "已复制链接"（2s 回退）。复制的是**绝对 CDN URL**，供内容编辑器与外部引用。
- 选择模式：从编辑器唤起时，格子变可选中（左上角 checkbox），底部粘性条显示"已选 N / 确定"。

### 5.4 媒体删除

- admin-only，走 §8 确认弹窗，且明示影响："该媒体被 N 处内容引用，删除后这些内容将缺图"。被引用时**默认阻断**（除非先解引用）。

---

## 6. 图标规范（Phosphor）

- 全产品**唯一**图标库：**Phosphor Icons**（Spec §4 锁定；禁 emoji、禁混用）。
- 尺寸：**16px 行内** / **20px 按钮内与导航** / **24px 独立**。
- 字重：后台统一用 **Regular**（描边），激活/强调可用 **Bold**；不使用 Duotone/Fill 混排（除选中态复选框）。
- 颜色走 Token：`--icon-default` / `--icon-muted` / `--icon-accent`，禁裸 hex。
- 后台关键图标映射：

| 场景 | Phosphor 图标 |
|------|---------------|
| 内容列表 / 内容 | `Article` |
| 新建 / 添加 | `Plus` |
| 媒体库 | `Images` |
| 模块与分类 | `SquaresFour` |
| 用户与角色 | `UsersThree` |
| 审计日志 | `ClipboardText` |
| 后台设置 | `GearSix` |
| 概览 | `ChartLineUp` |
| 搜索 | `MagnifyingGlass` |
| 筛选 | `FunnelSimple` |
| 排序 | `CaretUpDown` |
| 行操作菜单 | `DotsThree` |
| 删除 | `Trash` |
| 编辑 | `PencilSimple` |
| 提交审核 | `PaperPlaneTilt` |
| 审核通过 | `CheckCircle` |
| 驳回 | `ArrowUUpLeft` |
| 下架 / 归档 | `ArchiveBox` |
| 恢复 | `ArrowCounterClockwise` |
| 版本历史 | `ClockCounterClockwise` |
| 拖拽手柄 | `DotsSixVertical` |
| 上传 | `UploadSimple` |
| 重试 | `ArrowClockwise` |
| 复制链接 | `LinkSimple` / 成功 `Check` |
| 预览 | `Eye` |
| 错误 | `WarningCircle` |
| 空态默认 | `Tray` |
| 权限受限 | `LockSimple` |
| 登出 | `SignOut` |

---

## 7. 状态范式（空 / 加载 / 错误 / 权限受限）

所有数据区域**必须**实现以下状态，禁止只画"有数据"态。

### 7.1 空态（Empty）

- 结构（垂直居中，上下 `--space-12` 留白）：`Phosphor 线性图标 48px (--muted)` → 标题 `--text-lg` → 一句话引导 `--text-sm --muted` → 主操作按钮。
- 分场景文案（**真实、具体，禁空洞占位**）：
  - 内容列表无数据："还没有内容 · 创建第一篇绘本或儿歌，审核通过后即可在 App 展示。" → [新建内容]
  - 待审队列空："暂无待审内容 · 编辑提交后，待审内容会出现在这里。"（无按钮，纯信息）
  - 媒体库空："媒体库是空的 · 拖入图片或音频，或点击上传。" → [上传媒体]
  - 审计无数据："暂无操作记录。"
  - 搜索/筛选无结果："没有符合条件的内容 · 试试放宽筛选条件。" → [清除筛选]

### 7.2 加载态（Loading）

- **首屏**：骨架屏（Skeleton），形状与最终内容一致（表格 = 行条；卡片 = 矩形块），微光扫过动画（`--motion-base` 循环，遵守 reduced-motion）。
- **分页/筛选切换**：保留旧数据 + 顶部 2px `--accent-strong` 不定长进度条（不整页闪白）。
- **按钮内**：`CircleNotch` spinner 16px + 文案变进行时（"保存中…"），禁用重复提交。
- **禁**：无反馈的空白等待、整页 spinner 覆盖（失去上下文）。

### 7.3 错误态（Error）

- 页面级（列表加载失败）：居中 `WarningCircle 48px (--danger)` + "加载失败" + 具体原因（"网络请求超时"）+ [重试] 按钮 + 小字 `--muted` 错误码（便于排查）。
- 局部级（单个字段/单行）：行内红色提示，不阻断整页。
- 表单提交失败：Toast `--danger-soft` + 原因 + [重试]；**表单填写内容保留**。
- 错误文案原则：说清 **发生了什么 + 怎么办**，禁暴露技术堆栈给运营用户（可给错误码）。

### 7.4 权限受限态（editor 遇到 admin-only）——重点

依据 Spec §14.1 权限矩阵。三档处理策略，按"可发现性"取舍：

| 场景 | 策略 | 表现 |
|------|------|------|
| 整个导航项 admin-only（用户与角色 / 审计日志 / 后台设置） | **隐藏** | editor 侧边栏不渲染该组，减少噪音 |
| 行操作菜单中的 admin-only 动作（审核通过/驳回/下架/删除） | **隐藏**（默认） | editor 菜单里不出现这些项 |
| 表单主按钮中的 admin-only（审核通过） | **禁用 + Tooltip 解释** | 保留按钮可见，`--fg-disabled`，hover Tooltip："需要"内容负责人(admin)"权限" + `LockSimple` 图标 |
| 页面直达（editor 手输 `/users` URL） | **权限受限页** | 整页 `LockSimple 48px` + "无权访问" + "当前身份：editor，此页面仅 admin 可见" + [返回概览] |
| 后端 403（绕过前端） | **Toast + 回退** | `--danger-soft` Toast："操作被拒绝，需要 admin 权限"，并刷新当前数据 |

- **原则**：可发现性由角色决定——editor 不需要知道 admin 能做什么（隐藏）；但**正被使用的功能被禁用时**必须解释（禁用+Tooltip）；**用户明确到达**的受限页必须给出清晰原因与出路。
- **禁止**：把 admin 按钮置灰却不给原因；伪装允许再报错。

### 7.5 成功态（Success）

- Toast（右下，`--success-soft`，`CheckCircle`，2.5s 自动消失，可手动关）。
- 破坏性操作成功（下架/删除）用相同 Toast，文案含结果（"已下架 · App 端不再展示"）。

---

## 8. 确认弹窗范式（破坏性操作）

用于：**删除内容 / 下架 / 归档 / 回滚版本 / 改角色 / 停用用户 / 删除媒体**。

### 8.1 结构

```
┌─────────────────────────────────────────┐
│  [WarningCircle 24 --danger]  标题        │
│  ────────────────────────────────────    │
│  说明段：影响 + 不可逆提示                  │
│  对象卡（--surface-sunken）：目标名 / ID    │
│  [可选] 二次确认输入框（高危）              │
│  ────────────────────────────────────    │
│            [取消]   [确认(危险, --danger)] │
└─────────────────────────────────────────┘
```

- 宽 440px，`--radius-lg`，`--elev-overlay`，遮罩 `rgba(16,24,40,0.45)`。
- 焦点陷阱：打开后焦点落在"取消"（**默认非破坏**），`Esc` = 取消。
- 危险主按钮：`background: var(--danger)` + 白字（对比达标）+ loading 态。

### 8.2 分级

| 级别 | 触发 | 二次确认 |
|------|------|----------|
| 中危 | 下架、归档、停用用户 | 单次确认 |
| 高危 | 删除内容、删除媒体、回滚版本 | 需输入目标名/ID 确认（防误删） |

### 8.3 文案原则
- 标题用动词+"会怎样"："下架后 App 将不再展示此内容"而非"确认操作？"
- 说明含**具体影响范围**与**是否可逆**："此操作不可撤销。" / "可在版本历史中恢复。"
- 确认按钮文案 = 具体动作（"下架" / "删除"），**禁用**泛化文案（"确定" / "OK" 单独出现）。

---

## 9. 组件状态矩阵（核心组件 5+ 态）

| 组件 | Default | Hover | Focus | Active | Disabled | Loading | Empty | Error |
|------|---------|-------|-------|--------|----------|---------|-------|-------|
| 主按钮 (CTA) | `--cta`/`--cta-ink` | `--cta-hover` | `--focus-ring` | `--cta-active` | `--surface-sunken`+`--fg-disabled` | spinner+"进行中…" | — | — |
| 次按钮 | 透明+`--border`描边 | `--surface-hover` | `--focus-ring` | `--surface-active` | 同主 | spinner | — | — |
| 危险按钮 | `--danger`+白字 | 加深 8% | ring(danger) | 加深 14% | 同主 | spinner | — | — |
| 输入框 | `--border` | `--border-strong` | 描边`--accent-strong`+ring | — | `--surface-sunken` | 右侧 spinner | — | 描边`--danger`+下方文案 |
| 下拉 | 同输入框 | | | 面板 `--elev-raised` | | 面板内骨架 | "无匹配项" | — |
| 表格 | 见 §3.3 | 行 `--surface-hover` | 行可聚焦环 | 行 `--surface-active` | — | 顶部进度条 | 见 §7.1 | 见 §7.3 |
| 徽章 | 见 §4 | 无交互 | — | — | 降低不透明度 | — | — | — |
| 开关 | `--border-strong` 轨道 | — | `--focus-ring` | on=`--accent-strong` | `--fg-disabled` | 提交中禁用 | — | 回滚+Toast |
| Toast | 语义 soft 底 | — | — | — | — | — | — | 含 [重试] |
| 分页 | 见 §3.3 | `--surface-hover` | `--focus-ring` | `--surface-active` | `--fg-disabled` | 页码骨架 | 单页时隐藏 | — |

---

## 10. 可访问性（a11y）基线

> 设计阶段专注视觉与体验；**审计阶段**由 `audit` 命令逐项验证。以下为交付必须满足的基线。

- **对比度**：正文 ≥4.5:1、大字/非文本 UI ≥3:1。已在 §2.4 处理薄荷青分级（`--accent` 不作白底小字/描边）。
- **键盘可达**：全部交互可 Tab 到达；`⌘/Ctrl+K` 搜索、`Esc` 关弹窗、表格行 `Enter` 进详情。
- **焦点可见**：`:focus-visible` 统一 `--focus-ring`（4px 环），**禁 `outline:none` 无替代**。
- **语义**：表格用原生 `<table>` + `scope`；表单 `<label for>`；弹窗 `role="dialog" aria-modal` + 焦点陷阱 + `aria-labelledby`。
- **图标按钮**：必须带 `aria-label`（如 `⋯` → "更多操作"）。
- **状态非仅颜色**：四态徽章带文字+图标；错误态带文案；必填带 `*` + `aria-required`。
- **动效**：`prefers-reduced-motion: reduce` 时全时长归零（见 tokens）。
- **触控/点击目标**：≥32×32px（后台桌面为主，最小 32；移动端 ≥44）。

---

## 11. 反 AI 模板 / 反模式自检（后台版）

| 红线 | 后台对策 |
|------|----------|
| emoji 作图标 | 全量 Phosphor，正则 `[\x{1F300}-\x{1F9FF}\x{2600}-\x{26FF}\x{2700}-\x{27BF}]` 扫描零命中 |
| 紫→粉渐变 | 后台**零渐变**；品牌薄荷青 + 冷白灰阶 |
| 千篇一律 Hero | 无 Hero；首屏即数据 |
| 默认靛蓝强调 / 侧条纹 | 强调色=薄荷青分级；激活态用底色而非左边条 |
| 圆角卡片+彩色左边框 | 卡片 `--elev-ring` 1px 边框环，无左边条 |
| 幽灵卡片（边框+大模糊） | 卡片 `--elev-ring`，模糊仅浮层 |
| 过度圆角 | 卡片 ≤12px，控件 6px |
| 空洞占位文案 | 全部文案为真实动作/对象（见各页） |
| 虚构指标 | KPI 数值来自 `admin/stats`，口径标注；示例数据用有机数字 |
| 每节小写追踪标签堆叠 | 表格表头才用大写追踪；正文区块标题用正常大小写 |

---

## 12. 交付给前端 / 架构师的实现提示

1. **Token 先行**：先落地 `docs/design-tokens-admin.json` + CSS 变量，再写组件。组件内**禁止**除 `#fff/#000` 外的 hex。
2. **组件选型**：需与 Spec §4「运营后台 UI 组件」锁定结果一致。建议 Headless（Radix / Headless UI）+ 自绘 skin，以完全掌控 Token 与 a11y；**不引入**自带紫色主题的成品库默认皮肤。
3. **数据表**：建议 TanStack Table（headless），服务端分页/排序/筛选参数与 Spec §5.2 query 对齐。
4. **表单**：React Hook Form + Zod，校验规则与后端 `validators` 同源（避免前后端两套规则漂移）。
5. **状态机按钮**：内容动作区严格按 §3.4(d) 状态×角色矩阵渲染；前端仅做**展示裁剪**，真实权限以 403 为准（AC-11）。
6. **URL 即状态**：列表筛选/排序/分页写 URL query，保证可分享、刷新不丢（对应"刷新丢数据"角色测试）。
7. **四态徽章**：抽为单一 `<ContentStatusBadge status>` 组件，四态样式集中，禁止各页自绘。
8. **权限受限**：`<Can action="content.approve">` 门控组件封装 §7.4 三档策略，避免散落。

---

## 13. 对标参考（成熟运营后台 / 设计系统）

| 对标 | 借鉴点 |
|------|--------|
| **Linear** | 冷色中性表面、1px 边框环、键盘优先、紧凑表格、克制强调色 |
| **Stripe Dashboard** | 表单分组、脏值/保存态、数据密度、错误文案清晰 |
| **Retool / Sentry** | 筛选栏 chip 回显、行操作 Popover、批量操作条 |
| **Contentful / Sanity Studio** | 内容四态/版本历史、媒体库网格、表单左主区右侧栏 |
| **GitHub** | 表格斑马纹与 hover、审计日志只读、权限受限页 |
| **Polaris / Atlassian Design** | 状态徽章、空/错误态文案范式、破坏性确认弹窗分级 |

> 后台**不**对标儿童 App 的 Duolingo/宝宝巴士——那套 Claymorphism/暖色/大圆角只用于 C 端。品牌同源靠**色彩与图标**维系，而非皮肤照搬。

---

*配套文件：`docs/tokens-admin.md`（Token 映射）、`docs/design-tokens-admin.json`（机器可读）。*
