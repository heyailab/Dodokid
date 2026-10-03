# 部署指南：dodokid.heymf.cn 单域名上线

> 目标域名：`https://dodokid.heymf.cn/`
> 适用形态：**单域名 + 自有服务器 + 腾讯云 CloudBase（后端与数据库）**
> 与 `docs/deployment-plan.md`（多子域名方案）并列，按本文件执行即可；差异见文末「与多子域名方案的差异」。

---

## 0. 先看清架构：哪些东西不在你的服务器上

这是最关键的一点，先讲清楚，避免在服务器上白折腾：

```
儿童 App (APK)  ─┐
                 ├─► https://dodokid.heymf.cn/api/v1/*  ──►  Nginx 反向代理 ──►  CloudBase 云函数 api
运营后台 (浏览器)─┘        （同源，无 CORS 问题）                            │
                                                                                └─► CloudBase 文档数据库（19 集合）
静态资源 /              ◄── Nginx 直接托管 dodokid-admin/dist
```

**后端代码绑定 CloudBase 文档数据库**（`cloudbase/functions/api/appContext.js` 用 `@cloudbase/node-sdk` 的 `app.database()`），
所以数据库和云函数都在 CloudBase 上，**不在你的服务器上**。你的服务器只承担两件事：**HTTPS 入口**和**运营后台静态托管**。

> 因此：**服务器不需要装 Node.js、不需要装数据库、不需要装 COS。**

---

## 1. 服务器上要部署哪些（清单）

| # | 项目 | 必需 | 说明 |
|---|------|:----:|------|
| 1 | **Nginx** | ✅ | 反向代理 `/api/v1/*` 到云函数；托管后台静态文件；提供 HTTPS |
| 2 | **HTTPS 证书** | ✅ | Let's Encrypt 免费。**APK 只允许 HTTPS**（Android 9+ 默认禁用明文流量），没有证书则 App 全部请求失败 |
| 3 | **运营后台静态文件** | ✅ | `dodokid-admin/dist`（约 1.3 MB，纯静态，**不需要 Node 运行时**） |
| 4 | Node.js 运行时 | ❌ | 后端跑在 CloudBase，本地/服务器都不需要 |
| 5 | 数据库 | ❌ | CloudBase 文档数据库提供 |
| 6 | COS / 对象存储 | ❌ | 媒体走 CloudBase/COS，由云函数签发临时凭证 |

> **前提条件**：域名解析到服务器 IP。若服务器在中国大陆境内，域名需完成 **ICP 备案**才能绑定 80/443 端口 —— 这是硬前提，请先确认。

---

## 2. 完整部署步骤

### 步骤 1：CloudBase 环境与数据库（一次性）

1. 在腾讯云创建 CloudBase 环境，记下**环境 ID**。
2. 初始化集合与索引（**19 个集合 / 30 个索引**，来源 `cloudbase/db/schema.json`）：

   ```bash
   cd dodokid/cloudbase/db
   npm install
   TCB_ENV=<环境ID> TCB_SECRET_ID=<SecretId> TCB_SECRET_KEY=<SecretKey> node init-collections.js
   ```
   脚本是幂等的，可重复执行；若 `@cloudbase/manager-node` 不可用，它会打印控制台手工步骤 —— 此时以 `schema.json` 为准手工建。

3. 灌入初始内容（绘本 / 习惯任务 / 识字卡）：

   ```bash
   TCB_ENV=<环境ID> TCB_SECRET_ID=<SecretId> TCB_SECRET_KEY=<SecretKey> node seed-content.js
   ```
   ⚠️ 种子数据里的 `cdnKey`/`url` 是占位值，**上线前需替换为真实上传的媒体资源**，否则绘本封面/音频 404。

### 步骤 2：部署 API 云函数

```bash
cd dodokid/cloudbase/functions/api
npm install
tcb login            # 首次需登录
tcb fn deploy api --dir .
```

然后在控制台配置**环境变量**（云函数 → 配置 → 环境变量）：

| 变量 | 值 | 说明 |
|------|----|------|
| `JWT_SECRET` | **随机长串，必填** | 生产环境缺失会 fail-fast |
| `TCB_ENV` | `<环境ID>` | 云函数内会自动注入，确认即可 |
| `PRIVACY_POLICY_URL` | `https://dodokid.heymf.cn/privacy` | App 内展示的隐私政策地址 |
| `SMS_PROVIDER` | `log` → 正式改 `tencent` | 未接短信服务前验证码只在日志里 |
| `APP_VERSION` / `MIN_APP_VERSION` | 按需 | 版本门槛校验 |
| 其余 | 见 `cloudbase/README.md` 环境变量表 | 有默认值，可不配 |

> ⚠️ **大坑**：`tcb fn config update --envVariables` 是**全量覆盖**，不是增量。改环境变量前必须先 `tcb fn detail` 导出当前值再合并，否则会把已有变量清空。

开启云函数的 **HTTP 访问**，从控制台复制访问地址（形如 `https://<...>`），备用给 Nginx 反代。

### 步骤 3：DNS 解析

在域名服务商添加：

| 类型 | 主机记录 | 指向 |
|------|----------|------|
| A | `@` | 服务器公网 IP |
| CNAME | `www` | 同上（或直接不用） |

