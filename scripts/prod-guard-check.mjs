// Verifies the production loud-failure guarantee by simulating a Vercel
// deployment with NO database configured (the smoke suite spawns this with
// VERCEL=1 and neither DATABASE_MONGODB_URI nor MONGODB_URI set). Every
// store-backed endpoint must answer 503 with the exact configuration
// error, and the health endpoint must report the broken state, so a
// misconfigured deployment can never silently lose the owner's saves
// again.
//
// Prints a JSON report to stdout; exits 0 only if every expectation holds.

delete process.env.DATABASE_MONGODB_URI;
delete process.env.MONGODB_URI;
process.env.VERCEL = process.env.VERCEL || '1';

const { default: loginHandler } = await import('../api/admin/login.js');
const { default: inventoryHandler } = await import('../api/inventory/index.js');
const { default: publishHandler } = await import('../api/admin/publish.js');
const { default: productsHandler } = await import('../api/admin/products.js');
const { default: salesHandler } = await import('../api/admin/sales.js');
const { default: healthHandler } = await import('../api/admin/health.js');
const { default: imageHandler } = await import('../api/admin/inventory-image.js');

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    end(payload) {
      try {
        this.body = payload ? JSON.parse(payload) : null;
      } catch {
        this.body = null;
      }
    },
  };
}

async function call(handler, options) {
  const res = mockRes();
  await handler({ method: 'GET', url: '/', body: undefined, headers: {}, ...options }, res);
  return res;
}

// Login does not touch the store, so it still works; use it for auth.
const loginRes = await call(loginHandler, { method: 'POST', body: { password: 'oxford' } });
const auth = { authorization: `Bearer ${loginRes.body?.token}` };

const results = {};
let failed = 0;
function expect(name, condition, detail) {
  results[name] = condition ? 'ok' : `FAIL ${detail}`;
  if (!condition) failed += 1;
}

const inv = await call(inventoryHandler, { url: '/api/inventory' });
expect(
  'public inventory 503 + message',
  inv.statusCode === 503 &&
    inv.body?.code === 'DB_NOT_CONFIGURED' &&
    inv.body?.error === 'Database not configured. Set DATABASE_MONGODB_URI.',
  JSON.stringify({ status: inv.statusCode, body: inv.body })
);

const prod = await call(productsHandler, { url: '/x', headers: auth });
expect('admin products 503', prod.statusCode === 503 && prod.body?.code === 'DB_NOT_CONFIGURED', String(prod.statusCode));

const pub = await call(publishHandler, {
  method: 'POST',
  headers: auth,
  body: { action: 'publish' },
});
expect('publish 503', pub.statusCode === 503 && pub.body?.code === 'DB_NOT_CONFIGURED', String(pub.statusCode));

const sales = await call(salesHandler, { url: '/api/admin/sales', headers: auth });
expect('sales 503', sales.statusCode === 503 && sales.body?.code === 'DB_NOT_CONFIGURED', String(sales.statusCode));

const img = await call(imageHandler, {
  method: 'POST',
  headers: auth,
  body: { filename: 'x.jpg', dataUrl: 'data:image/jpeg;base64,AAAA' },
});
expect(
  'image upload 503 without Cloudinary in production',
  img.statusCode === 503 && img.body?.code === 'IMAGE_STORAGE_NOT_CONFIGURED',
  JSON.stringify({ status: img.statusCode, body: img.body })
);

const health = await call(healthHandler, { url: '/api/admin/health', headers: auth });
expect(
  'health reports unconfigured, ok false',
  health.statusCode === 200 &&
    health.body?.ok === false &&
    health.body?.adapter === 'unconfigured' &&
    health.body?.imageStorage === 'unconfigured' &&
    health.body?.runtime === 'production',
  JSON.stringify(health.body)
);
expect(
  'health leaks no secrets',
  !JSON.stringify(health.body).match(/mongodb(\+srv)?:\/\/|cloudinary:\/\/|api_key|secret/i),
  'body contains secret-like content'
);

console.log(JSON.stringify({ failed, results }));
process.exit(failed === 0 ? 0 : 1);
