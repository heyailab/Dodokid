# 宝塔面板部署指南：dodokid.heymf.cn

> 目标：在自己的宝塔面板上跑通 DodoKid 后端 + 运营后台 + 绘本媒体。
> 环境：Debian 12 海外服务器（免 ICP 备案）+ 宝塔面板 + PM2 + MongoDB。
> 代码已 `git clone` 到服务器，本文档从「装MongoDB」开始。

---

## 0. 你需要准备什么

| 项 | 说明 |
|---|---|
| 宝塔面板 | 已装好，能登录 |
| MongoDB 面板里能装 | 宝塔软件商店 → 安装 MongoDB |
| 域名解析 | `dodokid.heymf.cn` 已 A 记录指向服务器 IP |
| 代码目录 | 假设 `/www/wwwroot/dodokid`，**下面都用这个路径**，不同请全局替换 |

**本项目的技术前提（决定了后面为什么这么做）**：

- 后端是**纯 Node 项目**，入口 `functions/api/server.js`，启动命令 `npm start`，**无需编译**（依赖只有 express / mongodb / bcryptjs，没有构建步骤）。
- 后端**不自动读 `.env`**（代码里没装 dotenv）。所以环境变量必须在宝塔面板的「环境变量」里填 —— 这是最容易踩的坑，见第 3 步。

---

## 1. 装 MongoDB 并开启鉴权

宝塔面板 → **软件商店** → 搜索 `MongoDB` → 安装（选版本 7.0或 8.0）。

### 1.1 确认 mongod 已启动

面板 → **软件商店 → MongoDB → 设置** → 点「启动」，确认状态是「运行中」。

也可以用面板终端确认：

```bash
mongosh --quiet --eval 'db.version()'   # 期望输出版本号
```

### 1.2 建数据库账号（宝塔面板点法）

面板 → **数据库** → 点「添加数据库」：

| 字段 | 填什么 |
|---|---|
| 数据库名 | `dodokid` |
| 用户名 | `dodokid` |
| 密码 | 点「随机生成」 |
| 权限 | **读写** |
| 访问权限 | **本地服务器** |

> **访问权限必须选「本地服务器」**，不要选「公网」。选了公网等于把数据库暴露在公网，任何人都能连。
>
> 宝塔的「本地服务器」意味着只允许 `127.0.0.1` 连接，这正是我们要的（后端和MongoDB 同机）。

**记下这个连接串**，第 3 步要用：

```
mongodb://dodokid:<刚才的密码>@127.0.0.1:27017/dodokid?authSource=dodokid
```

> 若你的 MongoDB 面板版本没强制开鉴权，可能不要求密码也能连。只要能连上，下面这串就填这个：
>
> ```
> mongodb://127.0.0.1:27017/dodokid
> ```

---

## 2. 建媒体目录（绘本封面和音频存这里）

**这一步不做，后台上传 100% 报权限错误。**

面板 → **终端**，执行：

```bash
mkdir -p /www/wwwroot/media/dodokid
chmod 755 /www/wwwroot/media/dodokid
```

> **路径自己定也行**，只要和第 3 步的 `MEDIA_ROOT` 一致。例：`/www/dodokid-media`。
>
> 用 `/www/wwwroot/media/` 这种**独立目录**而不是 `/www/wwwroot/dodokid/`，是为了以后建网站时Nginx 不会把这个目录也当成静态文件暴露出去 —— 只通过第5 步的 `alias` 精确放行 `/media`。

---

## 3. 添加 Node 项目（后端）

面板 → **软件商店** → 搜索 `Node 项目` → 安装并进入设置 → **添加 Node 项目**。

按下面填：

| 字段 | 填什么 | 说明 |
|---|---|---|
| **项目目录** | `/www/wwwroot/dodokid/dodokid/cloudbase/functions/api` | **注意是最里层**，不是仓库根目录 |
| **Node版本** | 18 或 20 | 选面板已装的版本即可 |
| **启动选项** | `npm start` | 等价于 `node server.js` |
| **运行目录** | 留空（跟随项目目录） | |
| **端口** | `8080` | 必须和第 5 步反代端口一致 |
| **安装依赖** | 勾选，或先手动 `npm ci --omit=dev` | 只装 dependencies，没有构建步骤 |

> **项目目录必须是 `functions/api`**。因为 `package.json` 和 `node_modules` 都在这一层，外层目录没有package.json。

### 3.1 环境变量（最关键的一步，务必填）

在同一个添加页面往下找**「环境变量」**区域，逐条添加：

| 变量名 | 变量值 |
|---|---|
| `DB_DRIVER` | `mongo` |
| `MONGODB_URI` | `mongodb://dodokid:你的密码@127.0.0.1:27017/dodokid?authSource=dodokid` |
| `MONGODB_DB` | `dodokid` |
| `JWT_SECRET` | 见下方生成命令 |
| `MEDIA_DRIVER` | `local` |
| `MEDIA_ROOT` | `/www/wwwroot/media/dodokid`（第 2 步的目录） |
| `MEDIA_PUBLIC_PATH` | `/media` |
| `MEDIA_CDN_BASE_URL` | `https://dodokid.heymf.cn/media` |
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `HTTP_BASE_PATH` | `/api/v1` |

