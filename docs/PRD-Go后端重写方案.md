# PRD：Go 后端重写方案（DodoKid）

> 版本：v2.1　　日期：2026-10-13
> 状态：可开工（数据库选型已定 **PostgreSQL**；契约基线已锁定，见第 10 章）
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
| **`child.service.js:40-52` createChild** | 3 个 | **并发竞态**：第 40 行读同意、第 42 行校验`consent.childId`、第 52 行才写。两个并发请求可同时通过第 42 行校验各建一个孩子（`consent.repo.js` 只有 `updateById`，无条件更新） | **最高** |
| `contentWorkflow.service.js:234-268` restore | 3 个 | 状态已改但内容是旧的，无法回滚 | 高 |
| `auth.service.js:65-74` register | 2 个 | 验证码已消费但用户未创建 → **该邮箱再也无法注册** | 高 |
| 状态机其余 5 个迁移 | 3 个 | 内容进审核但无版本快照，无法回滚 | 中 |
| `contentAdmin` 创建/更新/删除 | 2-3 个 | 审计空洞，违反 AC-14 | 中 |
| `mediaAdmin.service.js:52-70` | 2 个 + 外部存储 | **分布式事务，PG 也解决不了** | 已知有意设计 |

**好消息**：全部是同构的「顺序 await 多写」模式，**没有跨服务、消息队列**，迁到 PG 后统一 `BEGIN/COMMIT` 即可，**不需要 Saga 或两阶段提交**。

> 讽刺的是：**Go + PG 反而让这些变简单了**。MongoDB 单文档模型下这些点只能靠应用层保证，PG 有原生事务。

**createChild 的具体修法**（不要只加事务，还要靠数据库保证）：

```sql
-- Node 的做法：先读 → 判断 → 再写（两个并发可同时通过判断）
-- Go 的做法：条件更新，天然互斥
UPDATE consent_records
   SET child_id = $1, status = 'used'
 WHERE id = $2 AND child_id IS NULL
-- 影响行数 = 0 → 说明已被占用，返回 40900
```

配合 `consent_records` 上对 `child_id` 的条件唯一性，才能真正消除竞态。

---

## 4. 现有系统的 5 个陷阱（Go 版必须避开）

> **重要**：用户已决定**不修改现有 Node 代码**，直接开发 Go 版。本章不是修代码清单，而是**Go 版实现时必须避开的坑** —— 架构调研时挖出来的真实缺陷，如果照抄进Go 会把bug 一起搬过去。

### 4.1 限流键硬编码手机号

**现状**（`middlewares/rateLimit.js:10-15`）：

```js
const phone = (ctx.req.body && ctx.req.body.phone) || '';
return String(ip) + ':' + String(phone);
```

**问题**：后台登录的请求体是 `{ account, password }`，**没有 `phone` 字段**。于是所有后台登录请求的限流键退化成 `ip + ':' + ''` —— **所有后台账号共用一个限流桶，撞库防护形同虚设，且不会报错**。

**Go 版要求**：限流键用「IP + 账号标识」双维度，标识从**显式参数**传入而非猜body 里有什么字段。家长端用 `email`，后台用 `account`。

### 4.2 后台登录只认手机号格式

**现状**（`validators/admin/schemas.js:51-53`）：字段名叫 `account`（暗示可传账号名），实际只允许手机号，传账号名直接 400。

**Go 版要求**：既然认证改邮箱，后台登录校验改为「邮箱或手机号均可」，**且与字段名语义一致**。

### 4.3 手机号脱敏对邮箱无效

**现状**（`services/admin/adminAuth.service.js:47` 调 `maskPhone`，`utils/phone.js:22`）：正则 `(\d{3})\d+(\d{4})` 针对 11 位手机号，对邮箱**完全匹配不上，会原样返回明文**。

**Go 版要求**：脱敏函数**按类型分派**（邮箱走 `maskEmail`，手机号走 `maskPhone`），并在测试中断言「输出不等于输入明文」。

### 4.4 两处并发缺陷（check-then-act）

