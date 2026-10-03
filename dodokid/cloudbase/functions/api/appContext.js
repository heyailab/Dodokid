// appContext.js
// 数据与存储上下文（单例），供云函数与自托管 HTTP 层使用。
// 驱动选择的唯一实现在 db/context.js；单测通过 require.cache 替换本模块
// 注入内存假库（见 tests/fake-db.js），因此保持"同步建好并导出"的形态。
const config = require('./config');

module.exports = require('./db/context').createContext(config);