生成 `JWT_SECRET`（面板终端执行，复制输出）：

```bash
openssl rand -hex 32
```

**填完点「提交」，再点「启动」。**

### 3.3 关掉 8080 的公网访问（建议做）

后端启动时是 `app.listen(8080)`，没指定 host，因此**监听 `0.0.0.0:8080`，公网能直接访问**。接口本身有鉴权，但没必要把它暴露出去。

面板 → **安全** → 添加端口规则，**只放行 22、80、443、面板端口**，不要放行 8080。

若已放行，在面板 → **安全** → 端口规则里删掉 8080 那条。之后 API 只能经Nginx 转发访问。

> systemd 版不会暴露这个问题，因为单元文件里没设 host 时也会监听全网卡，但 systemd 方案通常配合 `firewalld`/云安全组只开 22/80/443。用宝塔时这一步要你自己做。

### 3.2 确认起来了

面板 → **网站 → Node 项目** → 点你项目的「日志」，期望看到：

```
listening on 8080
```

或者点「检查」，状态应为「正常」。

**如果启动失败**，99% 是环境变量没填全。日志里会出现：

- `JWT_SECRET must be configured in production` → 漏了 `JWT_SECRET`
- `MEDIA_CDN_BASE_URL is required when DB_DRIVER=mongo` → 漏了 `MEDIA_CDN_BASE_URL`

> 代码里做了 fail-fast：生产环境缺关键配置**直接拒绝启动**（而不是跑起来然后各处报错）。这是刻意设计，填全即可。

---

## 4. 建集合与索引、灌初始内容

后端跑起来了，但数据库里还没有表。用面板终端执行两次命令：

```bash
cd /www/wwwroot/dodokid/dodokid/cloudbase

# 先干跑，确认要建什么（不连库，安全）
node db/init-mongo.js --dry-run | tail -3
# 期望输出：集合 19 个，索引 30 个

# 实际执行
node db/init-mongo.js
node db/seed-content.js
```

> **种子里的封面/音频是占位值**，上线后要在运营后台上传真实素材，绘本才有图有音。

---

## 5. 反向代理（宝塔网站配置）

面板 → **网站** → **PHP项目**（选「Node 项目」或纯静态都行）→ **添加站点**：

| 字段 | 填什么 |
|---|---|
| 域名 | `dodokid.heymf.cn` |
| 根目录 | `/www/wwwroot/dodokid-admin-dist` |
| PHP版本 | **纯静态** |
| 数据库 | 不创建 |

建站后进入站点设置，改两处**必须手动改**的地方。

### 5.1 反代到 Node 端口

**设置 → 反向代理 → 添加反向代理**：

| 字段 | 填什么 |
|---|---|
| 代理名称 | `dodokid-api` |
| 目标URL | `http://127.0.0.1:8080` |
| 发送域名 | `$host` |

### 5.2 媒体目录直出（不做则绘本全 404）

**设置 → 配置文件**，在 `server { ... }` 里面**追加**（注意是追加，别删原有内容）：

```nginx
    # 绘本封面与音频：直接由 Nginx 发文件，不经过 Node
    # 目录必须与 MEDIA_ROOT 一致，末尾斜杠两边都要有
    location ^~ /media/ {
        alias /www/wwwroot/media/dodokid/;
        expires 30d;
        add_header Cache-Control "public";
        access_log off;
    }

    # 后台静态文件（构建产物目录名按你实际的填）
    location / {
        root /www/wwwroot/dodokid-admin-dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
```

> `alias` 末尾的斜杠和 `location /media/` 末尾的斜杠**两边都必须有**，少一个会 404。
>
> `try_files ... /index.html` 是后台单页应用必需 —— 直接访问 `/media` 这类前端路由时，Nginx 找不到实体文件会回落到 `index.html`，否则刷新页面就404。

**点「保存」→ nginx 会自动重载。**

### 5.3 申请 HTTPS 证书

**设置 → SSL** → **Let's Encrypt** → 勾选域名 → 申请。

申请成功后**务必勾选「强制 HTTPS」**。

> Android 9+ 禁止明文 HTTP。**没证书 App 所有请求都会失败**，这是最常见的"App 打不开"原因。

---

## 6. 部署运营后台

在服务器上构建，产物放进第 5 步的根目录：

```bash
cd /www/wwwroot/dodokid/dodokid-admin
npm ci
npm run build

mkdir -p /www/wwwroot/dodokid-admin-dist
cp -r dist/* /www/wwwroot/dodokid-admin-dist/
```

> 后台配置文件 `dodokid-admin/.env.production` 里是 `VITE_API_BASE=/api/v1`（相对路径），与后台同域部署，天然没有跨域问题。
>
> **不要把这个变量留空** —— 留空会启用构建时内置的 Mock，表现为「后台能打开，但完全不连后端」。

---

## 7. 验收（逐条执行）

