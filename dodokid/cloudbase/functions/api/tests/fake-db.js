// fake-db.js
// In-memory CloudBase document-database mock shared by the smoke tests.
// Supports the subset used by repositories: collection().where() chains
// (get/count/update/remove with orderBy/skip/limit), doc().get/update/remove,
// add(), RegExp passthrough and the `in` command operator.

function createFakeDb(seed) {
  const store = JSON.parse(JSON.stringify(seed));
  let counter = 100;
  const genId = () => 'gen_' + counter++;
  const isRegexLike = (v) => v && typeof v === 'object' && typeof v.source === 'string';

  function matches(doc, cond) {
    return Object.keys(cond).every((k) => {
      const v = cond[k];
      if (isRegexLike(v)) return new RegExp(v.source, v.options).test(String(doc[k]));
      if (v && typeof v === 'object' && v.__inc !== undefined) return true;
      if (v && typeof v === 'object' && Array.isArray(v.__in)) return v.__in.includes(doc[k]);
      if (v && typeof v === 'object' && !Array.isArray(v) && (v.$gte !== undefined || v.$lte !== undefined)) {
        const s = String(doc[k]);
        if (v.$gte !== undefined && !(s >= v.$gte)) return false;
        if (v.$lte !== undefined && !(s <= v.$lte)) return false;
        return true;
      }
      return doc[k] === v;
    });
  }

  function collection(name) {
    const docs = () => store[name] || (store[name] = []);
    const query = (cond) => {
      let sortField = null;
      let sortDir = 'asc';
      let skipN = 0;
      let limitN = 0;
      const self = {
        orderBy(f, d) { sortField = f; sortDir = d || 'asc'; return self; },
        skip(n) { skipN = n; return self; },
        limit(n) { limitN = n; return self; },
        async get() {
          let list = docs().filter((d) => matches(d, cond));
          if (sortField) {
            list = list.slice().sort((a, b) => {
              const x = a[sortField]; const y = b[sortField];
              const cmp = x < y ? -1 : x > y ? 1 : 0;
              return sortDir === 'desc' ? -cmp : cmp;
            });
          }
          if (skipN) list = list.slice(skipN);
          if (limitN) list = list.slice(0, limitN);
          return { data: JSON.parse(JSON.stringify(list)) };
        },
        async count() { return { total: docs().filter((d) => matches(d, cond)).length }; },
        async update({ data }) {
          let n = 0;
          docs().forEach((d) => {
            if (matches(d, cond)) {
              Object.keys(data).forEach((f) => {
                const v = data[f];
                if (v && typeof v === 'object' && v.__inc !== undefined) {
                  d[f] = (d[f] || 0) + v.__inc;
                } else {
                  d[f] = v;
                }
              });
              n++;
            }
          });
          return { updated: n };
        },
        async remove() {
          const keep = docs().filter((d) => !matches(d, cond));
          store[name] = keep;
          return { deleted: docs().length - keep.length };
        },
      };
      return self;
    };
    return {
      where: query,
      doc(id) {
        return {
          async get() {
            const found = docs().filter((d) => d._id === id);
            return { data: JSON.parse(JSON.stringify(found)) };
          },
          async update({ data }) {
            const found = docs().find((d) => d._id === id);
            if (found) Object.assign(found, data);
            return { updated: found ? 1 : 0 };
          },
          async set({ data }) {
            const found = docs().find((d) => d._id === id);
            if (found) Object.assign(found, data);
            else docs().push(Object.assign({ _id: id }, JSON.parse(JSON.stringify(data))));
            return { _id: id };
          },
          async remove() {
            store[name] = docs().filter((d) => d._id !== id);
            return { deleted: 1 };
          },
        };
      },
      async add({ data }) {
        const _id = genId();
        docs().push(Object.assign({ _id }, JSON.parse(JSON.stringify(data))));
        return { _id };
      },
    };
  }

  return {
    store,
    collection,
    RegExp: (o) => o,
    command: {
      in: (arr) => ({ __in: arr }),
      inc: (n) => ({ __inc: n }),
    },
  };
}

module.exports = createFakeDb;
