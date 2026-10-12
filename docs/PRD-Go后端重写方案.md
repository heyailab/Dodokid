# PRD：Go 后端重写方案（DodoKid）

> 版本：v2.0　　日期：2026-10-12
> 状态：待评审（数据库选型已定：**PostgreSQL**）
> 背景：现有 Node + Express + MongoDB 后端在宝塔面板部署时暴露过多环境耦合（dotenv 缺失、全网卡监听、PM2 环境变量），改用 Go 重写为「单二进制 + PostgreSQL」，保留关系模型与通用运维工具。
> **前端（儿童 App + 运营后台）完全复用，不做任何改动。**

---

## 1. 核心结论先说

**前端 100% 复用，一行代码不改。** 依据（已实测）：

| 事实 | 数据 |
|---|---|
| 前端 API 层与后端实现的耦合 | **零** —— `grep -rn "cloudbase\|tcb\|TCB_" src/api/` 零命中 |
| 前端类型定义 | `src/api/types.ts` 32 个 interface/type，210 行，纯手写声明 |
| HTTP 调用方式 | 统一走 `apiRequest(method, path, body)` + 固定信封 `{success, code, message, data}` |

前端只认三件事：**HTTP 方法 + 路径 + 请求/响应 JSON 结构**。这三样在 OpenAPI 里已经写死了。所以换后端语言 = 重写服务端，前端无感。

**Go 能带来的部署简化**：

| 现状（Node + MongoDB） | Go + PostgreSQL 之后 |
|---|---|
| 装 Node 22 + 4808 行 JS 依赖 + 21 个仓储 | 一个二进制（约 20MB），无 `node_modules` |
| 装 MongoDB + 建用户 + 开鉴权 | 装 PostgreSQL（宝塔面板一键装，**比 MongoDB 省事**） |
| 宝塔面板配 10 个环境变量 + PM2 | 只配数据库连接串（1 个） |
| 挂掉靠 PM2 拉起 | systemd 托管 + 自动重启 |
| 备份靠 `mongodump` 命令 | `pg_dump`，宝塔面板有图形化按钮 |
| 数据排查靠写 Node 脚本 | `psql` / `pgAdmin`，通用工具 |

---

## 2. 现有系统盘点（重写的依据）

### 2.1 后端规模

```
总代码量    4808 行 JS（不含测试）
分层        controllers 11 / services 12 / repositories 21 / middlewares 8 / validators 1 / utils 7
API 端点    56 个路径 / 69 个方法（openapi.yaml 权威统计）
测试断言    128 条（smoke-admin 57 + smoke-routes 29 + selfhost 42）
契约文件    dodokid/cloudbase/openapi.yaml（2454 行）
```

### 2.2 必须 1:1 保留的业务规则（重写时最容易丢的部分）

| 规则 | 位置 | Go 侧要求 |
|---|---|---|
| **内容状态机 9 条迁移** | `services/admin/contentWorkflow.service.js:14-24` | 迁移表**必须逐条对齐**，不得增删。`restore` 的 `from:['*']` 语义要保留 |
| **乐观锁 CAS on version** | 同上，所有写操作 | 必须保留，`version` 不匹配返回 409 |
| **C 端强制 published 过滤** | `repositories/content.repo.js` | 草稿绝不能泄漏到 App |
| **双 token audience隔离** | `middlewares/adminAuth.js:4` | `aud=app` 与 `aud=admin` 密码学隔离，家长令牌访问后台必须 401 |
| **adminOnlyFields 中间件** | middlewares | editor 写 `isSample` 等管理字段 → 40300 |
| **业务码高位映射 HTTP 状态** | `40000→400` 等 | 信封 `code` 不变，HTTP 状态码要真实（云函数做不到，Go 可以） |
| **UTC 日期计算** | 全局 | `T00:00:00Z` + `setUTCDate` 等价写法；Go 里用 `time.Date(..., time.UTC)` |
| **限流按真实客户端 IP** | middlewares | 需信任反向代理的 `X-Real-IP` / `X-Forwarded-For` |

### 2.3 数据形态

`db/schema.json` 定义 **19 个集合、30 个索引**，无字段级约束（文档模型）。典型集合：

- `users`（家长 + 后台账号合一，靠 `role` 区分）
- `child_profiles`、`consent_records`（监护人同意记录）
- `content_modules`、`content_items`（内容与状态机）
- `progress_records`、`milestones`（学习进度）
- `parental_settings`、`preferences`（护眼时长等）
- `media_assets`、`content_revisions`、`audit_log`、`rate_limits`、`token_blacklist`

**关键观察（初稿判断已修正）**：全仓零 JOIN、零事务、零聚合（已 grep 验证 `$lookup`/`startSession`/`aggregate(` 零命中）。

初稿据此认为"关系型数据库没有优势可发挥"，**这个判断是错的**。评估后发现：
- 零 JOIN 不代表不需要外键 —— 现有 7 处引用完整性完全靠应用层维护
- 零事务不代表不需要 —— 人工阅读发现 **12 处「多集合要么全成功要么全失败」需求点**，当前全是「顺序 await 无补偿」
- 零聚合不代表不需要关系能力 —— `countByStatus` 迁到 PG 反而能从 4 次往返变 1 次