| 位置 | 现状 | Go 版要求 |
|---|---|---|
| `progress.repo.js:6-15` | upsert 是「先 findOne 再 insert」，两人同时上报同一 `(childId,itemId)` 会插两条 | **`UNIQUE(child_id, item_id)` + `INSERT ... ON CONFLICT DO UPDATE`** |
| `progress.service.js:36-44` | 「首完徽章」是 findOne→create，并发下会发两次徽章 | **`UNIQUE(child_id, badge_key)`** |

这两个是**当前就在的 bug**（与迁移无关）。Go 版靠 DDL 约束根治，不是靠代码判空。

### 4.5 封面字段形态不一致

**现状**：`db/schema.json:53` 定义 `content_items.cover` 为标量 cdnKey，但 `db/seed-content.js:32-33` 实际写入的是对象 `{ cdnKey, size }`。而 `contentAdmin.repo.js:66` 用标量等值匹配 —— **对种子数据会匹配失败**。

**Go 版要求**：`content_items.cover` 定义为 **JSONB**，用`->>'cdnKey'` 提取，兼容两种形态。

> 这 5 条已同步进第 3.4 / 3.5 章的风险与DDL 要求。**照抄 Node 逻辑会把这5 个 bug 一起搬到 Go**，这是本章存在的意义。

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

## 9. 决策记录与风险登记册

### 9.1 决策已定

| 决策项 | 结论 | 依据 |
|---|---|---|
| 语言 | **Go** | 单二进制、无 node_modules、systemd 托管 |
| 数据库 | **PostgreSQL**（曾评估嵌入式 badger，评估后推翻） | 保留关系模型与通用运维工具；见第 3 章 |
| 前端 | **完全复用，零改动** | `grep cloudbase/tcb` 零命中；只依赖 openapi 契约 |
| 认证 | **邮箱 + 密码**（替代手机号 + 短信码） | 免短信资质；海外发信正常；见第 5 章 |
| 未验证邮箱 | **禁止登录** | 未验证即可登录 = 可用他人邮箱注册看其孩子数据 |
| 部署 | **宝塔装 PG + systemd 托管二进制** | 环境变量 10 项 → 3 项 |

完整决策记录见 `docs/decisions/ADR-007-go-postgresql-rewrite.md`。

### 9.2 风险登记册

按严重度排序。**前4 项是本次重写的真实失败模式**，不是泛泛而谈。

| # | 风险 | 严重度 | 概率 | 触发条件 | 缓解措施 | 兜底 |
|---|---|---|---|---|---|---|
| **R1** | **契约漂移** —— 69 个方法手写 Go 与 `openapi.yaml` 有细微差异，**前端不做任何校验，静默出错** | **高** | 高 | 每个方法实现时 | ① 以 openapi.yaml 生成 Go 结构体与桩 ② 现有 128 条断言改造成 Go 契约测试 ③ P5 双跑逐方法比对响应体 | 保留 Node 版可随时切回（`DB_DRIVER` 不变，两套独立部署） |
| **R2** | **业务规则漏实现** —— 状态机 9 条迁移少一条、RBAC 少一个 role 判断、C 端 published 过滤漏了| **高** | 中 | 逐条重实现时 | ① 附录 11.1 的状态机表逐条对照 ② 每个域完成即跑契约测试 ③ 代码评审专查「与 Node 版逐行diff」 | 同上 |
| **R3** | **12 处事务改造不彻底** —— 尤其 deleteChild 跨 5 表，中途失败 = 合规风险 | **高** | 中 | P4.5 阶段 | ① 逐个列事务边界 ② 用 PG 的外键约束兜底部分一致性 ③ 补针对这 4 处高优先级的失败注入测试 | 保留 Node 版行为作为对照 |
| **R4** | **建表字段反推不准** —— `schema.json` 有 10/19 集合零字段说明，实际存量数据可能含代码里没出现的字段 | 中 | **高** | P0 建表阶段 | ① 逐集合读 service 层的写入点反推 ② 上线前用真实数据跑一次导入校验 | 导入脚本遇未知字段打日志跳过，不静默丢弃 |
| **R5** | 事务边界划分错误 —— repo 层隐式开事务导致边界不清 | 中 | 中 | P4.5 | 明确约定：**事务只在 service 层开**，repo 接收 `ctx` 中的 tx 句柄 | — |
| **R6** | 两套密码哈希并存 —— `utils/password.js` bcrypt（≥8）与 `utils/crypto.js` PBKDF2（≥4，家长锁用）强度不一致 | 中 | 高 | 认证改造时 | Go 侧统一 bcrypt cost≥12；家长锁密码强度提到 ≥8 或统一走 bcrypt | — |
| **R7** | pgx 依赖 CGO —— 构建环境缺 `libpq-dev` 导致编译失败 | 低 | 中 | 首次构建 | 文档已标注；CI 加安装步骤 | 用纯 Go 驱动替代 |
| **R8** | 邮箱送达率 —— 第三方邮件服务配置不当导致验证邮件进垃圾箱 | 中 | 中 | 认证域联调 | ① 发件域名与站点同域 ② 优先用固定验证码跑通流程再接真实服务 | 联调期用固定验证码 |
| **R9** | 双跑期运维成本翻倍 —— Go 与 Node 两套部署同时在线 | 低 | 高 | P5 阶段 | 双跑只跑测试流量，不接真实用户 | P5 时间压缩在1.5 天内 |

