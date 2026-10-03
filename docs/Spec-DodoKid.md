# Spec - DodoKid 儿童早教 App v0.6.1

> 生成日期：2026-10-02
> 基于：PRD v0.2 + 架构文档 v0.2 + UIUX 文档 v0.2
> 状态：已变更（用户 2026-10-02 确认补齐「内容维护与运营后台」，选方案 B）
> **范围策略变更**：用户明确「AI 全量开发，不受时间与 MVP 限制」→ 本 Spec 交付范围为**全量能力**，不再以 MVP 最小集作为裁剪依据。原 Out-of-Scope 中标注「MVP 不做」的项，除商业/合规禁区外均可纳入实现。
> 项目总监：大湾区靓仔 | PM：许清楚 | 架构师：高见远 | 设计师：颜好看

---

## 1. 产品定义
- **一句话描述**：完全免费、无广告、护眼限时的 0-6 岁分龄早教陪伴 App，配套一套内部内容运营后台，支撑内容持续生产与迭代。
- **目标用户**：
  - 儿童 App：3-6 岁儿童（主力）+ 25-38 岁家长（决策者/管控者）。
  - 运营后台：内容运营/编辑（editor）、内容负责人（admin）。
- **核心问题**：家长要优质早教内容又痛恨广告扣费；同时**内容型产品必须有可持续的内容生产与维护链路**，否则内容不更新、留存断崖。

## 2. 交付范围（锁定）

| 优先级 | 模块 | 验收标准摘要 |
|--------|------|-------------|
| P0 | 儿童 App：绘本共读（分龄/跟读/互动问答） | 分龄路由、跟读、问答、试读样章 |
| P0 | 儿童 App：习惯养成（任务/打卡/徽章/周报） | 分层任务、打卡、连续天数、周报 |
| P0 | 儿童 App：护眼防沉迷（每日上限、到点自停不可跳过） | 时长上限、单次≤15min、不可跳过 |
| P0 | 儿童 App：家长中心（严格家长锁 + 时长设置） | 生物/密码级家长锁 |
| P0 | **内容维护与运营后台（新增）** | 内容 CRUD、草稿/审核/发布/下架状态机、媒体库、分龄标签、模块/分类管理、运营角色与权限、审计日志、内容预览 |
| P1 | 儿童 App：儿歌音频（绘本配套轻量资源） | 纯音频、睡眠定时关闭 |
| P2 | 儿童 App：识字认知（字卡学习 + 认读小测） | **已实现**（路线图模块 1）：字卡分龄、翻面看组词/例句、听读音、四选一小测、进度回写（AC-16/17） |
| P2 | 儿童 App：数学启蒙（数一数 / 比大小 / 算一算） | **已实现**（路线图模块 2）：分龄难度、圆点可视化、三类练习与结算、得分回写（AC-18） |
| P2 | 儿童 App：英语启蒙（单词卡 + 看义选词小测） | **已实现**（路线图模块 3）：单词卡分龄、图标/音标/读音入口、四选一选词小测、得分回写（AC-19） |
| P2 | 儿童 App：益智游戏（记忆翻牌） | **已实现**（路线图模块 4）：3-4 岁 4 组 / 4-6 岁 6 组、翻牌状态机、翻牌次数结算与星级、结算页重开冷却（AC-20/AC-21） |

## 3. 明确不做（Out-of-Scope — 锁定）

> 范围策略已放宽（不受 MVP 限制），下表仅保留**商业与合规禁区**；原「因 MVP 裁剪」的项已移入交付范围或路线图。

| 不做的功能 | 原因 | 何时考虑 |
|------------|------|----------|
| 付费/订阅/内购链路 | 商业模式既定：完全免费品牌/工具型 | 商业模式变更时 |
| 0-2 岁屏幕内容 | WHO/教育部不建议电子屏幕 | 长期不作主体 |
| 家长社区 / UGC / 社交 | 内容审核与合规风险高 | 单独立项评估 |
| 面向消费者的内容开放平台 | 合规与审核成本 | 不规划 |
| 儿童行为画像 / 广告追踪 | COPPA 与国内法规禁区 | 永不做 |

> 说明：识字/数学/英语/益智游戏、AI 生成内容已从「MVP 不做」上调为**路线图项**，可按需排期。

## 4. 技术架构（锁定 — 含版本锚定）