详见第 3 章。

---

## 3. 数据库选型：PostgreSQL（已决策）

> **决策（用户已定）**：Go + PostgreSQL。本章给出选型理由与数据模型映射。

### 3.1 为什么选 PostgreSQL（而不是嵌入式）

初稿曾推荐嵌入式存储（badger），**评估后推翻**。原因如下：

**嵌入式方案的真实问题，不是数据量。** 架构师逐文件核实后发现：

| 担忧 | 核实结果 |
|---|---|
| 数组包含查询难度 | **0 处** —— `content_items.tags` 从不按成员查询，GIN 索引不需要 |
| 需要拆子表 | **0 处** —— 19 集合全是"一行一文档"，无一对多 |
| 需要聚合管道 | **0 处** —— 无 `$group`；stats 接口只是 4 个 COUNT |
| 链式查询散落各处 | **只有 1 处抽象**（`base.repo.js:27-37`），改 1 个函数覆盖全部 21 个仓储 |

**既然嵌入式也没省多少事，就不该为它牺牲三样更有价值的东西**：

1. **关系模型与真实外键约束** —— 现有 7 处引用完整性（`progress.childId` → `child._id` 等）完全靠应用层维护
2. **通用运维工具** —— `psql`、`pgAdmin`、标准 SQL 排查手段。嵌入式出问题只能写 Go 程序才能查
3. **迁移成本低** —— 关系模型是通用技能，未来再换任何数据库（包括回 MongoDB）都有明确路径

**选 PostgreSQL 的真实理由**：关系模型清晰 + 生态成熟 + 通用运维工具 + 未来可换。
**不是**"数据量大"（初稿那个说法不准确，已纠正）。

### 3.2 数据模型映射：19 集合 → 关系表

**先说一个必须知道的前提**：`db/schema.json` **只有索引定义，没有字段类型**。19 个集合里只有 9 个带字段描述，**另外 10 个零字段说明**。所以下表字段靠读代码写入点反推 —— **建表阶段本身有不确定性**。

| 集合 | 转表类型 | JSONB 字段 | 说明 |
|---|---|---|---|
| `users` | 纯标量 | — | 根表，`email` 唯一索引 |
| `child_profiles` | 纯标量 | — | 字段少（6 个） |
| `consent_records` | 纯标量 | — | `child_id` 可空 |
| `content_modules` | 纯标量 | — | 目录数据，10 行量级 |
| `content_items` | 标量 + 数组 | `tags TEXT[]` | 16 字段，主表 |
| `progress_records` | 纯标量 | — | **需加 UNIQUE(child_id,item_id)**，见 3.4 |
| `milestones` | 纯标量 | — | **需加 UNIQUE(child_id,badge_key)** |
| `parental_settings` | 纯标量 | — | 护眼设置 |
| `preferences` | 纯标量 | — | 仅 3 字段 |
| `media_assets` | 标量 + 数组 | `cdn_key TEXT[]` | 封面引用可能是数组 |
| `feedback` | 纯标量 | — | 仅 insert |
| `audit_log` | 标量 + 快照 | `before JSONB`、`after JSONB` | 异构快照，必须 JSONB |
| `sms_codes` | — | — | **改邮箱后废弃** |
| `rate_limits` | 纯标量 | — | 天然 KV |
| `token_blacklist` | 纯标量 | — | 建议后续迁 Redis |
| `admin_settings` | 标量 + 数组 | `allowed_mime_types TEXT[]` | 单例配置 |
| `content_revisions` | 标量 + 快照 | `snapshot JSONB` | 整份文档快照 |
| `content_categories` | 纯标量 | — | 4 字段 |
| `content_tags` | 纯标量 | — | **死集合**，代码零引用 |

**关键结论：拆表工作量接近零。** JSONB 只有两类用途 —— `audit_log` 的异构快照、`content_revisions` 的不可变归档。这两类是 JSONB 的教科书适用场景。`tags[]` / `allowedMimeTypes[]` / `cdnKey[]` 都是「写入后整条读回，从不按成员查询」的标签数组，`TEXT[]` 足够，**不需要 GIN 索引**。

**需要建外键约束的 7 处**：

```
child_profiles.user_id        → users.id
consent_records.child_id      → child_profiles.id   (可空)
consent_records.user_id       → users.id
progress_records.child_id     → child_profiles.id
milestones.child_id           → child_profiles.id
content_revisions.content_id  → content_items.id
media_assets.item_id          → content_items.id   (可空)
```

### 3.3 查询转 SQL：工作量比预想小

