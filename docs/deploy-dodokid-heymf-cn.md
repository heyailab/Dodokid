# 部署指南：dodokid.heymf.cn（Go + PostgreSQL，直接部署，不用 Docker）

> 目标域名：`https://dodokid.heymf.cn/`
> 形态：**你的服务器 + PostgreSQL + 单 Go 二进制（systemd 托管）+ Nginx**，后端不依赖 CloudBase、也不依赖 Docker。
> 前端（儿童 App 与运营后台）**一行不改**，只依赖 `openapi.yaml` 契约。

> **本文档对应已决策方案**：Go 重写后端 + PostgreSQL（见 `docs/PRD-Go后端重写方案.md`）。
> 旧的 Node + MongoDB 部署步骤已废弃，见文末「附录 A：已废弃的 Node 部署步骤」。

---

## 0. 架构与服务器清单

```
儿童 App (APK)  ─┐
                 ├─► https://dodokid.heymf.cn/api/v1/*  ──►  Nginx  ──►  127.0.0.1:8080
运营后台 (浏览器)─┘        （同源，无 CORS）               (HTTPS)     └─►  Go 二进制（systemd 托管）
后台静态文件      ◄──────── Nginx 直接托管 /var/www/dodokid-admin
PostgreSQL       监听 127.0.0.1:5432，仅本机可达（不开公网）
绘本封面/音频     ◄──────── MEDIA_ROOT（服务器磁盘，经 Nginx /media 直出）
```

| # | 项目 | 必需 | 说明 |
| - | --- | :-: | --- |
| 1 | **Go 1.21+ 工具链**（仅构建机需要） | 否* | 若用预编译二进制交付则服务器无需 Go |
| 2 | **PostgreSQL 15+**（推荐 16/17，已在 18.1 实测） | 是 | 数据库，只监听 127.0.0.1 |
| 3 | **libpq-dev**（仅构建机，CGO 编译需要） | 否* | `go build` 链接 pgx 时必需 |
| 4 | **systemd** | 是 | 托管 Go 二进制（CentOS/RHEL 需先 `yum install systemd`） |
| 5 | **Nginx + HTTPS 证书** | 是 | 入口与反代。没证书 App 全部请求失败（Android 9+ 禁用明文） |
| 6 | **运营后台 dist** | 是 | `dodokid-admin` 构建产物，纯静态 |
| 7 | **硬盘空间** | 是 | 绘本封面与音频直接存服务器磁盘，按音频总量预留（10MB/个，100 个约 1GB） |

> * 构建可在本地/CI 完成，服务器只跑编译好的二进制。详见第 1 节。
> **不需要 ICP 备案**（服务器在境外）。**也不需要对象存储** —— 媒体默认存服务器本地磁盘。
> 注意：将来若把服务器迁回大陆境内，域名必须先完成 ICP 备案才能绑 80/443。

安装目录约定（后续命令都基于它）：

```
/opt/dodokid/dodokid-go          ← Go 后端根目录（含二进制与 migrations/）
/opt/dodokid/dodokid-go/dodokid  ← 编译产物（约 20MB 单二进制）
/opt/dodokid/dodokid-go/migrations/  ← SQL 迁移（0001_init → 0003_indexes → 0002_seed）
/var/lib/dodokid/media           ← 媒体文件根目录（磁盘）
/var/www/dodokid-admin           ← 后台静态文件
```

---

## 1. 准备 Go 二进制（构建与交付）

Go 后端依赖 `pgx`，编译需 **CGO + libpq-dev**（已在 PRD 6.3.1.1 标注）。两种交付方式：

**方式 A：在服务器上构建（简单，但服务器需装工具链）**

```bash
# Debian / Ubuntu 构建机
sudo apt install -y golang-go libpq-dev gcc
cd /opt/dodokid/dodokid-go
export CGO_ENABLED=1
go build -o dodokid ./cmd/dodokid
```

**方式 B：本地/CI 交叉构建，只把二进制传上服务器（推荐，服务器更干净）**

