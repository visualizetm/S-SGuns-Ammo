// Smoke test: shared validation, the draft/publish catalog store, and every
// serverless endpoint invoked directly with mock req/res objects.
//
// The catalog ships EMPTY (no DEMO data anywhere), so these tests create
// their own fixtures through the same admin endpoints the dashboard uses,
// then assert against them.
// Run: npm run smoke

import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  validateProduct,
  validateCollection,
  validateBundle,
} from '../shared/catalogValidation.js';
import { changesDetail } from '../shared/catalogStore.js';
import {
  SEED_PRODUCTS,
  SEED_COLLECTIONS,
  SEED_BUNDLES,
  seedCatalogStore,
} from '../shared/catalogSeeds.js';
import {
  orderProducts,
  filterProducts,
  badgesFor,
  featuredItems,
  askAboutMessage,
} from '../src/lib/catalogView.js';
import { verifyToken } from '../api/_lib/auth.js';
import loginHandler from '../api/admin/login.js';
import adminPublishHistoryHandler from '../api/admin/publish-history.js';
import adminHealthHandler from '../api/admin/health.js';
import inventoryHandler from '../api/inventory/index.js';
import adminProductsHandler from '../api/admin/products.js';
import adminCollectionsHandler from '../api/admin/collections.js';
import adminBundlesHandler from '../api/admin/bundles.js';
import adminPublishHandler from '../api/admin/publish.js';
import adminProductsCsvHandler from '../api/admin/products-csv.js';
import adminImageHandler from '../api/admin/inventory-image.js';
import adminSalesHandler from '../api/admin/sales.js';
import { validateSale } from '../shared/salesValidation.js';
import { seedSalesStore } from '../shared/salesSeeds.js';
import {
  saleTotal,
  salesInWindow,
  sumRevenue,
  stockSummary,
  dailyBuckets,
} from '../src/lib/salesStats.js';
import {
  REVIEWS,
  REVIEWS_SUMMARY,
  GOOGLE_REVIEW_URL,
  ANNOUNCEMENT,
} from '../src/content/siteFacts.js';
import { shouldShowAnnouncement } from '../src/lib/announcementView.js';
import { readFileSync } from 'node:fs';
import { imageStorageMode, cloudinaryConfigured } from '../api/_lib/imageStorage.js';
import { hasReviewLink, starCount } from '../src/lib/reviewsView.js';
import {
  isMaintenanceEnabled,
  isPublicPath,
  RETRY_AFTER_SECONDS,
} from '../shared/maintenance.js';
import { diffOps } from '../api/_lib/catalogAdapter.js';
import { isTransactionUnsupportedError } from '../api/_lib/mongoClient.js';
import { mongoUri, mongoDbName, dbNotConfiguredError } from '../api/_lib/runtimeEnv.js';
import { isDashboardHostname, DEFAULT_PUBLIC_HOST, DEFAULT_DASHBOARD_HOST } from '../shared/hosts.js';

// Fresh dev store every run.
function resetStores() {
  rmSync('.data', { recursive: true, force: true });
  delete globalThis.__ssgaCatalogStore;
  delete globalThis.__ssgaSalesStore;
}
resetStores();

