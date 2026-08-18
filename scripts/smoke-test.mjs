// Smoke test: shared validation, the draft/publish catalog store, and every
// serverless endpoint invoked directly with mock req/res objects.
// Run: npm run smoke

import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import {
  validateContactLead,
  validateTransferLead,
  validateEmailSignupLead,
  isSpam,
} from '../shared/validation.js';
import {
  validateProduct,
  validateCollection,
  validateBundle,
} from '../shared/catalogValidation.js';
import { SEED_PRODUCTS } from '../shared/catalogSeeds.js';
import { verifyToken } from '../api/_lib/auth.js';
import contactHandler from '../api/leads/contact.js';
import transferHandler from '../api/leads/transfer.js';
import emailSignupHandler from '../api/leads/email-signup.js';
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

// ---- form validation (unchanged from the leads era) ----

ok('contact: valid input passes and is normalized', () => {
  const r = validateContactLead({
    name: '  Jane Doe  ',
    email: 'JANE@Example.com',
    phone: '',
    message: 'Do you carry small-gauge shells?',
  });
  assert.equal(r.ok, true);
  assert.equal(r.data.name, 'Jane Doe');
  assert.equal(r.data.email, 'jane@example.com');
});

ok('contact: missing fields produce per-field errors', () => {
  const r = validateContactLead({ name: '', email: 'nope', message: '' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.name);
  assert.ok(r.errors.email);
  assert.ok(r.errors.message);
});

ok('transfer: requires item description', () => {
  const r = validateTransferLead({
    name: 'A B',
    phone: '6105551234',
    email: 'a@b.co',
    itemDescription: '',
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.itemDescription);
});

ok('email signup: name and email required', () => {
  const r = validateEmailSignupLead({ name: '', email: '' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.name);
  assert.ok(r.errors.email);
});

ok('honeypot: filled company field flags spam', () => {
  assert.equal(isSpam({ company: 'bot inc' }), true);
  assert.equal(isSpam({ company: '' }), false);
});

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

  // ---- public forms -> Web3Forms ----

  res = await call(contactHandler, { body: { company: 'bot' } });
  assert.equal(res.statusCode, 200);
  ok('forms: honeypot answers success and forwards nothing', () => {});

  res = await call(contactHandler, { body: { name: '', email: 'x', message: '' } });
  assert.equal(res.statusCode, 422);
  ok('forms: invalid input returns 422 with field errors', () => {});

  delete process.env.WEB3FORMS_ACCESS_KEY;
  res = await call(contactHandler, {
    body: { name: 'Jane', email: 'j@x.co', message: 'Hello there' },
  });
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.setup, true);
  ok('forms: no access key returns graceful 503 setup message', () => {});

  process.env.WEB3FORMS_ACCESS_KEY = 'test-key-123';
  const originalFetch = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, options) => {
    captured = { url, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ success: true }) };
  };
  res = await call(transferHandler, {
    body: {
      name: 'Jane',
      phone: '6105551234',
      email: 'j@x.co',
      itemDescription: 'DEMO rifle from an online seller',
    },
  });
  globalThis.fetch = originalFetch;
  delete process.env.WEB3FORMS_ACCESS_KEY;
  assert.equal(res.statusCode, 201);
  assert.equal(captured.url, 'https://api.web3forms.com/submit');
  assert.equal(captured.body.access_key, 'test-key-123');
  assert.equal(captured.body.form_type, 'transfer');
  assert.ok(captured.body.subject.includes('transfer'));
  assert.equal(captured.body.name, 'Jane');
  ok('forms: with key, submission hits Web3Forms with the right shape', () => {});

  res = await call(emailSignupHandler, { method: 'GET' });
  assert.equal(res.statusCode, 405);
  ok('forms: unsupported method returns 405', () => {});

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

console.log(`\n${passed} checks passed.`);