| 层 | 技术 | 版本 | 锁定原因 |
|----|------|------|----------|
| 儿童 App 跨端 | React Native + Expo | Expo SDK 53（RN 0.79 / React 19） | OTA 热更、JS 团队复用 |
| 儿童 App 状态 | Zustand + TanStack Query | zustand ^5 / react-query ^5 | UI 状态 + 服务端缓存 |
| 儿童 App 媒体 | expo-audio / reanimated / lottie | SDK53 兼容 | 旁白/动效 |
| 儿童 App 存储 | expo-sqlite / expo-file-system / expo-secure-store | SDK53 兼容 | 离线 + 令牌 |
| **运营后台前端** | **React + TypeScript + Vite** | 待架构师 ADR 锁定 | 表格/表单密集，独立 Web 后台，不混入儿童 App 包体 |
| **运营后台 UI 组件** | **Ant Design 5**（严格 Token 映射 + 品牌原语自绘） | ^5 | 重型表格/表单/上传开箱即用；ConfigProvider 映射 `docs/tokens-admin.json`；图标仅 Phosphor（ESLint 禁 @ant-design/icons）——见附录裁决 4 |
| **运营后台鉴权** | JWT + RBAC（`parent` / `editor` / `admin`） | — | 角色化权限 |
| 后端 BaaS | 腾讯云开发 CloudBase | 个人版/免费档 | 云数据库+云函数+鉴权+云存储 CDN |
| 富媒体/CDN | CloudBase 云存储（内置 CDN） | — | 绘本图/音频/封面 |
| 图标库 | **Phosphor Icons**（全产品唯一） | 最新稳定 | 圆润描边、跨端、多字重；禁 emoji、禁混用 |

## 5. API 端点清单（锁定）

### 5.1 儿童 App（C 端，内容只读）
| Method | Path | 功能 | 认证 |
|--------|------|------|------|
| POST | /api/v1/parent/register \| login \| logout \| sendSmsCode \| verifyCode | 家长鉴权 | 公开/JWT |
| POST | /api/v1/child/create \| switch | 儿童档案 | JWT |
| GET | /api/v1/child/list \| /:id | 档案读取 | JWT |
| PUT/DELETE | /api/v1/child/:id | 更新/删除（撤回同意即删） | JWT |
| GET | /api/v1/content/list \| search \| categories \| /:id \| /:id/mediaUrl | 内容消费（**仅返回 published**） | JWT |
| GET/PUT | /api/v1/progress/:childId \| /list | 学习进度 | JWT |
| GET | /api/v1/milestones/:childId | 成就 | JWT |
| GET/PUT | /api/v1/parent/settings \| /settings/timeLimit | 家长设置（需家长锁） | JWT + Gate |
| POST | /api/v1/parent/gate/setup \| verify | 家长锁 | JWT |
| POST | /api/v1/consent/record | 同意记录 | JWT |
| PUT | /api/v1/preferences | 偏好 | JWT |
| POST | /api/v1/feedback | 反馈 | JWT |
| GET | /api/v1/version \| privacyPolicy | 元信息 | 公开 |

