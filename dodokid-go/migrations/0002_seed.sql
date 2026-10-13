-- 0002_seed.sql —— DodoKid Go 版种子数据
--
-- 本文件做什么：
--   灌入最小可运行种子：3 个内容模块 + 8 条内容项 + 10 条媒体元数据
--   + 1 条运营后台全局设置。内容与 db/seed-content.js 保持一致，
--   便于与 Node 版回退方案做数据比对。
--
-- 依赖哪个前置：
--   0001_init.sql（表结构）与 0003_indexes.sql（唯一索引）均需先执行。
--   完整顺序：0001_init.sql -> 0003_indexes.sql -> 0002_seed.sql
--
-- 幂等性：
--   全部 INSERT 带 ON CONFLICT DO NOTHING，可重复执行。
--   冲突键与各表的唯一约束严格对应（见每段注释），
--   因此重复执行不会报unique violation，也不会产生重复行。
--
-- 三处与 Node 版seed-content.js 的刻意差异（均有依据）：
--   1. content_items.cover 存标量 cdn_key 字符串。
--      Node 版 seed-content.js:32 的 cover:{cdnKey,size} 对象其实是
--      upsertMedia 的入参（seed-content.js:93-105），cover 字段本身从未
--      写入 content_items（见 seed-content.js:75-88的 doc 字面量，无 cover 键）。
--      Node 版 contentAdmin.service.js:39 与 contentAdmin.repo.js:66 都按
--      标量等值匹配 cover，故此处用TEXT 而非 JSONB。
--   2. 不灌 content_tags 集合数据。该集合在 schema.json 有定义和 2 个索引，
--      但代码零引用（无 repo、无 service、无端点），属死集合，未建表。
--   3. 不灌任何用户数据。运营账号由运维脚本人工创建（对应 Node 版
--      db/create-ops-user.js），不写进种子以避免在仓库中留存口令哈希。
--      家长账号需注册产生，故users 表种子为空。
--   4. content_items.type 归一化。Node 版 seed 写 'task'，但后台校验器
--      validators/admin/schemas.js:9 只允许 ['book','song','habit']，
--      属既有数据/契约不一致。本文件以校验器为准，详见 content_items 段注释。
--
-- id 约定：24 位小写十六进制字符串，模拟 MongoDB ObjectId 语义，
--   与前端缓存/URL 中已有的 id 形态一致。

-- ============================================================================
-- content_modules —— 3 个模块（seed-content.js:16-20）
-- 冲突键：key（表级 UNIQUE）
-- ============================================================================
INSERT INTO content_modules (id, key, name, color_token, sort_order, enabled) VALUES
    ('6f1a2b3c4d5e6f708192a301', 'picture_book', '绘本故事', '#4F9DDE', 1, true),
    ('6f1a2b3c4d5e6f708192a302', 'habit',        '好习惯养成', '#F2A65A', 2, true),
    ('6f1a2b3c4d5e6f708192a303', 'cognitive',    '认知启蒙',   '#6BBF8A', 3, true)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- content_items —— 2 绘本 + 4 好习惯 + 2 认知 = 8 条（seed-content.js:25-56）