| 查询模式 | 数量 | 转 SQL 难度 |
|---|---|---|
| 完整分页（orderBy+skip+limit） | 4 处 | 低 —— 直接 `ORDER BY` + `LIMIT/OFFSET` |
| 仅 orderBy | 6 处 | 低 —— `ORDER BY` |
| 仅 limit | 2 处 | 低 —— `LIMIT n` |
| findOneWhere | 15 处 | 低 —— `LIMIT 1` |
| `IN (...)` | 2 处 | 低 —— `ageGroup IN (...)`、`role IN ('editor','admin')` |
| 数组包含 | **0 处** | **无需 GIN 索引** |
| 跨集合聚合 | **0 处** | 见下 |

**唯一抽象点是 `base.repo.js:27-37` 的 `findWhere`** —— 全代码库唯一实现 where→orderBy→skip→limit 的地方，其余 20 个仓储都通过它。**改这一个函数即覆盖全部仓储。**

**关于 stats 接口**：`services/admin/statsAdmin.service.js:9-23` 实际是 4 个 COUNT 并行，**没有聚合管道**。迁到 PG 后 `countByStatus` 从「硬编码 4 个 status 各发一次 COUNT」变成一条 `GROUP BY status` —— **4 次往返变 1 次，是性能净收益**。

**C 端进度汇总**（`progress.service.js:49-59`）是全库唯一「拉回内存 filter 计数」，转成一条 `GROUP BY status` 即可。

### 3.4 PostgreSQL 会暴露的 3 个现存缺陷（迁移时顺手修）

这些**当前就存在**，与迁移无关：

| 缺陷 | 位置 | 后果 | PG 修法 |
|---|---|---|---|
| **`progress_records` 缺唯一约束** | `progress.repo.js:6-15` | upsert 是「先 find 再 insert」的应用层竞态，两人同时上报同一 (childId,itemId) 会插两条脏数据 | 加 `UNIQUE(child_id, item_id)`，改 `INSERT ... ON CONFLICT DO UPDATE` |
| **`milestones` 缺唯一约束** | `progress.service.js:36-44` | 「首完徽章」是 findOne→create 的 check-then-act，并发下会发两次徽章 | 加 `UNIQUE(child_id, badge_key)` |
| **`content_items.cover` 字段形态不一致** | `schema.json:53` 定义为标量 cdnKey，但 `seed-content.js:32-33` 写入的是对象 `{cdnKey,size}` | `contentAdmin.repo.js:66` 用标量等值匹配，对种子数据匹配失败 | 定义为 `JSONB` 兼容两种形态 |

> 前两条是**真实 bug**，不是迁移引入的。借迁移机会修掉是对的。

### 3.5 事务：当前零使用，PG 是净收益

全库搜索 `startSession` / `withTransaction` / `transaction` —— **零命中**。现有实现全是「顺序 await 多写，无事务无补偿」。

**12 处真实的事务需求点**，其中 4 处高优先级：

| 位置 | 涉及集合 | 失败后果 | 优先级 |
|---|---|---|---|
| **`child.service.js:85-98` deleteChild** | **5 个** | 孩子已删但同意记录仍 active → **合规风险**（GDPR 式删除未完成） | **最高** |
| **`child.service.js:46-53` createChild** | 3 个 | 同意记录未消费 → **同一份同意可重复用于创建第二个孩子** | **最高** |
| `contentWorkflow.service.js:234-268` restore | 3 个 | 状态已改但内容是旧的，无法回滚 | 高 |
| `auth.service.js:65-74` register | 2 个 | 验证码已消费但用户未创建 → **该邮箱再也无法注册** | 高 |
| 状态机其余 5 个迁移 | 3 个 | 内容进审核但无版本快照，无法回滚 | 中 |
| `contentAdmin` 创建/更新/删除 | 2-3 个 | 审计空洞，违反 AC-14 | 中 |
| `mediaAdmin.service.js:52-70` | 2 个 + 外部存储 | **分布式事务，PG 也解决不了** | 已知有意设计 |

**好消息**：全部是同构的「顺序 await 多写」模式，**没有跨服务、消息队列**，迁到 PG 后统一 `BEGIN/COMMIT` 即可，**不需要 Saga 或两阶段提交**。

> 讽刺的是：**Go + PG 反而让这些变简单了**。MongoDB 单文档模型下这些点只能靠应用层保证，PG 有原生事务。

---

## 4. 迁移必须处理的现存缺陷（与选型无关）

架构师核实代码时挖出**3 个当前就存在的隐患**，与是否迁移无关，但既然要做，建议一并修掉。

### 4.1 限流键硬编码手机号（安全漏洞，最优先）

**位置**：`middlewares/rateLimit.js:10-15`

```js
const phone = (ctx.req.body && ctx.req.body.phone) || '';
return String(ip) + ':' + String(phone);
```

**问题**：后台登录接口的请求体是 `{ account, password }`，**没有 `phone` 字段**。于是所有后台登录请求的限流键都退化成 `ip + ':' + ''` —— **所有后台账号共用一个限流桶**。

**后果**：后台登录接口的撞库防护形同虚设，且**不会报错**，是隐蔽失效。