### 5.2 运营后台（新增，均需 admin JWT + RBAC）
| Method | Path | 功能 | 角色 |
|--------|------|------|------|
| POST | /api/v1/admin/auth/login \| logout | 后台登录/登出 | 公开/JWT |
| GET | /api/v1/admin/auth/me | 当前运营身份 | editor+ |
| GET | /api/v1/admin/stats | 概览统计（内容数/待审/最近操作） | editor+ |
| GET | /api/v1/admin/contents | 内容列表（筛选：模块/年龄段/状态/关键词/分页） | editor+ |
| POST | /api/v1/admin/contents | 新建内容（草稿） | editor+ |
| GET/PUT/DELETE | /api/v1/admin/contents/:id | 读取/编辑/删除 | editor+（删除仅 admin） |
| POST | /api/v1/admin/contents/:id/submit | 提交审核 draft→in_review | editor+ |
| POST | /api/v1/admin/contents/:id/approve | 审核通过 in_review→published | admin |
| POST | /api/v1/admin/contents/:id/reject | 驳回 in_review→draft | admin |
| POST | /api/v1/admin/contents/:id/unpublish | 下架 published→archived | admin |
| POST | /api/v1/admin/contents/:id/archive | 归档 | admin |
| GET | /api/v1/admin/contents/:id/revisions | 版本历史 | editor+ |
| POST | /api/v1/admin/contents/:id/restore/:revisionId | 回滚到指定版本 | admin |
| GET | /api/v1/admin/contents/:id/preview | 内容预览 | editor+ |
| POST | /api/v1/admin/contents/:id/publish | 草稿直发 draft→published | admin |
| POST | /api/v1/admin/contents/:id/withdraw | 撤回 in_review→draft | editor+ |
| POST | /api/v1/admin/contents/:id/duplicate | 复制为新草稿 | editor+ |
| GET/POST | /api/v1/admin/modules | 模块列表/新建 | 创建 admin |
| PUT/DELETE | /api/v1/admin/modules/:id | 模块编辑/删除 | admin |
| GET/POST | /api/v1/admin/categories | 分类列表/新建 | editor+ |
| PUT/DELETE | /api/v1/admin/categories/:id | 分类编辑/删除 | admin |
| GET/POST | /api/v1/admin/media | 媒体列表 / 上传（取上传凭证并落库） | editor+ |
| GET/DELETE | /api/v1/admin/media/:id | 媒体详情/删除 | editor+（删除 admin） |
| GET | /api/v1/admin/users | 运营用户列表 | admin |
| PUT | /api/v1/admin/users/:id/role \| /status | 改角色/启停 | admin |
| GET | /api/v1/admin/audit | 审计日志（筛选/分页） | admin |
| GET/PUT | /api/v1/admin/settings | 后台设置 | admin |

> 架构师**必须**产出更新版 `openapi.yaml`（OpenAPI 3.0），覆盖 5.1 + 5.2 全部端点；前端据此生成 TS 类型，后端据此实现。

## 6. 数据库表清单（锁定）

### 6.1 现有集合（扩展字段）
| 集合 | 现有 | v0.2 新增字段 |
|------|------|---------------|
| users | phone/wechat, role=parent | `role`: parent\|editor\|admin；`status`: active\|disabled |
| content_items | moduleKey, ageGroup, title, mediaRef, type | `status`: draft\|in_review\|published\|archived；`version`；`publishedAt`；`authorId`；`reviewerId`；`tags[]`；`order`；`cover`；`summary`；`locale` |
| content_modules | key, name, colorToken | `iconKey`（Phosphor 图标名）、`order`、`enabled` |
| media_assets | itemId, url, cdnKey, size | `folder`、`mime`、`width`、`height`、`durationMs`、`uploadedBy`、`createdAt` |
| audit_log | actor, action, ts | `actorRole`、`targetType`、`targetId`、`before`、`after`、`ip` |

### 6.2 新增集合
| 集合 | 核心字段 | 索引 | 说明 |
|------|----------|------|------|
| content_revisions | contentId, version, snapshot, authorId, note, createdAt | contentId+version | 版本历史，支持回滚 |
| content_categories | key, name, order, enabled | key | 内容分类 |
| content_tags | key, name, moduleKey | key | 分龄/主题标签 |

## 7. 页面清单（锁定）

### 7.1 儿童 App
| 页面 | 路由 | 核心组件 |
|------|------|----------|
| 启动/年龄选择 | /onboarding | 吉祥物引导、年龄卡片 |
| 首页（儿童模式） | /home | 模块宫格、多多 IP、护眼计时条 |
| 绘本共读 | /book/:id | 分页阅读器、跟读、问答 |
| 习惯养成 | /habit | 任务列表、打卡、徽章墙 |
| 家长中心 | /parent | 家长锁、时长设置、周报 |
| 家长锁验证 | /parent/gate | 生物/密码验证 |
| 设置/关于 | /settings | 隐私政策、删除数据 |

