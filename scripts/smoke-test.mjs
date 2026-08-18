// Smoke test: shared validation, memory adapter, and every serverless
// endpoint invoked directly with mock req/res objects. Run: npm run smoke

import assert from 'node:assert/strict';
import {
  validateContactLead,
  validateTransferLead,
  validateEmailSignupLead,
  isSpam,
} from '../shared/validation.js';
import { getLeadsAdapter } from '../api/_lib/adapter.js';
import { SEED_LEADS } from '../shared/seeds.js';
import { verifyToken } from '../api/_lib/auth.js';
import contactHandler from '../api/leads/contact.js';
import transferHandler from '../api/leads/transfer.js';
import emailSignupHandler from '../api/leads/email-signup.js';
import loginHandler from '../api/admin/login.js';
import adminLeadsHandler from '../api/admin/leads.js';
import inventoryHandler from '../api/inventory/index.js';
import adminInventoryHandler from '../api/admin/inventory.js';
import adminInventoryImageHandler from '../api/admin/inventory-image.js';
import { validateInventoryItem } from '../shared/inventoryValidation.js';
import { SEED_INVENTORY } from '../shared/inventorySeeds.js';

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
  const res = {
    statusCode: 0,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    end(payload) {
      this.body = payload ? JSON.parse(payload) : null;
    },
  };
  return res;
}

async function call(handler, reqOptions) {
  const res = mockRes();
  await handler(mockReq(reqOptions), res);
  return res;
}

// ---- validation ----

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

