# DodoKid

完全免费、无广告、护眼限时的 **0–6 岁分龄早教陪伴 App**，配套一套内部内容运营后台。

> 儿童可独立使用；家长负责设置时长与内容偏好。后台不展示任何儿童可识别信息。

---

## 仓库结构

| 目录 | 说明 | 技术栈 |
|------|------|--------|
| `dodokid/` | 儿童 App（iOS / Android / Web） | Expo SDK 53 · React Native 0.79 · React 19 · Zustand · TanStack Query · Phosphor 图标 |
| `dodokid-admin/` | 内容运营后台（Web） | Vite 5 · React 18 · TypeScript · Ant Design 5（受严格 Token 约束） |
| `dodokid/cloudbase/functions/api/` | 后端云函数 | 腾讯 CloudBase Node 云函数，分层 `routes / controllers / services / repositories / middlewares / validators` |
| `docs/` | 规格与决策文档 | 见下方「文档索引」 |

---

## 在 GitHub 上编译安卓端

**不需要 Expo 账号，也不需要任何 secret**，直接用 GitHub 托管 runner 原生编译。

工作流文件：`.github/workflows/android.yml`

| 作业 | 触发条件 | 内容 |
|------|----------|------|
| `verify` | 每次 push / PR | 全量质量门禁：儿童 App `typecheck` + `eslint` + `jest`，后端冒烟测试，后台 `tsc` + `eslint` + `build` |
| `apk` | 推 `main` / 手动触发 | 依赖 `verify` 通过后：`expo prebuild` 生成原生工程 → Gradle `assembleRelease` → 上传 APK artifact |

### 怎么用

1. 推送到 `main` 即自动触发；或手动：**Actions → Android Build → Run workflow**。
2. 跑完后在这次运行的 **Artifacts** 区域下载 `dodokid-android-apk`（zip 内是 `.apk`，可直接安装）。
3. PR 只跑 `verify`（快速反馈），不跑耗时的原生编译。

### 首次构建较慢的原因

`app.json` 开启了 `newArchEnabled: true`（Expo SDK 53 默认），Gradle 需要下载 **NDK/CMake** 并编译 RN 原生代码，首次约 15–30 分钟；后续构建命中 Gradle 缓存会明显加快。

### 上架应用商店前必须改签名

prebuild 生成的 release 构建默认用 **debug keystore** 签名（因此 CI 无需 secret）。若要发布到 Google Play / 应用市场：

1. 本地生成正式 keystore（**不要提交到仓库**，本仓库 `.gitignore` 已忽略 `*.keystore` / `*.jks`）：
   ```bash
   keytool -genkeypair -v -keystore dodokid-release.keystore -alias dodokid \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
2. 把 keystore 以 **GitHub Secret** 形式配置（不要写进代码库）：
   - `ANDROID_KEYSTORE_BASE64`：`base64 -w0 dodokid-release.keystore`
   - `ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASSWORD`
3. 在 `android/app/build.gradle` 中改为读取上述 secret 并配置 `signingConfigs.release`。

---

## 本地开发

### 前置

Node.js ≥ 20、npm、以及（仅运行 App 时）Expo CLI。

### 儿童 App

```bash
cd dodokid
npm ci
npm start            # Expo Dev Server
npm run android      # 或 ios / web
```

### 运营后台

```bash
cd dodokid-admin
npm ci
npm run dev
npm run build
```

> 注意：后台构建/部署**必须**注入 `VITE_API_BASE`（见 `dodokid-admin/.env.production`）。
> 缺省时构建会打包并启用 MSW Mock，表现为「构建成功但连不上后端」——这是最常见的静默故障。

### 后端云函数

```bash
cd dodokid/cloudbase/functions/api
npm ci
node tests/smoke-admin.test.js      # 56 条断言
node tests/smoke-routes.test.js     # 29 条断言
```

冒烟测试使用内存态与固定夹具，**不连数据库、不需要 `.env`**。

---

## 质量门禁

改动后请本地跑通再提交；CI 会执行同一套命令。

| 端 | 命令 |
|----|------|
| 儿童 App | `npm run typecheck` · `npx eslint src` · `npm test` |
| 运营后台 | `npx tsc --noEmit` · `npx eslint .` · `npm run build` |
| 后端 | `node tests/smoke-admin.test.js` · `node tests/smoke-routes.test.js` |

### 项目硬性约束

- 交互元素必须用 `Pressable` / `Button`，**禁止 `View` + `onTouch*`**（缺无障碍语义，且会诱导写出假绿测试）
- 图标只用 **Phosphor**（16 / 20 / 24px），**禁止用 emoji 作功能图标**
- 单文件 ≤ 300 行；颜色一律走 `design/tokens`（仅 `#fff` / `#000` 例外）
- 禁止紫粉渐变主视觉
- 内容状态机 `TRANSITIONS` 单点定义，前后端不得重复实现
- 日期计算一律 UTC

---

## 文档索引

| 文档 | 内容 |
|------|------|
| `docs/deploy-dodokid-heymf-cn.md` | **上线执行文档**（全自托管：Docker + MongoDB + Nginx，域名 `dodokid.heymf.cn`） |
| `docs/Spec-DodoKid.md` | **规格即契约**：范围、API、页面、设计 Token、验收标准（AC-01~21） |
| `docs/roadmap-modules.md` | P2 互动模块（识字 / 数学 / 英语 / 益智）规划与交付记录 |
| `docs/deployment-plan.md` | 备选部署方案（CloudBase 云函数 + 多子域名） |
| `docs/decisions/OPEN-DECISIONS.md` | 未决/已决事项登记册（含关闭证据） |
| `docs/decisions/ADR-*.md` | 架构决策记录 |

---

## 后端部署形态

后端是**一份代码、两种形态**，由环境变量 `DB_DRIVER` 切换，业务层不做区分：

| `DB_DRIVER` | 数据库 | HTTP 层 | 部署方式 |
|-------------|--------|---------|---------|
| `mongo`（**当前采用**） | MongoDB（经薄适配层） | `server.js`（Express，能返回真实 4xx/5xx） | `docker compose up -d` |
| `cloudbase` | CloudBase 文档数据库（原生） | 云函数触发器 | `tcb fn deploy api --dir .` |

之所以能共用一套代码：全仓对数据库的依赖面被刻意控制得很窄（无聚合、事务、批量写），
适配层只做映射。详见 `dodokid/cloudbase/README.md`。

---

## 当前状态

- 儿童 App 6 个 P2 互动模块与全部 P0 能力已实现；自动化测试 **14 套件 / 106 用例**全绿
- 后端冒烟 **85 条断言**全绿；运营后台三门禁全绿
- 待外部条件：真机性能实测（AC-08）、真实 COS 上传链路联调（AC-12）

---

## License

MIT
