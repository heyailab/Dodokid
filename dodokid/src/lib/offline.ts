/**
 * 离线缓存层（AC-07）：将已下载内容的完整 ContentItem（含 pages 文本）落盘到
 * 本地 SQLite，使其在无网络时仍可阅读；同时把封面与音频下载到 FileSystem 目录，
 * 供离线朗读。Web 端无原生存储，全部能力降级为不支持（仅返回 null），不影响预览。
 */
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import type { ContentItem } from '../api/types';

const DB_NAME = 'dodokid_offline';
const TABLE = 'downloads';
let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase | null> {
  if (Platform.OS === 'web') return null;
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS ${TABLE} (` +
        'contentId TEXT PRIMARY KEY, version TEXT, item TEXT, ' +
        'localCover TEXT, localMedia TEXT, updatedAt INTEGER)',
    );
  }
  return db;
}

/** 缓存内容元数据 + 内联 pages（离线可读的核心）。 */
export async function cacheContent(item: ContentItem): Promise<void> {
  const conn = await getDb();
  if (!conn) return;
  await conn.runAsync(
    `INSERT OR REPLACE INTO ${TABLE} (contentId, version, item, updatedAt) VALUES (?, ?, ?, ?)`,
    [item.id, item.version, JSON.stringify(item), Date.now()],
  );
}

/** 离线读取：返回本地缓存的 ContentItem（含 pages），无则返回 null。 */
export async function getCachedContent(id: string): Promise<ContentItem | null> {
  const conn = await getDb();
  if (!conn) return null;
  const row = await conn.getFirstAsync<{ item: string }>(
    `SELECT item FROM ${TABLE} WHERE contentId = ?`,
    [id],
  );
  return row ? (JSON.parse(row.item) as ContentItem) : null;
}

export async function isCached(id: string): Promise<boolean> {
  const conn = await getDb();
  if (!conn) return false;
  const row = await conn.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM ${TABLE} WHERE contentId = ?`,
    [id],
  );
  return !!row && row.c > 0;
}

/** 下载封面与音频到本地；失败不阻塞（文本页已可离线读）。 */
export async function downloadFiles(item: ContentItem): Promise<{ localCover?: string; localMedia?: string }> {
  if (Platform.OS === 'web') return {};
  const dir = `${FileSystem.documentDirectory}downloads/${item.id}/`;
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    /* 目录已存在 */
  }
  const result: { localCover?: string; localMedia?: string } = {};
  const targets: [keyof typeof result, string][] = [];
  if (item.coverUrl) targets.push(['localCover', item.coverUrl]);
  const media = item.pages.find((p) => p.audioUrl)?.audioUrl;
  if (media) targets.push(['localMedia', media]);
  for (const [key, url] of targets) {
    try {
      const name = url.split('/').pop() || key;
      const out = await FileSystem.downloadAsync(url, dir + name);
      result[key] = out.uri;
    } catch {
      /* 单个资源失败忽略 */
    }
  }
  const conn = await getDb();
  if (conn && (result.localCover || result.localMedia)) {
    await conn.runAsync(
      `UPDATE ${TABLE} SET localCover = ?, localMedia = ? WHERE contentId = ?`,
      [result.localCover ?? null, result.localMedia ?? null, item.id],
    );
  }
  return result;
}

/** 联网时静默比对版本，不一致标注可更新（不自动删除已下载内容）。 */
export async function needsUpdate(id: string, version: string): Promise<boolean> {
  const conn = await getDb();
  if (!conn) return false;
  const row = await conn.getFirstAsync<{ version: string }>(
    `SELECT version FROM ${TABLE} WHERE contentId = ?`,
    [id],
  );
  return !!row && row.version !== version;
}

export async function removeCache(id: string): Promise<void> {
  const conn = await getDb();
  if (!conn) return;
  if (Platform.OS !== 'web') {
    const dir = `${FileSystem.documentDirectory}downloads/${id}/`;
    try {
      await FileSystem.deleteAsync(dir, { idempotent: true });
    } catch {
      /* 忽略 */
    }
  }
  await conn.runAsync(`DELETE FROM ${TABLE} WHERE contentId = ?`, [id]);
}