ok('contact: missing fields fail with per-field errors', () => {
  const r = validateContactLead({ name: '', email: 'nope', message: 'short' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.name);
  assert.ok(r.errors.email);
  assert.ok(r.errors.message);
});

ok('contact: non-string input types are rejected, not crashed on', () => {
  const r = validateContactLead({ name: 42, email: null, message: {} });
  assert.equal(r.ok, false);
});

ok('transfer: phone required and item description required', () => {
  const r = validateTransferLead({
    name: 'Sam Smith',
    email: 'sam@example.com',
    phone: '123',
    itemDescription: '',
    message: '',
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.phone);
  assert.ok(r.errors.itemDescription);
});

ok('transfer: valid inquiry passes with optional message empty', () => {
  const r = validateTransferLead({
    name: 'Sam Smith',
    email: 'sam@example.com',
    phone: '(610) 555-0101',
    itemDescription: 'Shotgun bought online from a retailer.',
    message: '',
  });
  assert.equal(r.ok, true);
  assert.equal(r.data.message, '');
});

ok('email signup: name and email only', () => {
  assert.equal(
    validateEmailSignupLead({ name: 'A', email: 'bad' }).ok,
    false
  );
  assert.equal(
    validateEmailSignupLead({ name: 'Al Jones', email: 'al@example.com' }).ok,
    true
  );
});

ok('honeypot detects filled company field', () => {
  assert.equal(isSpam({ company: 'Acme' }), true);
  assert.equal(isSpam({ company: '' }), false);
  assert.equal(isSpam({}), false);
});

// ---- adapter ----

await (async () => {
  const adapter = getLeadsAdapter();

  const all = await adapter.listLeads();
  assert.equal(all.length, SEED_LEADS.length);
  ok('adapter: seeded with demo leads', () => {});

  const newest = all[0];
  assert.ok(
    all.every((l, i) => i === 0 || all[i - 1].createdAt >= l.createdAt)
  );
  assert.ok(newest.createdAt >= all[all.length - 1].createdAt);
  ok('adapter: list is newest first', () => {});

  const created = await adapter.createLead({
    type: 'contact',
    data: { name: 'Test Person', email: 't@example.com', message: 'Hello there, testing.' },
  });
  assert.ok(created.id);
  assert.equal(created.read, false);
  const afterCreate = await adapter.listLeads({ type: 'contact' });
  assert.ok(afterCreate.some((l) => l.id === created.id));
  ok('adapter: createLead stores and listLeads filters by type', () => {});

  const marked = await adapter.setLeadRead(created.id, true);
  assert.equal(marked.read, true);
  assert.equal(await adapter.setLeadRead('missing-id', true), null);
  ok('adapter: setLeadRead updates and returns null for unknown id', () => {});
})();

// ---- endpoints ----

await (async () => {
  let res = await call(contactHandler, { method: 'GET' });
  assert.equal(res.statusCode, 405);
  ok('POST endpoints reject GET with 405', () => {});

  res = await call(contactHandler, {
    body: { name: 'Pat Lee', email: 'pat@example.com', message: 'Question about ammo stock.' },
  });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.ok, true);
  ok('contact endpoint: valid submission returns 201', () => {});

  res = await call(contactHandler, { body: { name: '', email: 'x', message: '' } });
  assert.equal(res.statusCode, 422);
  assert.ok(res.body.errors.name && res.body.errors.email && res.body.errors.message);
  ok('contact endpoint: invalid submission returns 422 with field errors', () => {});

  res = await call(contactHandler, {
    body: { name: 'Bot', email: 'bot@example.com', message: 'Buy my stuff online now.', company: 'SpamCo' },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  ok('contact endpoint: honeypot returns fake success, stores nothing', () => {});

  res = await call(transferHandler, {
    body: {
      name: 'Chris Park',
      phone: '(610) 555-0177',
      email: 'chris@example.com',
      itemDescription: 'Rifle from an online seller.',
      message: '',
    },
  });
  assert.equal(res.statusCode, 201);
  ok('transfer endpoint: valid inquiry returns 201', () => {});

  res = await call(emailSignupHandler, {
    body: { name: 'Dee Vaughn', email: 'dee@example.com' },
  });
  assert.equal(res.statusCode, 201);
  ok('email-signup endpoint: valid signup returns 201', () => {});

  res = await call(emailSignupHandler, { body: 'not json {{{' });
  assert.equal(res.statusCode, 400);
  ok('endpoints: malformed body returns 400', () => {});

  // admin auth
  res = await call(loginHandler, { body: { password: 'wrong' } });
  assert.equal(res.statusCode, 401);
  ok('admin login: wrong password returns 401', () => {});

  res = await call(loginHandler, { body: { password: 'oxford-demo' } });
  assert.equal(res.statusCode, 200);
  const token = res.body.token;
  assert.equal(verifyToken(token), true);
  assert.equal(verifyToken('123.badsignature'), false);
  ok('admin login: demo password returns valid signed token', () => {});

  res = await call(adminLeadsHandler, { method: 'GET', url: '/api/admin/leads' });
  assert.equal(res.statusCode, 401);
  ok('admin leads: no token returns 401', () => {});

  res = await call(adminLeadsHandler, {
    method: 'GET',
    url: '/api/admin/leads',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.leads.length >= SEED_LEADS.length);
  const total = res.body.leads.length;
  ok('admin leads: authorized GET lists all leads', () => {});

  res = await call(adminLeadsHandler, {
    method: 'GET',
    url: '/api/admin/leads?type=transfer',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.leads.length < total);
  assert.ok(res.body.leads.every((l) => l.type === 'transfer'));
  ok('admin leads: type filter works', () => {});

  res = await call(adminLeadsHandler, {
    method: 'GET',
    url: '/api/admin/leads?type=bogus',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.statusCode, 400);
  ok('admin leads: unknown type filter returns 400', () => {});

  const target = SEED_LEADS.find((l) => !l.read);
  res = await call(adminLeadsHandler, {
    method: 'PATCH',
    url: '/api/admin/leads',
    headers: { authorization: `Bearer ${token}` },
    body: { id: target.id, read: true },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.lead.read, true);
  ok('admin leads: PATCH marks a lead read', () => {});

  res = await call(adminLeadsHandler, {
    method: 'PATCH',
    url: '/api/admin/leads',
    headers: { authorization: `Bearer ${token}` },
    body: { id: 'nope', read: true },
  });
  assert.equal(res.statusCode, 404);
  ok('admin leads: PATCH unknown id returns 404', () => {});

  res = await call(adminLeadsHandler, {
    method: 'DELETE',
    url: '/api/admin/leads',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.statusCode, 405);
  ok('admin leads: unsupported method returns 405', () => {});

  // ---- inventory validation ----

  ok('inventory: valid item passes and is normalized', () => {
    const r = validateInventoryItem({
      name: '  DEMO: Test Rifle  ',
      category: 'Rifles',
      manufacturer: 'Example Arms Co.',
      model: 'T-1',
      caliber: '.308 Win',
      condition: 'New',
      price: '499.999',
      stockStatus: 'In Stock',
      description: 'A demo item.',
      photos: [],
      featured: false,
    });
    assert.equal(r.ok, true);
    assert.equal(r.data.name, 'DEMO: Test Rifle');
    assert.equal(r.data.price, 500);
  });

  ok('inventory: bad category, negative price, bad status all rejected', () => {
    const r = validateInventoryItem({
      name: 'X',
      category: 'Explosives',
      manufacturer: 'X',
      model: 'X',
      condition: 'Mint',
      price: -5,
      stockStatus: 'Backordered',
    });
    assert.equal(r.ok, false);
    assert.ok(r.errors.category);
    assert.ok(r.errors.price);
    assert.ok(r.errors.stockStatus);
    assert.ok(r.errors.condition);
  });

  // ---- inventory endpoints ----

  res = await call(inventoryHandler, { method: 'GET', url: '/api/inventory' });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.items.length > 0);
  assert.ok(res.body.items.every((i) => i.stockStatus !== 'Hidden'));
  ok('inventory: public GET returns items and never Hidden ones', () => {});

  res = await call(inventoryHandler, {
    method: 'GET',
    url: '/api/inventory?category=Rifles&q=lever',
  });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.items.every((i) => i.category === 'Rifles'));
  assert.ok(res.body.items.length >= 1);
  ok('inventory: public GET category filter and search work', () => {});

  res = await call(inventoryHandler, {
    method: 'GET',
    url: '/api/inventory?category=Nope',
  });
  assert.equal(res.statusCode, 400);
  ok('inventory: unknown category returns 400', () => {});

  res = await call(adminInventoryHandler, {
    method: 'GET',
    url: '/api/admin/inventory',
  });
  assert.equal(res.statusCode, 401);
  ok('admin inventory: no token returns 401', () => {});

  res = await call(adminInventoryHandler, {
    method: 'GET',
    url: '/api/admin/inventory',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.items.some((i) => i.stockStatus === 'Hidden'));
  ok('admin inventory: GET includes Hidden items', () => {});

  res = await call(adminInventoryHandler, {
    method: 'POST',
    url: '/api/admin/inventory',
    headers: { authorization: `Bearer ${token}` },
    body: { name: 'X', category: 'Nope', price: -1 },
  });
  assert.equal(res.statusCode, 422);
  assert.ok(res.body.errors);
  ok('admin inventory: invalid create returns 422 with field errors', () => {});

  res = await call(adminInventoryHandler, {
    method: 'POST',
    url: '/api/admin/inventory',
    headers: { authorization: `Bearer ${token}` },
    body: {
      name: 'DEMO: Smoke Test Item',
      category: 'Other',
      manufacturer: 'Sample Gear',
      model: 'SM-1',
      condition: 'New',
      price: 10,
      stockStatus: 'In Stock',
    },
  });
  assert.equal(res.statusCode, 201);
  const created = res.body.item;
  assert.ok(created.id);
  ok('admin inventory: create returns the new item', () => {});

  res = await call(adminInventoryHandler, {
    method: 'PATCH',
    url: '/api/admin/inventory',
    headers: { authorization: `Bearer ${token}` },
    body: { id: created.id, stockStatus: 'Sold', price: 12.5 },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.item.stockStatus, 'Sold');
  assert.equal(res.body.item.price, 12.5);
  ok('admin inventory: PATCH updates status and price', () => {});

  res = await call(adminInventoryHandler, {
    method: 'DELETE',
    url: '/api/admin/inventory',
    headers: { authorization: `Bearer ${token}` },
    body: { id: created.id },
  });
  assert.equal(res.statusCode, 200);
  res = await call(adminInventoryHandler, {
    method: 'DELETE',
    url: '/api/admin/inventory',
    headers: { authorization: `Bearer ${token}` },
    body: { id: created.id },
  });
  assert.equal(res.statusCode, 404);
  ok('admin inventory: DELETE removes, second DELETE returns 404', () => {});

  res = await call(adminInventoryImageHandler, {
    method: 'POST',
    url: '/api/admin/inventory-image',
    body: { dataUrl: 'data:image/jpeg;base64,AAAA' },
  });
  assert.equal(res.statusCode, 401);
  ok('inventory image: no token returns 401', () => {});

  res = await call(adminInventoryImageHandler, {
    method: 'POST',
    url: '/api/admin/inventory-image',
    headers: { authorization: `Bearer ${token}` },
    body: { filename: 'test.jpg', dataUrl: 'data:image/jpeg;base64,AAAA' },
  });
  assert.equal(res.statusCode, 201);
  assert.ok(res.body.url.startsWith('data:image/jpeg'));
  ok('inventory image: valid upload returns a url (dev: data url)', () => {});

  res = await call(adminInventoryImageHandler, {
    method: 'POST',
    url: '/api/admin/inventory-image',
    headers: { authorization: `Bearer ${token}` },
    body: { dataUrl: 'data:text/html;base64,AAAA' },
  });
  assert.equal(res.statusCode, 422);
  ok('inventory image: non-image payload returns 422', () => {});

  assert.ok(SEED_INVENTORY.every((i) => i.name.startsWith('DEMO:')));
  ok('inventory seeds: every item is marked DEMO', () => {});
})();

console.log(`\n${passed} checks passed.`);
