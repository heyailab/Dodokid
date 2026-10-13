"""在真实 PostgreSQL 上实测三份迁移文件。

不是静态检查——真建库、真执行、真验证约束。执行顺序 0001 -> 0003 -> 0002
（种子依赖索引，必须索引先建）。
"""
import pathlib
import sys

import psycopg

DSN = "postgresql://postgres:postgres@127.0.0.1:5432/postgres"
MIG = pathlib.Path(r"C:/Users/Hey/WorkBuddy/2026-10-01-18-25-35/dodokid-go/migrations")
DB = "dodokid_ddl_test"


def run(path, dsn):
    """整文件一次 execute（psycopg3 允许多语句）。

    必须用 autocommit=True：DDL 里有 CREATE EXTENSION / CREATE TABLE 等多条语句，
    若在事务里执行，with块退出时会连同 CREATE TABLE 一起回滚——库看起来"执行成功"
    但一张表都没建出来。这个坑踩过一次。
    """
    sql = path.read_text(encoding="utf-8")
    with psycopg.connect(dsn, autocommit=True) as conn:
        conn.execute(sql)
    return len(sql)


def main():
    # 1. 重建干净的测试库
    with psycopg.connect(DSN, autocommit=True) as conn:
        conn.execute(f'DROP DATABASE IF EXISTS "{DB}" WITH (FORCE)')
        conn.execute(f'CREATE DATABASE "{DB}"')
    dsn = DSN.rsplit("/", 1)[0] + f"/{DB}"
    print(f"测试库已重建: {DB}")

    # 2. 按依赖顺序执行
    for name in ["0001_init.sql", "0003_indexes.sql", "0002_seed.sql"]:
        path = MIG / name
        try:
            size = run(path, dsn)
            print(f"  OK   {name}  ({size} 字节)")
        except Exception as exc:
            print(f"  FAIL {name}")
            print(f"       {type(exc).__name__}: {str(exc)[:400]}")
            return 1

    # 3. 验证实际建出的结构
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "select table_name from information_schema.tables "
                "where table_schema='public' order by table_name"
            )
            tables = [r[0] for r in cur.fetchall()]
            print(f"\n表数量: {len(tables)}")

            cur.execute(
                "select count(*) from information_schema.table_constraints "
                "where constraint_type='FOREIGN KEY' and table_schema='public'"
            )
            print(f"外键: {cur.fetchone()[0]}")

            cur.execute(
                "select count(*) from pg_indexes where schemaname='public'"
            )
            print(f"索引: {cur.fetchone()[0]}")

            cur.execute(
                "select count(*) from information_schema.table_constraints "
                "where constraint_type='UNIQUE' and table_schema='public'"
            )
            print(f"表级 UNIQUE: {cur.fetchone()[0]}")

            # 种子数据落库确认
            for tbl, col in [
                ("content_modules", "count"),
                ("content_items", "count"),
                ("media_assets", "count"),
                ("admin_settings", "count"),
            ]:
                cur.execute(f"select count(*) from {tbl}")
                print(f"  {tbl}: {cur.fetchone()[0]} 行")

            # 约束行为实测：每项独立事务，失败即回滚
            print("\n=== 约束行为实测 ===")

            # 先建父记录，供后续外键测试引用
            cur.execute(
                "insert into users (id, role, status) "
                "values ('test_user_01','parent','active')"
            )
            cur.execute(
                "insert into child_profiles (id, user_id, name, age_group) "
                "values ('test_child_01','test_user_01','tester','4-6')"
            )
            conn.commit()

            # 1) progress_records 唯一约束 —— 验证并发重复上报被拒
            try:
                cur.execute(
                    "insert into progress_records (id, child_id, item_id, status) "
                    "values ('testdup001','test_child_01','i1','in_progress')"
                )
                conn.commit()
                cur.execute(
                    "insert into progress_records (id, child_id, item_id, status) "
                    "values ('testdup002','test_child_01','i1','completed')"
                )
                conn.commit()
                print("  [FAIL] progress_records 唯一约束未生效：重复键插入成功")
            except psycopg.errors.UniqueViolation:
                conn.rollback()
                print("  [OK] progress_records 唯一约束生效（重复上报被拒）")

            # 2) milestones 唯一约束 —— 验证并发重复发徽章被拒
            try:
                cur.execute(
                    "insert into milestones (id, child_id, badge_key) "
                    "values ('testms001','test_child_01','first_complete')"
                )
                conn.commit()
                cur.execute(
                    "insert into milestones (id, child_id, badge_key) "
                    "values ('testms002','test_child_01','first_complete')"
                )
                conn.commit()
                print("  [FAIL] milestones 唯一约束未生效：重复徽章被接受")
            except psycopg.errors.UniqueViolation:
                conn.rollback()
                print("  [OK] milestones 唯一约束生效（重复发徽章被拒）")

            # 3) CHECK 约束 —— 非法 status 必须被拒
            try:
                cur.execute(
                    "insert into content_items (id, module_key, type, "
                    "age_group, title, status, version) "
                    "values ('testbad001','literacy','book','4-6','x','not_a_status',1)"
                )
                conn.commit()
                print("  [FAIL] CHECK 未生效：非法 status 被接受")
            except psycopg.errors.CheckViolation:
                conn.rollback()
                print("  [OK] CHECK 生效：非法 status 被拒")

            # 4) 外键约束 —— 孤儿记录必须被拒
            try:
                cur.execute(
                    "insert into child_profiles (id, user_id, name, age_group) "
                    "values ('testfk001','ghost_user_999','x','4-6')"
                )
                conn.commit()
                print("  [FAIL] 外键未生效：孤儿记录被接受")
            except psycopg.errors.ForeignKeyViolation:
                conn.rollback()
                print("  [OK] 外键生效：孤儿记录被拒")

            # 5) TIMESTAMPTZ 类型确认（项目约定 UTC）
            cur.execute(
                "select data_type from information_schema.columns "
                "where table_name='content_items' and column_name='created_at'"
            )
            row = cur.fetchone()
            print(f"  created_at 类型: {row[0] if row else '未知'}")

            # 6) citext 邮箱大小写不敏感唯一索引
            cur.execute(
                "select count(*) from pg_indexes where schemaname='public' "
                "and indexdef ilike '%lower%email%'"
            )
            found = cur.fetchone()[0]
            print(f"  email 小写唯一索引: {'存在' if found else '缺失'}")

            # 7) ON DELETE CASCADE 实测 —— 删用户连带清理
            cur.execute("delete from users where id='test_user_01'")
            conn.commit()
            cur.execute("select count(*) from child_profiles where id='test_child_01'")
            left = cur.fetchone()[0]
            print(
                "  [OK] ON DELETE CASCADE 生效：子记录已清理"
                if left == 0
                else f"  [WARN] 删除用户后仍残留 {left} 条子记录"
            )
    return 0


if __name__ == "__main__":
    sys.exit(main())