// Tiny recursive lister for the permanence check (no deps).
import { readdirSync, statSync } from 'node:fs';
function globSync(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = `${dir}/${entry}`;
    if (statSync(full).isDirectory()) out.push(...globSync(full));
    else if (/\.(js|jsx|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

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

async function login() {
  const res = await call(loginHandler, { body: { password: 'oxford' } });
  return { authorization: `Bearer ${res.body.token}` };
}

// Shorthand fixture builders used across the endpoint suites.
async function makeCollection(auth, name) {
  const res = await call(adminCollectionsHandler, {
    method: 'POST',
    headers: auth,
    body: { name },
  });
  assert.equal(res.statusCode, 201, `collection "${name}" should create`);
  return res.body.item;
}

async function makeProduct(auth, fields) {
  const res = await call(adminProductsHandler, {
    method: 'POST',
    headers: auth,
    body: {
      manufacturer: 'Smoke Arms Co.',
      model: 'SM-1',
      condition: 'New',
      stockStatus: 'In Stock',
      ...fields,
    },
  });
  assert.equal(res.statusCode, 201, `product "${fields.name}" should create`);
  return res.body.item;
}

async function publish(auth) {
  const res = await call(adminPublishHandler, {
    method: 'POST',
    headers: auth,
    body: { action: 'publish' },
  });
  assert.equal(res.body.ok, true, 'publish should succeed');
  return res.body.summary;
}

// ---- catalog validation ----

ok('product: valid input passes, price normalized, onSale computed', () => {
  const r = validateProduct({
    name: '  Smoke Test Rifle  ',
    collectionIds: [],
    manufacturer: 'Smoke Arms Co.',
    model: 'T-1',
    condition: 'New',
    price: '499.999',
    compareAtPrice: 600,
    stockStatus: 'In Stock',
  });
  assert.equal(r.ok, true);
  assert.equal(r.data.name, 'Smoke Test Rifle');
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

ok('seeds: catalog and sales seed data are EMPTY (no DEMO anywhere)', () => {
  assert.equal(SEED_PRODUCTS.length, 0);
  assert.equal(SEED_COLLECTIONS.length, 0);
  assert.equal(SEED_BUNDLES.length, 0);
  const store = seedCatalogStore();
  assert.equal(store.products.length, 0);
  assert.equal(store.collections.length, 0);
  assert.equal(store.bundles.length, 0);
  assert.equal(seedSalesStore().length, 0);
});

// ---- endpoints: auth, empty start, fixtures, draft/publish ----

await (async () => {
  // auth
  let res = await call(loginHandler, { body: { password: 'wrong' } });
  assert.equal(res.statusCode, 401);
  ok('admin login: wrong password returns 401', () => {});

  res = await call(loginHandler, { body: { password: 'oxford' } });
  assert.equal(res.statusCode, 200);
  const token = res.body.token;
  assert.equal(verifyToken(token), true);
  assert.equal(verifyToken('123.badsignature'), false);
  ok('admin login: demo password returns valid signed token', () => {});

  const auth = { authorization: `Bearer ${token}` };

  // ---- the catalog starts EMPTY everywhere ----

  res = await call(inventoryHandler, { method: 'GET', url: '/api/inventory' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.items.length, 0, 'public products start empty');
  assert.equal(res.body.collections.length, 0, 'public collections start empty');
  assert.equal(res.body.bundles.length, 0, 'public bundles start empty');
  ok('public inventory: catalog starts completely empty (zero products)', () => {});

  res = await call(adminProductsHandler, { method: 'GET', url: '/x', headers: auth });
  assert.equal(res.body.items.length, 0);
  res = await call(adminPublishHandler, { method: 'GET', url: '/x', headers: auth });
  assert.equal(res.body.summary.total, 0);
  ok('dashboard: empty catalog, nothing pending to publish', () => {});

  res = await call(adminProductsHandler, { method: 'GET', url: '/x' });
  assert.equal(res.statusCode, 401);
  ok('admin products: no token returns 401', () => {});

  // ---- build fixtures through the same endpoints the dashboard uses ----

  const rifles = await makeCollection(auth, 'Rifles');
  const handguns = await makeCollection(auth, 'Handguns');

  // unknown collection id rejected
  res = await call(adminProductsHandler, {
    method: 'POST',
    headers: auth,
    body: {
      name: 'Smoke Ghost',
      collectionIds: ['no-such-collection'],
      manufacturer: 'Smoke Arms Co.',
      model: 'SM-0',
      condition: 'New',
      price: 300,
      stockStatus: 'In Stock',
    },
  });
  assert.equal(res.statusCode, 422);
  assert.ok(res.body.errors.collectionIds);
  ok('admin products: unknown collection id rejected', () => {});

  const bolt = await makeProduct(auth, {
    name: 'Smoke Bolt Rifle',
    collectionIds: [rifles.id],
    model: 'Model 100',
    caliber: '.308 Win',
    price: 649.99,
  });
  const lever = await makeProduct(auth, {
    name: 'Smoke Lever Rifle',
    collectionIds: [rifles.id],
    model: 'Heritage 94',
    caliber: '.30-30 Win',
    condition: 'Used',
    price: 425,
    stockStatus: 'Low Stock',
  });
  const compact = await makeProduct(auth, {
    name: 'Smoke Compact Pistol',
    collectionIds: [handguns.id],
    model: 'C-9',
    caliber: '9mm',
    price: 389.5,
    compareAtPrice: 449.5,
    saleLabel: 'Launch Sale',
  });
  const hidden = await makeProduct(auth, {
    name: 'Smoke Hidden Shotgun',
    collectionIds: [rifles.id],
    model: 'Clays 20',
    condition: 'Used',
    price: 780,
    stockStatus: 'Hidden',
  });
  assert.equal(bolt.status, 'new');
  assert.equal(compact.onSale, true);
  ok('admin products: creates return new drafts with onSale computed', () => {});

  // drafts never leak to the public read before publish
  res = await call(inventoryHandler, { method: 'GET', url: '/api/inventory' });
  assert.equal(res.body.items.length, 0);
  ok('public inventory: new drafts do not leak before publish', () => {});

  // publish promotes everything atomically
  const summary = await publish(auth);
  assert.equal(summary.total, 0);
  res = await call(inventoryHandler, { method: 'GET', url: '/api/inventory' });
  let publicItems = res.body.items;
  assert.equal(publicItems.length, 3, 'hidden item never serves publicly');
  assert.ok(!publicItems.some((i) => i.id === hidden.id), 'hidden leaks');
  assert.ok(!publicItems.some((i) => i.stockStatus === 'Hidden'));
  const saleItem = publicItems.find((i) => i.id === compact.id);
  assert.equal(saleItem.onSale, true);
  assert.equal(saleItem.compareAtPrice, 449.5);
  assert.equal(res.body.collections.length, 2);
  ok('publish: drafts go live; published only, no hidden, sale flags', () => {});

  res = await call(inventoryHandler, {
    method: 'GET',
    url: `/api/inventory?collection=${rifles.id}&q=lever`,
  });
  assert.equal(res.body.items.length, 1);
  assert.equal(res.body.items[0].id, lever.id);
  ok('public inventory: collection filter and search work', () => {});

  // draft edit shows in the dashboard, then discard reverts it
  res = await call(adminProductsHandler, {
    method: 'POST',
    headers: auth,
    body: { id: compact.id, price: 111 },
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
  assert.equal(res.body.items.find((i) => i.id === compact.id).price, 389.5);
  ok('discard: draft edits revert to the published state', () => {});

  // delete: pending removal until published
  const temp = await makeProduct(auth, {
    name: 'Smoke Temp Pistol',
    collectionIds: [handguns.id],
    model: 'T-9',
    price: 300,
  });
  await publish(auth);
  res = await call(adminProductsHandler, {
    method: 'DELETE',
    headers: auth,
    body: { id: temp.id },
  });
  assert.equal(res.statusCode, 200);
  res = await call(inventoryHandler, { method: 'GET', url: '/api/inventory' });
  assert.ok(res.body.items.some((i) => i.id === temp.id), 'still live before publish');
  await publish(auth);
  res = await call(inventoryHandler, { method: 'GET', url: '/api/inventory' });
  assert.ok(!res.body.items.some((i) => i.id === temp.id));
  ok('delete: removal is a draft until publish, then the item is gone', () => {});

  // delete: a NEVER-published product has no live counterpart to remove, so
  // it disappears from the admin list immediately, with no publish step.
  const neverPublished = await makeProduct(auth, {
    name: 'Smoke Never Published',
    collectionIds: [rifles.id],
    model: 'NP-1',
    price: 10,
  });
  res = await call(adminProductsHandler, {
    method: 'DELETE',
    headers: auth,
    body: { id: neverPublished.id },
  });
  assert.equal(res.statusCode, 200);
  res = await call(adminProductsHandler, { method: 'GET', url: '/x', headers: auth });
  assert.ok(
    !res.body.items.some((i) => i.id === neverPublished.id),
    'never-published product is gone from the admin list right away'
  );
  ok('delete: a never-published product is removed immediately, no publish needed', () => {});

  // ---- collections CRUD ----

  const rimfire = await makeCollection(auth, 'Rimfire');
  ok('collections: create returns a new draft collection', () => {});

  res = await call(adminCollectionsHandler, {
    method: 'POST',
    headers: auth,
    body: { id: rimfire.id, name: 'Rimfire Corner' },
  });
  assert.equal(res.body.item.name, 'Rimfire Corner');
  ok('collections: rename updates the draft', () => {});

  res = await call(adminCollectionsHandler, {
    method: 'PATCH',
    headers: auth,
    body: { order: [rimfire.id, rifles.id, handguns.id] },
  });
  assert.equal(res.statusCode, 200);
  res = await call(adminCollectionsHandler, { method: 'GET', url: '/x', headers: auth });
  assert.equal(res.body.items[0].id, rimfire.id);
  ok('collections: reorder puts the moved collection first', () => {});

  // hide / unhide: visible:false takes a published collection off the
  // public read; visible:true brings it back. Both are drafts like any
  // other edit, so publish makes the effect visible on the public side.
  await publish(auth);
  res = await call(adminCollectionsHandler, {
    method: 'POST',
    headers: auth,
    body: { id: rifles.id, visible: false },
  });
  assert.equal(res.body.item.visible, false);
  await publish(auth);
  res = await call(inventoryHandler, { method: 'GET', url: '/api/inventory' });
  assert.ok(!res.body.collections.some((c) => c.id === rifles.id), 'hidden collection is off the public read');
  res = await call(adminCollectionsHandler, {
    method: 'POST',
    headers: auth,
    body: { id: rifles.id, visible: true },
  });
  assert.equal(res.body.item.visible, true);
  await publish(auth);
  res = await call(inventoryHandler, { method: 'GET', url: '/api/inventory' });
  assert.ok(res.body.collections.some((c) => c.id === rifles.id), 'unhidden collection is back on the public read');
  ok('collections: hide (visible:false) and unhide (visible:true) both work', () => {});

  // deleting a collection keeps its products
  res = await call(adminCollectionsHandler, {
    method: 'DELETE',
    headers: auth,
    body: { id: handguns.id },
  });
  assert.equal(res.statusCode, 200);
  res = await call(adminProductsHandler, { method: 'GET', url: '/x', headers: auth });
  const compactAfter = res.body.items.find((i) => i.id === compact.id);
  assert.ok(compactAfter, 'product survived collection delete');
  assert.ok(!compactAfter.collectionIds.includes(handguns.id));
  ok('collections: delete keeps products, they just leave the collection', () => {});

  // ---- bundles CRUD ----

  res = await call(adminBundlesHandler, {
    method: 'POST',
    headers: auth,
    body: { name: 'Smoke Bad Bundle', memberProductIds: [bolt.id], price: 700 },
  });
  assert.equal(res.statusCode, 422);
  ok('bundles: fewer than two members rejected', () => {});

  res = await call(adminBundlesHandler, {
    method: 'POST',
    headers: auth,
    body: {
      name: 'Smoke Ghost Bundle',
      memberProductIds: [bolt.id, 'no-such-product'],
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
      name: 'Smoke Range Bundle',
      memberProductIds: [bolt.id, lever.id],
      price: 999,
      compareAtPrice: 1074.99,
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
  assert.ok(res.raw.includes('Smoke Bolt Rifle'));
  ok('csv export: returns a CSV with headers and the created rows', () => {});

  const csv = [
    'id,name,collections,manufacturer,model,caliber,condition,price,compareAtPrice,saleLabel,stockStatus,description',
    ',Smoke CSV Shotgun,Rifles,Smoke Arms Co.,CSV-12,12 GA,New,399.99,,,In Stock,Imported by smoke test',
    ',Smoke Broken Row,Rifles,Smoke Arms Co.,CSV-13,,Mint,399.99,,,In Stock,Bad condition value',
    ',Smoke Ghost Collection Row,No Such Collection,Smoke Arms Co.,CSV-14,,New,10,,,In Stock,Unknown collection',
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

// ---- public catalog view logic ----

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
    { id: '1', name: 'Smoke Lever Rifle', manufacturer: 'Example', model: 'H94', caliber: '.30-30 Win', condition: 'Used', stockStatus: 'In Stock', collectionIds: ['col-rifles'] },
    { id: '2', name: 'Smoke Pistol', manufacturer: 'Sample', model: 'C-9', caliber: '9mm', condition: 'New', stockStatus: 'Sold', collectionIds: ['col-handguns'] },
  ];
  assert.equal(filterProducts(items, { q: '30-30' }).length, 1);
  assert.equal(filterProducts(items, { q: 'sample' })[0].id, '2');
  assert.equal(filterProducts(items, { condition: 'New' }).length, 1);
  assert.equal(filterProducts(items, { inStockOnly: true }).length, 1);
  assert.equal(filterProducts(items, { inStockOnly: true })[0].id, '1');
  assert.equal(filterProducts(items, { collectionId: 'col-handguns' })[0].id, '2');
});

ok('catalog view: badge logic for sale, low stock, sold', () => {
  const sale = badgesFor({ onSale: true, saleLabel: 'Launch Sale', stockStatus: 'In Stock' });
  assert.equal(sale.sale, 'Launch Sale');
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
  const four = featuredItems([1, 2, 3, 4, 5].map((n) => ({ id: n, featured: true })));
  assert.equal(four.length, 4);
});

ok('catalog view: ask-about prefill carries the item name', () => {
  assert.ok(askAboutMessage('Smoke Revolver').includes('Smoke Revolver'));
  assert.equal(askAboutMessage(''), '');
});

// ---- public single item and bundle gating (own fixtures) ----

await (async () => {
  resetStores();
  const auth = await login();

  // Empty store: unknown id 404s cleanly.
  let res = await call(inventoryHandler, {
    method: 'GET',
    url: '/api/inventory?id=no-such-id',
  });
  assert.equal(res.statusCode, 404);
  ok('public item: unknown id 404s on an empty catalog', () => {});

  const range = await makeCollection(auth, 'Range Gear');
  const scope = await makeProduct(auth, {
    name: 'Smoke Rifle Scope',
    collectionIds: [range.id],
    model: 'Clearview 3940',
    price: 159,
  });
  const ammo = await makeProduct(auth, {
    name: 'Smoke Range Ammo Pack',
    collectionIds: [range.id],
    model: 'Range Pack',
    caliber: '9mm',
    price: 17.99,
  });
  const caseHidden = await makeProduct(auth, {
    name: 'Smoke Rifle Case',
    collectionIds: [range.id],
    model: 'Guard 48',
    price: 54.99,
    stockStatus: 'Hidden',
  });
  res = await call(adminBundlesHandler, {
    method: 'POST',
    headers: auth,
    body: {
      name: 'Smoke Starter Package',
      memberProductIds: [scope.id, ammo.id],
      price: 170,
    },
  });
  assert.equal(res.statusCode, 201);
  await publish(auth);

  res = await call(inventoryHandler, {
    method: 'GET',
    url: `/api/inventory?id=${scope.id}`,
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.item.name, 'Smoke Rifle Scope');
  ok('public item: published item served by id', () => {});

  for (const id of [caseHidden.id, 'no-such-id']) {
    res = await call(inventoryHandler, {
      method: 'GET',
      url: `/api/inventory?id=${id}`,
    });
    assert.equal(res.statusCode, 404, `${id} should 404`);
  }
  ok('public item: hidden and unknown ids both 404', () => {});

  res = await call(inventoryHandler, { method: 'GET', url: '/api/inventory' });
  assert.equal(res.body.bundles.length, 1);
  assert.equal(res.body.bundles[0].members.length, 2);
  ok('public bundles: bundle serves with two live members', () => {});

  // Hide one member and publish: the bundle must disappear entirely.
  await call(adminProductsHandler, {
    method: 'POST',
    headers: auth,
    body: { id: ammo.id, stockStatus: 'Hidden' },
  });
  await publish(auth);
  res = await call(inventoryHandler, { method: 'GET', url: '/api/inventory' });
  assert.equal(res.body.bundles.length, 0);
  assert.ok(!res.body.items.some((i) => i.id === ammo.id));
  ok('public bundles: bundle drops when fewer than two members are live', () => {});

  res = await call(inventoryHandler, {
    method: 'GET',
    url: `/api/inventory?id=${ammo.id}`,
  });
  assert.equal(res.statusCode, 404);
  ok('public item: newly hidden item stops being served', () => {});
})();

// ---- Quick Sale: validation, stats math, endpoint flows ----

ok('sale validation: negative price and zero quantity are rejected', () => {
  const r = validateSale({ productId: 'p1', priceAtSale: -5, quantity: 0 });
  assert.equal(r.ok, false);
  assert.ok(r.errors.priceAtSale);
  assert.ok(r.errors.quantity);
});

ok('sale validation: defaults quantity to 1, now for soldAt, empty note', () => {
  const r = validateSale({ productId: 'p1', priceAtSale: '19.999' });
  assert.equal(r.ok, true);
  assert.equal(r.data.quantity, 1);
  assert.equal(r.data.priceAtSale, 20); // rounded to cents
  assert.equal(r.data.note, '');
  assert.ok(!Number.isNaN(new Date(r.data.soldAt).getTime()));
  assert.equal(r.data.markSold, false);
});

ok('sale validation: missing product id is rejected', () => {
  const r = validateSale({ priceAtSale: 10 });
  assert.equal(r.ok, false);
  assert.ok(r.errors.productId);
});

ok('overview stats: stock summary counts and listed value', () => {
  const products = [
    { stockStatus: 'In Stock', price: 100 },
    { stockStatus: 'In Stock', price: 200 },
    { stockStatus: 'Low Stock', price: 50 },
    { stockStatus: 'Sold', price: 999 },
    { stockStatus: 'Hidden', price: 999 },
  ];
  const { counts, listedValue } = stockSummary(products);
  assert.equal(counts['In Stock'], 2);
  assert.equal(counts['Low Stock'], 1);
  assert.equal(counts.Sold, 1);
  assert.equal(counts.Hidden, 1);
  // Only In Stock + Low Stock count toward listed value: 100 + 200 + 50.
  assert.equal(listedValue, 350);
});

ok('overview stats: sale total, window filter, revenue, daily buckets', () => {
  const now = new Date('2026-08-20T12:00:00Z');
  const iso = (d, h = 12) =>
    new Date(now.getTime() - d * 86400000 + (h - 12) * 3600000).toISOString();
  const sales = [
    { soldAt: iso(0), priceAtSale: 100, quantity: 1 }, // today
    { soldAt: iso(0), priceAtSale: 10, quantity: 2 }, // today, qty 2 -> 20
    { soldAt: iso(3), priceAtSale: 50, quantity: 1 }, // within 7d
    { soldAt: iso(20), priceAtSale: 400, quantity: 1 }, // within 30d only
  ];
  assert.equal(saleTotal(sales[1]), 20);

  const today = salesInWindow(sales, 'today', now);
  assert.equal(today.length, 2);
  assert.equal(sumRevenue(today), 120);

  const week = salesInWindow(sales, '7d', now);
  assert.equal(week.length, 3);
  assert.equal(sumRevenue(week), 170);

  const month = salesInWindow(sales, '30d', now);
  assert.equal(month.length, 4);
  assert.equal(sumRevenue(month), 570);

  const all = salesInWindow(sales, 'all', now);
  assert.equal(sumRevenue(all), 570);

  const buckets = dailyBuckets(sales, 14, now);
  assert.equal(buckets.length, 14);
  // The last bucket is today and should hold both of today's sales.
  assert.equal(buckets[buckets.length - 1].total, 120);
  // The 20-day-old sale falls outside a 14-day window: total excluded.
  const summed = buckets.reduce((s, b) => s + b.total, 0);
  assert.equal(summed, 170);
});

await (async () => {
  resetStores();
  const auth = await login();

  // Auth gate.
  let res = await call(adminSalesHandler, { method: 'GET', url: '/api/admin/sales' });
  assert.equal(res.statusCode, 401);
  ok('quick sale endpoint: no token returns 401', () => {});

  // The sales log starts EMPTY (no DEMO sales).
  res = await call(adminSalesHandler, { method: 'GET', url: '/api/admin/sales', headers: auth });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.items.length, 0);
  ok('quick sale endpoint: sales log starts empty', () => {});

  // Validation and unknown-product guards.
  res = await call(adminSalesHandler, {
    method: 'POST',
    headers: auth,
    body: { productId: 'anything', priceAtSale: -5, quantity: 0 },
  });
  assert.equal(res.statusCode, 422);
  assert.ok(res.body.errors.priceAtSale && res.body.errors.quantity);
  ok('quick sale endpoint: invalid price/quantity rejected with field errors', () => {});

  res = await call(adminSalesHandler, {
    method: 'POST',
    headers: auth,
    body: { productId: 'no-such-product', priceAtSale: 10 },
  });
  assert.equal(res.statusCode, 422);
  assert.ok(res.body.errors.productId);
  ok('quick sale endpoint: unknown product rejected', () => {});

  // Fixture: one published Low Stock product.
  const used = await makeCollection(auth, 'Used Guns');
  const leverGun = await makeProduct(auth, {
    name: 'Smoke Lever Gun',
    collectionIds: [used.id],
    model: 'Heritage 94',
    caliber: '.30-30 Win',
    condition: 'Used',
    price: 425,
    stockStatus: 'Low Stock',
  });
  await publish(auth);
  res = await call(inventoryHandler, { method: 'GET', url: '/api/inventory' });
  assert.equal(
    res.body.items.find((i) => i.id === leverGun.id).stockStatus,
    'Low Stock'
  );
  const summaryBefore = await call(adminPublishHandler, { method: 'GET', url: '/x', headers: auth });
  const dirtyBefore = summaryBefore.body.summary.total;

  // Log a sale with markSold: the item goes Sold live on both draft + published.
  res = await call(adminSalesHandler, {
    method: 'POST',
    headers: auth,
    body: { productId: leverGun.id, priceAtSale: '400', quantity: 1, markSold: true },
  });
  assert.equal(res.statusCode, 201);
  const sale = res.body.sale;
  assert.equal(sale.markedSold, true);
  assert.equal(sale.prevStockStatus, 'Low Stock');
  assert.equal(sale.productNameSnapshot, 'Smoke Lever Gun');
  ok('quick sale endpoint: markSold logs sale and captures previous status', () => {});

  // Public catalog reflects Sold immediately, no publish step.
  res = await call(inventoryHandler, { method: 'GET', url: '/api/inventory' });
  assert.equal(
    res.body.items.find((i) => i.id === leverGun.id).stockStatus,
    'Sold'
  );
  ok('quick sale endpoint: markSold shows on the public site with no publish', () => {});

  // The write-through touches draft AND published equally: no new diff.
  res = await call(adminPublishHandler, { method: 'GET', url: '/x', headers: auth });
  assert.equal(res.body.summary.total, dirtyBefore);
  ok('quick sale endpoint: live sold status adds no unpublished changes', () => {});

  // Date filter: from just after the sale excludes it.
  const from = new Date(new Date(sale.soldAt).getTime() + 1000).toISOString();
  res = await call(adminSalesHandler, {
    method: 'GET',
    url: `/api/admin/sales?from=${encodeURIComponent(from)}`,
    headers: auth,
  });
  assert.ok(!res.body.items.some((s) => s.id === sale.id));
  ok('quick sale endpoint: date-range filter narrows the list', () => {});

  // Undo: delete the sale and the item returns to its prior status live.
  res = await call(adminSalesHandler, {
    method: 'DELETE',
    url: `/api/admin/sales?id=${sale.id}`,
    headers: auth,
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.restored.stockStatus, 'Low Stock');
  res = await call(inventoryHandler, { method: 'GET', url: '/api/inventory' });
  assert.equal(
    res.body.items.find((i) => i.id === leverGun.id).stockStatus,
    'Low Stock'
  );
  ok('quick sale endpoint: undo removes the sale and restores prior status live', () => {});

  res = await call(adminSalesHandler, {
    method: 'DELETE',
    url: '/api/admin/sales?id=no-such-sale',
    headers: auth,
  });
  assert.equal(res.statusCode, 404);
  ok('quick sale endpoint: deleting an unknown sale returns 404', () => {});

  // A sale WITHOUT markSold leaves stock untouched.
  res = await call(adminSalesHandler, {
    method: 'POST',
    headers: auth,
    body: { productId: leverGun.id, priceAtSale: 425, quantity: 1, markSold: false, note: 'counter sale' },
  });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.sale.markedSold, false);
  assert.equal(res.body.sale.note, 'counter sale');
  res = await call(inventoryHandler, { method: 'GET', url: '/api/inventory' });
  assert.equal(
    res.body.items.find((i) => i.id === leverGun.id).stockStatus,
    'Low Stock'
  );
  ok('quick sale endpoint: logging without markSold leaves stock unchanged', () => {});
})();

// ---- Reviews section: content and the review-button gate ----

ok('reviews: the section renders every review from siteFacts', () => {
  // The component maps directly over REVIEWS, so a non-empty, well-formed
  // list is exactly what the section renders.
  assert.ok(Array.isArray(REVIEWS) && REVIEWS.length >= 6);
  for (const review of REVIEWS) {
    assert.equal(typeof review.quote, 'string');
    assert.ok(review.quote.trim().length > 0);
    assert.equal(typeof review.author, 'string');
    assert.ok(review.author.trim().length > 0);
    assert.ok(Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5);
  }
});

ok('reviews: aggregate summary strings are present for the section heading', () => {
  assert.equal(typeof REVIEWS_SUMMARY.ratingText, 'string');
  assert.equal(typeof REVIEWS_SUMMARY.countText, 'string');
  assert.ok(REVIEWS_SUMMARY.ratingText && REVIEWS_SUMMARY.countText);
});

ok('reviews: the review button is hidden while googleReviewUrl is a placeholder', () => {
  assert.equal(hasReviewLink(GOOGLE_REVIEW_URL), false);
  assert.equal(hasReviewLink('[[GOOGLE REVIEW LINK - owner to provide]]'), false);
  assert.equal(hasReviewLink(''), false);
  assert.equal(hasReviewLink(undefined), false);
  assert.equal(hasReviewLink('https://g.page/r/example/review'), true);
});

ok('reviews: star count clamps to whole stars in 0..5', () => {
  assert.equal(starCount(5), 5);
  assert.equal(starCount(4.9), 5);
  assert.equal(starCount(0), 0);
  assert.equal(starCount(9), 5);
  assert.equal(starCount(-2), 0);
});

// ---- Production persistence guard: loud failure, never silent loss ----

await (async () => {
  const auth = await login();

  // Dev runtime: health reports the file store and a healthy state, and
  // every JSON response carries no-store so the public read is never stale.
  let res = await call(adminHealthHandler, { method: 'GET', url: '/api/admin/health', headers: auth });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.adapter, 'dev-file');
  assert.equal(res.body.runtime, 'dev');
  ok('health: dev runtime reports dev-file adapter, ok true', () => {});

  res = await call(adminHealthHandler, { method: 'GET', url: '/api/admin/health' });
  assert.equal(res.statusCode, 401);
  ok('health: auth-gated (401 without a token)', () => {});

  res = await call(inventoryHandler, { method: 'GET', url: '/api/inventory' });
  assert.equal(res.headers['cache-control'], 'no-store');
  ok('public inventory: served with Cache-Control no-store (never stale)', () => {});

  // Simulated Vercel deployment with NO database: every store-backed
  // endpoint must fail LOUD with the exact configuration error. Run in a
  // child process so the env change cannot leak into this one.
  const raw = execFileSync(
    process.execPath,
    ['scripts/prod-guard-check.mjs'],
    { env: { ...process.env, VERCEL: '1', DATABASE_MONGODB_URI: '', MONGODB_URI: '' } }
  ).toString();
  const report = JSON.parse(raw.trim().split('\n').pop());
  assert.equal(report.failed, 0, JSON.stringify(report.results));
  ok('production guard: no DATABASE_MONGODB_URI/MONGODB_URI means 503 everywhere, health warns', () => {});
})();

// ---- Publish modal diff + publish history ----

ok('publish diff: changesDetail groups added/updated/removed by name', () => {
  const store = {
    products: [
      { id: 'p1', draft: { name: 'New Rifle' }, published: null },
      { id: 'p2', draft: { name: 'Priced Pistol', price: 2 }, published: { name: 'Priced Pistol', price: 1 } },
      { id: 'p3', draft: null, published: { name: 'Gone Shotgun' } },
      { id: 'p4', draft: { name: 'Live Optic' }, published: { name: 'Live Optic' } },
    ],
    collections: [{ id: 'c1', draft: { name: 'New Shelf' }, published: null }],
    bundles: [],
  };
  const detail = changesDetail(store);
  assert.deepEqual(detail.products.added, ['New Rifle']);
  assert.deepEqual(detail.products.updated, ['Priced Pistol']);
  assert.deepEqual(detail.products.removed, ['Gone Shotgun']);
  assert.deepEqual(detail.collections.added, ['New Shelf']);
  assert.deepEqual(detail.bundles, { added: [], updated: [], removed: [] });
});

await (async () => {
  resetStores();
  delete globalThis.__ssgaHistoryStore;
  const auth = await login();

  // History is auth-gated and starts empty.
  let res = await call(adminPublishHistoryHandler, { method: 'GET', url: '/x' });
  assert.equal(res.statusCode, 401);
  res = await call(adminPublishHistoryHandler, { method: 'GET', url: '/x', headers: auth });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.items.length, 0);
  ok('publish history: auth-gated and starts empty', () => {});

  // Build a small change set; the GET publish detail itemizes it.
  const shelf = await makeCollection(auth, 'History Shelf');
  const rifle = await makeProduct(auth, {
    name: 'History Rifle',
    collectionIds: [shelf.id],
    price: 500,
  });
  res = await call(adminPublishHandler, { method: 'GET', url: '/x', headers: auth });
  assert.equal(res.body.summary.total, 2);
  assert.deepEqual(res.body.detail.products.added, ['History Rifle']);
  assert.deepEqual(res.body.detail.collections.added, ['History Shelf']);
  ok('publish endpoint: GET returns the itemized modal diff', () => {});

  // Publishing records a history entry with that exact itemized detail.
  await publish(auth);
  res = await call(adminPublishHistoryHandler, { method: 'GET', url: '/x', headers: auth });
  assert.equal(res.body.items.length, 1);
  const entry = res.body.items[0];
  assert.equal(entry.total, 2);
  assert.equal(entry.publishedBy, 'Owner');
  assert.ok(!Number.isNaN(new Date(entry.publishedAt).getTime()));
  assert.deepEqual(entry.detail.products.added, ['History Rifle']);
  assert.deepEqual(entry.detail.collections.added, ['History Shelf']);
  ok('publish history: publishing records the itemized entry', () => {});

  // An edit + publish adds a second entry, newest first, grouped as updated.
  await call(adminProductsHandler, {
    method: 'POST',
    headers: auth,
    body: { id: rifle.id, price: 525 },
  });
  await publish(auth);
  res = await call(adminPublishHistoryHandler, { method: 'GET', url: '/x', headers: auth });
  assert.equal(res.body.items.length, 2);
  assert.ok(res.body.items[0].publishedAt >= res.body.items[1].publishedAt);
  assert.deepEqual(res.body.items[0].detail.products.updated, ['History Rifle']);
  ok('publish history: newest first, edits itemized as updated', () => {});

  // Publishing nothing records nothing.
  await publish(auth);
  res = await call(adminPublishHistoryHandler, { method: 'GET', url: '/x', headers: auth });
  assert.equal(res.body.items.length, 2);
  ok('publish history: an empty publish records no entry', () => {});
})();

// ---- Cloudinary image storage ----

ok('images: storage mode follows the environment', () => {
  const before = process.env.CLOUDINARY_URL;
  delete process.env.CLOUDINARY_URL;
  assert.equal(cloudinaryConfigured(), false);
  assert.equal(imageStorageMode(), 'dev-data-url'); // local dev fallback
  process.env.CLOUDINARY_URL = 'cloudinary://key:secret@example-cloud';
  assert.equal(cloudinaryConfigured(), true);
  assert.equal(imageStorageMode(), 'cloudinary');
  if (before === undefined) delete process.env.CLOUDINARY_URL;
  else process.env.CLOUDINARY_URL = before;
});

ok('images: photo validation keeps the Cloudinary publicId, never bytes', () => {
  const r = validateProduct({
    name: 'Smoke Photo Rifle',
    manufacturer: 'Smoke Arms Co.',
    model: 'P-1',
    condition: 'New',
    price: 100,
    stockStatus: 'In Stock',
    photos: [
      { url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/ss-guns-ammo/products/abc.jpg', publicId: 'ss-guns-ammo/products/abc' },
      { url: 'https://example.com/plain.jpg' },
    ],
  });
  assert.equal(r.ok, true);
  assert.equal(r.data.photos[0].publicId, 'ss-guns-ammo/products/abc');
  assert.equal(r.data.photos[1].publicId, undefined);
});

ok('images: PERMANENCE - no Cloudinary destroy/delete call exists anywhere', () => {
  const files = [];
  for (const dir of ['api', 'src', 'shared', 'scripts']) {
    files.push(...globSync(dir));
  }
  const offenders = [];
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    if (/uploader\s*\.\s*destroy|delete_resources|api\.delete|\bdestroy\s*\(/.test(content) && file !== 'scripts/smoke-test.mjs') {
      offenders.push(file);
    }
  }
  assert.deepEqual(offenders, [], `destroy-like calls found: ${offenders.join(', ')}`);
});

// ---- Announcement bar: enabled by default, gated exactly as rendered ----

ok('announcement: shipped config is enabled with real text, no em dashes', () => {
  assert.equal(ANNOUNCEMENT.enabled, true);
  assert.equal(typeof ANNOUNCEMENT.text, 'string');
  assert.ok(ANNOUNCEMENT.text.trim().length > 0);
  assert.ok(!/[\u2013\u2014]/.test(ANNOUNCEMENT.text), 'no em or en dashes');
  assert.equal(shouldShowAnnouncement(ANNOUNCEMENT, false), true);
});

ok('announcement: bar renders when enabled, absent when disabled or dismissed', () => {
  const base = { enabled: true, text: 'Hello' };
  assert.equal(shouldShowAnnouncement(base, false), true);
  // Dismissed this visit: hidden.
  assert.equal(shouldShowAnnouncement(base, true), false);
  // Switched off in siteFacts: hidden.
  assert.equal(shouldShowAnnouncement({ ...base, enabled: false }, false), false);
  // No usable text: hidden.
  assert.equal(shouldShowAnnouncement({ enabled: true, text: '  ' }, false), false);
  assert.equal(shouldShowAnnouncement(undefined, false), false);
});

// ---- Maintenance mode: the switch and what it is allowed to cover ----

ok('maintenance: only the exact word "true" takes the site down', () => {
  assert.equal(isMaintenanceEnabled('true'), true);
  assert.equal(isMaintenanceEnabled('TRUE'), true);
  assert.equal(isMaintenanceEnabled(' true '), true);
  // Everything else fails SAFE: the site stays up.
  assert.equal(isMaintenanceEnabled('false'), false);
  assert.equal(isMaintenanceEnabled(''), false);
  assert.equal(isMaintenanceEnabled(undefined), false);
  assert.equal(isMaintenanceEnabled(null), false);
  assert.equal(isMaintenanceEnabled('yes'), false);
  assert.equal(isMaintenanceEnabled('1'), false);
  assert.equal(isMaintenanceEnabled('ture'), false); // typo stays up
});

ok("maintenance: the Owner's Dashboard and the API are never covered", () => {
  assert.equal(isPublicPath('/admin'), false);
  assert.equal(isPublicPath('/admin/'), false);
  assert.equal(isPublicPath('/admin/anything'), false);
  assert.equal(isPublicPath('/api'), false);
  assert.equal(isPublicPath('/api/inventory'), false);
  assert.equal(isPublicPath('/api/admin/products'), false);
  assert.equal(isPublicPath('/api/admin/sales'), false);
});

ok('maintenance: every public route is covered, static files are not', () => {
  for (const path of [
    '/',
    '/about',
    '/services',
    '/inventory',
    '/inventory/some-item',
    '/transfers',
    '/contact',
    '/no-such-page',
  ]) {
    assert.equal(isPublicPath(path), true, `${path} should be covered`);
  }
  // Build assets and static files keep serving so the page can render.
  for (const path of ['/assets/index-abc123.js', '/favicon.svg', '/og-image.png', '/robots.txt']) {
    assert.equal(isPublicPath(path), false, `${path} should keep serving`);
  }
});

ok('maintenance: Retry-After is a sane positive number of seconds', () => {
  assert.ok(Number.isInteger(RETRY_AFTER_SECONDS) && RETRY_AFTER_SECONDS > 0);
});

// ---- MongoDB adapter: pure logic that does not need a live cluster ----
// (Full CRUD/publish/discard/Quick Sale behavior is already exercised
// against the dev-file adapter above through the exact same shared pure
// functions from shared/catalogStore.js that the Mongo adapter also calls;
// these checks cover the two pieces that are genuinely new to the Mongo
// adapter: translating a store diff into bulkWrite ops, and recognizing
// when a cluster does not support transactions.)

ok('mongo: diffOps upserts new/changed records and deletes removed ones', () => {
  const before = [
    { id: 'a', name: 'Unchanged' },
    { id: 'b', name: 'Old name' },
    { id: 'c', name: 'Will be removed' },
  ];
  const after = [
    { id: 'a', name: 'Unchanged' },
    { id: 'b', name: 'New name' },
    { id: 'd', name: 'Brand new' },
  ];
  const ops = diffOps(before, after);
  // Unchanged record 'a' produces no operation at all.
  assert.equal(ops.length, 3);
  const upserts = ops.filter((o) => o.replaceOne).map((o) => o.replaceOne);
  const deletes = ops.filter((o) => o.deleteOne).map((o) => o.deleteOne);
  assert.deepEqual(
    upserts.map((u) => u.filter.id).sort(),
    ['b', 'd']
  );
  assert.ok(upserts.every((u) => u.upsert === true));
  assert.equal(upserts.find((u) => u.filter.id === 'b').replacement.name, 'New name');
  assert.deepEqual(deletes.map((d) => d.filter.id), ['c']);
});

ok('mongo: diffOps is a no-op when nothing changed', () => {
  const same = [{ id: 'a', name: 'X' }, { id: 'b', name: 'Y' }];
  assert.deepEqual(diffOps(same, same), []);
  assert.deepEqual(diffOps([], []), []);
});

ok('mongo: recognizes the "not a replica set" error, and only that error', () => {
  assert.equal(
    isTransactionUnsupportedError({
      message: 'Transaction numbers are only allowed on a replica set member or mongos',
    }),
    true
  );
  assert.equal(isTransactionUnsupportedError({ code: 20, message: 'IllegalOperation' }), true);
  // A real write conflict or network error must NOT be treated as
  // "transactions unsupported" and silently fall back outside the
  // transaction; it has to propagate and fail the publish loudly instead.
  assert.equal(isTransactionUnsupportedError({ code: 112, message: 'WriteConflict' }), false);
  assert.equal(isTransactionUnsupportedError(new Error('network timeout')), false);
  assert.equal(isTransactionUnsupportedError(undefined), false);
});

ok('mongo: connection details come only from env, read at request time', () => {
  const before = process.env.DATABASE_MONGODB_URI;
  const beforeFallback = process.env.MONGODB_URI;
  const beforeDb = process.env.MONGODB_DB;
  delete process.env.DATABASE_MONGODB_URI;
  delete process.env.MONGODB_URI;
  delete process.env.MONGODB_DB;
  assert.equal(mongoUri(), '');
  assert.equal(mongoDbName(), 'ssguns'); // documented default
  process.env.MONGODB_URI = 'mongodb+srv://fallback:pass@cluster.mongodb.net';
  assert.equal(mongoUri(), 'mongodb+srv://fallback:pass@cluster.mongodb.net'); // MONGODB_URI fallback
  process.env.DATABASE_MONGODB_URI = 'mongodb+srv://user:pass@cluster.mongodb.net';
  process.env.MONGODB_DB = 'custom';
  assert.equal(mongoUri(), 'mongodb+srv://user:pass@cluster.mongodb.net'); // DATABASE_MONGODB_URI wins
  assert.equal(mongoDbName(), 'custom');
  if (before === undefined) delete process.env.DATABASE_MONGODB_URI;
  else process.env.DATABASE_MONGODB_URI = before;
  if (beforeFallback === undefined) delete process.env.MONGODB_URI;
  else process.env.MONGODB_URI = beforeFallback;
  if (beforeDb === undefined) delete process.env.MONGODB_DB;
  else process.env.MONGODB_DB = beforeDb;
});

ok('mongo: the loud-failure message names the right env var', () => {
  const err = dbNotConfiguredError();
  assert.equal(err.code, 'DB_NOT_CONFIGURED');
  assert.equal(err.message, 'Database not configured. Set DATABASE_MONGODB_URI.');
});

ok('hosts: dashboard host detection matches the configured host and the dashboard. prefix', () => {
  assert.equal(isDashboardHostname('dashboard.ssgunsandammo.com'), true);
  assert.equal(isDashboardHostname('DASHBOARD.SSGUNSANDAMMO.COM'), true); // case-insensitive
  assert.equal(isDashboardHostname('dashboard.other-domain.test', 'dashboard.other-domain.test'), true);
  assert.equal(isDashboardHostname('dashboard.anything.example'), true); // belt-and-suspenders prefix rule
});

ok('hosts: the public host, localhost, and preview hosts are never the dashboard', () => {
  assert.equal(isDashboardHostname('ssgunsandammo.com'), false);
  assert.equal(isDashboardHostname('www.ssgunsandammo.com'), false);
  assert.equal(isDashboardHostname('localhost'), false);
  assert.equal(isDashboardHostname('my-preview-123.vercel.app'), false);
  assert.equal(isDashboardHostname(''), false);
  assert.equal(isDashboardHostname(undefined), false);
});

ok('hosts: default host constants match the real production domains', () => {
  assert.equal(DEFAULT_PUBLIC_HOST, 'ssgunsandammo.com');
  assert.equal(DEFAULT_DASHBOARD_HOST, 'dashboard.ssgunsandammo.com');
});

console.log(`\n${passed} checks passed.`);
