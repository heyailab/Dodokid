# DodoKid 部署方案（Phase 4）

作者：卜宕机（运维工程师） 日期：2026-10-02
适用范围：CloudBase 后端（云函数 api + 云数据库 + 云存储）、运营后台 Web（dodokid-admin）、儿童 App（EAS，本次仅列规划）。
契约依据：`docs/Spec-DodoKid.md`（§5 API、§6 DB 集合、§14 内容维护详设、AC-09/10/11/13/15）。

> 占位符约定：`<ENV_ID_DEV>` / `<ENV_ID_PROD>` 为 CloudBase 环境 ID；`<COS_BUCKET>`、`<DOMAIN_ADMIN>` 等同理。所有 `<...>` 上线前必须替换为真实值。

---

## 1. 环境规划

### 1.1 两套 CloudBase 环境

| 环境 | envId 占位 | 用途 | 备注 |
|------|-----------|------|------|
| dev | `<ENV_ID_DEV>` | 开发联调、seed 数据、冒烟验证 | `NODE_ENV=development`，SMS_PROVIDER=log（验证码打印到日志） |
| prod | `<ENV_ID_PROD>` | 线上 | `NODE_ENV=production`（强制要求 JWT_SECRET，缺失时 `config.js` 启动即抛错） |

创建环境：

```bash
npm install -g @cloudbase/cli
tcb login                       # 浏览器授权；CI 用 tcb login --apiKeyId <ID> --apiKey <KEY>
tcb env list                    # 查看现有环境
tcb env create                  # 按交互提示分别创建 dev / prod
tcb env use <ENV_ID_DEV>        # 切换默认环境；脚本内也可用 -e <ENV_ID> 显式指定
```

### 1.2 环境变量清单（云函数 api，来源 `cloudbase/functions/api/config.js` 与 `cloudbase/.env.example`）

| 名称 | 用途 | dev 值策略 | prod 值策略 | 敏感 |
|------|------|-----------|------------|------|
| TCB_ENV | CloudBase 环境 ID（云上自动注入，本地脚本需显式） | `<ENV_ID_DEV>` | `<ENV_ID_PROD>` | 否 |
| NODE_ENV | 运行模式；development 会向响应暴露开发验证码 | development | production（必须） | 否 |
| JWT_SECRET | JWT HMAC 签名密钥（父端 aud=app 与后台 aud=admin 共用同一密钥，靠 audience 字段隔离，见 ADR-005） | 长随机串（可用测试值） | 32+ 字符强随机串，与 dev 完全不同，仅存云函数环境变量/密钥管理 | 是 |
| JWT_ACCESS_TTL_SEC | access token 有效期 | 900 | 900 | 否 |
| JWT_REFRESH_TTL_SEC | refresh token 有效期 | 604800 | 604800 | 否 |
| GATE_TOKEN_TTL_SEC | 家长门 token 有效期 | 300 | 300 | 否 |
| ADMIN_ACCESS_TTL_SEC | 后台 access token 有效期 | 900 | 900 | 否 |
| ADMIN_REFRESH_TTL_SEC | 后台 refresh token 有效期 | 604800 | 604800 | 否 |
| ADMIN_LOGIN_RATE_LIMIT_PER_MIN | 后台登录限流 | 10 | 10 | 否 |
| SMS_CODE_TTL_SEC / SMS_CODE_LENGTH | 验证码参数 | 300 / 6 | 300 / 6 | 否 |
| SMS_RATE_LIMIT_PER_MIN | 发送验证码限流 | 10 | 10 | 否 |
| LOGIN_RATE_LIMIT_PER_MIN | 登录/注册限流 | 10 | 10 | 否 |
| DEFAULT_RATE_LIMIT_PER_MIN | 默认限流 | 60 | 60 | 否 |
| SMS_PROVIDER | 短信通道：log 打印 / tencent 真实 SDK | log | tencent（需配 tencentcloud-sdk-nodejs-sms 与凭据） | 否 |
| APP_VERSION / MIN_APP_VERSION | /version 元信息 | 1.0.0 | 1.0.0 | 否 |
| PRIVACY_POLICY_URL | 隐私政策链接 | 占位 URL | 真实备案域名 URL | 否 |
| COS_SECRET_ID / COS_SECRET_KEY | 媒体上传 STS 临时凭据签发（config.js `uploadCredTtlSec`） | 测试子账号密钥 | 最小权限子账号密钥（仅目标存储桶写入） | 是 |
| COS_BUCKET | 存储桶全名（含 APPID 后缀） | `<COS_BUCKET_DEV>` | `<COS_BUCKET_PROD>` | 否 |
| COS_REGION | 存储桶地域 | ap-guangzhou | ap-guangzhou | 否 |
| MEDIA_CDN_BASE_URL | 媒体 CDN 前缀 | 空（用临时 URL） | `<CDN_URL_PROD>` | 否 |
| MEDIA_MAX_SIZE_MB / MEDIA_ALLOWED_MIME_TYPES | 上传限制 | 默认值 | 默认值（50MB；png/jpeg/webp/mpeg/mp4） | 否 |
| UPLOAD_CRED_TTL_SEC | 临时凭据有效期 | 1800 | 1800 | 否 |