### 9.3 失败后的退路

**Node 版全链路保留，不删除。** 具体保留策略：

| 资产 | 处置 |
|---|---|
| 现有 Node 代码 | **保留**，P5 稳定运行 2 周后再议 |
| `openapi.yaml` | **两边都要用**，是唯一契约 |
| `db/schema.json` | 保留，索引定义可参考 |
| `tests/*.test.js`（128 断言） | **改造成 Go 契约测试** —— 这是 R1/R2 的主要防线，价值极高 |
| 宝塔部署文档 | 保留，Node 版回退时直接用 |

**切换是可逆的**：Go 版与 Node 版是两套独立部署，域名反代指向谁就生效谁。不需要数据迁移（Go 版从 seed 开始）。

### 9.4 什么情况下应该中止重写

诚实列出止损条件 —— 出现任一项，建议停下来重新评估：

1. **P0 结束时表结构仍有大量字段不确定**（R4 命中）→ 说明对现有系统理解不够，先补调研
2. **P4.5 事务改造发现更多未预期的事务需求点** → 工作量估算失效，重估
3. **P5 双跑差异超过 5%** → 契约理解有系统性偏差，回退到 Node 版补 dotenv 方案

---

## 10. 契约基线（QA 产出，开发时以此逐条对照）

### 10.1 必须先修的 3 项契约缺陷

**这 3 项在动工前处理**，否则会把问题一起搬进 Go 版。

#### 缺陷 1（阻断级）：6 个公开端点缺 operation 级 security

`openapi.yaml:46` 有全局 `security: [{bearerAuth: []}]`，而以下 6 个公开端点**未声明** operation 级 `security: []`：

| Method | Path | 实际应为 |
|---|---|---|
| POST | `/parent/sendSmsCode` | 公开 |
| POST | `/parent/verifyCode` | 公开 |
| POST | `/parent/register` | 公开 |
| POST | `/parent/login` | 公开 |
| GET | `/version` | 公开 |
| GET | `/privacyPolicy` | 公开 |

**证据**：`/admin/auth/login` 正确写了 `security: []`（openapi.yaml:884 附近），说明作者知道怎么写，这 6 处是漏写。实现侧 `routes.js:33-53`、`220-228` 确实无 auth 中间件，**是公开的**。

**后果**：任何 OpenAPI 代码生成器都会给「登录接口」生成"必须先带 token"的客户端。Go 版若用 `oapi-codegen` 生成客户端，**会直接引入 P0 缺陷**。

**修法**：为这 6 个操作补 `security: []`。

#### 缺陷 2（阻断级）：refreshToken 签发了但无兑换端点

- `services/auth.service.js:23-26` **确实签发**了 `refreshToken`（TTL 7 天）
- 但 69 个方法中**无任何 refresh 路径**（`grep refresh routes.js` 零命中）
- `middlewares/auth.js:28` 与 `adminAuth.js:28` **主动拒绝** `type=refresh` 的令牌

