# 部署指南：dodokid.heymf.cn（直接部署，不用 Docker）

> 目标域名：`https://dodokid.heymf.cn/`
> 形态：**你的服务器 + 系统级 Node.js + 系统级 MongoDB + systemd + Nginx**，后端不依赖 CloudBase、也不依赖 Docker。
> 备选：仓库里保留了 `docker-compose.yml`，需要容器化时看文末「备选：Docker 方式」。

---

## 0. 架构与服务器清单

```
儿童 App (APK)  ─┐
                 ├─► https://dodokid.heymf.cn/api/v1/*  ──►  Nginx  ──►  127.0.0.1:8080
运营后台 (浏览器)─┘        （同源，无 CORS）               (HTTPS)     └─►  Node 进程（systemd 托管）
后台静态文件      ◄──────── Nginx 直接托管 /var/www/dodokid-admin
MongoDB          监听 127.0.0.1:27017，仅本机可达（不开公网）
绘本封面/音频     ◄──────── MEDIA_ROOT（服务器磁盘，经 Nginx /media 直出）
```

| # | 项目 | 必需 | 说明 |
|---|------|:----:|------|
| 1 | **Node.js 20+**（建议 22 LTS） | 是 | 跑 API 进程 |
| 2 | **MongoDB 7 或 8** | 是 | 数据库，只监听 127.0.0.1 |
| 3 | **systemd** | 是 | 拉起与守护 API 进程（CentOS/RHEL 需先 `yum install systemd`） |
| 4 | **Nginx + HTTPS 证书** | 是 | 入口与反代。**没证书 App 全部请求失败**（Android 9+ 禁用明文） |
| 5 | **运营后台 dist** | 是 | `dodokid-admin` 构建产物，纯静态 |
| 6 | **硬盘空间** | 是 | 绘本封面与音频直接存服务器磁盘，按音频总量预留（10MB/个，100 个约 1GB） |

> **不需要 ICP 备案**（服务器在境外）。**也不需要对象存储** —— 媒体默认存服务器本地磁盘。
> 注意：将来若把服务器迁回大陆境内，域名必须先完成 ICP 备案才能绑 80/443。

安装目录约定（后续命令都基于它）：

```
/opt/dodokid                      ← git clone 目标（保留完整仓库，便于 git pull 升级）
/opt/dodokid/dodokid/cloudbase     ← 后端根目录
/opt/dodokid/dodokid/cloudbase/.env            ← 配置（含密钥，权限 600）
/opt/dodokid/dodokid/cloudbase/functions/api    ← API 进程工作目录
/var/www/dodokid-admin            ← 后台静态文件
```

---

## 1. 装 Node.js 与 MongoDB

### Node.js（22 LTS）

```bash
# Debian / Ubuntu
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# RHEL / Rocky / Alma
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo -E bash -
sudo yum install -y nodejs

node -v     # 期望 v22.x
```

### MongoDB（8.0；7.0 亦可）

```bash
# ---- Debian 12 (bookworm) ----
sudo apt install -y gnupg curl
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc \
  | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/debian bookworm/mongodb-org/8.0 main" \
  | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
sudo apt update && sudo apt install -y mongodb-org

# ---- Ubuntu（22.04 用 jammy，24.04 用 noble）----
# 把上面 echo 里的 debian bookworm 换成 ubuntu jammy 或 noble 即可

# ---- RHEL / Rocky / Alma 9 ----
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc \
  | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
sudo tee /etc/yum.repos.d/mongodb-org-8.0.repo > /dev/null <<'REPO'
[mongodb-org/8.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/9/mongodb-org/8.0/x86_64/RHEL-9/
gpgcheck=1
enabled=1
gpgkeyfile=/usr/share/keyrings/mongodb-server-8.0.gpg
REPO
sudo yum install -y mongodb-org
```

> 若 yum 报找不到包，说明你的发行版代号与 `RHEL-9` 不同，按 MongoDB 官网对应页面改 `baseurl` 即可。

启动并设为开机自启：

```bash
sudo systemctl enable --now mongod
sudo systemctl status mongod --no-pager | head -5
mongosh --quiet --eval 'db.version()'      # 期望输出版本号
```

> **若 mongod 起不来且报 `Illegal instruction`**：CPU 不支持 AVX（MongoDB 5.0+ 硬性要求）。
> 换用支持 AVX 的机型，或改装 MongoDB 4.4（不推荐，缺少部分运维能力）。

---

## 2. 克隆代码并装依赖

```bash
sudo mkdir -p /opt && sudo chown -R $USER /opt
git clone https://github.com/heyailab/Dodokid.git /opt/dodokid
cd /opt/dodokid/dodokid/cloudbase

npm ci --omit=dev --prefix functions/api     # API 运行依赖（含 express / mongodb）
npm ci --omit=dev --prefix db               # 数据库工具依赖
```