```bash
# 构建机（与上面相同的环境）
cd dodokid-go
export CGO_ENABLED=1
go build -o dodokid ./cmd/dodokid
# 把 dodokid 与 migrations/ 目录 scp 到服务器 /opt/dodokid/dodokid-go/
```

> **切记**：pgx 走 CGO，不能用 `CGO_ENABLED=0` 纯静态编译，否则链接 `libpq` 失败。
> 若构建机与服务器发行版不同，用方式 B 并在构建机装好 `libpq-dev` 即可，运行时服务器只需 `libpq` 运行时（Debian 默认已随 postgresql-client 带入，或 `apt install -y libpq5`）。

---

## 2. 安装 PostgreSQL

> 若使用宝塔面板：软件商店直接装 PostgreSQL，然后跳到「建库与账号」一步，无需手动加 PGDG 源。

```bash
# Debian 12 默认仓库是 PG 15，够用；要 16/17 走 PGDG 源：
sudo apt install -y curl ca-certificates gnupg
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt update && sudo apt install -y postgresql-16

sudo systemctl enable --now postgresql
sudo systemctl status postgresql --no-pager | head -5
sudo -u postgres psql -c 'SELECT version();'   # 期望输出版本号
```

> PostgreSQL 默认 `listen_addresses = 'localhost'`，**只听 127.0.0.1，不开公网，无需改防火墙**（比 MongoDB 少一步）。

建库与账号：

```bash
# 生成一个 URI 安全的密码并记下，第 4 步要用
PG_PWD=$(openssl rand -hex 16); echo "$PG_PWD"

sudo -u postgres psql -c "CREATE USER dodokid WITH PASSWORD '$PG_PWD';"
sudo -u postgres psql -c "CREATE DATABASE dodokid OWNER dodokid;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE dodokid TO dodokid;"
```

连接串（第 4 步用）：

```
postgres://dodokid:<PG_PWD>@127.0.0.1:5432/dodokid
```

---

## 3. 运行数据库迁移（建表 + 索引 + 种子）

迁移文件在 `dodokid-go/migrations/`，**必须按此顺序**（种子用 `ON CONFLICT`，依赖唯一索引先建好）：

```bash
cd /opt/dodokid/dodokid-go
export PGURI="postgres://dodokid:<PG_PWD>@127.0.0.1:5432/dodokid"

psql "$PGURI" -f migrations/0001_init.sql      # 18 张表 + 内联约束/外键
psql "$PGURI" -f migrations/0003_indexes.sql   # 23 个二级索引（含 email 小写唯一索引）
psql "$PGURI" -f migrations/0002_seed.sql     # 种子数据（模块/内容/媒体/后台设置）
```

> 已在真实 PostgreSQL 18.1 上实测通过（见 PRD 10.6）。若换 PG 15，语法完全兼容。
> 重复执行安全：所有语句 `CREATE TABLE IF NOT EXISTS` / `ON CONFLICT DO NOTHING`，可重跑。

快速校验：

```bash
psql "$PGURI" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
# 期望 18
```

---

## 4. systemd 托管 Go 二进制

```bash
# 建专用非登录用户
sudo useradd --system --no-create-home --shell /usr/sbin/nologin dodokid
sudo chown -R dodokid:dodokid /opt/dodokid/dodokid-go
sudo mkdir -p /var/lib/dodokid/media
sudo chown -R dodokid:dodokid /var/lib/dodokid/media

sudo cp /opt/dodokid/dodokid-go/deploy/dodokid-go.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now dodokid-go
```

单元文件 `deploy/dodokid-go.service`（关键环境变量写在 `Environment`，不进命令行）：

