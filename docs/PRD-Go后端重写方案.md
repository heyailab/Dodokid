# PRD：Go 后端重写方案（DodoKid）

> 版本：v1.0　　日期：2026-10-10
> 状态：待评审
> 背景：现有 Node + Express 后端在宝塔面板部署时暴露过多环境耦合（dotenv 缺失、全网卡监听、PM2 环境变量），改用 Go 重写以达成「单二进制 + 零外部依赖」的自托管目标。
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

| 现状（Node） | Go 之后 |
|---|---|
| 装Node 22 + 依赖（4808 行 JS、21 个仓储） | 一个 `.env` 都没有的二进制，约 15-25MB |
| 必须装 MongoDB 并开鉴权 | **不需要数据库**，二进制内嵌存储 |
| 宝塔面板需配 10 个环境变量 + PM2 | 只需 1 个环境变量（可选） |
| 依赖 `node_modules` 目录 | 静态编译，无依赖目录 |
| 挂掉靠 PM2 拉起 | 挂了自己重启（可选自守护），或 systemd |

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

**关键观察**：全仓零 JOIN、零事务、零聚合（已 grep 验证 `$lookup`/`startSession`/`aggregate(` 零命中）。**这是一份纯文档存储的负载，没有关系型数据库的优势可发挥。**

---

## 3. 方案选型：为什么建议放弃 MongoDB，用嵌入式存储

### 3.0 先澄清一个常见误解（重要）

「不需要数据库」这句话很容易被误读，必须先说清：

| 误解 | 事实 |
|---|---|
| "不需要数据库" = 不存数据？ | **错。数据照存，只是不需要安装 MySQL / MongoDB 那个独立软件** |
| "内嵌存储" = 存在内存里？ | **错。落磁盘，服务重启数据不丢** |
| "内嵌存储" = 存成 JSON 文件？ | **不是。badger 是完整的 LSM 键值数据库引擎，有索引、有事务、有快照隔离** |

**准确的表述是**：badger 就是"**不需要安装的 MongoDB**"。区别在于——

- MongoDB 是独立服务：要装、要开端口、要建用户开鉴权、要单独备份、要配防火墙。
- badger 是链接进你程序的库：Go 代码里 `import` 一个包。**没有服务、没有端口、没有账号体系。**

### 3.0.1 后台管理的内容数据保存在哪里？

**保存在服务器的磁盘文件里，就在二进制旁边。** 默认路径：

```
/opt/dodokid-go/
├── dodokid# 约 20MB 的可执行文件
└── data/            ← 全部业务数据都在这里（badger 的数据目录）
    ├── MANIFEST
    ├── KEYREGISTRY
    ├── *.sst        实际数据分片
    └── *.vlog
```

具体到后台功能：

| 后台操作 | 数据落在哪 |
|---|---|
| 运营上传的绘本封面/音频 | **文件系统** `/www/wwwroot/dodokid-media/`（不进数据库，只在 `media_assets` 里存元数据） |
| 编辑的绘本/识字/英语等内容 | `data/` 里的 `content_items` 键空间 |
| 分类、标签、模块开关 | `data/` 里的 `content_categories` / `content_tags` / `content_modules` |
| 孩子的学习进度、里程碑 | `data/` 里的 `progress_records` / `milestones` |
| 家长账号、后台管理员账号 | `data/` 里的 `users` 键空间 |
| 审计日志、版本记录 | `data/` 里的 `audit_log` / `content_revisions` |

**备份 = 复制 `data/` 目录**（或用 badger 的备份接口做一致性快照）。恢复 = 复制回来。**这就是选它的最大好处：备份这件事从"运维知识"变成了"cp 命令"。**

### 3.0.2 你的数据量：可以忽略

实测当前种子数据（`db/seed-content.js`）：**143 行 / 5.4KB / 16 条内容**。

推算实际负载：

| 集合 | 预期量级 |
|---|---|
| `content_items` 内容 | 几十～几百条 |
| `child_profiles` 儿童档案 | 每家庭 1～3 个 |
| `progress_records` 进度 | 每孩子每天几条 |
| `users` 账号 | 几十～几千 |
| `audit_log` 审计 | 每天几十条，需滚动清理 |

**总量估计 10～100 MB 量级。** badger 处理这个规模毫无压力，且因为是 LSM 写入放大可控，写入快。

> **关键前提**：以上估算基于"单机、单实例、非海量"。如果产品做到百万级内容或需要多机共享，必须换回真数据库。见 3.3 的代价说明。

### 3.1 三选项对比