**后果**：家长端 `accessToken` 15 分钟过期（`config.js:29` `JWT_ACCESS_TTL_SEC=900`）后，**只能重新走短信验证码**，无法静默续期。这是**功能缺失**，不是 bug。

**修法**：Go 版**必须新增**两个端点（双 audience 各自签发）：

```
POST /parent/auth/refresh   # body: { refreshToken }
POST /admin/auth/refresh    # body: { refreshToken }
```

> **注意**：这是**新增契约**，不是保持不变。且要与前端约定 —— 前端目前有 refresh token 存储逻辑吗？需确认（`dodokid/src/api/token.ts`）。

#### 缺陷 3（文档级）：同意凭证的描述与代码不符

已修正 —— 见 3.5 节。真实缺陷是**并发竞态**（先读后写、无条件更新），不是"可重复使用"。

#### 另有 2 个 openapi 未记录的路由

| Method | Path | 位置 | 性质 |
|---|---|---|---|
| GET | `/health` | `server.js:79` | 部署探针 |
| GET | `/media/*` | `server.js:47` | 本地媒体分发（local 驱动默认读路径） |

前端不依赖这两个，但**部署验收探针与媒体分发依赖它们**。建议明确标注为「部署面，非契约面」，或补进 openapi。

### 10.2 端点完整清单（69 个方法，来自 openapi.yaml 解析）

认证分类：**公开 7 / 家长 22 / 家长+gateToken 2 / 后台 38**

> `gateToken` 单独列出：`/parent/settings` 与 `/parent/settings/timeLimit` 是**双锁**（bearerAuth + `X-Gate-Token`）。Go 版漏掉 gate 中间件 = 后台护眼设置裸奔。

#### 公开端点（7）

| # | Method | Path | 功能 |
|---|---|---|---|
| 1 | POST | `/admin/auth/login` | 运营后台登录（账号+密码，签发 aud=admin） |
| 2 | POST | `/parent/login` | 家长登录（**Go 版改为邮箱+密码**） |
| 3 | POST | `/parent/register` | 家长注册（**Go 版改为邮箱+密码**） |
| 4 | POST | `/parent/sendSmsCode` | 下发验证码（**Go 版废弃**，替换为邮箱验证） |
| 5 | POST | `/parent/verifyCode` | 校验验证码（**Go 版废弃**） |
| 6 | GET | `/privacyPolicy` | 隐私政策引用地址 |
| 7 | GET | `/version` | 版本号 + `mediaBaseUrl` |

#### 家长端（22 + 2 双锁）

| # | Method | Path | 功能 |
|---|---|---|---|
| 8 | POST | `/child/create` | 凭有效监护同意创建儿童档案 |
| 9 | GET | `/child/list` | 列出本家长名下儿童 |
| 10 | POST | `/child/switch` | 切换当前激活儿童 |
| 11 | DELETE | `/child/{id}` | 删除儿童（**级联 5 表事务**） |
| 12 | GET | `/child/{id}` | 儿童档案详情 |
| 13 | PUT | `/child/{id}` | 更新儿童（仅 name/avatar/ageGroup） |
| 14 | POST | `/consent/record` | 记录监护同意凭证 |
| 15 | GET | `/content/categories` | 内容模块分类 |
| 16 | GET | `/content/list` | 按模块与年龄段列内容（**仅 published**） |
| 17 | GET | `/content/samples` | 试读样章（最多 10 条） |
| 18 | GET | `/content/search` | 按标题搜索（**仅 published**） |
| 19 | GET | `/content/{id}` | 内容详情 + 媒体资源 |
| 20 | GET | `/content/{id}/mediaUrl` | 媒体可访问地址 |
| 21 | POST | `/feedback` | 提交反馈 |
| 22 | GET | `/milestones/{childId}` | 已获徽章 |
| 23 | POST | `/parent/gate/setup` | 设置家长门 |
| 24 | POST | `/parent/gate/verify` | 校验家长门，签发 gateToken |
| 25 | POST | `/parent/logout` | 吊销当前令牌 jti |
| 26 | PUT | `/preferences` | 更新偏好（语言/主题） |
| 27 | GET | `/progress/{childId}` | 进度汇总（含完成率） |
| 28 | PUT | `/progress/{childId}` | 上报进度（**幂等 upsert**） |
| 29 | GET | `/progress/{childId}/list` | 全部进度记录 |
| 30 | GET | `/parent/settings` | 家长设置（**双锁**） |
| 31 | PUT | `/parent/settings/timeLimit` | 护眼时长（**双锁**） |

