# 部署指南：dodokid.heymf.cn（全自托管）

> 目标域名：`https://dodokid.heymf.cn/`
> 形态：**你的服务器 + Docker（MongoDB + Node API）+ Nginx + HTTPS**，后端不依赖 CloudBase。
> 备选方案（仍可用）：`docs/deployment-plan.md` 保留了 CloudBase 云函数形态，本项目**同一份后端代码**通过 `DB_DRIVER` 切换两种形态。

---

## 0. 架构：数据流向

```
儿童 App (APK)  ─┐
                 ├─► https://dodokid.heymf.cn/api/v1/*  ──►  Nginx  ──►  127.0.0.1:8080
运营后台 (浏览器)─┘        （同源，无 CORS）                (HTTPS)      └─► api 容器（Node/Express）
                                                                            └─► mongo 容器（MongoDB，仅内网）
后台静态文件      ◄──────── Nginx 直接托管 dodokid-admin/dist
绘本封面/音频     ◄──────── MEDIA_CDN_BASE_URL 指向的对象存储/COS（独立服务）
```

**与 CloudBase 方案的关键差异**：数据库从「CloudBase 文档数据库」换成「你自己的 MongoDB」。
为此后端加了一层很薄的适配（`functions/api/db/mongo.js`），把 CloudBase 那套文档库 API
映射到 MongoDB —— **业务代码（repositories / services / controllers）一行没改**。

### 服务器上要部署什么

| # | 项目 | 必需 | 说明 |
|---|------|:----:|------|
| 1 | **Docker + Docker Compose** | 是 | 跑 MongoDB 与 API 两个容器 |
| 2 | **Nginx** | 是 | HTTPS 入口、反代 API、托管后台静态文件 |
| 3 | **HTTPS 证书** | 是 | Let's Encrypt 免费。**没有证书 App 全部请求失败**（Android 9+ 禁用明文） |
| 4 | **运营后台 dist** | 是 | `dodokid-admin` 构建产物，纯静态 |
| 5 | **对象存储 / COS** | 建议 | 绘本封面与音频。**没有它绘本图片音频会 404**（可先用任意 HTTP 可达的静态目录） |
| 6 | 备案 | 是 | 服务器在中国大陆境内时，域名需完成 ICP 备案才能用 80/443 |

不需要装 Node.js、不需要装数据库 —— 都在容器里。

---

## 1. 部署步骤

### 步骤 1：装 Docker

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
docker compose version    # 确认 compose v2 可用
```

### 步骤 2：拉代码并配置环境变量

```bash
git clone https://github.com/heyailab/Dodokid.git
cd Dodokid/dodokid/cloudbase
cp .env.example .env
```

编辑 `.env`，**至少填这三项**：

```bash
DB_DRIVER=mongo
JWT_SECRET=<长随机串>                        # 生成：openssl rand -hex 32
MEDIA_CDN_BASE_URL=https://<你的媒体域名>    # 绘本封面/音频的公开地址前缀
```

> `JWT_SECRET` 或 `MEDIA_CDN_BASE_URL` 缺失时，compose 会**直接拒绝启动**（`${VAR:?...}`），
> 服务本身也会 fail-fast。这是刻意的：带着空配置启动，排查成本远高于启动失败。

### 步骤 3：起服务

```bash
docker compose up -d mongo api
docker compose ps          # 两个都应 healthy / running
curl -s http://127.0.0.1:8080/health
# 期望 {"success":true,...,"data":{"driver":"mongo"}}
```

### 步骤 4：建集合与索引（一次性）

19 个集合、30 个索引，**复用 `db/schema.json`**（与 CloudBase 形态同一份事实来源）：

```bash
docker compose --profile tools run --rm db-tools
```

### 步骤 5：灌初始内容（一次性）

```bash
docker compose --profile tools run --rm db-tools node seed-content.js
```

> 注意：种子里的封面/音频 `cdnKey` 是占位值。**上线前需在后台重新上传真实素材**，
> 否则绘本封面与音频 404。

### 步骤 6：Nginx + 证书

```bash
sudo apt update && sudo apt install -y nginx
sudo certbot --nginx -d dodokid.heymf.cn     # 需先让 80 端口通、DNS 已生效
```

`/etc/nginx/sites-available/dodokid`：

```nginx
server {
    listen 80;
    server_name dodokid.heymf.cn;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dodokid.heymf.cn;

    ssl_certificate     /etc/letsencrypt/live/dodokid.heymf.cn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dodokid.heymf.cn/privkey.pem;

    client_max_body_size 10m;

    # 运营后台静态文件
    root /var/www/dodokid-admin;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;        # SPA 路由回退
    }
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API 反代到容器（容器只监听回环，必须经这里出去）
    location /api/v1/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    gzip on;
    gzip_types text/css application/javascript application/json;
}
```

> `proxy_pass http://127.0.0.1:8080;` **不要加路径后缀** —— 容器内路由表注册的已经是
> `/api/v1/...` 完整路径，加了会重复前缀导致全量 404。