在面板终端执行：

```bash
# 1) 证书与跳转
curl -sI https://dodokid.heymf.cn/ | head -1              # 期望 HTTP/2 200
curl -s -o /dev/null -w '%{http_code}\n' http://dodokid.heymf.cn/   # 期望 301

# 2) 后端活着且连上MongoDB
curl -s http://127.0.0.1:8080/health
# 期望 {"success":true,...,"data":{"driver":"mongo"}}

# 3) 版本接口含媒体基址（B方案新增）
curl -s https://dodokid.heymf.cn/api/v1/version
# 期望包含 "mediaBaseUrl":"https://dodokid.heymf.cn/media"

# 4) 未带令牌应401（说明鉴权生效，不是放行）
curl -s -o /dev/null -w '%{http_code}\n' https://dodokid.heymf.cn/api/v1/child/list  # 期望 401

# 5) 媒体能直出（先放个测试文件）
echo test > /www/wwwroot/media/dodokid/probe.txt
curl -s -o /dev/null -w '%{http_code}\n' https://dodokid.heymf.cn/media/probe.txt  # 期望 200
```

**App 侧确认**：

- [ ] 首页能加载绘本列表（说明 Mock 已关、请求打到了真后端）
- [ ] 家长注册/登录能拿到 token
- [ ] 护眼超时后 App 立即中断

---

## 8. 排错速查

| 现象 | 原因与处理 |
|------|-----------|
| Node 项目启动即退出，日志报 `JWT_SECRET must be configured` | 环境变量没填或没保存。宝塔面板 → 项目 → 设置 → 环境变量，填完**要点提交再重启** |
| 日志报 `MEDIA_CDN_BASE_URL is required` | 同上，漏了 `MEDIA_CDN_BASE_URL` |
| `/health` 返回 502 | Node 没起来。查「日志」看真实报错；确认端口与反代目标一致（都是 8080） |
| 后台能打开但数据全是假的 | `VITE_API_BASE` 被留空，构建时启用了 Mock。改 `.env.production` 为 `/api/v1` 后重新 `npm run build` |
| 绘本封面/音频 404 | 依次查三处：① `MEDIA_ROOT` 与 nginx `alias` 路径是否完全一致（末尾斜杠）② `MEDIA_CDN_BASE_URL` 是否以 `/media` 结尾 ③ 素材是否真的上传过（种子数据是占位值） |
| App 所有请求失败 | 大概率是**没配 HTTPS 证书**。`curl -I https://域名` 验证一下；Android 9+ 不允许明文 HTTP |
| 公网能直接访问 `http://服务器IP:8080` | 后端监听全网卡。按 3.3 在面板「安全」里删掉 8080 的放行规则 |
| 上传 403 / 权限错误 | `MEDIA_ROOT` 目录权限。面板 Node 项目通常以 `www` 或 `root` 运行，执行 `chmod -R 755 /www/wwwroot/media/dodokid` |
| 改了配置不生效 | 环境变量改完必须**重启项目**，不是刷新页面 |
| 数据库连不上 | `MONGODB_URI` 里的密码与面板「数据库」里不一致；`authSource=dodokid` 要和数据库名一致 |
| 修改代码后不生效 | Node 项目没热更新，改完在面板点「重启」 |

---

## 9. 日常运维

```bash
# 看日志（面板 → Node 项目 → 日志，或终端）
pm2 logs dodokid-api --lines 100

# 重启
pm2 restart dodokid-api

# 备份数据库（面板 → 计划任务 → 添加任务，选「备份数据库」更省事）
mongodump --uri="mongodb://dodokid:密码@127.0.0.1:27017/dodokid" --out /www/backup/dodokid
```

> **媒体目录也要单独备份** —— 绘本封面音频在 `/www/wwwroot/media/dodokid`，数据库备份不含这些文件。
> 面板 → **计划任务** → 添加「备份目录」任务，把媒体目录打包到别处。

**升级代码后**：

```bash
cd /www/wwwroot/dodokid && git pull
cd dodokid/cloudbase/functions/api && npm ci --omit=dev
# 然后面板里点「重启」
```

---

## 10. 和 systemd 部署的差别

如果你之前看过 `docs/deploy-dodokid-heymf-cn.md`（systemd 版本），差异只有这些，**代码完全一样**：

| 项 | systemd 版 | 宝塔版 |
|---|---|
| 进程托管 | systemd 单元 | 宝塔 Node 项目（PM2） |
| 环境变量 | `EnvironmentFile` 读 `.env` | **面板「环境变量」逐条填** |
| 反向代理 | 手写 nginx 配置文件 | 面板「反向代理」+ 手写 `location /media/` |
| 启动用户 | 专用`dodokid` 系统用户 | 面板默认用户（`www` 或 `root`） |
| 媒体目录 | `/var/lib/dodokid/media` | 随意（本文用 `/www/wwwroot/media/dodokid`） |

两份文档不要混着操作，选一套走到底。仓库里的 `deploy/` 目录是给 systemd 版准备的，用宝塔可以忽略。
