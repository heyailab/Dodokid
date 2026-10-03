// appContext.js
// CloudBase Node SDK initialization (singleton).
// In a cloud function the environment is injected automatically; TCB_ENV can
// override it for local/test execution. The database command object (`command`)
// is exposed for query operators such as inc/gt/in.

const tcb = require('@cloudbase/node-sdk');
const config = require('./config');

const app = tcb.init({ env: config.env });
const db = app.database();
const storage = app.storage();
const command = db.command;

module.exports = { app, db, storage, command, _: command };
