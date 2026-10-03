// init-collections.js
// Creates the CloudBase collections and indexes declared in schema.json.
//
// Two paths are supported:
//   1. Programmatic (preferred): requires @cloudbase/manager-node and the
//      credentials below. The management SDK API may differ slightly by version;
//      every call is wrapped so a failing one is logged and skipped.
//   2. Manual fallback: if the programmatic path is unavailable, this script
//      prints the exact `tcb` CLI commands and console steps to apply the schema.
//
// Required env: TCB_ENV, TCB_SECRET_ID, TCB_SECRET_KEY

const fs = require('fs');
const path = require('path');

const SCHEMA = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8')
);

function requireManager() {
  const env = process.env;
  if (!env.TCB_ENV || !env.TCB_SECRET_ID || !env.TCB_SECRET_KEY) {
    return null;
  }
  try {
    // @cloudbase/manager-node is the official management SDK. Validate the
    // exact method names against your installed version.
    const { init } = require('@cloudbase/manager-node');
    return init({
      secretId: env.TCB_SECRET_ID,
      secretKey: env.TCB_SECRET_KEY,
      envId: env.TCB_ENV,
    });
  } catch (e) {
    console.warn('manager-node unavailable:', e.message);
    return null;
  }
}

async function applyProgrammatic(manager) {
  const db = manager.database;
  for (const coll of SCHEMA.collections) {
    try {
      await db.createCollection(coll.name);
      console.log('created collection:', coll.name);
    } catch (e) {
      console.warn('collection', coll.name, 'skip:', e.message);
    }
    for (const idx of coll.indexes || []) {
      try {
        await db.createIndex({
          collectionName: coll.name,
          name: idx.name,
          keys: idx.keys,
          unique: !!idx.unique,
        });
        console.log('created index:', coll.name, idx.name);
      } catch (e) {
        console.warn('index', coll.name, idx.name, 'skip:', e.message);
      }
    }
  }
}

function printManualInstructions() {
  console.log('\n=== Manual fallback (CloudBase console or tcb CLI) ===');
  console.log('1. Open the CloudBase console > Database, or use the tcb CLI.');
  console.log('2. Create each collection, then add the indexes below.\n');
  for (const coll of SCHEMA.collections) {
    console.log('Collection: ' + coll.name);
    for (const idx of coll.indexes || []) {
      const keys = Object.entries(idx.keys)
        .map(([k, v]) => k + ':' + v)
        .join(', ');
      console.log('  - index ' + idx.name + ' (' + (idx.unique ? 'unique' : 'non-unique') + '): ' + keys);
    }
  }
  console.log('\nReference schema file: db/schema.json');
}

async function main() {
  const manager = requireManager();
  if (manager) {
    console.log('Applying schema programmatically via @cloudbase/manager-node ...');
    await applyProgrammatic(manager);
  } else {
    console.log('Missing TCB_SECRET_ID / TCB_SECRET_KEY or manager-node not installed.');
    printManualInstructions();
  }
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { SCHEMA };