### 7.2 运营后台（新增，独立 Web App）
| 页面 | 路由 | 核心组件 | 对应 API |
|------|------|----------|----------|
| 登录 | /login | 账号密码表单 + 错误态 | admin/auth/login |
| 概览 | /dashboard | 统计卡、待审核队列、最近操作 | admin/stats |
| 内容列表 | /contents | 筛选栏（模块/年龄/状态/关键词）、分页表格 | admin/contents |
| 内容编辑器 | /contents/new、/contents/:id/edit | 表单、媒体选择器、分龄/标签、草稿保存、提交审核、预览 | admin/contents CRUD + media |
| 版本历史 | /contents/:id/revisions | 版本列表、摘要、回滚 | admin/contents/revisions |
| 媒体库 | /media | 上传区、网格、删除、复制 CDN 链接 | admin/media |
| 模块与分类 | /modules | 模块/分类表格维护 | admin/modules, categories |
| 用户与角色 | /users | 用户表格、角色下拉、启停 | admin/users |
| 审计日志 | /audit | 日志表格、筛选、分页 | admin/audit |
| 后台设置 | /settings | 站点参数 | admin/settings |

## 8. 设计 Token（锁定）

> 设计师需产出 `design-tokens.json` + `design-tokens.css`（儿童 App），并补充**后台主题映射**。

- **主色（品牌）**：薄荷青 `#12B5A6`；**CTA**：暖阳橙 `#FF9A3D`（深字保证 AA）
- **成功/奖励**：芽绿 `#7CC576`
- **背景**：儿童 App 暖白 `#FFF9F2`；**后台**建议中性冷白（提升表格信息密度可读性），仍由 Token 管理
- **文字**：主文 `#3A3A3A`、次文 `#8A8A8A`；语义警示红 `#E5564E`（仅退出确认/家长锁失败）
- **模块色彩编码**：绘本共读 `#FF7A85`、习惯养成 `#FF9F43`、儿歌音频 `#FFD166`、识字认知 `#6BCB77`、数学启蒙 `#4D96FF`、英语启蒙 `#9B5DE5`、益智游戏 `#FF6F9C`（仅作内容标签，不用于主视觉渐变）；白图标/白字必须落在对应 `moduleStrong` 深色底上（对比度 ≥4.7:1，益智游戏为 `#B23A6E`）
- **字体**：儿童 App 展示 站酷快乐体 + Baloo 2 / 正文 Noto Sans SC + Nunito，最小字重 500；**后台**正文统一 Noto Sans SC + Inter
- **形状/间距**：圆角 12-24px；儿童 App 最小点击热区 56px；厚底柔和投影按钮
- **图标库**：Phosphor Icons（16 行内 / 20 按钮 / 24 独立，全产品唯一，禁 emoji、禁混用）
- **主题**：儿童 App 浅色暖白 + 睡前暖光扩展；后台浅色
- **对标品牌**：Duolingo + Khan Kids + 宝宝巴士 + 洪恩；**吉祥物 IP**：多多(Dodo) 渡渡鸟

## 9. 验收标准（锁定 — QA 唯一依据，EARS 格式）