#### 管理后台（38）

| # | Method | Path | 功能 | 角色 |
|---|---|---|---|---|
| 32 | GET | `/admin/audit` | 审计日志（仅 admin） | admin |
| 33 | POST | `/admin/auth/logout` | 吊销运营令牌 | editor+ |
| 34 | GET | `/admin/auth/me` | 当前运营身份与权限 | editor+ |
| 35 | GET | `/admin/categories` | 列出分类 | editor+ |
| 36 | POST | `/admin/categories` | 创建分类 | **admin** |
| 37 | DELETE | `/admin/categories/{id}` | 删除分类 | **admin** |
| 38 | PUT | `/admin/categories/{id}` | 更新分类 | **admin** |
| 39 | GET | `/admin/contents` | 内容列表（全状态+筛选分页） | editor+ |
| 40 | POST | `/admin/contents` | 创建内容（初始 draft） | editor+ |
| 41 | DELETE | `/admin/contents/{id}` | 删除内容 | **admin** |
| 42 | GET | `/admin/contents/{id}` | 内容详情 + 媒体 | editor+ |
| 43 | PUT | `/admin/contents/{id}` | 更新内容（**version 乐观锁**） | editor+ |
| 44 | POST | `/admin/contents/{id}/approve` | 审核通过（in_review→published） | **admin** |
| 45 | POST | `/admin/contents/{id}/archive` | 归档（→archived） | **admin** |
| 46 | POST | `/admin/contents/{id}/duplicate` | 复制为新草稿 | editor+ |
| 47 | GET | `/admin/contents/{id}/preview` | 按 C 端口径预览 | editor+ |
| 48 | POST | `/admin/contents/{id}/publish` | 草稿直发（draft→published） | **admin** |
| 49 | POST | `/admin/contents/{id}/reject` | 审核驳回（→draft） | **admin** |
| 50 | POST | `/admin/contents/{id}/restore/{revisionId}` | 回滚到指定修订 | **admin** |
| 51 | GET | `/admin/contents/{id}/revisions` | 修订历史（不含快照体） | editor+ |
| 52 | POST | `/admin/contents/{id}/submit` | 提交送审（draft→in_review） | editor+ |
| 53 | POST | `/admin/contents/{id}/unpublish` | 下架（published→archived） | **admin** |
| 54 | POST | `/admin/contents/{id}/withdraw` | 撤回送审（in_review→draft） | editor+ |
| 55 | GET | `/admin/media` | 媒体列表（可筛选） | editor+ |
| 56 | POST | `/admin/media` | 签发直传凭证 + 落库元数据 | editor+ |
| 57 | PUT | `/admin/media/blob` | 接收直传二进制（**原始字节**） | editor+ |
| 58 | DELETE | `/admin/media/{id}` | 删除媒体 | **admin** |
| 59 | GET | `/admin/media/{id}` | 媒体详情 | editor+ |
| 60 | GET | `/admin/modules` | 列出模块（含禁用） | editor+ |
| 61 | POST | `/admin/modules` | 创建模块 | **admin** |
| 62 | DELETE | `/admin/modules/{id}` | 删除模块 | **admin** |
| 63 | PUT | `/admin/modules/{id}` | 更新模块 | **admin** |
| 64 | GET | `/admin/settings` | 读取后台设置 | **admin** |
| 65 | PUT | `/admin/settings` | 更新后台设置 | **admin** |
| 66 | GET | `/admin/stats` | 概览统计 | editor+ |
| 67 | GET | `/admin/users` | 列出运营账号（不含家长） | editor+ |
| 68 | PUT | `/admin/users/{id}/role` | 变更角色 | **admin** |
| 69 | PUT | `/admin/users/{id}/status` | 启用/停用账号 | **admin** |

