# DodoKid 路线图模块规划（P2）

> 依据：Spec §2「P2 儿童 App：识字 / 数学 / 英语 / 益智游戏」+ 用户「启动路线图模块」指令。
> 原则：每个模块都复用既有基座（年龄路由 / 护眼计时 / 进度回写 / 设计 Token / Phosphor 图标），不引入新框架。

## 状态总览

| 模块 | 状态 | 说明 |
|------|------|------|
| 识字认知 | **已实现** | 字卡学习（分龄、翻面组词/例句、听读音）+ 认读小测（四选一、百分制、进度回写）；AC-16/AC-17 |
| 数学启蒙 | **已实现** | 数一数 / 比大小 / 算一算（分龄难度、圆点可视化、结算与得分回写）；AC-18 |
| 英语启蒙 | **已实现** | 单词卡学习（分龄、图标/音标/读音入口）+ 看义选词小测（四选一、百分制、进度回写）；AC-19 |
| 益智游戏 | **已实现** | 记忆翻牌（分龄牌组、翻牌次数结算与星级、进度回写、结算页重开冷却）；AC-20/AC-21 |

## 已实现：益智游戏 · 记忆翻牌（交付记录）

- 代码：`dodokid/src/features/puzzle/`（`memoryData.ts` 难度与候选面 / `memoryLogic.ts` 翻牌状态机纯逻辑 / `MemoryFace.tsx` 卡面图标 / `MemoryBoard.tsx` 牌面 + 状态条 / `MemoryResult.tsx` 结算与重开冷却 / `MemoryScreen.tsx` 编排）
- 难度：3-4 岁 → 4 组 8 张；4-6 岁 → 6 组 12 张，均 4 列排布
- 状态机：翻第 1 张 → 翻第 2 张 → 同面配对消除 / 异面锁定 900ms 后自动翻回；锁定期间点击无效（幂等）
- 结算：`flips` 按每一次翻牌计；理论最少 = 组数 × 2；星级 3/2/1 与百分制得分（下限 40）均由纯函数给出
- 防沉迷（AC-21）：结算页「再来一局」有 **5 秒冷却**（倒计时期间禁用），并给出护眼提示；达限中断由 RootNavigator 统一 `reset` 到阻断屏
- 导航：`RootNavigator` 新增 `Puzzle` 路由；首页「益智游戏」宫格直达；`tokens` 新增模块色 `puzzle` = `#FF6F9C` / `moduleStrong` = `#B23A6E`（白图标 5.64:1，落在既有 4.71–6.58 区间内）
- 进度：`puzzle:memory`
- 测试：`puzzle.test.ts`（纯逻辑 18 条）+ `puzzleBoard.render.test.tsx`（渲染与冷却交互 7 条）
- **设计约束**：卡面只呈现图形、不承载文字语义，因此不存在英语模块的「图标语义必须与词义一致」约束，可自由选取区分度高的图标

## 已实现：英语启蒙（交付记录）

- 代码：`dodokid/src/features/english/`（`englishData.ts` 词表 / `wordQuestions.ts` 出题纯逻辑 / `WordIcon.tsx` 图标映射 / `WordQuiz.tsx` 作答界面 / `EnglishScreen.tsx` 单词卡浏览）
- 词表：3-4 岁 → cake / cat / dog / sun / moon / star（6 张）；4-6 岁 → fish / bird / tree / car / house / heart（6 张）
- 题型：**看义选词**（图标 + 中文释义 → 四选一英文单词）。原规划的「听音选词」依赖发音音频，音频未就绪，故改用零音频依赖的题型；卡片仍保留 `NarrationButton` 读音入口，音频接入后补充听音题型
- 导航：`RootNavigator` 新增 `English` 路由；首页「英语启蒙」宫格直达
- 进度：浏览写 `english:<wordId>`；小测得分写 `english:quiz`（复用 `progressApi`）
- 共享：复用 `shared/lib/quizCore`（洗牌/得分/索引），与识字、数学同构
- 测试：`english.test.ts`（纯逻辑 7 条）+ `englishQuiz.render.test.tsx`（渲染交互 6 条）
- **踩坑记录（重要）**：逻辑文件原名 `wordQuiz.ts`，与组件 `WordQuiz.tsx` 仅差大小写 —— 在 Windows/macOS 大小写不敏感文件系统上，模块解析会命中逻辑文件、导致 `WordQuiz` 无导出（TS2305）。已重命名为 `wordQuestions.ts`。**新增模块时，纯逻辑文件名必须与组件文件名在「忽略大小写」后仍不同**（对比：识字用 `quiz.ts` / `LiteracyQuiz.tsx`，数学用 `problems.ts` / `MathPractice.tsx`）
- **词表约束**：只收录图标库中存在「语义精确」图标的词。phosphor 无「苹果」水果图形（只有品牌 logo `AppleLogo`），故未收录 apple；练习题干是图标，图标与词义不符会让低龄儿童产生错误联想