数据库工具脚本（`db/init-collections.js`、`db/seed-content.js`、`db/create-ops-user.js`）另需本地环境变量：`TCB_ENV`、`TCB_SECRET_ID`、`TCB_SECRET_KEY`（腾讯云 API 密钥，仅在运维本机/CI 使用，不入库）。

### 1.3 JWT 双 audience 配置方式

- 密钥统一由 `JWT_SECRET` 提供（HMAC 单密钥）。双 audience 隔离在代码层实现：父端签发 `aud=app`，运营后台签发 `aud=admin`；后台接口的 `adminAuth` 中间件校验 `aud===admin`，父端接口的 `auth` 中间件校验 `aud===app`，跨端 token 互认即 401（冒烟测试已覆盖：app token 打后台接口 -> 401）。
- 运维要求：dev 与 prod 必须使用不同 `JWT_SECRET`，防止 dev 泄露的 token 在 prod 复用；轮换密钥会使全体 refresh token 失效，需公告后低峰执行。

---

## 2. 数据库初始化（19 集合）

集合与索引的唯一事实来源：`dodokid/cloudbase/db/schema.json`（19 个集合：users、child_profiles、consent_records、content_modules、content_items、progress_records、milestones、parental_settings、preferences、media_assets、feedback、audit_log、sms_codes、rate_limits、token_blacklist、admin_settings、content_revisions、content_categories、content_tags）。

### 2.1 建库与索引

```bash
cd dodokid/cloudbase/db
npm install                              # @cloudbase/node-sdk + @cloudbase/manager-node

# 方式一：脚本自动创建（推荐）
TCB_ENV=<ENV_ID> TCB_SECRET_ID=<SID> TCB_SECRET_KEY=<SKEY> node init-collections.js

# 方式二：若 manager-node 版本 API 不匹配，脚本会打印每条 tcb CLI / 控制台操作步骤，人工照做
```

要点：

- 脚本逐集合 `createCollection`、逐索引 `createIndex`，已存在的会 warn+skip，**可安全重复执行（幂等）**。
- 关键唯一索引（手工核对必建）：`users.idx_phone`、`content_modules.idx_key`、`admin_settings.idx_key`、`content_categories.idx_key`、`content_tags.idx_key`、`content_revisions.idx_content_version (contentId,version unique)`、`token_blacklist.idx_jti`、`parental_settings.idx_userId`、`preferences.idx_userId`。
- 查询索引：`content_items.idx_module_age_status`（C 端只读 published，AC-13/15）、`content_items.idx_status`（后台列表）、`audit_log.idx_ts` 等，以 schema.json 为准逐条核对。
- 验证：`tcb db list -e <ENV_ID>` 应列出 19 个集合；索引在 CloudBase 控制台数据库页逐集合比对 schema.json。