**一致性已核实**：用脚本把 openapi 的 69 个 `(method, path)` 与 `routes.js`(30) + `admin.routes.js`(39) 做双向集合 diff，**差集均为空**，69/69 精确匹配。69 个 `operationId` 全唯一。

### 10.3 响应契约（Go 版必须逐字对齐）

统一信封：

```json
{ "success": true, "code": 0, "message": "ok", "data": { } }
```

| code | 含义 | HTTP（自托管形态） |
|---|---|---|
| 0 | 成功 | 200 |
| 40000 | 校验失败 | 400 |
| 40100 | 未授权 | 401 |
| 40300 | 禁止 / RBAC | 403 |
| 40400 | 未找到 | 404 |
| 40900 | 冲突（状态或版本） | 409 |
| 42900 | 限流 | 429 |

**HTTP 状态映射规则**（`server.js:73-77`）：`floor(code/100)` 落在 400-599 则取之，否则 500。Go 版若也自托管需复刻。

### 10.4 验收标准（EARS 格式，QA 产出）

> **注意**：以下标准按**当前实现**写（手机号+短信码）。Go 版把认证改成邮箱+密码时，A 组需同步调整 —— 但**安全语义不变**。

#### A. 认证

| 编号 | EARS 标准 |
|---|---|
| A1 | While 家长提交合法凭据申请注册，系统必须 创建 `role=parent` 账号并返回 `{user, tokens}`，且用户对象中联系方式必须脱敏 |
| A2 | If 该标识已注册，系统必须 返回 `code=40900`，且不得返回任何令牌 |
| A3 | While 家长提交合法凭据申请登录，系统必须 返回 `{user, tokens}`，accessToken 含 `aud=app`、TTL 900 秒 |
| A4 | If 凭据不存在、已过期或已消费，系统必须 返回 `code=40000`，且不得透露三种情形的差异 |
| A5 | While 家长凭据未验证成功，系统必须 拒绝其获取业务令牌（**Go 版：邮箱未验证禁止登录**） |
| A6 | If 使用不存在的账号登录后台，系统必须 返回与「密码错误」**完全相同**的 `code` 与 `message`（防账号枚举） |
| A7 | While 任一 accessToken 访问受保护端点，系统必须 先校验签名与 exp，再校验 jti 是否在吊销名单，最后放行 |
| A8 | While 令牌 `type=refresh`，系统必须 拒绝其访问任何业务端点并返回 40100 |
| A9 | While 用户已登出，系统必须 使该 accessToken 后续请求返回 40100（jti 吊销即刻生效） |
| A10 | While 家长令牌（`aud=app`）访问任一 `/admin/*`，系统必须 返回 40100 |
| A11 | While 运营令牌（`aud=admin`）访问任一 C 端端点，系统必须 返回 40100 |
| A12 | If 运营账号 `status=disabled`，系统必须 在下一次请求即返回 40100（**每次请求查库**，不靠令牌内快照） |
| A13 | While 连续请求登录或发码超阈值，系统必须 返回 `code=42900` |

#### B. 儿童档案

| 编号 | EARS 标准 |
|---|---|
| B1 | While 家长提交未被占用、未过期的 consentId 与合法信息，系统必须 创建档案、置同意为 `status=used` 并写入 childId |
| B2 | If consentId 不存在，系统必须 返回 40000 |
| B3 | If 同意记录 `expiresAt` 已过期，系统必须 返回 40000 |
| B4 | If ageGroup 不属于 `{3-4, 4-6}`，系统必须 返回 40000 |
| B5 | While 两个并发请求携带**同一** consentId，系统必须 至多一个成功，另一个返回 40900（**须由条件更新或唯一约束保证**） |
| B6 | While 家长操作自己名下儿童，系统必须 放行 |
| B7 | While 家长操作他人名下 childId，系统必须 返回 40300，且响应体不得包含该儿童任何字段 |
| B8 | While 家长删除儿童，系统必须 **在同一事务内**删除 `child_profiles`/`progress_records`/`milestones`，并将该儿童全部 `consent_records` 置为 `revoked`+`revokedAt` |
| B9 | If childId 不存在，系统必须 返回 40300（与「不归属」同码，避免存在性侧信道） |
| B10 | While 更新儿童档案，系统必须 仅接受 name/avatar/ageGroup，其余字段必须被忽略而非报错 |