-- 全部 status='published'、version=1、age_group='4-6'（seed-content.js:77/84/85）
-- 两本绘本 is_sample=true（seed-content.js:31/40）
-- cover / media_ref 在 Node 版 seed 中未写入内容项，故此处为 NULL
-- 冲突键：id（主键）。Node 版按 (module_key,title) 去重，此处主键已足够
--
-- 【type 字段归一化，与 Node 版有意不同】
--   seed-content.js 给好习惯与认知项写的是 type='task'，但后台校验器
--   validators/admin/schemas.js:9 的 CONTENT_TYPES 只有
--   ['book','song','habit']，不含 'task'。即Node 版这批种子数据若经后台
--   接口编辑会直接 400，属于既有的数据/契约不一致。
--   本DDL 以校验器为准（权威契约），故 habit 与 cognitive 6 条统一写
--   type='habit'，避免 CHECK 约束冲突。若产品后续需要 'task' 类型，
--   应先改 validators/admin/schemas.js:9 的 CONTENT_TYPES，再放宽此处 CHECK。
-- ============================================================================
INSERT INTO content_items
    (id, module_key, type, age_group, title, summary, cover, media_ref,
     tags, sort_order, locale, status, version, is_sample, published_at,
     author_id, reviewer_id) VALUES
    ('6f1a2b3c4d5e6f708192a401', 'picture_book', 'book',  '4-6', '小熊的夜晚routine',
     NULL, NULL, NULL, '{}', 1, 'zh-CN', 'published', 1, true,
     TIMESTAMPTZ '2026-10-01 00:00:00+00', NULL, NULL),
    ('6f1a2b3c4d5e6f708192a402', 'picture_book', 'book',  '4-6', '彩虹色的花',
     NULL, NULL, NULL, '{}', 2, 'zh-CN', 'published', 1, true,
     TIMESTAMPTZ '2026-10-01 00:00:00+00', NULL, NULL),
    ('6f1a2b3c4d5e6f708192a403', 'habit', 'habit', '4-6', '早晚刷牙',
     NULL, NULL, NULL, '{}', 1, 'zh-CN', 'published', 1, false,
     TIMESTAMPTZ '2026-10-01 00:00:00+00', NULL, NULL),
    ('6f1a2b3c4d5e6f708192a404', 'habit', 'habit', '4-6', '自己洗手',
     NULL, NULL, NULL, '{}', 2, 'zh-CN', 'published', 1, false,
     TIMESTAMPTZ '2026-10-01 00:00:00+00', NULL, NULL),
    ('6f1a2b3c4d5e6f708192a405', 'habit', 'habit', '4-6', '整理玩具',
     NULL, NULL, NULL, '{}', 3, 'zh-CN', 'published', 1, false,
     TIMESTAMPTZ '2026-10-01 00:00:00+00', NULL, NULL),
    ('6f1a2b3c4d5e6f708192a406', 'habit', 'habit', '4-6', '按时睡觉',
     NULL, NULL, NULL, '{}', 4, 'zh-CN', 'published', 1, false,
     TIMESTAMPTZ '2026-10-01 00:00:00+00', NULL, NULL),
    ('6f1a2b3c4d5e6f708192a407', 'cognitive', 'habit', '4-6', '认识颜色',
     NULL, NULL, NULL, '{}', 1, 'zh-CN', 'published', 1, false,
     TIMESTAMPTZ '2026-10-01 00:00:00+00', NULL, NULL),
    ('6f1a2b3c4d5e6f708192a408', 'cognitive', 'habit', '4-6', '数一数',
     NULL, NULL, NULL, '{}', 2, 'zh-CN', 'published', 1, false,
     TIMESTAMPTZ '2026-10-01 00:00:00+00', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- media_assets —— 10 条媒体元数据（seed-content.js:113-132 的 upsertMedia 调用）
-- 每本绘本 cover + audio 各 1 条，其余每项 cover 1 条
-- cdn_key / url 沿用 Node 版的占位值（真实素材需重新上传后回写）
-- folder 取值必须落在 admin_settings.allowed_mime_types 之外的合法枚举内：
--   绘本与音频用 books，好习惯/认知图片用 covers（见 0001 的 folder CHECK）
-- 冲突键：id（主键）
-- ============================================================================
INSERT INTO media_assets
    (id, item_id, folder, file_name, mime, size, width, height, duration_ms,
     cdn_key, url, uploaded_by) VALUES
    ('6f1a2b3c4d5e6f708192a501', '6f1a2b3c4d5e6f708192a401', 'books',
     'bear_night.png', 'image/png', 245000, NULL, NULL, NULL,
     'cloud://dodokid-env/seed/books/bear_night.png',
     'cloud://dodokid-env/seed/books/bear_night.png', NULL),
    ('6f1a2b3c4d5e6f708192a502', '6f1a2b3c4d5e6f708192a401', 'books',
     'bear_night.mp3', 'audio/mpeg', 1820000, NULL, NULL, NULL,
     'cloud://dodokid-env/seed/books/bear_night.mp3',
     'cloud://dodokid-env/seed/books/bear_night.mp3', NULL),
    ('6f1a2b3c4d5e6f708192a503', '6f1a2b3c4d5e6f708192a402', 'books',
     'rainbow_flower.png', 'image/png', 268000, NULL, NULL, NULL,
     'cloud://dodokid-env/seed/books/rainbow_flower.png',
     'cloud://dodokid-env/seed/books/rainbow_flower.png', NULL),
    ('6f1a2b3c4d5e6f708192a504', '6f1a2b3c4d5e6f708192a402', 'books',
     'rainbow_flower.mp3', 'audio/mpeg', 2010000, NULL, NULL, NULL,
     'cloud://dodokid-env/seed/books/rainbow_flower.mp3',
     'cloud://dodokid-env/seed/books/rainbow_flower.mp3', NULL),
    ('6f1a2b3c4d5e6f708192a505', '6f1a2b3c4d5e6f708192a403', 'covers',
     'brush_teeth.png', 'image/png', 156000, NULL, NULL, NULL,
     'cloud://dodokid-env/seed/habit/brush_teeth.png',
     'cloud://dodokid-env/seed/habit/brush_teeth.png', NULL),
    ('6f1a2b3c4d5e6f708192a506', '6f1a2b3c4d5e6f708192a404', 'covers',
     'wash_hands.png', 'image/png', 149000, NULL, NULL, NULL,
     'cloud://dodokid-env/seed/habit/wash_hands.png',
     'cloud://dodokid-env/seed/habit/wash_hands.png', NULL),
    ('6f1a2b3c4d5e6f708192a507', '6f1a2b3c4d5e6f708192a405', 'covers',
     'tidy_toys.png', 'image/png', 162000, NULL, NULL, NULL,
     'cloud://dodokid-env/seed/habit/tidy_toys.png',
     'cloud://dodokid-env/seed/habit/tidy_toys.png', NULL),
    ('6f1a2b3c4d5e6f708192a508', '6f1a2b3c4d5e6f708192a406', 'covers',
     'sleep.png', 'image/png', 151000, NULL, NULL, NULL,
     'cloud://dodokid-env/seed/habit/sleep.png',
     'cloud://dodokid-env/seed/habit/sleep.png', NULL),
    ('6f1a2b3c4d5e6f708192a509', '6f1a2b3c4d5e6f708192a407', 'covers',
     'colors.png', 'image/png', 170000, NULL, NULL, NULL,
     'cloud://dodokid-env/seed/cog/colors.png',
     'cloud://dodokid-env/seed/cog/colors.png', NULL),
    ('6f1a2b3c4d5e6f708192a50a', '6f1a2b3c4d5e6f708192a408', 'covers',
     'count.png', 'image/png', 173000, NULL, NULL, NULL,
     'cloud://dodokid-env/seed/cog/count.png',
     'cloud://dodokid-env/seed/cog/count.png', NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- admin_settings —— 单例全局设置（settingsAdmin.service.js:9-16 的 defaults()）
-- key 恒为 'global'（settingsAdmin.repo.js:9 SINGLETON_KEY），
-- 表级 CHECK (key='global') 保证只可能存在一行
-- allowed_mime_types 默认值取自 config.js:59-62 MEDIA_ALLOWED_MIME_TYPES
-- 冲突键：key（主键）
-- ============================================================================
INSERT INTO admin_settings
    (key, media_max_size_mb, allowed_mime_types, default_locale, pagination_limit,
     updated_by) VALUES
    ('global', 50,
     '["image/png", "image/jpeg", "image/webp", "audio/mpeg", "audio/mp4"]'::jsonb,
     'zh-CN', 20, NULL)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 刻意不灌数据的表（理由见文件头）
--   users / child_profiles / consent_records / progress_records /
--   milestones / parental_settings / preferences / feedback / audit_log /
--   rate_limits / token_blacklist / content_revisions /
--   email_verification_tokens
--   全部为空表：或由用户注册产生，或由运维流程产生，
--   或属于运行期/审计数据，不应预置。
--   content_tags：死集合，未建表。
-- ============================================================================