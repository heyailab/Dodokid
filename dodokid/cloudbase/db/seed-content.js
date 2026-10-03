// seed-content.js
// Seeds the content catalog: modules, picture-book items (age 4-6), and a habit
// task library, plus their media asset references. Idempotent by key/title.
//
// Run from a CloudBase cloud function context, or locally with:
//   TCB_ENV=xxx TCB_SECRET_ID=xxx TCB_SECRET_KEY=xxx node seed-content.js
// Placeholder cdnKey/url values should be replaced with real uploaded assets.

const tcb = require('@cloudbase/node-sdk');

const app = tcb.init({
  env: process.env.TCB_ENV,
  secretId: process.env.TCB_SECRET_ID,
  secretKey: process.env.TCB_SECRET_KEY,
});
const db = app.database();

const MODULES = [
  { key: 'picture_book', name: '绘本故事', colorToken: '#4F9DDE' },
  { key: 'habit', name: '好习惯养成', colorToken: '#F2A65A' },
  { key: 'cognitive', name: '认知启蒙', colorToken: '#6BBF8A' },
];

// ageGroup is 4-6 for all seed items (Spec requires >= 2 picture books for 3-6).
// isSample: v1.2.1 - the two picture books are published sample chapters so the
// child app home screen can load them via GET /content/samples (P2-2 fix).
const PICTURE_BOOKS = [
  {
    title: '小熊的夜晚 routine',
    type: 'book',
    mediaRef: '',
    order: 1,
    isSample: true,
    cover: { cdnKey: 'cloud://dodokid-env/seed/books/bear_night.png', size: 245000 },
    audio: { cdnKey: 'cloud://dodokid-env/seed/books/bear_night.mp3', size: 1820000 },
  },
  {
    title: '彩虹色的花',
    type: 'book',
    mediaRef: '',
    order: 2,
    isSample: true,
    cover: { cdnKey: 'cloud://dodokid-env/seed/books/rainbow_flower.png', size: 268000 },
    audio: { cdnKey: 'cloud://dodokid-env/seed/books/rainbow_flower.mp3', size: 2010000 },
  },
];

const HABIT_TASKS = [
  { title: '早晚刷牙', type: 'task', mediaRef: '', order: 1, cover: { cdnKey: 'cloud://dodokid-env/seed/habit/brush_teeth.png', size: 156000 } },
  { title: '自己洗手', type: 'task', mediaRef: '', order: 2, cover: { cdnKey: 'cloud://dodokid-env/seed/habit/wash_hands.png', size: 149000 } },
  { title: '整理玩具', type: 'task', mediaRef: '', order: 3, cover: { cdnKey: 'cloud://dodokid-env/seed/habit/tidy_toys.png', size: 162000 } },
  { title: '按时睡觉', type: 'task', mediaRef: '', order: 4, cover: { cdnKey: 'cloud://dodokid-env/seed/habit/sleep.png', size: 151000 } },
];

const COGNITIVE_ITEMS = [
  { title: '认识颜色', type: 'task', mediaRef: '', order: 1, cover: { cdnKey: 'cloud://dodokid-env/seed/cog/colors.png', size: 170000 } },
  { title: '数一数', type: 'task', mediaRef: '', order: 2, cover: { cdnKey: 'cloud://dodokid-env/seed/cog/count.png', size: 173000 } },
];

async function upsertModule(m) {
  const existing = await db.collection('content_modules').where({ key: m.key }).get();
  if (existing.data && existing.data.length > 0) {
    return existing.data[0];
  }
  const res = await db.collection('content_modules').add({ data: m });
  return Object.assign({ _id: res._id }, m);
}

async function upsertItem(moduleKey, item) {
  const existing = await db
    .collection('content_items')
    .where({ moduleKey, title: item.title })
    .get();
  if (existing.data && existing.data.length > 0) {
    return existing.data[0];
  }
  const doc = {
    moduleKey,
    ageGroup: '4-6',
    title: item.title,
    type: item.type,
    mediaRef: item.mediaRef,
    order: item.order,
    // Seeded items are live catalog entries; the two sample books carry
    // isSample=true (v1.2.1) so GET /content/samples returns them.
    status: 'published',
    version: 1,
    isSample: item.isSample === true,
    createdAt: new Date().toISOString(),
  };
  const res = await db.collection('content_items').add({ data: doc });
  return Object.assign({ _id: res._id }, doc);
}

async function upsertMedia(itemId, asset) {
  const existing = await db.collection('media_assets').where({ itemId, cdnKey: asset.cdnKey }).get();
  if (existing.data && existing.data.length > 0) return existing.data[0];
  const doc = {
    itemId,
    url: asset.cdnKey,
    cdnKey: asset.cdnKey,
    size: asset.size,
    createdAt: new Date().toISOString(),
  };
  const res = await db.collection('media_assets').add({ data: doc });
  return Object.assign({ _id: res._id }, doc);
}

async function main() {
  for (const m of MODULES) {
    const mod = await upsertModule(m);
    console.log('module:', mod.key, mod._id);
  }

  const bookModule = MODULES.find((m) => m.key === 'picture_book');
  for (const b of PICTURE_BOOKS) {
    const item = await upsertItem(bookModule.key, b);
    await upsertMedia(item._id, b.cover);
    if (b.audio) await upsertMedia(item._id, b.audio);
    console.log('book:', item.title, item._id);
  }

  const habitModule = MODULES.find((m) => m.key === 'habit');
  for (const t of HABIT_TASKS) {
    const item = await upsertItem(habitModule.key, t);
    await upsertMedia(item._id, t.cover);
    console.log('habit:', item.title, item._id);
  }

  const cogModule = MODULES.find((m) => m.key === 'cognitive');
  for (const c of COGNITIVE_ITEMS) {
    const item = await upsertItem(cogModule.key, c);
    await upsertMedia(item._id, c.cover);
    console.log('cognitive:', item.title, item._id);
  }

  console.log('Seed complete.');
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