| 编号 | 功能 | EARS 验收标准 | 优先级 |
|------|------|---------------|--------|
| AC-01 | 年龄路由 | When 家长完成年龄选择(3-6)，系统**必须**仅展示该年龄段内容且有试读样章 | P0 |
| AC-02 | 绘本共读 | When 儿童打开绘本，系统**必须**提供跟读与问答并记录进度 | P0 |
| AC-03 | 习惯打卡 | When 儿童完成打卡，系统**必须**记录连续天数并刷新徽章，周报+1 | P0 |
| AC-04 | 护眼防沉迷 | When 当日达上限，系统**必须**温和提示并自停，仅留家长验证入口，不可跳过 | P0 |
| AC-05 | 家长锁 | If 儿童误触家长中心，未过验证时系统**必须**不暴露设置/退出/外链 | P0 |
| AC-06 | 合规 | When 创建儿童档案，系统**必须先**完成家长同意记录，且不采位置/麦克风/通讯录 | P0 |
| AC-07 | 离线 | If 网络不可用且已下载内容存在，系统**应该**可读 | P1 |
| AC-08 | 性能 | While 冷启动，系统**必须** 3s 内首屏，翻页 p95<500ms | P0 |
| AC-09 | 内容提交 | When editor 提交审核，系统**必须**将状态置 `in_review` 并写入一条 revision | P0 |
| AC-10 | 内容发布 | When admin 审核通过，内容**必须**出现在 App `content/list`（按模块+年龄段） | P0 |
| AC-11 | 权限隔离 | If editor 调用发布/下架/删用户，系统**必须**返回 403 | P0 |
| AC-12 | 媒体上传 | When 上传媒体，系统**必须**写入 `media_assets` 并返回可引用的 CDN 引用 | P0 |
| AC-13 | 下架生效 | When 内容被下架/归档，App `content/list` **必须**不再返回它 | P0 |
| AC-14 | 审计 | When 执行发布/下架/删除/改角色，系统**必须**写 `audit_log`（含 actorRole/target/before/after） | P0 |
| AC-15 | 草稿隔离 | While 内容为 draft/in_review，App 侧**必须**完全不可见 | P0 |
| AC-16 | 识字字卡 | When 儿童进入识字认知，系统**必须**按其年龄段返回字卡，并支持翻面查看组词/例句与播放读音 | P2 |
| AC-17 | 认读小测 | When 儿童完成认读小测，系统**必须**按题计分（百分制）并回写进度（contentId=`literacy:quiz`） | P2 |
| AC-18 | 数学启蒙 | When 儿童进入数学启蒙，系统**必须**按其年龄段提供「数一数 / 比大小 / 算一算」练习（和≤上限）并回写得分（contentId=`math:<kind>`） | P2 |
| AC-19 | 英语启蒙 | When 儿童进入英语启蒙，系统**必须**按其年龄段返回单词卡（图标/英文/音标/中文 + 读音入口），并提供「看义选词」四选一小测、按百分制回写得分（contentId=`english:quiz`） | P2 |
| AC-20 | 益智游戏 | When 儿童进入益智游戏，系统**必须**提供单局 ≤2 分钟的轻量玩法（首期：记忆翻牌），按其年龄段配置牌组规模、按翻牌次数结算并回写进度（contentId=`puzzle:memory`） | P2 |
| AC-21 | 游戏防沉迷 | While 益智游戏进行中，达当日护眼上限时系统**必须**立即中断并显示不可跳过的阻断层（复用 AC-04 通道）；且游戏结算页**不得**提供无冷却的「再来一局」 | P2 |

> **AC-19 说明**：原规划题型为「听音选词」，但发音音频依赖媒体库尚未就绪，本期（路线图模块 3）交付「图标 + 中文释义 → 选英文单词」以**保证零音频资源下仍可练习**，符合「不依赖外部资源不阻塞交付」原则；同时单词表只收录图标库中**语义精确**的词（如无「苹果」水果图形，故未收录 apple），避免低龄儿童产生错误联想。音频就绪后补充听音题型（见 `docs/roadmap-modules.md` 方案 B）。

## 10. 边界与约束
- 目标 iOS / Android 最新 2 版 + 平板；后台支持 Chrome/Edge/Safari 最新 2 版。
- 性能：儿童 App 首屏 <3s、翻页 p95 <500ms；后台列表页 <1.5s。
- 护眼：单次 ≤15min，日累计按年龄段上限；0-2 岁不做屏幕内容。
- 合规：COPPA + 国内《儿童个人信息网络保护规定》；数据最小化、家长同意前置、撤回即删。
- **后台不得展示儿童个人可识别信息**（运营仅见内容与聚合统计）。
- 运营后台与儿童 App **分域部署**，后台路由不进入儿童 App 包体。
- 零广告 SDK、零追踪，埋点不采集隐私。

## 11. 内嵌已知坑（从项目记忆拉取）
| 坑 | 技术栈指纹 | 根因 | 修法 |
|----|------------|------|------|
| dev bundle 首构建慢 | expo/AppEntry | Hermes 首次编译 4054 模块 ~50s+ | 属正常，勿误判卡死 |
| 入口非 index | expo SDK53 | 入口为 `expo/AppEntry`，`/index.bundle` 会 404 | 用 `/node_modules/expo/AppEntry.bundle` |
| peer 依赖漏登记 | phosphor-react-native | `react-native-svg` 仅为 peer，未入 package.json | 已补入 dependencies |
| 子代理长任务触发限流 | 平台 | 高频 LLM 调用触顶 429 | 错峰/分段续跑，勿判代码失败 |

## 12. 端到端验证步骤
```bash
# 儿童 App
cd dodokid && npm install && npx expo start --web     # 或 npx expo start 真机

# 运营后台
cd dodokid-admin && npm install && npm run dev        # http://localhost:5173

# 核心成功流（后台）
# 1) editor 登录 -> 新建绘本草稿 -> 上传封面/音频 -> 提交审核
# 2) admin 登录 -> 审核通过 -> 内容 published
# 3) 儿童 App content/list 出现该内容；后台下架后 App 不再返回

# 关键错误流
# editor 直接调 POST /admin/contents/:id/approve -> 断言 403
# 未登录调 GET /admin/contents -> 断言 401
# 断言：发布/下架/删除/改角色均写入 audit_log
```

