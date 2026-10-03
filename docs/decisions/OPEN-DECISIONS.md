# OPEN-DECISIONS — DodoKid

> 规范：只追加 + 就地关闭（OPEN → RESOLVED，补 Resolution 字段）。每次 Phase 开始时把未决项复现到工作上下文最前面。
> 三类固定 slug：`waiting-on-external-condition` / `design-decision-to-evaluate` / `existing-design-boundary`

| Date | Source | Slug | Open Item | Related Constraints | Current Leaning | Blocked By | Resolves When | Status |
|------|--------|------|-----------|---------------------|-----------------|------------|---------------|--------|
| 2026-10-02 | Phase 3 核查 | waiting-on-external-condition | DodoKid 是否补齐「内容维护/运营」能力，以及采用哪一档方案（A 控制台+CLI / B 内部 CMS / C 内容中台） | 现状：`/content/*` 全为只读接口，无任何写入端点；内容仅靠一次性 `db/seed-content.js` 灌入；角色仅 `parent`，无 `admin`/`editor`；App 无运营后台页面。数据模型（content_modules/content_items/media_assets）已就绪，缺的是写入与维护链路 | 用户已选定 **方案 B（内部 CMS 运营后台）**，并明确「AI 全量开发，不受时间与 MVP 限制」 | 已由用户拍板（2026-10-02） | 用户选定即可 | 2026-10-02 用户选定 | RESOLVED |
| 2026-10-02 | 路线图模块 3 交付核查 | existing-design-boundary | **AC-04 护眼阻断在「已压栈内容页」失效（P0 违反）**：`isBlocked` 仅条件替换 `MainTabs`↔`Blocked`，全仓**无任何** `navigate('Blocked')` / `reset` 调用；儿童一旦进入 `BookReader` / `Literacy` / `Math` / `English`，达限后该路由仍被声明且保持聚焦 → **不中断、可继续玩**，且 `useContentActivity` 仍在计时 | 原设计隐含假设「内容消费都在底部 Tab 内」，但识字/数学/英语/绘本阅读器均为 RootStack 顶层路由。AC-04 明列「不可跳过」 | 最终实现：**声明列表保持稳定**（`MainTabs` 与 `Blocked` 恒声明），聚焦路由只由守卫 effect 的 `reset` 决定。首版修法（保留条件渲染 + 追加 reset）实测在同一次提交内与子元素重算竞争，**偶发失效**（单跑通过 / 并行全量跑失败），已弃用 | 无 | 集成测试证明 + 突变验证（去掉 reset 即失败） | **RESOLVED（2026-10-02）**：新增 `src/__tests__/eyeCareBlock.navigation.test.tsx`（真实渲染 RootNavigator，3 条：Math 页达限被切走 / 解除阻断回落 MainTabs / 家长验证入口可达），突变验证有效；调试验证 3/3 单跑 + 2/2 全量并行全绿 |
| 2026-10-02 | Phase 4 验收（QA） | waiting-on-external-condition | **AC-08 性能验收 blocked**：无冷启动 ≤3s / 翻页 p95<500ms 的真机测量数据 | 儿童 App（RN/Expo）需低端安卓真机 profiling；静态代码无法证明 | 排期真机性能测试后闭环 | 需真机设备 | profiling 报告产出并达标 | OPEN |
| 2026-10-02 | Phase 4 验收（QA） | design-decision-to-evaluate | **C 端剩余交互仍缺自动化测试**：绘本共读（AC-02）、家长锁（AC-05）尚只有代码级核查 | 测试基建已建（jest-expo + RNTL 13 + RTR 19.0.0，`npm test`），AC-03/AC-04 已覆盖；AC-02 需 RNTL 渲染测（跟读/答题回调）、AC-05 可测 authStore gatePassed 分支 | 已有基建，按增量补测即可 | 无 | AC-02/AC-05 主路径纳入 CI 并可运行 | **RESOLVED（2026-10-02）**：新增 `bookReader.render.test.tsx`（8 条：分页/首页边界/末页 completed/跟读加分/答对答错分流/续读定位）+ `parentGate.render.test.tsx`（13 条：三种 reason 文案与回落/失败不上锁不返回/指纹与密码两条通过路径/**仅 eyeCare 入口解除护眼阻断、parentCenter 不得绕过**/异常上报/整屏无设置文案）。C 端套件达 14 套件 106 条，连续 2 轮全量全绿；两条互逆边界经**突变校验**（去掉 `unblock()` → 恰 1 条失败） |
| 2026-10-02 | Phase 4 验收（QA） | design-decision-to-evaluate | **后台 antd chunk 744 kB 超限警告**（build 可用但首屏偏大） | dodokid-admin vite.config 增加 manualChunks（antd/rc-icons 单拆）或按路由 code-split | low：仅警告非错误，但全量开发策略下应处理 | 无 | bundle 体积低于 500 kB 阈值或确认豁免理由 | RESOLVED |
| 2026-10-02 | Phase 4 验收（QA） | waiting-on-external-condition | **AC-12 CDN 引用可用性**仅验证到 metadata 持久化与缺凭证报错，真实 COS 上传/引用链路未联调 | 需真实 COS 配置（云环境联调） | 部署 dev 环境后联调一次 | CloudBase dev 环境 + COS 凭证 | 真实上传→引用→C 端可访问链路走通 | OPEN |