```ini
[Unit]
Description=DodoKid Go API
After=network.target postgresql.service

[Service]
User=dodokid
Group=dodokid
WorkingDirectory=/opt/dodokid/dodokid-go
ExecStart=/opt/dodokid/dodokid-go/dodokid
Environment=PORT=8080
Environment=DATABASE_URL=postgres://dodokid:<PG_PWD>@127.0.0.1:5432/dodokid
Environment=JWT_SECRET=<openssl rand -hex 32 的输出>
Environment=MEDIA_ROOT=/var/lib/dodokid/media
Environment=MEDIA_CDN_BASE_URL=https://dodokid.heymf.cn/media
Restart=on-failure
# 安全加固：文件系统只读 + 仅媒体目录可写
ProtectSystem=full
ReadWritePaths=/var/lib/dodokid/media

[Install]
WantedBy=multi-user.target
```

验证：

```bash
curl -s http://127.0.0.1:8080/health
# 期望 {"success":true,"code":0,"message":"ok","data":{}}
curl -s http://127.0.0.1:8080/version
# 期望含 mediaBaseUrl 字段
systemctl status dodokid-go --no-pager | head -5
```

- `JWT_SECRET` 缺失时**进程会拒绝启动**（fail-fast）。
- `JWT_SECRET` 生成后不要随意更换 —— 换了会让所有已登录用户的令牌立即失效。

---

## 5. Nginx + HTTPS 证书

```bash
sudo apt install -y nginx            # RHEL: sudo yum install -y nginx
sudo cp deploy/nginx/dodokid.conf /etc/nginx/sites-available/dodokid
sudo ln -s /etc/nginx/sites-available/dodokid /etc/nginx/sites-enabled/dodokid
sudo rm -f /etc/nginx/sites-enabled/default

# 证书（需 80 端口已通、DNS 已生效）
sudo apt install -y certbot python3-certbot-nginx    # RHEL: sudo yum install -y certbot
sudo certbot --nginx -d dodokid.heymf.cn
sudo nginx -t && sudo systemctl reload nginx
```

Nginx 配置两处易踩坑（已在文件注释中标注）：

- `proxy_pass http://127.0.0.1:8080;` **不要加路径后缀** —— Go 路由注册已是 `/api/v1/...` 完整路径，加了会全量 404。
- 必须透传 `X-Real-IP` / `X-Forwarded-For` —— 限流按客户端 IP 计数（见 PRD 4.1，限流键已修正为 IP+账号维度）。

---

## 6. 部署运营后台

```bash
cd /opt/dodokid/dodokid-admin
npm ci && npm run build
sudo mkdir -p /var/www/dodokid-admin
sudo cp -r dist/* /var/www/dodokid-admin/
sudo chown -R www-data:www-data /var/www/dodokid-admin
```

> 后台 `VITE_API_BASE=/api/v1`（`dodokid-admin/.env.production`）是**同源相对路径**，天然无 CORS。
> **不要留空** —— 留空会启用内置 Mock，表现为「构建成功但完全不连后端」。

---

## 7. 配备份（必做）

```bash
sudo cp deploy/backup-pg.sh /usr/local/bin/dodokid-backup
sudo chmod +x /usr/local/bin/dodokid-backup
sudo crontab -e
# 每天 03:17 备份，保留 14 天
17 3 * * * /usr/local/bin/dodokid-backup >> /var/log/dodokid-backup.log 2>&1

# 先手动跑一次确认可用
sudo /usr/local/bin/dodokid-backup
```

脚本产出两份（**媒体在本地磁盘，必须一起备，否则素材全丢**）：

```
/var/backups/dodokid/dodokid-YYYY-MM-DD-db.sql.gz     ← pg_dump
/var/backups/dodokid/dodokid-YYYY-MM-DD-media.tar.gz  ← MEDIA_ROOT 打包
```

**请再同步一份到别处**（另一台机器或对象存储）—— 备份和源机同盘等于没备份。

---

## 8. 验收（逐条可执行）