| 维度 | A. Go + MongoDB(mongo-driver) | B. Go + PostgreSQL | C. Go + 嵌入式（推荐） |
|------|------|------|------|
| 与现有数据模型契合 | 高（文档原样搬） | 中（19 集合要转表） | 高（集合概念对应） |
| 服务器要装东西 | **要装 MongoDB** | 要装 PostgreSQL | **什么都不用装** |
| 备份 | `mongodump` + 单独备媒体 | `pg_dump` | **复制一个文件** |
| 常驻内存占用 | ~150-300MB | ~100-200MB | **0（跑满即退出）** |
| 部署复杂度 | 高（认证/服务/防火墙） | 中 | **低（单文件）** |
| 是否支持事务 | 是 | 是 | 需谨慎（见3.3） |
| 与你现有运维习惯 | 接近 | 新东西 | 新东西 |

### 3.2 推荐 C 的理由（针对你的诉求）

你的核心痛点是**部署麻烦**。方案 A/B 都保留了「装数据库服务」这一步 —— 那正是你之前 systemd 版最麻烦的部分（建用户、开鉴权、配置、防火墙、配备份）。

因为**全仓零 JOIN、零事务、零聚合**，嵌入式存储完全够用。具体选型：

| 项 | 选型 | 理由 |
|---|---|---|
| 引擎 | **badger**（纯 Go LSM） | 零 CGO，`go build` 出静态二进制，跨平台无依赖；比 bbolt 适合大数据量 |
| 或| bbolt | 极致简单，但单文件大库读写会阻塞 |
| 路径 | `/www/wwwroot/dodokid-data/` | 部署目录外，便于整体备份/迁移 |
| 缓存索引 | 按 `schema.json` 的 30 个索引**预建** | 否则 `where().orderBy()` 会全表扫 |

> **这不是玩具方案。** Badger 支持多进程并发读（MVCC）、事务、快照隔离。LSM 写入吞吐在教育App 的量级（千级QPS 峰值）绰绰有余。

### 3.3 必须承认的代价（诚实评估）

嵌入式存储的**硬限制**，写在这里而不是等到上线才发现：

| 限制 | 影响 | 应对 |
|---|---|---|
| **单机存储，无网络共享** | 无法做多机集群 | 你现在是单机，够用。要扩容需导出到 MongoDB（预留迁移接口） |
| **事务能力弱于数据库** | 跨集合事务受限 | **当前业务零事务需求**（已grep验证）。若将来需要，用「应用层补偿 + 幂等键」而非强事务 |
| **无 SQL 生态** | 复杂聚合统计要自己写 | 运营侧的统计需求用预聚合 + 增量更新，别写临时查询 |
| **迁移成本** | 若将来换MongoDB，需写导出器 | **本次就要求仓储层做存储抽象**（见 5.2），让换引擎只改一层 |

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
| Redis 缓存 | 单机下badger 的读已足够快 |
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
| 存储 | badger | v4 | 见 3.2 |
| 密码哈希 | golang.org/x/crypto/bcrypt | 最新 | 与 Node bcryptjs 兼容（同一算法） |
| JWT | github.com/golang-jwt/jwt/v5 | v5 | 主流标准 |
| 手机验证 | 内存 + 定时清理 | 自研 | 保持与现有 `sms_codes` 集合语义；换真实服务商时只改适配层 |
| 测试 | go test + httptest | 标准 | 不引入外部依赖 |

> **不选 ORM 框架**（如 GORM）。文档模型下 ORM 反而是负担，写薄仓储层更直接。

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
│   │   ├── repo.go                  # 接口定义
│   │   ├── badgerimpl/              # Badger 实现
│   │   └── mongoimpl/               # 迁移期用的 MongoDB 实现（可选，见9.2）
│   └── util/
├── data/                            # 运行时生成：badger 数据目录
└── go.mod
```

**依赖方向严格向下**：`handler → service → repo → 存储`。`domain` 被service 引用，不反向依赖。

#### 6.3.3 存储抽象（关键设计决策）

**必须做**，否则「嵌入式→MongoDB」的死路从第一天就埋下：

```go
// repo/repo.go —— 接口在domain 侧定义，实现可替换
type ContentRepo interface {
    Get(ctx context.Context, id string) (*domain.ContentItem, error)
    List(ctx context.Context, q domain.ContentQuery) ([]domain.ContentItem, error)
    // CAS 乐观锁：version 不匹配返回 ErrVersionConflict → HTTP 409
    UpdateStatus(ctx context.Context, id string, from domain.ContentStatus, to domain.ContentStatus, expectVersion int) error
    // ...
}
```

这样**换数据库只改 `badgerimpl` 一个包**，service 与 handler 不动。

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

### 7.1 面板配置

宝塔 → **软件商店 → Node 项目** → 换成**「Go 项目」**（或直接用 systemd，见 6.2）。实际上宝塔对 Go 支持弱，**推荐 systemd**：

### 7.2 systemd（比 Node 简单得多）

```bash
# 1. 上传二进制 + 配置，整目录就两个文件
mkdir -p /opt/dodokid-go
cp dodokid /opt/dodokid-go/
cp config.yaml /opt/dodokid-go/   # 可选，不用环境变量