**修法**：限流键改为「IP + 账号标识」双维度，后台用 `account`，家长端用后续的 `email`。

### 4.2 后台登录校验手机号格式

**位置**：`validators/admin/schemas.js:51-53`

```js
const account = reqString(body, 'account');
if (!isValidPhone(account)) throw errors.badRequest('account must be a valid phone number');
```

**问题**：字段名叫 `account`（暗示可传账号名），实际只允许手机号。**传账号名直接 400**。

**影响**：改邮箱认证后更严重 —— 若后台也要支持邮箱，这里必须同步改。

### 4.3 手机号脱敏对邮箱无效

**位置**：`services/admin/adminAuth.service.js:47` 调用 `maskPhone()`（`utils/phone.js:22`）

**问题**：`maskPhone` 的正则 `(\d{3})\d+(\d{4})` 是针对 11 位手机号的。对邮箱输入**完全匹配不上，会原样返回明文邮箱**。

**后果**：日志/响应里出现明文邮箱。若不改，**等于没脱敏**。

### 4.4 另两个并发缺陷

见 3.4 节：`progress_records` 与 `milestones` 缺唯一约束，PG 迁移时一并修。

---

## 5. 认证改造：手机号短信 → 邮箱密码（本方案的既定决策）

> **决策已定**：家长端改为**邮箱 + 密码**；验证邮件走**第三方邮件服务**；后台管理员仍用账号 + 密码。

### 5.0 为什么要改（顺带的好处）

你的服务器在**海外**。国内短信通道需要企业资质且对海外号码发送成功率差。改用邮箱后：

- 不需要 SMS 服务商账号与资质
- 邮件可从任意服务器发出，海外送达正常
- 同时删掉验证码过期/重试/限流这套逻辑，代码更简单

### 5.0.1 要删除的（已实测确认范围）

现有 9 个文件引用短信，其中 3 个可整体删除：

| 文件 | 处置 |
|---|---|
| `utils/phone.js`（768B） | **整体删除**（手机号校验 + 脱敏） |
| `repositories/sms.repo.js`（573B） | **整体删除** |
| `services/sms.service.js`（1116B） | **整体删除** |
| `config.js` | 删`SMS_PROVIDER`、`SMS_CODE_TTL_SEC`、`SMS_CODE_LENGTH`、`SMS_RATE_LIMIT_PER_MIN` |
| `services/auth.service.js` | `sendSmsCode` / `verifyCodeInternal` →改为 `registerByEmail` / `loginByEmail` |
| `controllers/parent.controller.js` | `/auth/sendCode` 端点 → `/auth/register`、`/auth/login` |
| `middlewares/rateLimit.js` | 短信专用限流键 → 改登录失败限流 |
| `routes.js` | `/auth/sendCode` 路由 → 换新端点 |
| `validators/schemas.js` | `phone` 规则 → `email` 规则 |

**`sms_codes` 集合不再需要**（19 个集合降到 18 个）。

### 5.0.2 要新增的

| 项 | 说明 |
|---|---|
| `users.email` | 唯一索引，**防重复注册**（这是安全关键，不是优化） |
| `users.passwordHash` | bcrypt，**成本因子 ≥ 12** |
| `email_verification_tokens` 集合 | 验证邮箱归属、重置密码都用它，带过期时间 |
| 邮件发送适配层 | `internal/mailer/`，接口 `Send(ctx, to, subject, body) error`，**具体服务商只在实现层绑定**，换服务商不改业务 |
| 「忘记密码」流程 | 请求重置 → 发邮件 → 凭token 设新密码 |

### 5.0.3 认证流程

```
注册：邮箱 + 密码 → 生成验证 token → 存email_verification_tokens
      → 发验证邮件 → 用户点链接 → 标记 emailVerified
登录：邮箱 + 密码 → bcrypt 比对 →签发 JWT(aud=app)
      → 若未验证则拒绝（或只读模式，二选一，见下）
重置：邮箱 → 发重置 token 邮件 → 凭 token 设新密码 → token 作废
```

**待你确认的一个细节**：注册后未验证邮箱时，是**禁止登录**（安全更严）还是**允许登录但限制功能**（体验更平滑）？我倾向**禁止登录**，因为"未验证邮箱可登录"等于允许用他人邮箱注册。

### 5.0.4 不可放松的安全边界（认证换了，这些照旧）

| 边界 | 要求 |
|---|---|
| **双audience 隔离** | `aud=app`（家长）与 `aud=admin`（后台）**密码学隔离**，家长令牌访问后台 API 必须 401 |
| **密码强度** | 最小 8 位；bcrypt cost ≥ 12 |
| **登录失败限流** | 按邮箱 + IP 双维度，防撞库 |
| **错误信息不泄露账号是否存在** | 登录失败统一返回"邮箱或密码不正确"，不区分哪个错 |
| **令牌轮换** | refresh token 一次性使用，用后进黑名单 |
| **管理员账号不可自助注册** | 只能由已有admin 创建或数据库初始化时创建 |

### 5.0.5 第三方邮件服务配置

