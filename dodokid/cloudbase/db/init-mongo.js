// init-mongo.js —— 自托管 MongoDB 的集合 / 索引初始化
//
// 索引定义复用 db/schema.json（与 CloudBase 的 init-collections.js 同一份事实来源），
// 因此两种数据库的索引不会漂移。
//
// 用法：
//   MONGODB_URI=mongodb://127.0.0.1:27017 MONGODB_DB=dodokid node init-mongo.js
//   node init-mongo.js --dry-run     # 只打印将要执行的集合与索引，不连数据库
//
// 幂等：可重复执行（createIndex 同名同定义会跳过）。

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const config = require('./config');

const SCHEMA_PATH = path.join(__dirname, 'schema.json');

function loadSchema() {
  return JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
}

/** schema.json 的 collections 可能是数组或以集合名为键的对象，统一成数组 */
function collectionList(schema) {
  const raw = schema.collections || schema;
  if (Array.isArray(raw)) return raw;
  return Object.keys(raw).map((name) =>
    Object.assign({ name }, typeof raw[name] === 'object' ? raw[name] : {})
  );
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const schema = loadSchema();
  const collections = collectionList(schema);

  let indexCount = 0;
  for (const c of collections) {
    const indexes = c.indexes || [];
    indexCount += indexes.length;
    if (dryRun) {
      console.log('collection ' + c.name + '  indexes=' + indexes.length);
      for (const idx of indexes) {
        console.log(
          '    ' + idx.name + ' ' + JSON.stringify(idx.keys) + (idx.unique ? ' (unique)' : '')
        );
      }
    }
  }
  console.log(
    (dryRun ? '[dry-run] ' : '') + '集合 ' + collections.length + ' 个，索引 ' + indexCount + ' 个'
  );
  if (dryRun) return;

  const client = new MongoClient(config.mongoUri);
  await client.connect();
  try {
    const db = client.db(config.mongoDbName);
    const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((x) => x.name));

    for (const c of collections) {
      if (!existing.has(c.name)) {
        try {
          await db.createCollection(c.name);
          console.log('created collection ' + c.name);
        } catch (err) {
          // 并发执行时可能被别的实例抢先建好，不算失败
          if (err && err.codeName !== 'NamespaceExists') throw err;
        }
      }
      for (const idx of c.indexes || []) {
        await db.collection(c.name).createIndex(idx.keys, {
          name: idx.name,
          unique: Boolean(idx.unique),
        });
      }
    }
    console.log('done: ' + collections.length + ' collections, ' + indexCount + ' indexes');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('init-mongo failed:', err && err.message ? err.message : err);
  process.exit(1);
});