# 2. 建用户 + 授权
useradd --system --no-create-home --shell /usr/sbin/nologin dodokid
chown -R dodokid:dodokid /opt/dodokid-go /www/wwwroot/dodokid-media

# 3. 挂 systemd
cp deploy/dodokid-go.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now dodokid-go
```

**启动失败时日志直接看**：`journalctl -u dodokid-go -n 50 --no-pager`。没有 PM2、没有 node_modules、没有环境变量表。

### 7.3 对比现有宝塔 Node 方案

| 项 | 现在（Node） | Go 重写后 |
|---|---|---|
| 安装 Node 22 | 要 | **不要** |
| `npm ci` 装依赖 | 要（4808 行代码的依赖） | **不要** |
| 环境变量 | 10 个，漏一个就崩 | **0 个**（全用默认值即可跑） |
| 目录结构 | 4808 行源码 + node_modules | **1 个二进制**（约 20MB） |
| 需要装数据库 | MongoDB + 建用户 + 开鉴权 | **不要** |
| 备份 | mongodump + 媒体 tar | **复制 data/ 目录** |
| 升级 | git pull + npm ci + 面板重启 | 换二进制 + `systemctl restart` |
| 挂掉恢复 | PM2 | systemd 自动拉起 |

---

## 8. 实施计划

### 阶段划分（每阶段可独立验收）

| 阶段 | 内容 | 验收标准 |
|---|---|---|
| **P0** | 骨架 + 契约冻结 | `openapi.yaml` 校验通过；`/health`、`/version` 可用；badger 读写通；**前端已可连** |
| **P1** | 认证域（**新增邮箱验证 + 忘记密码**） | 邮箱注册/登录/验证邮件/重置密码/双 audience/刷新/黑名单/限流；**契约测试覆盖全部认证端点** |
| **P2** | C 端读域 | 内容/模块/儿童档案/进度/护眼/里程碑；**App 主流程可用** |
| **P3** | 媒体域 | 上传凭证 + blob 接收 + 静态直出 + 路径穿越防护；**后台能传图** |
| **P4** | 管理域 | 39 个方法 + 状态机 9 条 + CAS + 审计；**后台全功能可用** |
| **P5** | 双跑与切换 | Go 与 Node 并行，真实流量对比响应体；差异归零后切流 |

### 里程碑估算

按现有代码规模（4808 行 JS，含业务规则）与 Go 的表达力：

| 阶段 | 估算 | 理由 |
|---|---|---|
| P0 | 0.5 天 | 骨架 |
| P1 | **3 天** | 认证是安全敏感区；且新增了邮箱验证邮件 + 忘记密码流程（原方案只有短信验证码） |
| P2 | 1.5 天 | 读域，最直接 |
| P3 | 1 天 | 媒体，含原子落盘与安全防护 |
| P4 | **4.5 天** | **最重**：39 个管理方法 + 状态机 + RBAC + 审计 |
| P5 | 1.5 天 | 双跑对比（69 个方法逐一比对响应体） |
| **合计** | **约 12 人日** | 不含测试补全；含邮箱验证与忘记密码 |

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
| **12+ 人日** | 期间不能加新功能 |
| **放弃已验证的部署方案** | systemd 版已写完文档能用；宝塔版刚写完 |

### 不重写也能达成「部署简单」

你的真实痛点是**部署麻烦**，这个有成本低得多的解法：

| 方案 | 工作量 | 效果 |
|---|---|---|
| **A. 现有宝塔版文档直接照做** | 0天 | 装MongoDB + 填 10 个环境变量。已写好的文档照做即可 |
| **B. 宝塔 Node 项目补 `dotenv`** | 0.5 天 | 加个依赖，`.env` 就能生效，少填 8 个环境变量 |
| **C. 打成单文件 + 嵌入存储（不改语言）** | 2-3 天 | Node 单文件编译（`pkg`/`node --build-sea`）+ SQLite，部署形态接近 Go |
| **D. Go 重写** | 12+ 天 | 部署最干净 |

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
badger 数据目录 → 导出器（Go CLI 子命令） → MongoDB / PostgreSQL
```

因为仓储层是接口化的，换引擎只需实现另一个 `repo` 包 + 跑导出器。**这条退路从P0 就要留好，不要等到出问题才补。**

### 10.3 现有 Node 版资产处置

Go 版上线后，Node 版**不要立刻删**：

| 资产 | 处置 |
|---|---|
| `openapi.yaml` | **保留** —— 唯一契约，两边都要用 |
| `db/schema.json` | **保留** —— 集合与索引定义，需预建成 badger 索引 |
| `db/seed-content.js` | 改造为 Go 的种子程序（种子数据是文档 JSON，可直接移植） |
| `tests/*.test.js`（128 断言） | **改造为契约测试** —— 这是 Go 版的验收基准，价值极高 |
| `deploy/`（systemd/nginx） | 复用，替换二进制路径 |
| 业务代码 | Go 稳定运行 2 周后再删 |
