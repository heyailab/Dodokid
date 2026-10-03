// mongo.js
// 自托管数据库适配器：用 MongoDB 驱动实现 CloudBase 文档数据库的那一小撮 API，
// 使 repositories/ 与 services/ 无需任何改动（依赖方向仍严格向下）。
//
// 为什么可行：全仓对数据库的依赖面极小，清点如下：
//   collection().add({data})
//   collection().doc(id).get() / .set({data}) / .update({data}) / .remove()
//   collection().where(cond).orderBy(f,d) / .skip(n) / .limit(n)
//                     .get() / .count() / .update({data}) / .remove()
//   操作符：command.inc(n)（限流计数）、_.in(arr)（按角色/年龄段筛选）、db.RegExp(...)
//   条件：$gte / $lte 范围（审计时间窗）
// 不涉及聚合、事务、批量写，因此无需实现这些能力。
//
// 语义对齐要点：
//   - `_id` 一律用 24 位十六进制字符串（不用 ObjectId 类型），保证 JSON 序列化后
//     与 CloudBase 一致，URL 路径参数与前端缓存里的 id 不会因驱动而变形；
//   - CloudBase 的 get() 返回 { data: [...] }、count() 返回 { total }，这里保持一致，
//     上层无需改动；
//   - where 条件里的操作符对象（inc/in/regex）由 toMongoFilter 翻译成 Mongo 查询算子。

const { MongoClient, ObjectId } = require('mongodb');

const OP_INC = '__inc';
const OP_IN = '__in';
const OP_REGEX = '__regex';

/** 与 CloudBase 一致的操作符工厂（appContext 导出为 command 与 _）。 */
function createCommand() {
  return {
    inc(n) {
      return { [OP_INC]: n };
    },
    in(values) {
      return { [OP_IN]: values };
    },
  };
}

/** CloudBase 的 db.RegExp({ regexp, options })。 */
function createRegExp(options) {
  const source = options && options.regexp !== undefined ? options.regexp : '';
  return { [OP_REGEX]: String(source), options: (options && options.options) || '' };
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** 把 CloudBase 风格条件翻译为 MongoDB filter。 */
function toMongoFilter(cond) {
  if (!isPlainObject(cond)) return {};
  const out = {};
  for (const key of Object.keys(cond)) {
    const value = cond[key];
    if (isPlainObject(value)) {
      if (Array.isArray(value[OP_IN])) {
        out[key] = { $in: value[OP_IN] };
        continue;
      }
      if (value[OP_REGEX] !== undefined) {
        out[key] = { $regex: value[OP_REGEX], $options: value.options || '' };
        continue;
      }
      if (value.$gte !== undefined || value.$lte !== undefined) {
        const range = {};
        if (value.$gte !== undefined) range.$gte = value.$gte;
        if (value.$lte !== undefined) range.$lte = value.$lte;
        out[key] = range;
        continue;
      }
    }
    out[key] = value;
  }
  return out;
}

/** 把 { data: {...} } 形式的更新负载翻译为 MongoDB update（拆出 $set 与 $inc）。 */
function toMongoUpdate(data) {
  const set = {};
  const inc = {};
  const source = isPlainObject(data) ? data : {};
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (isPlainObject(value) && value[OP_INC] !== undefined) inc[key] = value[OP_INC];
    else set[key] = value;
  }
  const update = {};
  if (Object.keys(set).length > 0) update.$set = set;
  if (Object.keys(inc).length > 0) update.$inc = inc;
  return update;
}

function newId() {
  return new ObjectId().toHexString();
}

function createQuery(mongoCol, filter) {
  const state = { filter: filter || {}, sort: null, skip: 0, limit: 0 };
  const self = {
    orderBy(field, dir) {
      state.sort = { [field]: dir === 'desc' ? -1 : 1 };
      return self;
    },
    skip(n) {
      state.skip = n;
      return self;
    },
    limit(n) {
      state.limit = n;
      return self;
    },
    async get() {
      let cursor = mongoCol.find(state.filter);
      if (state.sort) cursor = cursor.sort(state.sort);
      if (state.skip > 0) cursor = cursor.skip(state.skip);
      if (state.limit > 0) cursor = cursor.limit(state.limit);
      return { data: await cursor.toArray() };
    },
    async count() {
      return { total: await mongoCol.countDocuments(state.filter) };
    },
    async update(payload) {
      await mongoCol.updateMany(state.filter, toMongoUpdate(payload && payload.data));
      return {};
    },
    async remove() {
      await mongoCol.deleteMany(state.filter);
      return {};
    },
  };
  return self;
}

function createCollection(mongoCol) {
  return {
    async add(payload) {
      const doc = Object.assign({}, payload && payload.data);
      if (!doc._id) doc._id = newId();
      await mongoCol.insertOne(doc);
      return { _id: doc._id };
    },
    doc(id) {
      return {
        async get() {
          const found = await mongoCol.findOne({ _id: id });
          return { data: found ? [found] : [] };
        },
        async set(payload) {
          // CloudBase 的 set 是"整文档写入"，Mongo 用 replaceOne + upsert 对齐
          const next = Object.assign({}, payload && payload.data);
          next._id = id;
          await mongoCol.replaceOne({ _id: id }, next, { upsert: true });
          return {};
        },
        async update(payload) {
          await mongoCol.updateOne({ _id: id }, toMongoUpdate(payload && payload.data));
          return {};
        },
        async remove() {
          await mongoCol.deleteOne({ _id: id });
          return {};
        },
      };
    },
    where(cond) {
      return createQuery(mongoCol, toMongoFilter(cond));
    },
  };
}

/**
 * 建立自托管上下文。返回结构与 CloudBase 分支完全一致，
 * 因此 appContext 的下游（repositories/services/controllers）无需区分部署形态。
 *
 * 连接是惰性的：MongoDB 驱动在首次操作时自动建连，无需在此 await connect()，
 * 所以 collection() 可以保持同步签名（与 CloudBase 一致）。
 */
function createMongoContext(config) {
  const client = new MongoClient(config.mongoUri, {
    ignoreUndefined: true,
    serverSelectionTimeoutMS: Number(config.mongoServerSelectionTimeoutMs || 8000),
  });
  const database = client.db(config.mongoDbName);
  const command = createCommand();

  const api = {
    command,
    RegExp: createRegExp,
    collection(name) {
      return createCollection(database.collection(name));
    },
    /** 就绪探针：确认能连上 MongoDB（容器编排的 readiness 用）。 */
    async ping() {
      await database.command({ ping: 1 });
      return true;
    },
    async close() {
      await client.close();
    },
  };

  return { app: api, db: api, command, _: command };
}

module.exports = {
  createMongoContext,
  createCommand,
  createRegExp,
  toMongoFilter,
  toMongoUpdate,
  newId,
};
