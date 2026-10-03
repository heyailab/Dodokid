# DodoKid Backend

Backend for DodoKid, a children's early-education app. **同一份代码支持两种部署形态**，
由环境变量 `DB_DRIVER` 切换，业务层（repositories / services / controllers）完全一致：

| `DB_DRIVER` | 形态 | 数据库 | HTTP 层 | 部署 |
|-------------|------|--------|---------|------|
| `cloudbase`（默认） | 腾讯云 CloudBase | CloudBase 文档数据库（原生） | 云函数触发器 | `tcb fn deploy api --dir .` |
| `mongo` | **自托管** | MongoDB（经 `functions/api/db/mongo.js` 适配） | `server.js`（Express，**能返回真实 4xx/5xx**） | `docker compose up -d` |

自托管形态的完整步骤见 [`docs/deploy-dodokid-heymf-cn.md`](../../docs/deploy-dodokid-heymf-cn.md)。

> 为什么能共用一套代码：全仓对数据库的依赖面被刻意控制得很小 —— 只有
> `collection().add / doc().get|set|update|remove / where().orderBy|skip|limit|get|count|update|remove`
> 与三个操作符（`inc` / `in` / `RegExp`），**没有聚合、事务、批量写**。
> 适配器就是在这条窄接口上做映射的；日后若引入聚合/事务，需同步扩展 `db/mongo.js`，
> 不要在 repositories 里直接写 Mongo 原生 API，否则会破坏两种形态同源的前提。

This package contains MVP code only. It is not deployed (no credentials were
used). Follow the deployment steps below to publish it.

## Compliance posture (Spec §10)

- **Dual role**: a verified parent account owns zero or more child profiles. A
  child profile is only created after a `consent_records` entry exists
  (`POST /api/v1/consent/record` -> `POST /api/v1/child/create` with `consentId`).
- **Data minimization**: child profiles store only nickname, age group, and
  avatar. No precise geolocation, microphone, or contact data is ever written.
- **Encryption**: all API traffic is served over HTTPS/TLS by CloudBase. Server
  secrets live in environment variables, never in source.
- **Deletion / consent revocation**: `DELETE /api/v1/child/:id` hard-deletes the
  child profile and all related `progress_records`, `milestones`, and marks
  `consent_records` as revoked.
- **Audit**: sensitive operations (register, login, child create/delete, consent,
  settings change, gate setup/verify) write to `audit_log`.
- **Rate limiting**: `sendSmsCode` and `login`/`register`/`verifyCode` are
  throttled per caller via a fixed-window limiter.

## Architecture

A single cloud function `api` handles all REST routes. Inside, the code is
strictly layered (dependency only flows downward):

```
functions/api/
  index.js              entry: builds request, dispatches, normalizes response
  router.js             zero-dep path matcher (:params)
  routes.js             route table (method + path + middlewares + handler)
  config.js             environment configuration loader
  appContext.js         CloudBase Node SDK init (db, storage, command)
  controllers/          thin: validate -> service -> data (no business logic)
  services/             business logic, ownership, compliance rules
  repositories/         data access only (CloudBase document DB)
  middlewares/          auth, gate, rateLimit, validate, errorHandler, logger
  validators/           request body validation (separate from logic)
  utils/                response, errors, jwt, crypto, phone
```

Each file is small and single-responsibility (largest is `routes.js` at ~226
lines). The unified response contract is `{ success, code, message, data }`.

## Directory layout

```
cloudbase/
  functions/api/        the cloud function (deploy this directory)
  db/
    schema.json         collection + index definitions (source of truth)
    init-collections.js create collections/indexes (manager-node or manual)
    seed-content.js     seed modules, picture books, habit tasks, media
    package.json        db tooling dependencies
  openapi.yaml          OpenAPI 3.0, 29 endpoints (frontend type generation)
  README.md             this file
  .env.example          environment variable template
```

## Environment variables