```bash
# 1) HTTPS 与跳转
curl -sI https://dodokid.heymf.cn/ | head -1
curl -s -o /dev/null -w '%{http_code}\n' http://dodokid.heymf.cn/     # 301

# 2) 后台可访问
curl -s https://dodokid.heymf.cn/ | grep -o '<title>[^<]*'

# 3) API 通，且状态码真实（未带令牌应 401，而不是 200）
curl -s https://dodokid.heymf.cn/api/v1/version
curl -s -o /dev/null -w '%{http_code}\n' https://dodokid.heymf.cn/api/v1/child/list   # 401

# 4) 本地媒体能读（先自行放一个测试文件）
sudo -u dodokid mkdir -p /var/lib/dodokid/media/admin-media/covers
echo test > /var/lib/dodokid/media/admin-media/covers/probe.png
curl -s -o /dev/null -w '%{http_code}\n' https://dodokid.heymf.cn/media/admin-media/covers/probe.png   # 200

# 5) 进程与数据库
systemctl is-active dodokid-go postgresql      # active active
sudo journalctl -u dodokid-go -n 50 --no-pager
```

App 侧逐条确认：

- [ ] APK 首页**能加载绘本列表**（说明 Mock 已关、真实后端通）
- [ ] 家长邮箱注册 → 收验证邮件 → 验证后登录能拿到 token
- [ ] 后台登录后能看到内容列表
- [ ] 绘本封面与音频能加载（404 则是 `MEDIA_CDN_BASE_URL` 或素材问题）
- [ ] 护眼达限后 App 立即中断（AC-04 回归）

---

## 9. 日常运维

```bash
# 日志
sudo journalctl -u dodokid-go -f
sudo tail -f /var/log/dodokid-backup.log

# 重启 / 停止
sudo systemctl restart dodokid-go

# 升级（替换二进制 → 重启；migrations 如有新增按顺序补跑）
cd /opt/dodokid/dodokid-go
scp 新二进制 dodokid  # 或重新构建
sudo systemctl restart dodokid-go

# 改配置后必须重启才生效
sudo systemctl edit dodokid-go   # 改 Environment，然后：
sudo systemctl restart dodokid-go
```

---

## 10. 排错速查

| 现象 | 原因与处理 |
| --- | --- |
| App 全部请求失败 | 证书没签 / 域名解析错。先 `curl -I https://域名` 确认；Android 9+ 不允许明文 HTTP |
| API 全 404 | `proxy_pass` 加了路径后缀。必须是 `proxy_pass http://127.0.0.1:8080;` |
| 限流不准 / 所有人共用一个配额 | Nginx 少了 `X-Real-IP` / `X-Forwarded-For` 透传（见 PRD 4.1 限流键修正） |
| 绘本封面音频 404 | `MEDIA_CDN_BASE_URL` 应以 `/media` 结尾；Nginx 的 `alias` 路径要与 `MEDIA_ROOT` 一致；种子数据里是占位值 |
| 上传返回 500 / 权限错误 | `MEDIA_ROOT` 目录属主必须是 `dodokid`，且在单元文件的 `ReadWritePaths` 里 |
| 进程反复重启 | `journalctl -u dodokid-go -n 100` 看真实报错；多半是 `DATABASE_URL` 连不上或 `JWT_SECRET` 缺失 |
| 启动报 `libpq.so` 找不到 | 服务器缺 `libpq` 运行时：`sudo apt install -y libpq5` |
| `go build` 报 CGO / `libpq` 链接失败 | 构建机没装 `libpq-dev` 或 `CGO_ENABLED=0`，见第 1 节 |
| 数据库连不上 | `DATABASE_URL` 的密码/库名错，或 PG 未起 `systemctl status postgresql` |

---

## 附录 A：已废弃的 Node 部署步骤（归档，不再使用）

> 以下为**原 Node + MongoDB 方案**的步骤，自 2026-10 决策改为 Go + PostgreSQL 后**已废弃**。
> 仅保留作历史参考，请勿照做。如需回退到 Node 版（PRD 9.3 退路），另行评估。

（原文档的「装 Node.js 与 MongoDB」「克隆代码并 `npm ci`」「建 Mongo 用户并开鉴权」
「`DB_DRIVER=mongo` 配置 .env」「`node db/init-mongo.js` 建集合」「`docker-compose.yml` 双形态」
等全部作废。新方案见上文第 1–10 节。）
