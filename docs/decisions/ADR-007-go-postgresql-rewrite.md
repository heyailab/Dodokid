# ADR-007: Go + PostgreSQL 重写后端

## Status: Accepted (2026-10-13)

## Background

DodoKid 现有后端是 Node.js + Express + MongoDB（4808 行 JS，56 路径 / 69 方法），原为跑在腾讯 CloudBase 云函数上。2026-10 决定脱离 CloudBase、改为自托管，域名 `dodokid.heymf.cn`，海外 Debian 12 服务器（免 ICP 备案），媒体存服务器本地磁盘。

自托管过程中暴露三个部署耦合问题：

1. **环境变量耦合** —— 后端不加载 `.env`（未装 dotenv），宝塔 PM2 启动时拿不到 `JWT_SECRET` 等 10 项配置，进程直接 fail-fast 退出。
2. **进程托管分散** —— 依赖 Node 22 运行时 + 4808 行代码的 `npm ci`，版本漂移风险高。
3. **应用层维护一致性** —— 人工阅读发现 **12 处「多集合要么全成功要么全失败」需求点**（`child.service.js:85-98` deleteChild跨 5 个集合最严重，中途失败构成合规风险），当前全部是「顺序 await、无事务无补偿」。

同期用户评估过用 Go + 嵌入式存储（badger）规避数据库安装成本。评估后**推翻该推荐**，改选 PostgreSQL。

## Decision

**用 Go + PostgreSQL 重写后端，前端（儿童 App + 运营后台）完全复用、零改动。**

具体选型：

| 层 | 选型 |
|---|---|
| 语言 | Go 1.23+ |
| HTTP 路由 | chi v5 |
| 数据库 | PostgreSQL 16+ |
| 驱动 | github.com/jackc/pgx/v5 |
| JWT | golang-jwt/jwt/v5 |
| 密码哈希 | golang.org/x/crypto/bcrypt |
| 认证方式 | 邮箱 + 密码（**替代原手机号 + 短信验证码**）|
| 部署 | 宝塔装 PostgreSQL + systemd 托管二进制 |

**关键取舍**：

- **保留数据库服务**，换取关系模型、真实外键约束、通用运维工具（psql / pgAdmin）、以及那 12 处事务能被正确保证。
- **仓储层接口化**（`repo.ContentRepo` 接口在 domain 侧，实现在 `pgximpl/`），保证未来换库只改一个包。
- **契约不变** —— `openapi.yaml` 是唯一契约，业务码不重新编号，`_id` 保持 24 位十六进制字符串。

## Consequences

### 正面

- **12 处事务需求点获得原生支持** —— PG 有事务，MongoDB 单文档模型下这些只能靠应用层保证。
- **并发缺陷顺带修复** —— `progress_records` 与 `milestones` 补 `UNIQUE` 约束，消除两处 check-then-act 竞态。
- **部署简化** —— 环境变量 10 项 → 3 项；无 `node_modules`；systemd 自动拉起。
- **数据可查** —— 可用 `psql` / pgAdmin 排查，不必写 Node 脚本。
- **契约稳定** —— 前端零改动，无回归风险。

### 负面

- **重写成本约 15 人日** —— 期间不能加新功能。69 个方法 + 状态机 9 条迁移 + 12 处事务边界改造需逐条重实现，**每条都可能漏**。
- **构建期新增 CGO 依赖** —— pgx 需 `libpq-dev`，不能纯 `go build` 随处编译，CI 需加一步 `apt-get install libpq-dev`。
- **仍需安装数据库服务** —— 「不用装数据库」这一收益不存在，宝塔需装 PostgreSQL（比 MongoDB 省事：默认只听 127.0.0.1，无需手动开鉴权与配防火墙）。
- **`schema.json` 无字段类型定义** —— 19 集合里 10 个零字段说明，表结构靠读代码写入点反推，**建表阶段本身存在不确定性**。
- **双跑期需要两套部署** —— Go 与 Node 并行比对响应体，运维成本短期翻倍。

### 被否决的方案

| 方案 | 否决理由 |
|---|---|
| 继续用 Node，只补 dotenv | 0.5 天成本即可解决环境变量问题，但没解决 12 处事务与并发缺陷 |
| Node 单文件编译 + SQLite | 2-3 天，部署形态接近 Go，但仍未解决事务与一致性 |
| Go + 嵌入式 badger | 初稿推荐，评估后推翻：评估发现初稿担心的 4 个问题（数组查询、拆表、聚合、链式查询）全部不成立，嵌入式并未省多少事，却牺牲了关系模型与通用运维工具 |

## Related

- 现状盘点与代价评估见 `docs/PRD-Go后端重写方案.md` 第 2、3、9 章
- 认证改造详见该 PRD 第 5 章
- 原架构决策见 `docs/decisions/ADR-004~006`