### 2.2 Seed 内容

```bash
TCB_ENV=<ENV_ID> TCB_SECRET_ID=<SID> TCB_SECRET_KEY=<SKEY> node seed-content.js
```

- 顺序：**必须先 init-collections 再 seed**（seed 写入 content_modules/content_items/media_assets）。
- 幂等性：按 `key`（模块）与 `title`（条目）先查后插，重复执行不会产生重复数据。
- 注意：seed 的 `cdnKey/url` 是 `cloud://dodokid-env/...` 占位，上线前须在 prod 上传真实素材（`tcb storage upload` 或控制台）并回填 media 记录。

### 2.3 初始运营账号

```bash
cd dodokid/cloudbase/db
TCB_ENV=<ENV_ID> TCB_SECRET_ID=<SID> TCB_SECRET_KEY=<SKEY> \
  node create-ops-user.js --phone 13800138000 --password "<min-8-chars>" --role admin
TCB_ENV=... node create-ops-user.js --phone 13900139000 --password "<min-8-chars>" --role editor
```

- 脚本规则（`create-ops-user.js`）：role 仅限 editor/admin；密码 >= 8 字符，仅存 bcrypt hash；已存在手机号则就地升级角色。
- 密码策略建议（prod 强制）：长度 >= 12、含大小写+数字；首次登录后修改；账号与真人一一对应，禁共享。登录入口 `POST /api/v1/admin/auth/login`。
- 执行环境：该脚本不是 API 端点，只能在持有 TCB 密钥的机器上运行，用完即弃（不留历史命令中的明文密码，建议 `read -s` 方式传入）。

---

## 3. 后端部署（云函数 api）

### 3.1 安装依赖与打包

```bash
cd dodokid/cloudbase/functions/api
npm install                    # 依赖：@cloudbase/node-sdk、bcryptjs、qcloud-cos-sts
```

注意：本项目使用普通云函数（`index.js` 接收 event，含 HTTP 访问服务的事件格式），不是 HTTP 云函数（无 scf_bootstrap），因此部署**不加** `--httpFn`。

### 3.2 部署命令（已核实的 tcb CLI 语法）

```bash
# 方式一：在函数目录内直接部署（CLI 自动读 package.json 的 name=api）
cd dodokid/cloudbase/functions/api
tcb fn deploy api --dir . -e <ENV_ID> --force --yes

# 方式二：在 cloudbase/ 根目录配 cloudbaserc.json（envId + functionRoot=./functions）后批量部署
tcb fn deploy --all -e <ENV_ID> --yes

# 仅更新代码 / 仅更新环境变量等配置
tcb fn code update api -e <ENV_ID>
tcb fn config update api -e <ENV_ID> --envVariables '{"JWT_SECRET":"...","NODE_ENV":"production", ...}'
```

注意事项（来自官方文档核实）：

- `--envVariables` 是**全量覆盖**，更新前先用 `tcb fn detail api -e <ENV_ID>` 查询现有变量并合并，避免丢失。
- 若配 `installDependency: true`（云上装依赖），则不要上传 node_modules；本项目依赖极少（bcryptjs 有原生因素，建议本地 `npm install --production` 后连同 node_modules 一起上传，即不设 installDependency）。
- HTTP 访问服务：部署时加 `--path api/v1` 可自动创建 HTTP 访问路径（或在控制台"HTTP 访问服务/云接入"绑定 `/api/v1/*` -> 函数 api）。绑定自定义域名 api.dodokid.cn 于云接入配置中。

### 3.3 冒烟测试

- 本地逻辑冒烟（不依赖真实环境，fake-db 内存替换 appContext）：

```bash
cd dodokid/cloudbase/functions/api
node tests/smoke-admin.test.js     # 覆盖 RBAC 403、aud 隔离 401、C 端仅 published（AC-09/11/13/15）
node tests/smoke-routes.test.js    # 路由表完整性
```

- 部署后真实环境冒烟（无需改测试代码，直接 curl 真实域名验证核心 AC）：