```bash
sudo mkdir -p /var/www/dodokid-admin
cd ../../dodokid-admin && npm ci && npm run build
sudo cp -r dist/* /var/www/dodokid-admin/
sudo chown -R www-data:www-data /var/www/dodokid-admin
sudo nginx -t && sudo systemctl reload nginx
```

### 步骤 7：DNS

| 类型 | 主机记录 | 指向 |
|------|----------|------|
| A | `@` | 服务器公网 IP |
| CNAME | `www` | 同上（可选） |

---

## 2. 验收（逐条可执行）

```bash
# 1) HTTPS 与跳转
curl -sI https://dodokid.heymf.cn/ | head -1
curl -s -o /dev/null -w '%{http_code}\n' http://dodokid.heymf.cn/     # 301

# 2) 后台可访问
curl -s https://dodokid.heymf.cn/ | grep -o '<title>[^<]*'

# 3) API 通（统一响应契约；自托管能返回真实状态码）
curl -s https://dodokid.heymf.cn/api/v1/version
curl -s -o /dev/null -w '%{http_code}\n' https://dodokid.heymf.cn/api/v1/child/list   # 401（未带令牌）

# 4) 数据库容器健康
docker compose ps
docker compose exec api wget -qO- http://127.0.0.1:8080/health
```

App 侧逐条确认：

- [ ] APK 安装后首页**能加载绘本列表**（说明 Mock 已关、真实后端通）
- [ ] 家长注册/登录能拿到 token 并进家长中心
- [ ] 后台登录后能看到内容列表
- [ ] 绘本翻页正常，封面与音频能加载（若 404 → 检查 `MEDIA_CDN_BASE_URL` 与素材是否已替换）
- [ ] 护眼达限后 App 立即中断（AC-04 回归检查）

---

## 3. 日常运维

```bash
cd dodokid/cloudbase

docker compose logs -f api              # 看日志（含每请求耗时）
docker compose restart api              # 重启
docker compose pull && docker compose up -d --build   # 升级（拉新代码后重新构建）
```

**备份（必做）** —— MongoDB 数据在 `mongo-data` 卷里：

```bash
docker compose exec -T mongo mongodump --archive --gzip > dodokid-$(date +%F).archive.gz
```

建议加个每日 cron，并把副本同步到另一台机器或对象存储。

**升级注意**：`mongo.js` 只实现了仓库实际用到的数据库能力（无聚合/事务）。
若日后业务需要聚合或事务，需同步扩展适配器 —— 直接在 repositories 里用 Mongo 原生 API 会破坏
"两种部署形态同源"的前提。

---

## 4. 与 CloudBase 形态的关系

同一份后端代码通过 `DB_DRIVER` 切换，**随时可以退回 CloudBase**：

| 项 | 自托管（当前） | CloudBase |
|----|--------------|-----------|
| 启动方式 | `docker compose up -d` | `tcb fn deploy api --dir .` |
| 数据库 | MongoDB（`db/mongo.js` 适配） | CloudBase 文档数据库（原生） |
| 集合/索引 | `db/init-mongo.js` | `db/init-collections.js` |
| HTTP 层 | `server.js`（Express，**能返回真实 4xx/5xx**） | 云函数触发器（只能返回 200 + body） |
| 媒体 | COS / 对象存储（两种形态都用它） | 云存储或 COS |

`DB_DRIVER=cloudbase` 时行为与改造前完全一致（85 条冒烟断言全绿，是这次改造的回归基线）。

---

## 5. 已知限制（自托管形态）

1. **短信验证码默认只打日志**（`SMS_PROVIDER=log`）。要真实发送需接腾讯云短信，
   把 `SMS_PROVIDER` 改为 `tencent` 并补齐相应 SDK 凭证。
2. **媒体走对象存储直传**（后端只签发临时凭证、只存元数据）。没有对象存储时绘本无图无音。
3. **单机部署**：MongoDB 与 API 在同一台机器，未做高可用。流量上来后建议数据库独立实例 +
   API 多副本（compose 扩 `api` 副本数即可，Nginx 前面加负载均衡）。