#### C. 内容状态机（9 条迁移逐条为验收单位）

| 编号 | EARS 标准 |
|---|---|
| C1 | While draft + editor+，系统必须 允许 submit → in_review，version+1 并写修订快照 |
| C2 | While draft + admin，系统必须 允许 publish 直发 → published，写 publishedAt/reviewerId/快照 |
| C3 | While in_review + admin，系统必须 允许 approve → published |
| C4 | While in_review + admin，系统必须 允许 reject → draft，快照 reason |
| C5 | While in_review + editor+，系统必须 允许 withdraw → draft，**清空 reviewerId**、version+1 但**不写快照** |
| C6 | While published + admin，系统必须 允许 unpublish → archived |
| C7 | While draft/in_review/published + admin，系统必须 允许 archive → archived |
| C8 | While archived + editor+ 提交 PUT，系统必须 先自动 reEdit → draft 再应用修改 |
| C9 | While admin 提交 restore，系统必须 以目标快照为新副本、状态置 draft、清空 publishedAt/reviewerId、version+1，且**历史只追加不改写** |
| C10 | If 迁移不在当前状态的合法集合内，系统必须 返回 40900，并在 data 中回传 `currentStatus` 与 `allowedActions` |
| C11 | If 携带的 version 与服务端不一致，系统必须 返回 40900 并回传 `currentVersion` |
| C12 | If 携带的 `expectedVersion` 不匹配（publish 路径），系统必须 返回 40900 |
| C13 | While 内容处于 in_review，系统必须 拒绝任何 PUT 编辑并返回 40900 |
| C14 | While editor 提交带 `isSample` 的请求，系统必须 返回 40300（**该字段仅 admin 可写**） |
| C15 | While C 端调用 list/search/getItem/samples，系统必须 **只返回 status=published**；非 published 一律按「不存在」返回 40400 |
| C16 | If editor 调用 approve/reject/unpublish/archive/delete 或改角色与状态，系统必须 返回 40300 |

#### D. 媒体

| 编号 | EARS 标准 |
|---|---|
| D1 | While 运营者请求上传凭证，系统必须 **先落库元数据再返回直传目标**（AC-12：元数据先于字节到达而存在） |
| D2 | While 直传字节抵达 blob 端点，系统必须 以**临时文件 + 原子 rename** 落盘，禁止半截文件被读到 |
| D3 | If key 规范化后越出媒体根目录（含 `../` 与**同前缀绕过**如 `../media-evil`），系统必须 返回 40000 |
| D4 | If 请求体为空，系统必须 返回 40000 |
| D5 | If 超过 `mediaMaxSizeMB`（默认 50），系统必须 返回 40000 |
| D6 | If MIME 不在白名单内，系统必须 返回 40000 |
| D7 | While 后台完成上传与发布，系统必须 使 C 端可通过 `/content/{id}/mediaUrl` 拿到地址并成功读取 |
| D8 | While 通过公开读路径访问媒体，系统必须 返回 200 且带 `max-age=31536000, immutable` 强缓存头 |
| D9 | While 通过公开读路径访问不存在的文件，系统必须 返回 40400 |

#### E. 护眼

| 编号 | EARS 标准 |
|---|---|
| E1 | While 家长通过家长门修改时长与模式，系统必须 持久化并在读回时原样返回 |
| E2 | If 未携带有效 gateToken 访问或修改护眼设置，系统必须 返回 40300 |
| E3 | While 累计使用时长达到 `dailyLimitMin`，系统必须 **立即中断并锁定界面**（strict 模式不得延迟） |
| E4 | Where 护眼设置为 strict，系统必须 在达到上限时不提供任何绕过入口 |
| E5 | While 在后台/家长端任一侧修改，系统必须 两侧读到同一份值（单一数据源 `parental_settings`） |
| E6 | While App 冷启动，系统必须 从 `parental_settings` 拉取上限值，使中断逻辑**首次会话即生效** |

> E3/E6 的超时判定目前由**客户端**承担（API 中无中断端点），Go 版保持此分工。但这两条**必须由前端自动化测试覆盖**，不列入后端契约。