## 3. 建 Mongo 用户并开启鉴权

**顺序很重要：先建用户，再开鉴权**（开了鉴权又没用户 = 谁都连不上）。

```bash
# 3.1 生成一个 URI 安全的密码（十六进制，无需转义）
MONGO_PWD=$(openssl rand -hex 16); echo "$MONGO_PWD"     # 记下来，第 4 步要用

# 3.2 建库与账号（此时还没开鉴权，本机连接即可）
mongosh --quiet dodokid --eval "db.createUser({
  user: 'dodokid',
  pwd: '$MONGO_PWD',
  roles: [ { role: 'readWrite', db: 'dodokid' } ]
})"

# 3.3 合并鉴权与监听配置（片段文件，不是完整配置，务必先备份）
sudo cp /etc/mongod.conf /etc/mongod.conf.bak
sudo cp /opt/dodokid/dodokid/cloudbase/deploy/mongod-snippet.conf /etc/mongod.dodokid.conf
sudo vi /etc/mongod.conf     # 用上面文件里的 ip / port / bindIp / authorization / dbPath 覆盖同名项
sudo systemctl restart mongod

# 3.4 验证：现在必须带凭证才能连
mongosh "mongodb://dodokid:$MONGO_PWD@127.0.0.1:27017/dodokid?authSource=dodokid" \
  --quiet --eval 'db.getName()'      # 期望输出 dodokid
```

## 4. 配置 .env

```bash
cd /opt/dodokid/dodokid/cloudbase
cp .env.example .env
chmod 600 .env                     # 里面有 JWT_SECRET，必须只有属主可读
```

至少改这四项：

```bash
DB_DRIVER=mongo
MONGODB_URI=mongodb://dodokid:<第3步的密码>@127.0.0.1:27017/dodokid?authSource=dodokid
JWT_SECRET=<openssl rand -hex 32 的输出>

# 媒体：存服务器本地磁盘，不需要开通任何对象存储
MEDIA_DRIVER=local
MEDIA_ROOT=/var/lib/dodokid/media
MEDIA_PUBLIC_PATH=/media
MEDIA_CDN_BASE_URL=https://dodokid.heymf.cn/media
```

再建一次媒体目录并交给运行 API 的用户（**目录权限忘了会导致上传失败**）：

```bash
sudo mkdir -p /var/lib/dodokid/media
sudo chown -R dodokid:dodokid /var/lib/dodokid
```

- `JWT_SECRET` 或 `MEDIA_CDN_BASE_URL` 缺失时**进程会拒绝启动**（fail-fast）。这是刻意设计：带着空配置启动，绘本封面会 404，排查成本远高于启动失败。
- `JWT_SECRET` 生成后不要随意更换 —— 换了会让所有已登录用户的令牌立即失效。

## 5. 建集合 / 索引，并灌初始内容

```bash
cd /opt/dodokid/dodokid/cloudbase

# 先干跑，确认要建什么（不连库）
node db/init-mongo.js --dry-run | tail -3
# 期望：集合 19 个，索引 30 个

# 实际执行
node db/init-mongo.js
node db/seed-content.js
```

> 种子里的封面/音频 `cdnKey` 是占位值。**上线前需在后台重新上传真实素材**，否则绘本无图无音。

## 6. 用 systemd 托管 API

```bash
# 建专用非登录用户
sudo useradd --system --no-create-home --shell /usr/sbin/nologin dodokid
sudo chown -R dodokid:dodokid /opt/dodokid/dodokid/cloudbase

sudo cp deploy/systemd/dodokid-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now dodokid-api

# 验证
curl -s http://127.0.0.1:8080/health
# 期望 {"success":true,...,"data":{"driver":"mongo"}}
systemctl status dodokid-api --no-pager | head -5
```

单元文件已做安全加固（非 root 运行、`ProtectSystem=full`、配置走 `EnvironmentFile` 不进命令行）。

## 7. Nginx + HTTPS 证书

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

Nginx 配置里两处容易踩的已在文件注释中标注：

- `proxy_pass http://127.0.0.1:8080;` **不要加路径后缀** —— Node 内路由表注册的已是 `/api/v1/...` 完整路径，加了会全量 404。
- 必须透传 `X-Real-IP` / `X-Forwarded-For` —— 限流按客户端 IP 计数，拿不到真实 IP 会导致限流失效。

## 8. 部署运营后台

```bash
cd /opt/dodokid/dodokid-admin
npm ci && npm run build
sudo mkdir -p /var/www/dodokid-admin
sudo cp -r dist/* /var/www/dodokid-admin/
sudo chown -R www-data:www-data /var/www/dodokid-admin
```