配置项（Go 侧，`.env` 或配置文件均可）：

```
MAIL_PROVIDER=sendgrid      # sendgrid | mailgun | smtp
MAIL_API_KEY=xxx            # 服务商 API Key
MAIL_FROM=noreply@dodokid.heymf.cn
MAIL_FROM_NAME=DodoKid
```

**两个必须注意的点**：

1. **发件域名建议与站点同域**（`noreply@dodokid.heymf.cn`），否则容易进垃圾箱。若用第三方免费额度，通常需在服务商后台验证发件域名（加 DNS 记录）。

2. **不要把API Key 写进代码或提交进仓库。** Go 侧建议读环境变量或独立配置文件，且该文件权限设为 `600`。

> 早期开发阶段可临时用"固定验证码"或"日志打印验证码"跑通流程，但**上线前必须换成真服务**。

---

## 6. 功能范围

### 6.1 必须实现（不做则 App 不能用）

| 域 | 内容 |
|---|---|
| **认证** | **邮箱 + 密码**注册登录、邮箱验证、忘记密码、JWT 双 audience、refresh 轮换、登出与黑名单（详见 5.0） |
| **儿童档案** | 增删改查、监护人同意记录 |
| **内容** | 模块列表、内容列表/详情（强制 published）、按年龄段筛选 |
| **学习进度** | 进度上报/查询、里程碑 |
| **护眼设置** | 时长设置与使用记录 |
| **反馈** | 提交家长反馈 |
| **系统** | `/version`（含 `mediaBaseUrl`）、`/privacyPolicy` |
| **媒体** | `POST /admin/media/upload`（取上传凭证）、`PUT /admin/media/blob`（收二进制）、元数据落库 |
| **限流** | 按真实客户端 IP |
| **健康检查** | `/health` |

### 6.2 管理后台 API（29 个路径 / 39 个方法）

| 域 | 内容 |
|---|---|
| **后台登录** | 账号密码 + bcrypt → `aud=admin` JWT |
| **内容管理** | 列表/详情/创建/更新/**状态机迁移（9 条）**/版本回滚 |
| **分类与标签** | content_categories / content_tags CRUD |
| **媒体管理** | 上传、列表、删除、`storeBlob` |
| **版本记录** | content_revisions |
| **审计日志** | audit_log 写入与查询 |
| **设置** | admin_settings |
| **用户管理** | users CRUD、启用/禁用 |

### 6.4 明确不做

| 不做 | 原因 |
|---|---|
| 前端任何改动 | 契约不变 |
| 管理后台 UI 改动 | 契约不变 |
| 微服务拆分 | 单体足够，拆了只会增加部署复杂度 |
| Redis 缓存 | 单机下 PostgreSQL 读已足够快；`token_blacklist` 后续可迁 |
| 多机/集群 | 当前无需求 |
| CDN | 服务器带宽足够 |

---

### 6.3 技术设计

#### 6.3.1 技术选型

| 层 | 选型 | 版本 | 理由 |
|---|---|---|---|
| 语言 | Go | 1.23+ | 单二进制、静态编译、部署零依赖 |
| HTTP 路由 | chi | v5 | 轻量、标准 net/http 风格、路由分组天然对应 `public` / `admin` |
| JSON | encoding/json | 标准库 | 无需第三方。注意开启 `DisallowUnknownFields` 的取舍 |
| 日志 | slog | 标准库 | Go 1.21+ 内置，结构化日志，便于宝塔/文件采集 |
| 数据库 | **PostgreSQL** | 16+ | 已决策，见第 3 章 |
| 驱动 | github.com/jackc/pgx/v5 | v5 | 事实标准，pgxpool 连接池 |
| 密码哈希 | golang.org/x/crypto/bcrypt | 最新 | 与 Node bcryptjs 兼容（同一算法） |
| JWT | github.com/golang-jwt/jwt/v5 | v5 | 主流标准 |
| 邮件发送 | 第三方服务商 SDK |— | 邮箱验证 + 忘记密码，见第 5 章 |
| 测试 | go test + httptest | 标准 | 不引入外部依赖 |

> **不选 ORM 框架**（如 GORM）。本项目数据模型简单（19 张表、无继承、无复杂关联），手写 SQL + pgx 更直接，且SQL 完全可读可审查。

### 6.3.1.1 构建期依赖（务必了解）

**Go + PostgreSQL 需要 CGO 与 libpq**：

```bash
# Debian / Ubuntu 构建机
apt-get install -y gcc libpq-dev
export CGO_ENABLED=1
go build -o dodokid ./cmd/dodokid
```

| 选项 | 代价 |
|---|---|
| pgx + CGO（推荐） | 构建机需装 `libpq-dev`，但性能与稳定性最好 |
| pgx 纯 Go 编译 | 需选 pgx 的无 CGO 驱动路径，生态支持较弱 |

**编译必须在有 PostgreSQL 开发库的机器上做**，不能像 badger 那样纯 `go build` 随处编译。CI 上需要 `apt-get install libpq-dev` 这一步。

