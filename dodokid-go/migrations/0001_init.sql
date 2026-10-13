-- 0001_init.sql —— DodoKid Go 版初始 schema：扩展与18 张表
--
-- 本文件做什么：建立 18 张表及其列定义、主键、内联唯一约束与内联外键。
--   19 个 MongoDB 集合映射为 18 张表：
--     - 删 sms_codes（认证已改邮箱+密码，短信码机制废弃）
--     - 不建 content_tags（代码零引用的死集合，无 repo/service/端点）
--     - 新增 email_verification_tokens（邮箱验证与忘记密码共用）
--
-- 依赖哪个前置：PostgreSQL 16+。首条语句自行创建 citext 扩展，无需手工预装。
--   0003_indexes.sql 与 0002_seed.sql 均依赖本文件的全部表。
--
--幂等性：所有 CREATE TABLE 均带 IF NOT EXISTS，可重复执行。注意：CREATE TABLE IF NOT EXISTS
--   不会给已存在的表补加约束，故本文件只保证"首次执行后再次执行不报错"，不保证结构升级；
--   结构变更请新增 0004_*.sql，不要改本文件。
--
-- 字段类型来源：schema.json 只定义索引、不定义字段（19 集合中 10 个零字段说明），
--   故所有列均由代码写入点反推（各 service 的 create/insert/upsert 字面量）。
--
-- 全局约定：
--   - 主键 id TEXT，沿用 24 位十六进制字符串语义（前端缓存与 URL 已依赖），不用 UUID
--   - 时间列一律 TIMESTAMPTZ（项目全局 UTC 约定，禁用 TIMESTAMP）
--   - 尺寸用 BIGINT，计数用 INTEGER，分数用 SMALLINT
--   - 软引用列（author_id/reviewer_id/uploaded_by/actor/updated_by）不建外键，理由见各列注释

-- === 扩展 ===
CREATE EXTENSION IF NOT EXISTS citext;

-- === 1. users —— 家长端与运营后台共用同一张表（沿用现状，非本轮引入） ===
CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         CITEXT,
    password_hash TEXT,
    phone         TEXT,
    wechat        TEXT, -- 预留字段：users.repo.js:7 findByWechat 无调用点
    role          TEXT        NOT NULL DEFAULT 'parent'
                  CHECK (role IN ('parent', 'editor', 'admin')),
    status        TEXT        NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'disabled')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 邮箱唯一索引（含大小写不敏感表达式索引）建在 0003_indexes.sql。