> 后台的 `VITE_API_BASE=/api/v1`（`dodokid-admin/.env.production`）是**同源相对路径**，
> 与后台同域部署天然没有 CORS 问题。**不要把这个变量留空** —— 留空会启用内置 Mock，
> 表现为「构建成功但完全不连后端」。

## 9. 配备份（必做）

```bash
sudo cp deploy/backup-mongo.sh /usr/local/bin/dodokid-backup
sudo chmod +x /usr/local/bin/dodokid-backup
sudo crontab -e
# 每天 03:17 备份，保留 14 天
17 3 * * * /usr/local/bin/dodokid-backup >> /var/log/dodokid-backup.log 2>&1

# 先手动跑一次确认可用
sudo /usr/local/bin/dodokid-backup
```

脚本会产出两份（**媒体在本地磁盘上，所以必须一起备，否则素材全丢**）：

```
/var/backups/dodokid/dodokid-YYYY-MM-DD-db.archive.gz     ← mongodump
/var/backups/dodokid/dodokid-YYYY-MM-DD-media.tar.gz     ← MEDIA_ROOT 打包
```

**请再同步一份到别处**（另一台机器或对象存储）—— 备份和源机同盘等于没备份。

---

## 10. 验收（逐条可执行）

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
systemctl is-active dodokid-api mongod      # active active
sudo journalctl -u dodokid-api -n 50 --no-pager
```

App 侧逐条确认：

- [ ] APK 首页**能加载绘本列表**（说明 Mock 已关、真实后端通）
- [ ] 家长注册/登录能拿到 token 并进家长中心
- [ ] 后台登录后能看到内容列表
- [ ] 绘本封面与音频能加载（404 则是 `MEDIA_CDN_BASE_URL` 或素材问题）
- [ ] 护眼达限后 App 立即中断（AC-04 回归）

---

## 11. 日常运维

```bash
# 日志
sudo journalctl -u dodokid-api -f
sudo tail -f /var/log/dodokid-backup.log

# 重启 / 停止
sudo systemctl restart dodokid-api

# 升级（拉新代码 → 装依赖 → 重启；.env 不在仓库里，不会被覆盖）
cd /opt/dodokid && git pull
cd dodokid/cloudbase && npm ci --omit=dev --prefix functions/api
sudo systemctl restart dodokid-api

# 改配置后必须重启才生效
sudo vi /opt/dodokid/dodokid/cloudbase/.env && sudo systemctl restart dodokid-api
```

## 12. 排错速查

| 现象 | 原因与处理 |
|------|-----------|
| App 全部请求失败 | 证书没签 / 域名解析错。先 `curl -I https://域名` 确认；Android 9+ 不允许明文 HTTP |
| API 全 404 | `proxy_pass` 加了路径后缀。必须是 `proxy_pass http://127.0.0.1:8080;` |
| 限流不准 / 所有人共用一个配额 | Nginx 少了 `X-Real-IP` / `X-Forwarded-For` 透传 |
| 绘本封面音频 404 | `MEDIA_DRIVER=local` 且 `MEDIA_CDN_BASE_URL` 应以 `/media` 结尾；Nginx 的 `alias` 路径要与 `MEDIA_ROOT` 一致；种子数据里是占位值，需在后台重新上传 |
| 上传返回 500 / 权限错误 | `MEDIA_ROOT` 目录属主必须是 `dodokid`（systemd 以该用户运行），且在单元文件的 `ReadWritePaths` 里 |
| `mongod` 起不来报 Illegal instruction | CPU 不支持 AVX。换机型或改用 MongoDB 4.4 |
| 进程反复重启 | `journalctl -u dodokid-api -n 100` 看真实报错；多半是 `.env` 缺 `JWT_SECRET`，或 `MONGODB_URI` 连不上 |
| 数据库连不上 | 鉴权已开但 URI 没带凭证，或 `authSource` 写错（应为 `dodokid`） |

## 13. 备选：Docker 方式

仓库保留了 `docker-compose.yml`（Mongo 7 + API + 一次性 db-tools），需要容器化或 CI 环境复现时用：

```bash
cd /opt/dodokid/dodokid/cloudbase
cp .env.example .env      # 注意 compose 里 MONGODB_URI 硬编码为 mongodb://mongo:27017，会覆盖 .env
docker compose up -d mongo api
docker compose --profile tools run --rm db-tools
docker compose --profile tools run --rm db-tools node seed-content.js
```

两种后端形态（自托管 / CloudBase）的差异与取舍见 `dodokid/cloudbase/README.md`。

---

## 14. 与 CloudBase 的关系

后端是**一份代码两种形态**，`DB_DRIVER=cloudbase` 时行为与自托管完全一致（85 条冒烟断言是这次改造的回归基线），随时可切回或双跑。详见 `docs/deployment-plan.md`。
