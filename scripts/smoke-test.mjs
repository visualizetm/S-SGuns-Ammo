// Smoke test: shared validation, the draft/publish catalog store, and every
// serverless endpoint invoked directly with mock req/res objects.
// Run: npm run smoke

import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import {
  validateProduct,
  validateCollection,
  validateBundle,
} from '../shared/catalogValidation.js';
import { SEED_PRODUCTS } from '../shared/catalogSeeds.js';
import {
  orderProducts,
  filterProducts,
  badgesFor,
  featuredItems,
  askAboutMessage,
} from '../src/lib/catalogView.js';
import { verifyToken } from '../api/_lib/auth.js';
import loginHandler from '../api/admin/login.js';
import inventoryHandler from '../api/inventory/index.js';
import adminProductsHandler from '../api/admin/products.js';
import adminCollectionsHandler from '../api/admin/collections.js';
import adminBundlesHandler from '../api/admin/bundles.js';
import adminPublishHandler from '../api/admin/publish.js';
import adminProductsCsvHandler from '../api/admin/products-csv.js';
import adminImageHandler from '../api/admin/inventory-image.js';

// Fresh dev store every run.
rmSync('.data', { recursive: true, force: true });

let passed = 0;
function ok(label, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${label}`);
}

function mockReq({ method = 'POST', url = '/', body, headers = {} } = {}) {
  return { method, url, body, headers };
}

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: null,
    raw: null,
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    end(payload) {
      this.raw = payload ?? null;
      try {
        this.body = payload ? JSON.parse(payload) : null;
      } catch {
        this.body = null;
      }
    },
  };
}

async function call(handler, reqOptions) {
  const res = mockRes();
  await handler(mockReq(reqOptions), res);
  return res;
}

// ---- catalog validation ----

ok('product: valid input passes, price normalized, onSale computed', () => {
  const r = validateProduct({
    name: '  DEMO: Test Rifle  ',
    collectionIds: [],
    manufacturer: 'Example Arms Co.',
    model: 'T-1',
    condition: 'New',
    price: '499.999',
    compareAtPrice: 600,
    stockStatus: 'In Stock',
  });
  assert.equal(r.ok, true);
  assert.equal(r.data.name, 'DEMO: Test Rifle');
  assert.equal(r.data.price, 500);
  assert.equal(r.data.onSale, true);
});

ok('product: compareAtPrice at or below price is rejected', () => {
  const r = validateProduct({
    name: 'X',
    manufacturer: 'X',
    model: 'X',
    condition: 'New',
    price: 200,
    compareAtPrice: 100,
    stockStatus: 'In Stock',
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.compareAtPrice);
});

ok('product: no compareAtPrice means not on sale', () => {
  const r = validateProduct({
    name: 'X',
    manufacturer: 'X',
    model: 'X',
    condition: 'New',
    price: 200,
    stockStatus: 'In Stock',
  });
  assert.equal(r.ok, true);
  assert.equal(r.data.onSale, false);
  assert.equal(r.data.compareAtPrice, null);
});

ok('collection: name required, defaults visible', () => {
  assert.equal(validateCollection({ name: '' }).ok, false);
  const r = validateCollection({ name: 'Rimfire' });
  assert.equal(r.ok, true);
  assert.equal(r.data.visible, true);
});

ok('bundle: needs at least two distinct members', () => {
  const base = { name: 'B', price: 100 };
  assert.equal(validateBundle({ ...base, memberProductIds: ['a'] }).ok, false);
  assert.equal(validateBundle({ ...base, memberProductIds: ['a', 'a'] }).ok, false);
  assert.equal(validateBundle({ ...base, memberProductIds: ['a', 'b'] }).ok, true);
});

ok('catalog seeds: every fictional item is marked DEMO', () => {
  assert.ok(
    SEED_PRODUCTS.every((r) => (r.draft ?? r.published).name.startsWith('DEMO:'))
  );
});

// ---- endpoints ----

await (async () => {
  // auth
  let res = await call(loginHandler, { body: { password: 'wrong' } });
  assert.equal(res.statusCode, 401);
  ok('admin login: wrong password returns 401', () => {});

  res = await call(loginHandler, { body: { password: 'oxford-demo' } });
  assert.equal(res.statusCode, 200);
  const token = res.body.token;
  assert.equal(verifyToken(token), true);
  assert.equal(verifyToken('123.badsignature'), false);
  ok('admin login: demo password returns valid signed token', () => {});

  const auth = { authorization: `Bearer ${token}` };

  // ---- public catalog read: published snapshot only ----

  res = await call(inventoryHandler, { method: 'GET', url: '/api/inventory' });
  assert.equal(res.statusCode, 200);
  let publicItems = res.body.items;
  assert.ok(publicItems.length > 0);
  assert.ok(!publicItems.some((i) => i.id === 'demo-other-case'), 'never-published leaks');
  assert.ok(!publicItems.some((i) => i.stockStatus === 'Hidden'), 'hidden leaks');
  const revolver = publicItems.find((i) => i.id === 'demo-handgun-revolver');
  assert.equal(revolver.price, 299);
  assert.ok(res.body.collections.length > 0);
  const saleItem = publicItems.find((i) => i.id === 'demo-handgun-compact');
  assert.equal(saleItem.onSale, true);
  assert.equal(saleItem.compareAtPrice, 449.5);
  ok('public inventory: published only, no drafts, no hidden, sale flags', () => {});

  res = await call(inventoryHandler, {
    method: 'GET',
    url: '/api/inventory?collection=col-rifles&q=lever',
  });
  assert.equal(res.body.items.length, 1);
  ok('public inventory: collection filter and search work', () => {});

  // ---- admin catalog: drafts with statuses ----

  res = await call(adminProductsHandler, { method: 'GET', url: '/x' });
  assert.equal(res.statusCode, 401);
  ok('admin products: no token returns 401', () => {});

  res = await call(adminProductsHandler, { method: 'GET', url: '/x', headers: auth });
  assert.equal(res.statusCode, 200);
  const adminItems = res.body.items;
  assert.equal(adminItems.find((i) => i.id === 'demo-other-case').status, 'new');
  assert.equal(adminItems.find((i) => i.id === 'demo-handgun-revolver').status, 'changed');
  assert.equal(adminItems.find((i) => i.id === 'demo-handgun-revolver').price, 279);
  assert.ok(adminItems.some((i) => i.stockStatus === 'Hidden'));
  ok('admin products: draft view shows statuses, staged edits, hidden', () => {});

  res = await call(adminPublishHandler, { method: 'GET', url: '/x', headers: auth });
  assert.equal(res.body.summary.total, 2);
  ok('publish summary: seeds start with 2 unpublished changes', () => {});

  // create product: validation catches sale pricing and ghost collections
  res = await call(adminProductsHandler, {
    method: 'POST',
    headers: auth,
    body: {
      name: 'DEMO: Smoke Pistol',
      collectionIds: ['no-such-collection'],
      manufacturer: 'Sample Firearms',
      model: 'SM-9',
      condition: 'New',
      price: 300,
      stockStatus: 'In Stock',
    },
  });
  assert.equal(res.statusCode, 422);
  assert.ok(res.body.errors.collectionIds);
  ok('admin products: unknown collection id rejected', () => {});

  res = await call(adminProductsHandler, {
    method: 'POST',
    headers: auth,
    body: {
      name: 'DEMO: Smoke Pistol',
      collectionIds: ['col-handguns'],
      manufacturer: 'Sample Firearms',
      model: 'SM-9',
      condition: 'New',
      price: 300,
      compareAtPrice: 350,
      saleLabel: 'DEMO Sale',
      stockStatus: 'In Stock',
    },
  });
  assert.equal(res.statusCode, 201);
  const created = res.body.item;
  assert.equal(created.status, 'new');
  assert.equal(created.onSale, true);
  ok('admin products: create returns a new draft with onSale computed', () => {});

  // drafts never leak to the public read
  res = await call(inventoryHandler, { method: 'GET', url: '/api/inventory' });
  assert.ok(!res.body.items.some((i) => i.id === created.id));
  ok('public inventory: new draft does not leak before publish', () => {});

  // publish promotes everything atomically
  res = await call(adminPublishHandler, {
    method: 'POST',
    headers: auth,
    body: { action: 'publish' },
  });
  assert.equal(res.body.summary.total, 0);
  res = await call(inventoryHandler, { method: 'GET', url: '/api/inventory' });
  publicItems = res.body.items;
  assert.ok(publicItems.some((i) => i.id === created.id));
  assert.ok(publicItems.some((i) => i.id === 'demo-other-case'));
  assert.equal(publicItems.find((i) => i.id === 'demo-handgun-revolver').price, 279);
  ok('publish: drafts promoted, new items live, staged price live', () => {});

  // discard reverts a fresh draft edit
  res = await call(adminProductsHandler, {
    method: 'POST',
    headers: auth,
    body: { id: created.id, price: 111 },
  });
  assert.equal(res.statusCode, 200);
  res = await call(adminPublishHandler, { method: 'GET', url: '/x', headers: auth });
  assert.equal(res.body.summary.total, 1);
  res = await call(adminPublishHandler, {
    method: 'POST',
    headers: auth,
    body: { action: 'discard' },
  });
  assert.equal(res.body.summary.total, 0);
  res = await call(adminProductsHandler, { method: 'GET', url: '/x', headers: auth });
  assert.equal(res.body.items.find((i) => i.id === created.id).price, 300);
  ok('discard: draft edits revert to the published state', () => {});

  // delete: pending removal until published
  res = await call(adminProductsHandler, {
    method: 'DELETE',
    headers: auth,
    body: { id: created.id },
  });
  assert.equal(res.statusCode, 200);
  res = await call(inventoryHandler, { method: 'GET', url: '/api/inventory' });
  assert.ok(res.body.items.some((i) => i.id === created.id), 'still live before publish');
  res = await call(adminPublishHandler, {
    method: 'POST',
    headers: auth,
    body: { action: 'publish' },
  });
  res = await call(inventoryHandler, { method: 'GET', url: '/api/inventory' });
  assert.ok(!res.body.items.some((i) => i.id === created.id));
  ok('delete: removal is a draft until publish, then the item is gone', () => {});

  // ---- collections CRUD ----

  res = await call(adminCollectionsHandler, {
    method: 'POST',
    headers: auth,
    body: { name: 'DEMO: Rimfire' },
  });
  assert.equal(res.statusCode, 201);
  const rimfire = res.body.item;
  ok('collections: create returns a new draft collection', () => {});

  res = await call(adminCollectionsHandler, {
    method: 'POST',
    headers: auth,
    body: { id: rimfire.id, name: 'DEMO: Rimfire Corner' },
  });
  assert.equal(res.body.item.name, 'DEMO: Rimfire Corner');
  ok('collections: rename updates the draft', () => {});

  res = await call(adminCollectionsHandler, {
    method: 'PATCH',
    headers: auth,
    body: { order: [rimfire.id, 'col-rifles', 'col-handguns'] },
  });
  assert.equal(res.statusCode, 200);
  res = await call(adminCollectionsHandler, { method: 'GET', url: '/x', headers: auth });
  assert.equal(res.body.items[0].id, rimfire.id);
  ok('collections: reorder puts the moved collection first', () => {});

  // deleting a collection keeps its products
  res = await call(adminCollectionsHandler, {
    method: 'DELETE',
    headers: auth,
    body: { id: 'col-ammunition' },
  });
  assert.equal(res.statusCode, 200);
  res = await call(adminProductsHandler, { method: 'GET', url: '/x', headers: auth });
  const ammo = res.body.items.find((i) => i.id === 'demo-ammo-9mm');
  assert.ok(ammo, 'product survived collection delete');
  assert.ok(!ammo.collectionIds.includes('col-ammunition'));
  ok('collections: delete keeps products, they just leave the collection', () => {});

  // ---- bundles CRUD ----

  res = await call(adminBundlesHandler, {
    method: 'POST',
    headers: auth,
    body: {
      name: 'DEMO: Bad Bundle',
      memberProductIds: ['demo-rifle-bolt'],
      price: 700,
    },
  });
  assert.equal(res.statusCode, 422);
  ok('bundles: fewer than two members rejected', () => {});

  res = await call(adminBundlesHandler, {
    method: 'POST',
    headers: auth,
    body: {
      name: 'DEMO: Ghost Bundle',
      memberProductIds: ['demo-rifle-bolt', 'no-such-product'],
      price: 700,
    },
  });
  assert.equal(res.statusCode, 422);
  assert.ok(res.body.errors.memberProductIds);
  ok('bundles: unknown member product rejected', () => {});

  res = await call(adminBundlesHandler, {
    method: 'POST',
    headers: auth,
    body: {
      name: 'DEMO: Smoke Bundle',
      memberProductIds: ['demo-rifle-bolt', 'demo-optic-scope'],
      price: 760,
      compareAtPrice: 808.99,
    },
  });
  assert.equal(res.statusCode, 201);
  const bundle = res.body.item;
  assert.equal(bundle.onSale, true);
  ok('bundles: valid create returns draft with sale flag', () => {});

  res = await call(adminBundlesHandler, {
    method: 'DELETE',
    headers: auth,
    body: { id: bundle.id },
  });
  assert.equal(res.statusCode, 200);
  ok('bundles: delete works', () => {});

  // ---- CSV ----

  res = await call(adminProductsCsvHandler, { method: 'GET', url: '/x', headers: auth });
  assert.equal(res.statusCode, 200);
  assert.ok(res.raw.startsWith('id,name,collections'));
  assert.ok(res.raw.includes('DEMO: Example Bolt-Action Rifle'));
  ok('csv export: returns a CSV with headers and rows', () => {});

  const csv = [
    'id,name,collections,manufacturer,model,caliber,condition,price,compareAtPrice,saleLabel,stockStatus,description',
    ',DEMO: CSV Shotgun,Shotguns,Example Arms Co.,CSV-12,12 GA,New,399.99,,,In Stock,Imported by smoke test',
    ',DEMO: Broken Row,Shotguns,Example Arms Co.,CSV-13,,Mint,399.99,,,In Stock,Bad condition value',
    ',DEMO: Ghost Collection Row,No Such Collection,Example Arms Co.,CSV-14,,New,10,,,In Stock,Unknown collection',
  ].join('\n');
  res = await call(adminProductsCsvHandler, {
    method: 'POST',
    headers: auth,
    body: { csv },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.applied, 1);
  assert.equal(res.body.rejected, 2);
  const badRows = res.body.results.filter((r) => !r.ok);
  assert.ok(badRows.find((r) => r.line === 3).errors.condition);
  assert.ok(badRows.find((r) => r.line === 4).errors.collections);
  ok('csv import: valid rows become drafts, bad rows get per-row errors', () => {});

  res = await call(adminProductsHandler, { method: 'GET', url: '/x?q=CSV-12', headers: auth });
  assert.equal(res.body.items.length, 1);
  assert.equal(res.body.items[0].status, 'new');
  ok('csv import: imported row is a draft, not published', () => {});

  res = await call(adminProductsCsvHandler, { method: 'POST', body: { csv } });
  assert.equal(res.statusCode, 401);
  ok('csv: no token returns 401', () => {});

  // ---- image upload ----

  res = await call(adminImageHandler, {
    method: 'POST',
    body: { dataUrl: 'data:image/jpeg;base64,AAAA' },
  });
  assert.equal(res.statusCode, 401);
  res = await call(adminImageHandler, {
    method: 'POST',
    headers: auth,
    body: { filename: 'x.jpg', dataUrl: 'data:image/jpeg;base64,AAAA' },
  });
  assert.equal(res.statusCode, 201);
  res = await call(adminImageHandler, {
    method: 'POST',
    headers: auth,
    body: { dataUrl: 'data:text/html;base64,AAAA' },
  });
  assert.equal(res.statusCode, 422);
  ok('image upload: auth enforced, images accepted, non-images rejected', () => {});
})();

// ---- Phase 3: public catalog view logic and endpoints ----

// Pure view helpers, exactly what the pages render with.
ok('catalog view: featured items order first, then newest', () => {
  const ordered = orderProducts([
    { id: 'b', featured: false },
    { id: 'a', featured: true },
    { id: 'c', featured: false },
  ]);
  assert.equal(ordered[0].id, 'a');
  assert.equal(ordered[1].id, 'b');
});

ok('catalog view: search and filters match spec fields', () => {
  const items = [
    { id: '1', name: 'DEMO: Lever Rifle', manufacturer: 'Example', model: 'H94', caliber: '.30-30 Win', condition: 'Used', stockStatus: 'In Stock', collectionIds: ['col-rifles'] },
    { id: '2', name: 'DEMO: Pistol', manufacturer: 'Sample', model: 'C-9', caliber: '9mm', condition: 'New', stockStatus: 'Sold', collectionIds: ['col-handguns'] },
  ];
  assert.equal(filterProducts(items, { q: '30-30' }).length, 1);
  assert.equal(filterProducts(items, { q: 'sample' })[0].id, '2');
  assert.equal(filterProducts(items, { condition: 'New' }).length, 1);
  assert.equal(filterProducts(items, { inStockOnly: true }).length, 1);
  assert.equal(filterProducts(items, { inStockOnly: true })[0].id, '1');
  assert.equal(filterProducts(items, { collectionId: 'col-handguns' })[0].id, '2');
});

ok('catalog view: badge logic for sale, low stock, sold', () => {
  const sale = badgesFor({ onSale: true, saleLabel: 'DEMO Sale', stockStatus: 'In Stock' });
  assert.equal(sale.sale, 'DEMO Sale');
  assert.equal(sale.stock, null);
  const plainSale = badgesFor({ onSale: true, saleLabel: '', stockStatus: 'Low Stock' });
  assert.equal(plainSale.sale, 'Sale');
  assert.equal(plainSale.stock, 'Low Stock');
  const sold = badgesFor({ onSale: false, stockStatus: 'Sold' });
  assert.equal(sold.stock, 'Sold');
  assert.equal(sold.dimmed, true);
  assert.equal(sold.sale, null);
});

ok('catalog view: featured strip renders only when featured items exist', () => {
  assert.deepEqual(featuredItems([{ featured: false }, {}]), []);
  const four = featuredItems(
    [1, 2, 3, 4, 5].map((n) => ({ id: n, featured: true }))
  );
  assert.equal(four.length, 4);
});

ok('catalog view: ask-about prefill carries the item name', () => {
  assert.ok(askAboutMessage('DEMO: Example Revolver').includes('DEMO: Example Revolver'));
  assert.equal(askAboutMessage(''), '');
});

await (async () => {
  // Fresh seeded store for the public-read checks.
  rmSync('.data', { recursive: true, force: true });
  delete globalThis.__ssgaCatalogStore;

  // Single item: published only, Hidden never served.
  let res = await call(inventoryHandler, {
    method: 'GET',
    url: '/api/inventory?id=demo-rifle-bolt',
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.item.name, 'DEMO: Example Bolt-Action Rifle');
  ok('public item: published item served by id', () => {});

  for (const id of ['demo-shotgun-ou', 'demo-other-case', 'no-such-id']) {
    res = await call(inventoryHandler, {
      method: 'GET',
      url: `/api/inventory?id=${id}`,
    });
    assert.equal(res.statusCode, 404, `${id} should 404`);
  }
  ok('public item: hidden, never-published, and unknown ids all 404', () => {});

  // Bundles: gated on two or more live members.
  res = await call(inventoryHandler, { method: 'GET', url: '/api/inventory' });
  assert.equal(res.body.bundles.length, 1);
  assert.equal(res.body.bundles[0].members.length, 2);
  ok('public bundles: seed bundle serves with two live members', () => {});

  const login = await call(loginHandler, { body: { password: 'oxford-demo' } });
  const auth = { authorization: `Bearer ${login.body.token}` };

  // Hide one member and publish: the bundle must disappear entirely.
  await call(adminProductsHandler, {
    method: 'POST',
    headers: auth,
    body: { id: 'demo-ammo-9mm', stockStatus: 'Hidden' },
  });
  await call(adminPublishHandler, {
    method: 'POST',
    headers: auth,
    body: { action: 'publish' },
  });
  res = await call(inventoryHandler, { method: 'GET', url: '/api/inventory' });
  assert.equal(res.body.bundles.length, 0);
  assert.ok(!res.body.items.some((i) => i.id === 'demo-ammo-9mm'));
  ok('public bundles: bundle drops when fewer than two members are live', () => {});

  // The hidden member also 404s as a single read now.
  res = await call(inventoryHandler, {
    method: 'GET',
    url: '/api/inventory?id=demo-ammo-9mm',
  });
  assert.equal(res.statusCode, 404);
  ok('public item: newly hidden item stops being served', () => {});
})();

console.log(`\n${passed} checks passed.`);