#### F. 进度

| 编号 | EARS 标准 |
|---|---|
| F1 | While 同一 `childId+itemId` 重复上报，系统必须 只更新同一条记录，不得产生第二条 |
| F2 | If 两个并发请求同时上报同一 `childId+itemId`，系统必须 最终仅一条记录（**依赖 UNIQUE + ON CONFLICT**） |
| F3 | If score 越界（<0 或 >100）或非数字，系统必须 返回 40000 |
| F4 | If status 不属于三种枚举，系统必须 返回 40000 |
| F5 | While 状态变更为 completed，系统必须 至多授予**一枚** first_complete 徽章 |
| F6 | If 并发完成多个条目，系统必须 仍只授予一枚（唯一约束保证） |
| F7 | While 读取进度汇总，系统必须 返回 total/completed/inProgress/notStarted 四项计数，`completionRate = 四舍五入(completed/total*100)`，total=0 时为 0 |
| F8 | While 家长读取他人儿童的进度，系统必须 返回 40300 |

### 10.5 契约测试策略

1. **契约冻结**：以 `openapi.yaml` 为唯一基准，加两条 CI 卡口 —— `spectral lint`（禁 security 缺失等）与 `oapi-codegen validate`。**先修掉 10.1 的 6 处 security 缺失再冻结**，否则生成器会产出错误客户端。

2. **实现一致性卡口**：用 `oapi-codegen` 生成 Go 的路由与 DTO，写表驱动测试 `TestRouteTableMatchesOpenAPI` —— 读 openapi.yaml 遍历 69 个 `(method, path)`，逐一比对 Go 路由表，缺失即失败。**这条直接防「漏实现」和「多实现」**。

3. **128 条现有断言改造成 Go 基准**：三个测试文件全是纯手写 `check(name, cond)`（无框架依赖），运行时实测 57+29+42 = **128 全绿**。路径：保留 `tests/fixtures/admin-seed.json` 作为黄金夹具，把每个 check 逐条翻译为 Go 的 `testing.T` 断言，落到 `tests/contract/{smoke_admin, smoke_routes, selfhost}_test.go`。**要求逐条对应、断言数不少于 128**，作为回归底线。

4. **双跑比对响应体**：起 Node(3000) 与 Go(3001)，对同一夹具库发同样请求，比对 ①业务 code ②脱敏后的 data JSON（抹掉 token/jti/时间戳/UUID）③HTTP 状态码。差异分三档：**阻断**（code 或字段缺失）/ **告警**（字段顺序、空数组 vs null）/ **忽略**（随机与时间类）。**连续 N 轮零阻断差异方可切流**。

5. **竞态补集成测试**：用 `go test -race` + `httptest` 覆盖 C2/C7/F2/F6 这类竞态 —— **这是 Node 单进程 fake-db 测不出来的，也是本次迁移的主要收益**。

---

## 11. 附录

### 11.1 状态机迁移表（Go 侧必须逐条对齐）

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

### 11.2 迁移退路（保留可逆性）

Go 版跑通后，若存储引擎不合适，导出路径：

```
PostgreSQL → 导出器（Go CLI 子命令） → MongoDB / 其他库
```

因为仓储层是接口化的，换引擎只需实现另一个 `repo` 包 + 跑导出器。**这条退路从P0 就要留好，不要等到出问题才补。**

### 11.3 现有 Node 版资产处置

Go 版上线后，Node 版**不要立刻删**：

| 资产 | 处置 |
|---|---|
| `openapi.yaml` | **保留** —— 唯一契约，两边都要用 |
| `db/schema.json` | **保留** —— 索引定义可参考；但**字段靠读代码反推**（它没有字段类型），见 3.2 |
| `db/seed-content.js` | 改造为 Go 的种子程序（种子数据是文档 JSON，可直接移植） |
| `tests/*.test.js`（128 断言） | **改造为契约测试** —— 这是 Go 版的验收基准，价值极高 |
| `deploy/`（systemd/nginx） | 复用，替换二进制路径 |
| 业务代码 | Go 稳定运行 2 周后再删 |