## 13. 变更记录
| 日期 | 变更内容 | 原因 | 影响范围 |
|------|----------|------|----------|
| 2026-10-01 | 初始 Spec v0.1 生成 | 用户确认三文档 + 两项裁决 | 全量 |
| 2026-10-02 | Spec v0.2：新增「内容维护与运营后台」整块能力；范围策略放宽为全量交付；新增 RBAC、内容状态机、媒体库、审计；5.2 / 6.2 / 7.2 / AC-09~15 | 用户选定方案 B，并明确「AI 全量开发，不受时间与 MVP 限制」 | API / DB / 页面 / 角色 / 验收 |
| 2026-10-02 | Spec v0.2.1：§5.2 增补 3 个 admin 端点（publish 草稿直发 / withdraw 撤回 / duplicate 复制新草稿）+ 2 条状态转移（draft→published、in_review→draft）；§14.4 补 admin.content.publish / withdraw / duplicate 事件 | 补全设计契约 §3.4(d) 所需能力（Phase 3 前端发现 openapi 缺口） | API / 状态机 / 审计 |
| 2026-10-02 | Spec v0.3：路线图启动（P2 首个模块）——新增「识字认知」模块（字卡学习 + 认读小测），§2 交付范围更新，§9 新增 AC-16/AC-17；新增 `docs/roadmap-modules.md` 规划数学/英语/益智 | 用户指令「启动路线图模块」 | 页面 / 导航 / AC / 进度回写 |
| 2026-10-02 | Spec v0.4：路线图模块 2——新增「数学启蒙」（数一数/比大小/算一算，分龄难度），§9 新增 AC-18；小测通用逻辑抽到 `shared/lib/quizCore`（识字复用） | 路线图持续交付 | 页面 / 导航 / AC / 共享逻辑 |
| 2026-10-02 | Spec v0.5：路线图模块 3——新增「英语启蒙」（单词卡 + 看义选词小测），§2 交付范围拆分英语/益智，§9 新增 AC-19 并注明题型替代原因（音频未就绪 → 看义选词；词表仅收录图标语义精确的词） | 路线图持续交付 | 页面 / 导航 / AC / 词表约束 |
| 2026-10-02 | Spec v0.5.1（**P0 缺陷修复，无契约变更**）：修复 AC-04 护眼阻断在已压栈内容页失效——`RootNavigator` 达限时显式 `reset` 到 `Blocked` 单路由。原实现只替换底部 Tab，`BookReader`/`Literacy`/`Math`/`English` 仍保持聚焦可继续玩。AC-04 原文已要求「不可跳过」，故不新增 AC，仅记录修复（详见 `docs/decisions/OPEN-DECISIONS.md`） | 路线图模块 3 交付前的交付边界核查发现既有 P0 违反 | 导航 / 护眼 P0 |
| 2026-10-02 | Spec v0.6：路线图模块 4——新增「益智游戏 · 记忆翻牌」，§2 交付范围更新，§9 新增 AC-20（玩法与结算）/AC-21（游戏防沉迷：达限中断 + 结算页重开需冷却），§8 设计 Token 补 `puzzle` 模块色。**同期把 AC-04 的阻断改为确定性实现**：声明列表保持稳定、聚焦路由只由守卫 effect 决定（原「条件渲染 + reset」在同一次提交内竞争，实测偶发失效） | P2 路线图四个模块全部交付 | 页面 / 导航 / 设计 Token / AC |
| 2026-10-02 | Spec v0.6.1（**修复 + 测试补齐，无契约变更**）：① `QuizCard`（绘本互动问答选项）由 `View onTouchEnd` 改为 `Pressable`，补 `accessibilityRole="button"` 与 `accessibilityState` —— 此前是全仓唯一一处绕开响应者系统的点击承载，既缺无障碍语义，也会诱使后人用 `fireEvent(el,'touchEnd')` 写出「真机未必能点」的假绿测试；② 补齐 AC-02 / AC-05 的屏幕级自动化测试（`bookReader.render.test.tsx` 8 条、`parentGate.render.test.tsx` 13 条），C 端测试套件达 14 套件 / 106 条 | 关闭 Phase 4 遗留的 C 端自动化测试空白（见 `docs/decisions/OPEN-DECISIONS.md`） | 组件无障碍 / 测试 |