## 已实现：数学启蒙（交付记录）

- 代码：`dodokid/src/features/math/`（`mathData.ts` 难度配置 / `problems.ts` 出题纯逻辑 / `MathScreen.tsx` 玩法选择 / `MathPractice.tsx` 作答界面）
- 难度：3-4 岁 → 数到 5、加法和≤5、每轮 6 题；4-6 岁 → 数到 10、和≤10、每轮 8 题
- 玩法：数一数（点阵→选数量）、比大小（两组点阵→左多/右多/一样多）、算一算（a+b 十以内）
- 导航：`RootNavigator` 新增 `Math` 路由；首页「数学启蒙」宫格直达
- 进度：得分写 `math:<kind>`（复用 `progressApi`）
- 共享：小测通用逻辑抽到 `src/shared/lib/quizCore.ts`（洗牌/得分/索引/选项生成），识字模块已改为复用
- 测试：`math.test.ts`（纯逻辑 9 条）+ `mathPractice.render.test.tsx`（RNTL 渲染交互 3 条）

## 已实现：识字认知（交付记录）

- 代码：`dodokid/src/features/literacy/`（`literacyData.ts` 字卡 / `quiz.ts` 纯逻辑 / `LiteracyScreen.tsx` / `LiteracyQuiz.tsx`）
- 导航：`RootNavigator` 新增 `Literacy` 路由；首页「识字认知」宫格直达（其余模块仍走内容列表）
- 进度：浏览字卡写 `literacy:<cardId>`，小测得分写 `literacy:quiz`（复用 `progressApi`）
- 测试：`src/__tests__/literacy.test.ts`（纯逻辑 12 条）+ `literacyQuiz.render.test.tsx`（RNTL 渲染交互 3 条）

## 方案 A：数学启蒙（已实现 — 见上方交付记录）

- **交互形态**：数数配对（数字 ↔ 圆点/物品数量）、比大小、10 以内加减小测（带可视物）。
- **复用**：`cardsForAge` 式分龄过滤 + 「四选一」小测框架（`quiz.ts` 可参数化复用，题干改为算式/数量）。
- **新增**：`features/math/`（题目生成纯函数 + 屏幕）；数字图形用 Phosphor + 简单 View 圆点，不引入图片资源。
- **验收草案**：AC-18「When 儿童进入数学启蒙，系统**必须**按年龄提供数与量配对练习并记录得分」。
- **成本**：与识字同构，最低，建议**第二个做**。

## 方案 B：英语启蒙（已实现 — 见上方交付记录）

- **交互形态**：单词卡（图/词/音）+ 看义选词；后续可加听音选词与简单跟读（复用绘本的录音交互）。
- **复用**：识字字卡屏已泛化（char→word、pinyin→音标/中文释义）；`NarrationButton` 保留读音入口。
- **已落地**：AC-19 调整为「看义选词」，绕开音频依赖先交付；词表受「图标语义精确」约束（未收录 apple）。
- **待补**：发音音频依赖媒体库，需运营后台可配置（否则为占位音）；音频就绪后补听音题型。离线缓存走 `lib/offline`（当前音频为占位 URL，未纳入下载白名单）。

## 方案 C：益智游戏（已实现 — 首个玩法为记忆翻牌，见上方交付记录）

- **交互形态**：轻量小游戏，单局 ≤2 分钟，含鼓励性结算。
- **复用**：护眼计时、进度回写、统一结算卡片样式。
- **首个玩法**：**记忆翻牌**（纯状态机 + 卡片网格，无图片依赖，可测试性最好）。
- **防沉迷**：结算页「再来一局」加 5 秒冷却（不提供无冷却的连续诱导）；达限中断沿用统一阻断层。
- **后续玩法候选**：找不同、拼图、听音辨物（需音频资源）。

## 建议排期

1. ~~**数学启蒙**~~ 已完成
2. ~~**英语启蒙**~~ 已完成（听音题型待音频资源接入后补充）
3. ~~**益智游戏**~~ 已完成（记忆翻牌；后续玩法候选见方案 C）

> **P2 路线图四个模块已全部交付**（识字 / 数学 / 英语 / 益智）。

## 共性要求（所有新模块必须满足）

- 单文件 ≤300 行；图标仅 Phosphor；颜色仅取 `design/tokens`；无 emoji。
- 纯逻辑与 UI 分离，纯逻辑必须可单测（`npm test`）。
- 计入护眼计时（`useContentActivity`）；进度回写 `progressApi.upsert(childId, { contentId, pageIndex, completed, score })`。
- 新能力必须先在 Spec §9 增加 AC，再实现（QA 以 AC 为唯一验收依据）。