```bash
BASE=https://api.dodokid.cn/api/v1
# 1) 健康元信息
curl -s $BASE/meta/version
# 2) 后台登录（用 2.3 创建的账号）
curl -s -X POST $BASE/admin/auth/login -H 'Content-Type: application/json' \
  -d '{"phone":"13800138000","password":"<password>"}'    # 应返回 aud=admin 的 token
# 3) 越权检查（AC-11）：editor 调 admin-only 接口应 403；app token 调后台应 401
# 4) C 端可见性（AC-13/15）：GET $BASE/content/categories 只出现 enabled 模块与 published 条目，
#    draft 状态的条目 id 直接查 detail 应 404
# 5) 云函数日志复核：tcb fn log api -e <ENV_ID> --keyword Error
```

---

## 4. 运营后台 Web 部署（dodokid-admin）

### 4.1 分域方案

| 域名 | 承载 | 实现方式 |
|------|------|---------|
| api.dodokid.cn | C 端 + 后台共用的 REST API | CloudBase 云接入（HTTP 访问服务）绑定云函数 api，`/api/v1/*` |
| admin.dodokid.cn | 运营后台 SPA | CloudBase 静态托管（同环境 prod），或独立 CDN+COS |

后台与 API 同源不同域：admin.dodokid.cn 前端直连 api.dodokid.cn。跨域 CORS 由云函数层处理（如后端未启用 CORS 中间件，优先在云接入/网关层配置 `Access-Control-Allow-Origin: https://admin.dodokid.cn` 及 OPTIONS 预检；建议显式白名单而非 `*`，因后台请求携带 Authorization 头）。

### 4.2 构建与环境变量注入

前端 API 地址通过 Vite 构建期变量注入（`src/lib/http.ts`：`import.meta.env.VITE_API_BASE ?? '/api/v1'`；未配置时启用内置 Mock，**生产构建必须配置，否则上线的是假后端**）：

```bash
# dodokid-admin/.env.production
VITE_API_BASE=https://api.dodokid.cn/api/v1

cd dodokid-admin
npm run build          # tsc --noEmit && vite build，产物 dist/
```

### 4.3 静态托管（CloudBase）

```bash
cd dodokid-admin
tcb hosting detail -e <ENV_ID_PROD>        # 未开通静态托管会交互引导开通
tcb hosting deploy ./dist -e <ENV_ID_PROD> --safe --verify --entry index.html
# 可选：--prune 清理远端多余文件（加 --yes 跳过二次确认）
```

然后在静态托管设置中绑定自定义域名 admin.dodokid.cn（CNAME 到托管分配域名），HTTPS 由腾讯云证书托管。备选：COS 静态网站 + CDN 独立域名，流程相同（coscli 上传 + CDN 源站配置），MVP 阶段优先用 CloudBase 托管少维护一套配置。

### 4.4 SPA 路由回退

react-router-dom 使用 BrowserRouter 时，需在静态托管控制台配置 404/错误页指向 index.html（或将路由改为 HashRouter），否则刷新子路由 404。

---

## 5. 上线前检查清单

