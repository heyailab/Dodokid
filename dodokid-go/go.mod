// DodoKid Go 版后端
//
// 用途：DodoKid（3-8 岁儿童教育 App）的 Go 版服务端。
// 现阶段仅承载数据库 schema，HTTP 服务与业务代码尚未落地。
//
// 迁移执行顺序（务必按此顺序，编号不连续是有意的）：
//
//	0001_init.sql     建表（18 张表 + citext 扩展）
//	0003_indexes.sql  建索引（依赖表已存在）
//	0002_seed.sql     灌种子数据（依赖表与唯一索引均已存在）
//
// 之所以把索引放在 0002 之前：种子的 INSERT 使用 ON CONFLICT，
// 冲突目标依赖唯一索引已建立，否则重复执行会报 unique violation 而非静默跳过。
//
// Go 版本选择：与本机工具链一致（go1.25），语言特性按 1.21 保守编写。
module github.com/dodokid/dodokid-go

go 1.21