| Name | Required | Default | Purpose |
|------|----------|---------|---------|
| `TCB_ENV` | yes | `dodokid-env` | CloudBase environment id |
| `JWT_SECRET` | prod | (empty) | HMAC secret for custom JWT; fail-fast if missing in production |
| `JWT_ACCESS_TTL_SEC` | no | `900` | access token lifetime (15 min) |
| `JWT_REFRESH_TTL_SEC` | no | `604800` | refresh token lifetime (7 days) |
| `GATE_TOKEN_TTL_SEC` | no | `300` | parent gate token lifetime (5 min) |
| `SMS_CODE_TTL_SEC` | no | `300` | SMS code expiry |
| `SMS_CODE_LENGTH` | no | `6` | SMS code length |
| `SMS_RATE_LIMIT_PER_MIN` | no | `10` | SMS send limit per caller/min |
| `LOGIN_RATE_LIMIT_PER_MIN` | no | `10` | login/register/verify limit per caller/min |
| `DEFAULT_RATE_LIMIT_PER_MIN` | no | `60` | default rate limit per caller/min |
| `SMS_PROVIDER` | no | `log` | `log` (dev) or `tencent` (wire SDK) |
| `APP_VERSION` | no | `1.0.0` | returned by `/version` |
| `MIN_APP_VERSION` | no | `1.0.0` | minimum supported app version |
| `PRIVACY_POLICY_URL` | no | example url | returned by `/privacyPolicy` |
| `PRIVACY_POLICY_TEXT` | no | (empty) | optional inline policy text |
| `NODE_ENV` | no | `production` | set to `development` to expose dev SMS codes |

For the db tooling scripts, also provide `TCB_SECRET_ID` and `TCB_SECRET_KEY`.

Copy `.env.example` to `.env` (cloud function environment variables) and fill in
real values. Never commit secrets.

## Deployment (tcb CLI)

1. Install the CloudBase CLI: `npm install -g @cloudbase/cli`
2. Login: `tcb login`
3. Initialize (if not already): `tcb init`
4. Deploy the function from its directory:
   ```
   cd cloudbase/functions/api
   npm install            # installs @cloudbase/node-sdk
   tcb fn deploy api --dir .
   ```
5. Enable HTTP access for the function so `/api/v1/*` is reachable, or call it
   from the mini-program / web SDK directly.
6. Set the environment variables above in the CloudBase console (Function ->
   Configuration -> Environment variables) or via `tcb env` commands.

## Database setup

1. Create collections and indexes:
   ```
   cd cloudbase/db
   npm install
   TCB_ENV=xxx TCB_SECRET_ID=xxx TCB_SECRET_KEY=xxx node init-collections.js
   ```
   If `@cloudbase/manager-node` is unavailable or the API differs in your
   version, the script prints the exact console/CLI steps and `schema.json`
   remains the source of truth.
2. Seed content (picture books for age 4-6, habit tasks, cognitive items):
   ```
   TCB_ENV=xxx TCB_SECRET_ID=xxx TCB_SECRET_KEY=xxx node seed-content.js
   ```
   Seed media `cdnKey`/`url` values are placeholders and should be replaced with
   real uploaded assets before launch.

## Supporting infrastructure collections

Beyond the domain model in Spec §6, three support collections are used and are
listed in `schema.json`:

- `sms_codes` - issued verification codes (TTL enforced in code)
- `rate_limits` - fixed-window rate-limit counters
- `token_blacklist` - revoked JWT `jti` values (makes logout effective)

## Notes and unresolved items

- **CloudBase Node SDK version**: `@cloudbase/node-sdk` is pinned loosely
  (`^2.0.0`). Confirm the exact installed version in your environment; the
  database API (`collection().where().get()/.add()/.doc().update()/.remove()`,
  `db.command`, `db.RegExp`, `storage.getTempFileURL`) follows the documented
  interface but should be verified against your SDK version.
- **`@cloudbase/manager-node`**: used only by the optional programmatic db init.
  Validate its `createCollection`/`createIndex` signatures against your version.
- **SMS delivery**: `SMS_PROVIDER=tencent` requires wiring
  `tencentcloud-sdk-nodejs-sms` with real credentials (a stub is provided).
- **Biometric gate**: biometric unlock is performed on the device; the client
  passes a one-time attestation secret that the backend stores and verifies like
  a password. True platform biometric attestation is a client-side concern.
- **Distributed rate limiting**: the limiter uses a read-modify-write on the
  `rate_limits` collection; a small race is acceptable for MVP. For stricter
  limits, move to a Redis-backed limiter.