-- === 2. child_profiles —— 儿童档案，仅存昵称/年龄段/头像（数据最小化） ===
CREATE TABLE IF NOT EXISTS child_profiles (
    id         TEXT PRIMARY KEY,
    user_id    TEXT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name       TEXT        NOT NULL,
    age_group  TEXT        NOT NULL CHECK (age_group IN ('3-4', '4-6')),
    avatar     TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === 3. consent_records —— 监护人同意记录，可在孩子档案创建前写入（child_id 可空） ===
CREATE TABLE IF NOT EXISTS consent_records (
    id         TEXT PRIMARY KEY,
    child_id   TEXT REFERENCES child_profiles (id) ON DELETE SET NULL,
    user_id    TEXT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type       TEXT        NOT NULL,
    method     TEXT        NOT NULL,
    signed_at  TIMESTAMPTZ NOT NULL,
    status     TEXT        NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'used', 'revoked')),
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === 4. content_modules —— C 端模块宫格 ===
CREATE TABLE IF NOT EXISTS content_modules (
    id          TEXT PRIMARY KEY,
    key         TEXT        NOT NULL UNIQUE,
    name        TEXT        NOT NULL,
    color_token TEXT,
    icon_key    TEXT,
    sort_order  INTEGER     NOT NULL DEFAULT 0,
    enabled     BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === 5. content_categories —— 运营后台内容分类 ===
CREATE TABLE IF NOT EXISTS content_categories (
    id         TEXT PRIMARY KEY,
    key        TEXT        NOT NULL UNIQUE,
    name       TEXT        NOT NULL,
    sort_order INTEGER     NOT NULL DEFAULT 0,
    enabled    BOOLEAN     NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === 6. content_items —— 内容主表 ===
CREATE TABLE IF NOT EXISTS content_items (
    id           TEXT PRIMARY KEY,
    module_key   TEXT        NOT NULL,
    type         TEXT        NOT NULL
                 CHECK (type IN ('book', 'song', 'habit')),
    age_group    TEXT        NOT NULL CHECK (age_group IN ('3-4', '4-6')),
    title        TEXT        NOT NULL,
    summary      TEXT,
    -- cover 存 media_assets.cdn_key 的标量字符串。
    -- module_key 与 cover 均不加外键：catalogAdmin.repo.js:16 removeModule
    -- 无级联守卫，外键会在删除模块时报错；cover 需按 cdn_key 反查引用
    -- （contentAdmin.repo.js:66），标量列可直接等值匹配。
    cover        TEXT,
    media_ref    TEXT,
    tags         TEXT[]      NOT NULL DEFAULT '{}',
    sort_order   INTEGER     NOT NULL DEFAULT 0,
    locale       TEXT        NOT NULL DEFAULT 'zh-CN',
    status       TEXT        NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'in_review', 'published', 'archived')),
    version      INTEGER     NOT NULL DEFAULT 1,
    is_sample    BOOLEAN     NOT NULL DEFAULT false,
    published_at TIMESTAMPTZ,
    -- author_id / reviewer_id 为软引用，不建外键：产品无删除用户端点，
    -- 且合规擦除要求审计记录能与用户解耦。
    author_id    TEXT,
    reviewer_id  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- tags 当前无任何按成员查询（仅写入与整条读回），故不建 GIN；
-- 若将来后台增加 tag 筛选，补 CREATE INDEX ... USING GIN (tags)。

-- === 7. progress_records —— 学习进度。UNIQUE 修并发重复写入 ===
CREATE TABLE IF NOT EXISTS progress_records (
    id         TEXT PRIMARY KEY,
    child_id   TEXT        NOT NULL REFERENCES child_profiles (id) ON DELETE CASCADE,
    item_id    TEXT        NOT NULL,
    status     TEXT        NOT NULL DEFAULT 'not_started'
               CHECK (status IN ('not_started', 'in_progress', 'completed')),
    score      SMALLINT    CHECK (score BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- 原实现 progress.repo.js:6-15 为"先查后写"的应用层竞态，
    -- 并发下可插入重复(child_id,item_id)。此处用唯一约束兜底。
    CONSTRAINT uq_progress_records_child_item UNIQUE (child_id, item_id)
);
-- 不建 idx_progress_records_child_id：uq 的首列已覆盖 child_id 等值查询。

-- === 8. milestones —— 徽章。UNIQUE 修并发重复发放 ===
CREATE TABLE IF NOT EXISTS milestones (
    id         TEXT PRIMARY KEY,
    child_id   TEXT        NOT NULL REFERENCES child_profiles (id) ON DELETE CASCADE,
    badge_key  TEXT        NOT NULL,
    earned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    streak     INTEGER     NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- 原实现 progress.service.js:36-44 为findOne-then-create 的 check-then-act，
    -- 并发下会重复发徽章。此处用唯一约束兜底。
    CONSTRAINT uq_milestones_child_badge UNIQUE (child_id, badge_key)
);
-- 不建 idx_milestones_child_id：uq 首列已覆盖。

-- === 9. parental_settings —— 家长设置（含家长锁），每用户一行 ===
CREATE TABLE IF NOT EXISTS parental_settings (
    id               TEXT PRIMARY KEY,
    user_id          TEXT        NOT NULL UNIQUE
                     REFERENCES users (id) ON DELETE CASCADE,
    daily_limit_min  INTEGER     NOT NULL DEFAULT 0
                     CHECK (daily_limit_min BETWEEN 0 AND 1440),
    mode             TEXT        NOT NULL DEFAULT 'balanced'
                     CHECK (mode IN ('strict', 'balanced', 'free')),
    gate_type        TEXT        CHECK (gate_type IN ('password', 'biometric')),
    gate_salt        TEXT,
    gate_hash        TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === 10. preferences —— 语言/主题偏好，每用户一行 ===
CREATE TABLE IF NOT EXISTS preferences (
    id         TEXT PRIMARY KEY,
    user_id    TEXT        NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    lang       TEXT        NOT NULL DEFAULT 'zh-CN'
               CHECK (lang IN ('zh-CN', 'en', 'zh-TW')),
    theme      TEXT        NOT NULL DEFAULT 'system'
               CHECK (theme IN ('light', 'dark', 'system')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === 11. media_assets —— 媒体元数据（文件不入库，只存元数据） ===
CREATE TABLE IF NOT EXISTS media_assets (
    id           TEXT PRIMARY KEY,
    item_id      TEXT REFERENCES content_items (id) ON DELETE SET NULL,
    folder       TEXT        NOT NULL
                 CHECK (folder IN ('books', 'songs', 'covers', 'icons', 'misc')),
    file_name    TEXT        NOT NULL,
    mime         TEXT        NOT NULL,
    size         BIGINT      NOT NULL,
    width        INTEGER,
    height       INTEGER,
    duration_ms  INTEGER,
    cdn_key      TEXT        NOT NULL,
    url          TEXT        NOT NULL,
    uploaded_by  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === 12. feedback —— 用户反馈。只写入不查询（feedback.repo.js 仅 create） ===
CREATE TABLE IF NOT EXISTS feedback (
    id         TEXT PRIMARY KEY,
    user_id    TEXT,
    text       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === 13. audit_log —— 审计日志。before/after/detail 为异构快照，用 JSONB ===
CREATE TABLE IF NOT EXISTS audit_log (
    id           TEXT PRIMARY KEY,
    actor        TEXT,
    actor_role   TEXT,
    action       TEXT        NOT NULL,
    target_type  TEXT,
    target_id    TEXT,
    before_state JSONB,
    after_state  JSONB,
    -- detail：C 端 audit.repo.js:10 写入的第三种快照字段，schema.json 未记载
    detail       JSONB,
    ip           TEXT,
    ts           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === 14. rate_limits —— 固定窗口限流计数器（id 形如 "<scope>:<windowStart>"） ===
CREATE TABLE IF NOT EXISTS rate_limits (
    id           TEXT PRIMARY KEY,
    key          TEXT        NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    count        INTEGER     NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 运维建议：按 updated_at 定期清理过期窗口，或后续迁 Redis。

-- === 15. token_blacklist —— JWT 吊销名单 ===
CREATE TABLE IF NOT EXISTS token_blacklist (
    id         TEXT PRIMARY KEY,
    jti        TEXT        NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 运维建议：按 expires_at 定期清理过期条目。

-- === 16. admin_settings —— 运营后台全局设置，单例（key 恒为 'global'） ===
CREATE TABLE IF NOT EXISTS admin_settings (
    key                 TEXT PRIMARY KEY CHECK (key = 'global'),
    media_max_size_mb   INTEGER     NOT NULL DEFAULT 50
                        CHECK (media_max_size_mb BETWEEN 1 AND 200),
    allowed_mime_types  JSONB       NOT NULL DEFAULT '[]'::jsonb,
    default_locale      TEXT        NOT NULL DEFAULT 'zh-CN',
    pagination_limit    INTEGER     NOT NULL DEFAULT 20
                        CHECK (pagination_limit BETWEEN 10 AND 100),
    updated_by          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === 17. content_revisions —— 内容版本快照，append-only，snapshot 用 JSONB ===
CREATE TABLE IF NOT EXISTS content_revisions (
    id         TEXT PRIMARY KEY,
    content_id TEXT        NOT NULL REFERENCES content_items (id) ON DELETE CASCADE,
    version    INTEGER     NOT NULL,
    snapshot   JSONB       NOT NULL,
    action     TEXT        NOT NULL
               CHECK (action IN ('submit', 'approve', 'publish', 'reject', 'restore')),
    note       TEXT,
    author_id  TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_content_revisions_content_version UNIQUE (content_id, version)
);
-- 不建 idx_content_revisions_content_id：uq 首列已覆盖。

-- ============================================================================
-- 18. email_verification_tokens —— 邮箱验证 + 忘记密码（共用一张表）
--token_hash 存哈希不存明文；consumed_at 非空表示已使用（防重放）
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id          TEXT PRIMARY KEY,
    user_id     TEXT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash  TEXT        NOT NULL UNIQUE,
    purpose     TEXT        NOT NULL
                CHECK (purpose IN ('verify_email', 'reset_password')),
    expires_at  TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 运维建议：按 expires_at 定期清理过期令牌。

-- === 索引统一在 0003_indexes.sql 中创建（保持本文件在 300 行内可读） ===