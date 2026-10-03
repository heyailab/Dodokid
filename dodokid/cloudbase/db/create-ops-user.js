// create-ops-user.js
// Internal bootstrap for operations accounts (ADR-005 section 5): creates a
// new editor/admin user or promotes an existing user (incl. parent) to an
// ops role, setting a bcrypt passwordHash. This flow is intentionally NOT an
// API endpoint - it runs where TCB credentials exist and its usage is manual.
//
// Usage (env or flags):
//   TCB_ENV=your-env node create-ops-user.js --phone 13800138000 \
//     --password "min-8-chars" --role admin
//
// Rules enforced:
//   - role must be editor or admin (parent is not an ops role)
//   - password >= 8 characters, stored as bcrypt hash only
//   - existing users keep their _id and get role/passwordHash updated

const tcb = require('@cloudbase/node-sdk');
const passwordUtil = require('../functions/api/utils/password');

function arg(name) {
  const idx = process.argv.indexOf('--' + name);
  return idx > 0 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const phone = arg('phone');
  const password = arg('password');
  const role = arg('role') || 'editor';
  const env = process.env.TCB_ENV || process.env.CLOUDBASE_ENV;

  if (!env) {
    console.error('TCB_ENV is required');
    process.exit(1);
  }
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    console.error('--phone must be a valid mainland phone number');
    process.exit(1);
  }
  if (!['editor', 'admin'].includes(role)) {
    console.error('--role must be editor or admin');
    process.exit(1);
  }

  let hash;
  try {
    hash = await passwordUtil.hashPassword(password);
  } catch (e) {
    console.error('--password: ' + e.message);
    process.exit(1);
  }

  const app = tcb.init({ env });
  const db = app.database();
  const users = db.collection('users');

  const existing = await users.where({ phone }).get();
  if (existing.data && existing.data.length > 0) {
    const user = existing.data[0];
    await users.doc(user._id).update({
      data: { role, passwordHash: hash, status: 'active', updatedAt: new Date().toISOString() },
    });
    console.log('updated user ' + user._id + ' -> role=' + role + ' status=active');
  } else {
    const res = await users.add({
      data: {
        phone,
        role,
        status: 'active',
        passwordHash: hash,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    console.log('created user ' + (res._id || res.id) + ' role=' + role);
  }
  console.log('done. The account can now log in at POST /api/v1/admin/auth/login.');
}

main().catch((err) => {
  console.error('failed:', err.message);
  process.exit(1);
});