### 步骤 4：服务器装 Nginx + 证书

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y nginx
sudo certbot --nginx -d dodokid.heymf.cn      # 需先让 80 端口通、DNS 已生效
```

### 步骤 5：Nginx 配置

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

    # APK 体积偏大（~86MB），放宽上传上限以备后台上传媒体
    client_max_body_size 60m;

    root /var/www/dodokid-admin;
    index index.html;

    # ---- 后台静态资源 ----
    location / {
        try_files $uri $uri/ /index.html;      # SPA 前端路由回退
    }

    # ---- API 反向代理到 CloudBase 云函数 ----
    location /api/v1/ {
        proxy_pass https://<云函数HTTP访问地址>/api/v1/;   # ← 换成控制台复制的地址
        proxy_ssl_server_name on;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # 带 hash 的构建产物可长期缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/css application/javascript application/json;
}
```

部署后台静态文件：

```bash
cd dodokid-admin && npm ci && npm run build
sudo mkdir -p /var/www/dodokid-admin
sudo cp -r dist/* /var/www/dodokid-admin/
sudo chown -R www-data:www-data /var/www/dodokid-admin
sudo nginx -t && sudo systemctl reload nginx
```

> 后台的 `VITE_API_BASE=/api/v1` 是**同源相对路径**（见 `dodokid-admin/.env.production`），所以后台与 API 同域、不存在跨域问题。**不要把这个变量留空** —— 留空会让 `src/main.tsx` 启用内置 Mock，表现为「构建成功但不连后端」。

### 步骤 6：媒体上传的域名白名单

云存储/COS 需允许后台域名上传，否则运营传不了封面/音频：

- CORS 允许来源：`https://dodokid.heymf.cn`
- 允许方法：`GET`、`PUT`、`POST`、`HEAD`

---

## 3. 客户端配置（本次已改好，无需你手动动）

| 位置 | 配置 | 作用 |
|------|------|------|
| `dodokid/app.json` | `extra.apiBaseUrl = https://dodokid.heymf.cn/api/v1` | APK 默认后端地址 |
| `dodokid/src/api/client.ts` | 支持 `EXPO_PUBLIC_API_BASE_URL` / `EXPO_PUBLIC_USE_MOCK` 注入 | 本地开发走 Mock，CI 正式包自动关 Mock |
| `.github/workflows/android.yml` | 打包步骤注入 `EXPO_PUBLIC_USE_MOCK=false` | 产出的 APK 连真实后端 |
| `dodokid-admin/.env.production` | `VITE_API_BASE=/api/v1` | 后台连真实后端（并禁用内置 Mock） |

**取值优先级**（已验证）：环境变量 > `app.json` > 兜底常量。
已用哨兵值实测：设置 `EXPO_PUBLIC_API_BASE_URL` 后，该地址确实被内联进 Hermes 字节码；不设置时回落到 `app.json` 的域名。

---

## 4. 上线验收（逐条可执行）

```bash
# 1) 域名与证书
curl -sI https://dodokid.heymf.cn/ | head -1                     # 期望 HTTP/2 200
curl -s -o /dev/null -w '%{http_code}\n' http://dodokid.heymf.cn/ # 期望 301（HTTPS 跳转）

# 2) 后台可访问
curl -s https://dodokid.heymf.cn/ | grep -o '<title>[^<]*'         # 期望有标题

# 3) API 通了（应返回统一响应契约 { success, code, message, data }）
curl -s https://dodokid.heymf.cn/api/v1/version

# 4) 后台未被 Mock 污染（生产包里不应出现 msw）
curl -s https://dodokid.heymf.cn/assets/ -o /dev/null -w '%{http_code}\n'
```

App 侧逐条确认：

- [ ] APK 安装后首页能加载绘本列表（**说明 Mock 已关、真实后端通**）
- [ ] 家长注册/登录能拿到 token 并进家长中心
- [ ] 后台登录后能看到内容列表，媒体能上传
- [ ] 绘本翻页能正常读（读音音频已换成真实资源，不是种子占位）

---

## 5. 与多子域名方案的差异

`docs/deployment-plan.md` 采用 `api.<domain>` / `admin.<domain>` 双子域名分域部署。本方案改用单域名 + 路径分流：

| 项 | 多子域名方案 | 本方案 |
|----|-------------|-------|
| 儿童 App 后端地址 | `https://api.<domain>/api/v1` | `https://dodokid.heymf.cn/api/v1` |
| 后台访问入口 | `https://admin.<domain>` | `https://dodokid.heymf.cn/` |
| 证书 | 两张 | 一张（省事，且 CloudBase 免费证书也可） |
| CORS | 需为后台单独配 | 同源，无需处理 |
| 分域隔离（Spec §10） | 强隔离 | **依赖隔离**：APK 包体内不含后台代码，后台路由不在 App 包中；证书/网络层同域 |

Spec §10 原始要求「运营后台与儿童 App 分域部署，后台路由不进入儿童 App 包体」。
本方案满足后半句（**包体完全不含后台代码**），域名层面同域。如需严格分域，把 API 挂到 `api.dodokid.heymf.cn`（Nginx 一个 `server` 块 + 单独证书）即可，后台改为绝对地址 `VITE_API_BASE=https://api.dodokid.heymf.cn/api/v1`，代码无需再改。