---

## 附：三档方案详情

### 方案 A — MVP 轻量（零/极低开发成本）
- 不进 App、不加公网后台。
- 直接用腾讯云 CloudBase 数据库控制台维护 `content_modules` / `content_items` / `media_assets`。
- 把一次性 `seed-content.js` 升级为可重复执行的**内容导入 CLI**：内容 JSON/CSV → 校验 → 覆盖式发布；媒体批量上传脚本。
- 影响：**不新增 App API 端点、不新增表** → 按 Spec 变更流程属「小改」，更新 Spec 变更记录即可。
- 适用：内容量小、更新低频的 MVP 阶段。

### 方案 B — 中期内部 CMS（推荐 v1.1）
- 独立受保护 Web 后台（不进儿童 App），提供：内容 CRUD、草稿/发布状态机、媒体上传、分龄标签、内容预览。
- 需要新增：`admin`/`editor` 角色与鉴权、内容写接口（≥4 个）、媒体上传接口、内容状态字段。
- 影响：**新增端点 ≥2 + 新增角色/字段** → 按 Spec 变更流程属「大改」，需回 Phase 0 澄清后更新三文档与 Spec。
- 适用：有运营同事需要日常改内容、需要审核发布流程。

### 方案 C — 长期内容中台
- 版本化、灰度发布、多语言、审核流、A/B、内容效果数据回流。
- 适用：内容规模化后的长期演进，MVP/v1 不考虑。

---

## 已关闭项

| 关闭日期 | 条目 | Resolution | 拟升格 ADR |
|----------|------|------------|------------|
| 2026-10-02 | 内容维护/运营能力补齐方案 | 用户选定 **方案 B：内部 CMS 运营后台**（内容 CRUD + 状态机 + 媒体库 + 分龄标签 + RBAC + 审计）；范围策略同步放宽为「AI 全量开发，不受时间与 MVP 限制」。已写入 Spec v0.2 第 5.2 / 6.2 / 7.2 / 14 章。 | ADR-004（后台技术栈）/ ADR-005（RBAC 模型）/ ADR-006（内容生命周期与版本化） |
| 2026-10-02 | 后台 antd chunk 744 kB 超限告警 | `vite.config.ts` 改用函数式 manualChunks：antd + rc-* / @rc-component / dayjs 合为单一 vendor chunk（750 kB，gzip 236.5 kB，长期缓存可接受），框架/路由/查询/图标独立分包；`chunkSizeWarningLimit` 提至 800 kB 并在配置内注明理由。另修正首版「antd / rc 分拆」引发的 circular chunk 与空 dayjs chunk 告警。**实测零告警**。附带验证：设置 `VITE_API_BASE` 后 Mock chunk 被正确摇树移除（未设则打包 MockServer，印证部署方案 §4 的告警项）。 | — |
| 2026-10-02 | C 端测试基建缺失 | 建立 jest-expo 53 + @testing-library/react-native 13 + react-test-renderer 19.0.0（对齐 React 19.0.0/RN 0.79.2），`package.json` 增 `jest` 配置与 `npm test`。新增 11 条单测：AC-04 护眼防沉迷（软提示/日限阻断/阻断后不累加/家长锁解锁/额度下限/跨日重置 6 条）、AC-03 连续打卡（含今/不含今/断档/空集/跨月 5 条）。**首跑即抓出一个真实缺陷**：`addDays` 本地时区解析 + UTC 序列化混用导致 ±1 天偏移（非 UTC 时区算错连续天数，QA 走查未发现），已抽为纯函数模块 `src/features/habit/streak.ts` 并统一改为 UTC 运算。门禁：typecheck 0 / eslint 0 / 11 tests passed。 | — |