## 14. 内容维护与运营后台（详设）

### 14.1 角色与权限矩阵
| 能力 | editor | admin |
|------|:------:|:-----:|
| 查看内容/媒体/统计 | Y | Y |
| 创建 / 编辑内容 | Y | Y |
| 提交审核 | Y | Y |
| 上传 / 编辑媒体 | Y | Y |
| 审核通过 / 驳回 | N | Y |
| 发布 / 下架 / 归档 / 回滚 | N | Y |
| 删除内容 / 删除媒体 | N | Y |
| 模块 / 分类管理 | N | Y |
| 用户与角色管理 | N | Y |
| 审计日志查看 | N | Y |
| 后台设置 | N | Y |

### 14.2 内容生命周期状态机
```
draft ──提交审核──▶ in_review ──审核通过──▶ published ──下架──▶ archived
  ▲                    │                                   │
  └──────驳回──────────┘                                   │
  └──────────────── 重新编辑（归档 → 草稿）──────────────────┘
```
- **draft**：仅后台可见
- **in_review**：待审，App 不可见
- **published**：App 可见（`content/list` 只返回此态）
- **archived**：下架/归档，App 不可见

### 14.3 内容类型（content_items.type）
| type | 说明 | 关联媒体 |
|------|------|----------|
| book | 绘本 | 封面图 + 分页图 + 旁白音频 |
| song | 儿歌音频 | 音频 + 封面 |
| habit | 习惯任务 | 图标（Phosphor iconKey）+ 说明 |

### 14.4 审计事件（写入 audit_log）
`admin.auth.login` / `admin.content.create` / `admin.content.update` / `admin.content.submit` / `admin.content.approve` / `admin.content.reject` / `admin.content.publish` / `admin.content.withdraw` / `admin.content.duplicate` / `admin.content.unpublish` / `admin.content.archive` / `admin.content.restore` / `admin.content.delete` / `admin.media.upload` / `admin.media.delete` / `admin.user.role_change` / `admin.user.status_change`

### 14.5 分域与安全
- 后台独立域名/子路径部署，与儿童 App 分离。
- 后台登录独立于家长登录；`/api/v1/admin/*` 全部经 `adminAuth` + `rbac` 中间件。
- 后台接口不返回儿童个人可识别信息；统计仅聚合。
- 上传走云存储临时凭证，前端直传，后端只落元数据。

---

### 附：项目总监裁决记录
1. **图标库**：裁决 **Phosphor**（覆盖架构师原 Lucide 方案）——圆润描边契合儿童 Claymorphism、一等支持 RN+Flutter/Web、多字重利于低龄。
2. **主色**：裁决 **薄荷青 #12B5A6**（覆盖 PM 靛蓝基线）——规避靛/紫/蓝 AI 模板味与 P0-2 红线边缘。
3. **后台形态**：裁决**独立 Web 后台**，不混入儿童 App 包体（运营效率 + 包体隔离 + 合规分域）。
4. **后台组件库**：架构师选 Ant Design 5，设计师主张 Headless 自绘 —— 裁决**采用 Ant Design 5 但受严格 Token 约束**：单点 ConfigProvider 映射 `docs/tokens-admin.json`（colorPrimary=`#0B7E73` 保 AA）、品牌原语（Button / ContentStatusBadge / Tag / Card）自绘、禁用 Ant 默认 message/notification（改用自研 Toast）、ESLint 禁 `@ant-design/icons`（图标仅 Phosphor）。理由：后台为效率工具，Table/Form/Upload/Modal 自研成本高且易错；以 Token 约束消除「默认皮肤失控」风险。
5. **主色分级使用（跨产品）**：薄荷青 `#12B5A6` 白底对比仅 2.57:1，不达 AA —— 裁决**全产品分级使用**：实心填充/大色块用 `#12B5A6`，交互文字与白字实心按钮用 `#0B7E73`（4.95:1）。儿童 App 需同步修正（任务 #24）。
