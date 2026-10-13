-- 0003_indexes.sql —— DodoKid Go 版全部二级索引
--
-- 本文件做什么：
--   创建 0001_init.sql 中18 张表的二级索引。索引名一律加表名前缀
--   （schema.json 中 idx_childId 等名字跨集合重名，直接沿用会冲突）。
--
-- 依赖哪个前置：
--   0001_init.sql 必须先执行（表已存在）。
--   执行顺序：0001_init.sql -> 0003_indexes.sql -> 0002_seed.sql
--
-- 幂等性：
--   全部 CREATE INDEX 带 IF NOT EXISTS，可重复执行。
--
-- 索引来源：db/schema.json 的 30 条定义，按表改名后取 27 条
--   （排除 sms_codes.idx_phone 随表删除、content_tags 的 2 条随死集合不迁，
--     以及下列 3 条被唯一约束首列覆盖而省略的单列索引）。
--
-- 刻意不建的索引及理由：
--   - tags GIN：全库无按 tag 成员查询（contentAdmin.repo.js:14-22 过滤条件
--     只有 moduleKey/type/ageGroup/status/q），无需 GIN。
--   - idx_progress_records_child_id / idx_milestones_child_id /
--     idx_content_revisions_content_id：三者分别被 uq_progress_records_child_item、
--     uq_milestones_child_badge、uq_content_revisions_content_version 的首列覆盖，
--     单列索引冗余。

-- ============================================================================
-- users
-- ============================================================================
-- 邮箱唯一且大小写不敏感。CITEXT 本身已大小写无关，此表达式索引为显式冗余保险。
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
    ON users (lower(email)) WHERE email IS NOT NULL;
-- phone 从 UNIQUE 降级为普通索引：兼容运营后台账号与客服联系，可为空可重复。
CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users (role);

-- ============================================================================
-- child_profiles / consent_records
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_child_profiles_user_id ON child_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_consent_records_child_id ON consent_records (child_id);
CREATE INDEX IF NOT EXISTS idx_consent_records_user_id  ON consent_records (user_id);

-- ============================================================================
-- content_modules / content_categories
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_content_modules_order ON content_modules (sort_order);

-- ============================================================================
-- content_items —— 对应 schema.json 的 5 条索引
--   idx_module_age / idx_module_age_status / idx_status_sample_age /
--   idx_status(status,updatedAt desc) / idx_authorId
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_content_items_module_age
    ON content_items (module_key, age_group);
CREATE INDEX IF NOT EXISTS idx_content_items_module_age_status
    ON content_items (module_key, age_group, status);
CREATE INDEX IF NOT EXISTS idx_content_items_status_sample_age
    ON content_items (status, is_sample, age_group);
CREATE INDEX IF NOT EXISTS idx_content_items_status_updated_at
    ON content_items (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_items_author_id ON content_items (author_id);

-- ============================================================================
-- media_assets
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_media_assets_item_id     ON media_assets (item_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_folder      ON media_assets (folder);
CREATE INDEX IF NOT EXISTS idx_media_assets_uploaded_by ON media_assets (uploaded_by);

-- ============================================================================
-- feedback
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback (user_id);

-- ============================================================================
-- audit_log —— 对应 schema.json 的 idx_actor / idx_target / idx_ts
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log (actor);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON audit_log (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON audit_log (ts DESC);

-- ============================================================================
-- rate_limits
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits (window_start);

-- ============================================================================
-- token_blacklist
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at
    ON token_blacklist (expires_at);

-- ============================================================================
-- email_verification_tokens
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id
    ON email_verification_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at
    ON email_verification_tokens (expires_at);

-- ============================================================================
-- 汇总：schema.json 30 条 -> 本文件 22 条 + 0001 内联 UNIQUE 5 条 = 27 条
--   内联 UNIQUE（0001_init.sql）：users.email 之外的
--     content_modules.key、content_categories.key、parental_settings.user_id、
--     preferences.user_id、token_blacklist.jti、
--     progress_records(child_id,item_id)、milestones(child_id,badge_key)、
--     content_revisions(content_id,version)、email_verification_tokens.token_hash
--
--   注：users.email 的唯一索引在本文件（因 lower(email) 是表达式，
--   不适合写成表级 UNIQUE 约束）。
-- ============================================================================