- [ ] 1. dev/prod 两环境已创建，prod 未混入任何 dev 测试数据（users、content 等集合核对）。
- [ ] 2. 19 个集合全部创建，schema.json 中唯一索引逐条核对存在（idx_phone、idx_jti、idx_content_version 等）。
- [ ] 3. 云函数 api 已部署，`tcb fn detail api` 显示环境变量完整（JWT_SECRET 非默认值、NODE_ENV=production）。
- [ ] 4. prod 的 JWT_SECRET 与 dev 不同且未提交任何代码仓库；COS_SECRET_ID/KEY 为最小权限子账号。
- [ ] 5. 云接入已绑定 `/api/v1/*` -> 函数 api，自定义域名 api.dodokid.cn HTTPS 生效。
- [ ] 6. 本地冒烟 `node tests/smoke-admin.test.js` 与 `smoke-routes.test.js` 全部 PASS。
- [ ] 7. 真实环境冒烟：后台登录成功；editor 调用 admin-only 接口返回 403（AC-11）；app audience token 调后台接口返回 401。
- [ ] 8. C 端隔离验证（AC-13/15）：draft/in_review/archived 条目在 `/content/*` 列表与详情均不可见；仅 published 可见。
- [ ] 9. 儿童档案合规链路：无 consent_records 时无法创建 child（409/4xx）；删除 child 联动硬删 progress/milestones 并吊销 consent。
- [ ] 10. audit_log 正常写入（登录、内容审批、设置变更等敏感操作有 before/after 快照）。
- [ ] 11. 云函数已发布版本（`tcb fn publish-version api`），记录当前 prod 版本号备用回滚。
- [ ] 12. admin 后台构建已注入 VITE_API_BASE（登录真实 API 而非 Mock），admin.dodokid.cn HTTPS 与 SPA 路由回退正常。
- [ ] 13. CORS 白名单仅允许 `https://admin.dodokid.cn`（及 C 端域名），预检 OPTIONS 通过。
- [ ] 14. seed 占位媒体已替换为真实素材（cdnKey 指向 prod 存储桶），音频可播、封面可显。
- [ ] 15. 短信通道 prod 使用 tencent provider 实测发送成功，`SMS_PROVIDER=log` 未出现在 prod；限流参数与清单一致。
- [ ] 16. 初始 admin/editor 账号密码满足策略且已交接，无共享账号；备份/回滚文档已归档（见 §6）。

---

## 6. 回滚方案

### 6.1 云函数版本与别名回滚

- 每次部署后发布版本快照：`tcb fn publish-version api -e <ENV_ID_PROD>`，用 `tcb fn list-version api` 记录版本号。
- 回滚动作（秒级）：在 CloudBase 控制台"函数 -> 版本与别名"将线上别名（如 prod 别名）从当前版本切换回上一版本；CLI 负责发布与查询，**流量切换/别名指向由控制台或 API 操作**（CLI 不提供别名切换参数）。
- 仅代码回滚（别名不可用时的兜底）：`git checkout <上一稳定tag>` 后重新 `tcb fn deploy api --dir . --force --yes`。
- 配置回滚：`tcb fn config update api --envVariables '{...}'` 全量覆盖写回旧变量表（务必先 `tcb fn detail` 保存当前值再改）。

### 6.2 数据库变更回滚原则

- schema 只增不删：新增集合/索引允许保留（无害）；**不执行破坏性删集合/删索引**，如必须删除，先导出数据。
- 内容数据：依赖 `content_revisions` 快照做**前向恢复**（restore 生成新版本，不改写历史，与 Spec AC-09 一致）；不提供逆向 UPDATE 脚本，回滚即"恢复到某历史版本并产生新版本"。
- seed 数据回滚：seed 幂等只插不删，错误 seed 的清理用人工脚本按 key/title 定向删除，并在 audit_log 留痕。
- 静态托管回滚：使用 `tcb hosting deploy --safe` 部署时自动备份至 `.cloudbase-backup/` 前缀，失败自动恢复；手动回滚即从备份前缀恢复或重新部署上一个 dist 产物（建议 dist 按 `dist-<date>` 归档留存）。
- 密钥泄露回滚：立即轮换 JWT_SECRET（强制全部 token 失效）+ 更换 COS 子账号密钥，随后全量冒烟。

---

## 附：本文引用的项目文件

- `dodokid/cloudbase/.env.example`（环境变量模板）
- `dodokid/cloudbase/functions/api/config.js`（配置加载、JWT fail-fast、双 audience 说明）
- `dodokid/cloudbase/db/schema.json`（19 集合 + 索引定义）
- `dodokid/cloudbase/db/init-collections.js` / `seed-content.js` / `create-ops-user.js`
- `dodokid/cloudbase/functions/api/tests/smoke-admin.test.js` / `smoke-routes.test.js`
- `dodokid-admin/src/lib/http.ts`（VITE_API_BASE）、`dodokid-admin/package.json`（build 脚本）
