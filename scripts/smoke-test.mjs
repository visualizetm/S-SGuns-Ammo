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
import { tokenForPassword } from '../api/_lib/auth.js';
import contactHandler from '../api/leads/contact.js';
import transferHandler from '../api/leads/transfer.js';
import emailSignupHandler from '../api/leads/email-signup.js';
import loginHandler from '../api/admin/login.js';
import adminLeadsHandler from '../api/admin/leads.js';

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
  assert.equal(token, tokenForPassword('oxford-demo'));
  ok('admin login: demo password returns token', () => {});

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
})();

console.log(`\n${passed} checks passed.`);