#### 6.3.2 目录结构（对齐现有分层，保持文件职责一一对应）

```
dodokid-go/
├── cmd/
│   └── dodokid/main.go              # 唯一入口：装配 + 启动 + 优雅关闭（零业务）
├── internal/
│   ├── config/config.go             # 环境变量读取 + 默认值 + 校验
│   ├── httpapi/
│   │   ├── server.go                # 路由装配、中间件链
│   │   ├── envelope.go              # 统一响应信封 {success,code,message,data}
│   │   ├── statusmap.go             # 业务码 → HTTP 状态码
│   │   ├── middleware/              # logger / auth / adminAuth / rbac / ratelimit / validate
│   │   └── handler/                 # 只做参数解析与响应组装，业务在 service
│   ├── domain/                      # 领域模型（struct）+ 业务规则（纯函数）
│   │   ├── content.go               # 状态机 TRANSITIONS（9 条，单一定义）
│   │   ├── progress.go
│   │   └── ...
│   ├── service/                     # 业务编排
│   ├── repo/
│   │   ├── repo.go                  # 接口定义（domain 侧）
│   │   └── pgximpl/                 # PostgreSQL 实现
│   ├── migrations/                  # SQL 迁移文件（版本化，勿手工改已发布的）
│   │   ├── 0001_init.sql            # 19 张表 + 索引 + 外键
│   │   └── 0002_seed.sql            # 种子数据
│   └── util/
├── migrations/                      # SQL 迁移（若未放进 internal）
└── go.mod
```

**依赖方向严格向下**：`handler → service → repo → 存储`。`domain` 被service 引用，不反向依赖。

#### 6.3.3 存储抽象（关键设计决策）

**必须做**，否则未来「PostgreSQL → 其他库」的死路从第一天就埋下：

```go
// repo/repo.go —— 接口定义在domain 侧，实现可替换
type ContentRepo interface {
    Get(ctx context.Context, id string) (*domain.ContentItem, error)
    List(ctx context.Context, q domain.ContentQuery) ([]domain.ContentItem, error)
    // CAS 乐观锁：version 不匹配返回 ErrVersionConflict -> HTTP 409
    UpdateStatus(ctx context.Context, id string, from domain.ContentStatus, to domain.ContentStatus, expectVersion int) error
    // ...
}
```

这样换数据库只改 `pgximpl/` 一个包，service 与 handler 不动。

**动态查询构造**：现有 `base.repo.js:27-37` 的 `findWhere` 是全代码库唯一的链式查询实现点，Go 侧对应一个查询构造器（用 `pgx` 手写条件拼装，或用 `squirrel`）。所有仓储的调用点签名基本不变。

**事务边界**：service 层需要多集合原子写入时，通过 repo 暴露的 `WithTx(ctx, fn)` 传入事务句柄，**不要在repo 内部隐式开事务** —— 避免边界不清。

---

#### 6.3.4 契约稳定性（前端零改动的保证）

1. **`openapi.yaml` 是唯一契约**，Go 实现后必须用同一个文件做校验。
2. 响应信封**逐字节对齐**现有格式：`{ success, code, message, data }`。
3. **业务码不重新编号** —— 沿用现有高位编码（40000 系列等），否则前端错误分支全错。
4. `_id` 继续用 **24 位十六进制字符串**，与 Node 版一致（MongoDB 兼容导出时不会变形）。
5. 用契约测试锁死：对 `openapi.yaml` 里每个端点跑正例，断言 JSON 结构一致。

#### 6.3.5 媒体存储（沿用本地磁盘方案）

沿用你已定的方案 —— 存服务器本地磁盘，不开对象存储：

```
MEDIA_ROOT（默认 /www/wwwroot/dodokid-media）
   └── admin-media/covers/xxx.png
```
- Nginx `location ^~ /media/ { alias ...; }` 直出，不过Go 进程
- Go 侧原子落盘：`tmp 文件 → rename`（与Node 版一致，防半截文件）
- **路径穿越防护必须保留**：`path.resolve` 的前缀比较在 Go 里是 `filepath.Abs` + `strings.HasPrefix`
- 保持 `PUT /admin/media/blob` 收原始字节（`Content-Type: */*`），**必须在 JSON 解析之前处理**

---

## 7. 部署方案（宝塔面板）

这才是重写的真正目的 —— 部署要**比现在简单**。

### 7.1 装 PostgreSQL（宝塔面板一键）

宝塔 → **软件商店** → 搜索 `PostgreSQL` → 安装（选 16或 17）。

装完在宝塔 → **数据库** → 添加数据库：

| 字段 | 填什么 |
|---|---|
| 数据库名 | `dodokid` |
| 用户名 | `dodokid` |
| 密码 | 点随机生成 |
| 权限 | **本地服务器**（只允许 127.0.0.1） |

拿到连接串：`postgres://dodokid:<密码>@127.0.0.1:5432/dodokid`

