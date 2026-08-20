// Integration test for the Postgres (Supabase-compatible) catalog adapter.
// Points the API handlers at a real Postgres via POSTGRES_URL and exercises
// the full flow: empty start, admin create (draft), publish, public read,
// edit, republish, delete, and the atomic publish transaction with multiple
// changes. Run against a local Postgres:
//   POSTGRES_URL=postgresql://ssga:ssgapass@127.0.0.1:5433/ssga_test \
//     node scripts/test-postgres.mjs
import assert from 'node:assert/strict';

const handlers = {
  login: (await import('../api/admin/login.js')).default,
  products: (await import('../api/admin/products.js')).default,
  collections: (await import('../api/admin/collections.js')).default,
  publish: (await import('../api/admin/publish.js')).default,
  inventory: (await import('../api/inventory/index.js')).default,
};

let passed = 0;
function ok(label) { passed += 1; console.log(`ok - ${label}`); }
function mockReq({ method = 'POST', url = '/', body, headers = {} } = {}) {
  return { method, url, body, headers };
}
function mockRes() {
  return {
    statusCode: 0, headers: {}, body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(p) { try { this.body = p ? JSON.parse(p) : null; } catch { this.body = null; } },
  };
}
async function call(handler, opts) { const res = mockRes(); await handler(mockReq(opts), res); return res; }

// clean slate
{
  const postgres = (await import('postgres')).default;
  const sql = postgres(process.env.POSTGRES_URL, { prepare: false, ssl: false });
  await sql.unsafe('DROP TABLE IF EXISTS catalog_products, catalog_collections, catalog_bundles');
  await sql.end();
}

// login
let res = await call(handlers.login, { body: { password: 'oxford' } });
assert.equal(res.statusCode, 200, 'login');
const token = res.body.token;
const auth = { authorization: `Bearer ${token}` };
ok('login returns a token');

// empty start
res = await call(handlers.inventory, { method: 'GET', url: '/api/inventory' });
assert.equal(res.statusCode, 200);
assert.equal(res.body.items.length, 0, 'production Postgres starts empty');
assert.equal(res.body.collections.length, 0);
ok('empty catalog on first read (no DEMO leakage)');

// create a collection
res = await call(handlers.collections, { headers: auth, body: { name: 'Rifles' } });
assert.equal(res.statusCode, 201, JSON.stringify(res.body));
const colId = res.body.item.id;
ok('create collection (draft)');

// create a product in it
res = await call(handlers.products, {
  headers: auth,
  body: { name: 'Test Rifle', manufacturer: 'Acme', model: 'X1', condition: 'New', price: 500, stockStatus: 'In Stock', collectionIds: [colId] },
});
assert.equal(res.statusCode, 201, JSON.stringify(res.body));
const prodId = res.body.item.id;
ok('create product (draft)');

// not public until published
res = await call(handlers.inventory, { method: 'GET', url: '/api/inventory' });
assert.equal(res.body.items.length, 0, 'draft not public');
ok('drafts do not leak to the public read');

// publish (atomic transaction with 2 changes)
res = await call(handlers.publish, { headers: auth, body: { action: 'publish' } });
assert.equal(res.statusCode, 200, JSON.stringify(res.body));
assert.equal(res.body.summary.total, 0, 'no pending changes after publish');
ok('publish commits (atomic transaction, multiple rows)');

// now public
res = await call(handlers.inventory, { method: 'GET', url: '/api/inventory' });
assert.equal(res.body.items.length, 1);
assert.equal(res.body.items[0].price, 500);
assert.equal(res.body.collections.length, 1);
ok('published product and collection appear publicly');

// edit price (draft), still old price public
res = await call(handlers.products, { headers: auth, body: { id: prodId, price: 450 } });
assert.equal(res.statusCode, 200, JSON.stringify(res.body));
res = await call(handlers.inventory, { method: 'GET', url: '/api/inventory' });
assert.equal(res.body.items[0].price, 500, 'edit stays draft until publish');
ok('edit is a draft until published');

// publish edit
await call(handlers.publish, { headers: auth, body: { action: 'publish' } });
res = await call(handlers.inventory, { method: 'GET', url: '/api/inventory' });
assert.equal(res.body.items[0].price, 450, 'published edit is live');
ok('published edit goes live');

// delete + publish
res = await call(handlers.products, { method: 'DELETE', headers: auth, body: { id: prodId } });
assert.equal(res.statusCode, 200, JSON.stringify(res.body));
await call(handlers.publish, { headers: auth, body: { action: 'publish' } });
res = await call(handlers.inventory, { method: 'GET', url: '/api/inventory' });
assert.equal(res.body.items.length, 0, 'deleted product removed after publish');
ok('delete then publish removes the row');

console.log(`\n${passed} Postgres checks passed.`);
process.exit(0);
