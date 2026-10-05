// Renders the public Inventory page in a real browser, twice: once with
// zero published products (the designed empty state must be reachable and
// actually visible) and once with a published product (the grid must
// actually render a card, and it must actually be visible, not just
// present in the DOM). Exists because a page can have correct markup in
// the DOM and still show nothing to a visitor, e.g. a reveal/stagger
// animation class left at opacity:0 forever, or a swallowed JS error, and
// a DOM presence check alone would miss both.
//
// Builds the site, runs a local API server (the same handlers Vercel
// runs) and a static+API proxy that mirrors Vercel's own routing (static
// files, then /api/*, then the SPA rewrite), then drives Chromium through
// both scenarios.
//
// Prints one JSON line at the end: {"failed": N, "results": {...}}.
// Run directly: node scripts/inventory-render-check.mjs
// Invoked by: npm run smoke (scripts/smoke-test.mjs spawns this as a
// child process so it starts from, and leaves, an empty dev store).

import { spawn, execSync } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname } from 'node:path';
import { chromium } from 'playwright-core';

const API_PORT = 3998;
const STATIC_PORT = 4190;
const BASE = `http://localhost:${STATIC_PORT}`;
const API_BASE = `http://localhost:${API_PORT}`;
const DIST = join(process.cwd(), 'dist');

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

const results = {};
let failed = 0;
function expect(name, condition, detail) {
  results[name] = condition ? 'ok' : `FAIL ${detail ?? ''}`;
  if (!condition) failed += 1;
}

async function cleanData() {
  await rm('.data', { recursive: true, force: true });
}

function startDevApi() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/dev-api.mjs'], {
      env: { ...process.env, PORT: String(API_PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => reject(new Error('dev-api did not start')), 15000);
    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('listening')) {
        clearTimeout(timer);
        resolve(child);
      }
    });
    child.on('exit', (code) => {
      if (code !== null && code !== 0) reject(new Error(`dev-api exited: ${code}`));
    });
  });
}

// Static file server + API proxy, mirroring Vercel's own routing (static
// files first, then /api/*, then the SPA rewrite for everything else) so
// the real GET /api/inventory code path is exercised, not a demo-mode
// fallback (vite preview alone has no serverless functions to hit).
function startStaticProxy() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      if (req.url.startsWith('/api/')) {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const body = Buffer.concat(chunks);
        const upstream = await fetch(API_BASE + req.url, {
          method: req.method,
          headers: { ...req.headers, host: undefined },
          body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
        });
        res.statusCode = upstream.status;
        upstream.headers.forEach((v, k) => {
          if (k !== 'content-encoding') res.setHeader(k, v);
        });
        res.end(Buffer.from(await upstream.arrayBuffer()));
        return;
      }
      let filePath = join(DIST, req.url.split('?')[0]);
      if (req.url === '/' || !existsSync(filePath) || filePath.endsWith('/')) {
        filePath = join(DIST, 'index.html');
      }
      try {
        const data = await readFile(filePath);
        res.setHeader('Content-Type', MIME[extname(filePath)] || 'application/octet-stream');
        res.end(data);
      } catch {
        const data = await readFile(join(DIST, 'index.html'));
        res.setHeader('Content-Type', 'text/html');
        res.end(data);
      }
    });
    server.listen(STATIC_PORT, () => resolve(server));
  });
}

async function publishOneProduct() {
  const loginRes = await fetch(`${API_BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'oxford' }),
  }).then((r) => r.json());
  const token = loginRes.token;
  await fetch(`${API_BASE}/api/admin/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: 'Render Check Rifle',
      manufacturer: 'Check Arms',
      model: 'C-1',
      caliber: '.308',
      condition: 'New',
      price: 599,
      stockStatus: 'In Stock',
      description: 'Inventory render check fixture',
      collectionIds: [],
      photos: [],
    }),
  });
  await fetch(`${API_BASE}/api/admin/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'publish' }),
  });
}

async function isVisible(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return (
      Number(style.opacity) > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      rect.width > 0 &&
      rect.height > 0
    );
  }, selector);
}

await cleanData();
console.error('building...');
execSync('npm run build', { stdio: 'ignore' });
console.error('build done, starting dev-api...');

const devApi = await startDevApi();
console.error('dev-api up, starting static proxy...');
const staticServer = await startStaticProxy();
console.error('static proxy up, launching chromium...');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
});
console.error('chromium launched');

try {
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('CERT') && !msg.text().includes('TUNNEL')) {
      consoleErrors.push(msg.text());
    }
  });

  // ---- Scenario 1: zero published products ----
  await page.goto(`${BASE}/inventory`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const emptyText = await page.evaluate(() => document.querySelector('.cat-empty-state')?.textContent || '');
  expect(
    'inventory: designed empty state renders with zero published products',
    emptyText.includes('online list is being stocked'),
    `empty-state text was: ${JSON.stringify(emptyText)}`
  );
  const emptyVisible = await isVisible(page, '.cat-empty-state');
  expect(
    'inventory: the empty state is actually visible, not just present in the DOM',
    emptyVisible === true,
    `isVisible returned ${emptyVisible}`
  );

  // ---- Scenario 2: a published product exists ----
  await publishOneProduct();
  await page.goto(`${BASE}/inventory`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const cardCount = await page.evaluate(() => document.querySelectorAll('.pc-card').length);
  expect('inventory: a published product renders a product card', cardCount > 0, `found ${cardCount} cards`);
  const cardVisible = cardCount > 0 ? await isVisible(page, '.pc-card') : false;
  expect(
    'inventory: the product card is actually visible, not just present in the DOM',
    cardVisible === true,
    `isVisible returned ${cardVisible}`
  );

  expect('inventory: no JS console/page errors during either render', consoleErrors.length === 0, consoleErrors.join(' | '));
} finally {
  await browser.close();
  staticServer.close();
  devApi.kill();
  await cleanData();
}

console.log(JSON.stringify({ failed, results }));
process.exit(failed === 0 ? 0 : 1);