> **比装 MongoDB 更省事**：宝塔的 PostgreSQL 插件默认就是本地访问+面板托管备份，不需要手动开鉴权、改配置文件、配防火墙。

### 7.2 Go 项目部署（systemd）

宝塔对 Go 项目支持弱，**推荐 systemd + 宝塔只管数据库**。

```bash
# 1. 上传二进制，整目录就一个文件
mkdir -p /opt/dodokid-go
cp dodokid /opt/dodokid-go/          # 约 20MB

# 2. 建专用用户 + 授权（非 root 运行）
useradd --system --no-create-home --shell /usr/sbin/nologin dodokid
chown -R dodokid:dodokid /opt/dodokid-go /www/wwwroot/dodokid-media

# 3. 挂 systemd（配置写在 unit 的 Environment 里）
cp deploy/dodokid-go.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now dodokid-go
```

`Environment` 只需 3 项（其余全用默认值）：

```
DATABASE_URL=postgres://dodokid:密码@127.0.0.1:5432/dodokid
JWT_SECRET=<openssl rand -hex 32 的输出>
MEDIA_CDN_BASE_URL=https://dodokid.heymf.cn/media
```

**启动失败时日志直接看**：`journalctl -u dodokid-go -n 50 --no-pager`。没有 PM2、没有 node_modules、没有 10 项环境变量表。

> PostgreSQL 默认监听 127.0.0.1:5432，**不需额外配防火墙**（这比 MongoDB 少一步）。

### 7.3 对比现有宝塔 Node 方案

| 项 | 现在（Node + MongoDB） | Go + PostgreSQL |
|---|---|---|
| 安装 Node 22 | 要 | **不要** |
| `npm ci` 装依赖 | 要（4808 行代码的依赖） | **不要** |
| 环境变量 | **10 个**，漏一个就崩 | **3 个**（DB 连接串 + JWT + 媒体域名） |
| 目录结构 | 4808 行源码 + node_modules | **1 个二进制**（约 20MB） |
| 装数据库 | MongoDB + 建用户 + **开鉴权** | PostgreSQL（宝塔一键 + 面板托管） |
| 数据库端口暴露 | 需手动改 `mongod.conf` + 防火墙 | **默认只听127.0.0.1，不用管** |
| 备份 | `mongodump` + 媒体 tar | 面板点一下 + `pg_dump` |
| 数据排查 | 写 Node 脚本 | `psql` / `pgAdmin`（图形化） |
| 升级 | git pull + npm ci + 面板重启 | 换二进制 + `systemctl restart` |
| 挂掉恢复 | PM2 | systemd 自动拉起 |

> **诚实说明**：选 PostgreSQL 后，**「不用装数据库」这个好处没有了** —— 你还是要在宝塔装一个 PG。
> 用这个方案换来的不是"更少步骤"，而是：更少环境变量、更清晰的表结构、可用图形化工具排查、以及那 12 处事务能被正确保证。

---

## 8. 实施计划

### 阶段划分（每阶段可独立验收）

| 阶段 | 内容 | 验收标准 |
|---|---|---|
| **P0** | 骨架 + **建表迁移** + 契约冻结 | `openapi.yaml` 校验通过；**19 张表 + 30 索引 + 7 外键建好**；`/health`、`/version` 可用；pgx 连库读写通；**前端已可连** |
| **P1** | 认证域（**新增邮箱验证 + 忘记密码**） | 邮箱注册/登录/验证邮件/重置密码/双 audience/刷新/黑名单/限流；**契约测试覆盖全部认证端点** |
| **P2** | C 端读域 | 内容/模块/儿童档案/进度/护眼/里程碑；**App 主流程可用** |
| **P3** | 媒体域 | 上传凭证 + blob 接收 + 静态直出 + 路径穿越防护；**后台能传图** |
| **P4** | 管理域 | 39 个方法 + 状态机 9 条 + CAS + 审计；**后台全功能可用** |
| **P5** | 双跑与切换 | Go 与 Node 并行，真实流量对比响应体；差异归零后切流 |

### 里程碑估算

按现有代码规模（4808 行 JS，含业务规则）与 Go 的表达力：

| 阶段 | 估算 | 理由 |
|---|---|---|
| P0 | **1.5 天** | 骨架 + **19 张表建表迁移 + 7 处外键**（字段靠读代码反推，有不确定性） |
| P1 | 3 天 | 认证；邮箱验证 + 忘记密码是新流程 |
| P2 | 1.5 天 | 读域，最直接 |
| P3 | 1 天 | 媒体，含原子落盘与安全防护 |
| P4 | **5 天** | 39 个管理方法 + 状态机 9 条 + CAS + 审计 |
| **P4.5** | **1.5 天** | **新增：12 处事务边界改造**（见 3.5），deleteChild 跨 5 表是重点 |
| P5 | 1.5 天 | 双跑对比（69 个方法逐一比对响应体） |
| **合计** | **约 15 人日** | 不含测试补全 |

> **修正说明**：
> - 初稿按「30 个端点」估 8.5 天，实测是 69 个方法（业务 30 + 管理 39）→ 修正
> - 选 PostgreSQL 后新增 **P0 建表（+1 天）** 与 **P4.5 事务改造（+1.5 天）**
> - P1 从 2 天涨到 3 天：多了邮箱验证 + 忘记密码
>
> **这是跑通的估算，不含"写测试"。** 现有 128 条断言若要同等覆盖度，Go 侧另加 3 天。

> **修正说明**：初稿按「30 个端点」估算，实际是 69 个方法（业务 30 + 管理 39），P4/P5 相应上调。
>
> **这是重写后跑通的估算，不含"写测试"的时间。** 现有 128 条断言若要同等覆盖度，Go 侧另加 2-3 天。
> **如果目标只是「部署简单」，不建议重写** —— 见第 9 节。

---

## 9. 先看清代价：重写 vs 改进现有

我必须诚实说明，**重写不一定更划算**：

### 重写要付的账

| 账项 | 说明 |
|---|---|
| **业务规则重实现风险** | 128 条断言锁住的规则要逐条重写，**每条都可能漏**。状态机少一条迁移、RBAC 少一个判role，都是线上事故 |
| **契约漂移风险** | 69 个方法的手写 Go 实现可能与 `openapi.yaml` 有细微差异，**前端不做任何校验，静默出错** |
| **15+ 人日** | 期间不能加新功能 |
| **放弃已验证的部署方案** | systemd 版已写完文档能用；宝塔版刚写完 |

### 不重写也能达成「部署简单」

你的真实痛点是**部署麻烦**，这个有成本低得多的解法：

| 方案 | 工作量 | 效果 |
|---|---|---|
| **A. 现有宝塔版文档直接照做** | 0天 | 装MongoDB + 填 10 个环境变量。已写好的文档照做即可 |
| **B. 宝塔 Node 项目补 `dotenv`** | 0.5 天 | 加个依赖，`.env` 就能生效，少填 8 个环境变量 |
| **C. 打成单文件 + 嵌入存储（不改语言）** | 2-3 天 | Node 单文件编译（`pkg`/`node --build-sea`）+ SQLite，部署形态接近 Go |
| **D. Go + PG 重写** | 15+ 天 | 部署最干净（少 7 个环境变量、SQL 可读、有图形化工具） |

**我的建议**：先按 A 把系统跑起来拿到真实反馈（你在服务器上立刻能验证前后端链路），**再决定要不要重写**。现在重写，你手里就只有一个没跑通过的部署和一个没上线的产品。

如果一定要重写，**请先回答**：

1. 现在的宝塔部署卡在哪一步？（具体报错/哪个面板字段找不到）
2. 你预期月活量级？（若在万级以内，嵌入式足够；十万级以上建议真数据库）
3. 是否需要多机扩容预案？

---

## 10. 附录

### 10.1 状态机迁移表（Go 侧必须逐条对齐）

```go
var Transitions = map[string]Transition{
  "submit":   {From: []Status{Draft},        To: InReview,  Role: RoleEditor},
  "approve":  {From: []Status{InReview},To: Published, Role: RoleAdmin},
  "publish":  {From: []Status{Draft},        To: Published, Role: RoleAdmin},  // 草稿直接发布
  "withdraw": {From: []Status{InReview},     To: Draft,     Role: RoleEditor}, // 撤回
  "reject":   {From: []Status{InReview},     To: Draft,     Role: RoleAdmin},
  "unpublish":{From: []Status{Published},    To: Archived,  Role: RoleAdmin},
  "archive":  {From: []Status{Draft, InReview, Published}, To: Archived, Role: RoleAdmin},
  "reEdit":   {From: []Status{Archived},     To: Draft,     Role: RoleEditor}, // 由 PUT 触发
  "restore":  {From: []Status{Any},          To: Draft,     Role: RoleAdmin},  // 版本回滚
}
```

### 10.2 迁移退路（保留可逆性）

Go 版跑通后，若存储引擎不合适，导出路径：

```
PostgreSQL → 导出器（Go CLI 子命令） → MongoDB / 其他库
```

因为仓储层是接口化的，换引擎只需实现另一个 `repo` 包 + 跑导出器。**这条退路从P0 就要留好，不要等到出问题才补。**

### 10.3 现有 Node 版资产处置

Go 版上线后，Node 版**不要立刻删**：

| 资产 | 处置 |
|---|---|
| `openapi.yaml` | **保留** —— 唯一契约，两边都要用 |
| `db/schema.json` | **保留** —— 索引定义可参考；但**字段靠读代码反推**（它没有字段类型），见 3.2 |
| `db/seed-content.js` | 改造为 Go 的种子程序（种子数据是文档 JSON，可直接移植） |
| `tests/*.test.js`（128 断言） | **改造为契约测试** —— 这是 Go 版的验收基准，价值极高 |
| `deploy/`（systemd/nginx） | 复用，替换二进制路径 |
| 业务代码 | Go 稳定运行 2 周后再删 |
