// Real-browser check for the Owner's Dashboard Hours page Save bar and the
// bottom tab bar it must never hide behind. Asserts what a person can see
// and tap, not what is in the DOM:
//
//   Layout (4 phone sizes): Save and Discard are inside the viewport, at
//   least 44px, and document.elementFromPoint at each button's center
//   returns that button (not the tab bar); the Save bar sits directly
//   above the tab bar without overlapping it; all five tab labels are on
//   one line and every tab is the same height; --tabbar-h matches the real
//   tab bar; the last content scrolls fully clear of the Save bar; no
//   other fixed or sticky element on any dashboard page overlaps the tab
//   bar.
//
//   Feedback (390x844): Saving... state, the saved confirmation (visible
//   above the tab bar, after the server was asked again), a 503, a 500, a
//   non-JSON 504, an offline network failure and a server that "forgets"
//   the hours each show a plain message above the buttons and keep the
//   unsaved changes (and the owner signed in); a bad time range is caught
//   without any request; a retry after a failure succeeds.
//
// The dashboard is opened at its real hostname
// (dashboard.ssgunsandammo.com, mapped to localhost for Chromium only) so
// the production-only "a failed request is a real failure, never demo
// data" rule is what gets tested, against the real dev-api handlers.
//
// Prints one JSON line at the end: {"failed": N, "results": {...}}.
// Run directly: node scripts/hours-savebar-check.mjs
// Invoked by: npm run smoke.

import { spawn, execSync } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname } from 'node:path';
import { chromium } from 'playwright-core';

const API_PORT = 3995;
const STATIC_PORT = 4193;
const HOST = 'dashboard.ssgunsandammo.com';
const BASE = `http://${HOST}:${STATIC_PORT}`;
const API_BASE = `http://localhost:${API_PORT}`;
const DIST = join(process.cwd(), 'dist');

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

const DB_MESSAGE =
  'The site could not reach its database, so nothing was saved. Try again in a minute. If it keeps happening, text Rob.';
const NETWORK_MESSAGE = 'No connection. Nothing was saved. Try again.';
const SAVED_MESSAGE = 'Hours saved. They are live on your site now.';

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

async function adminLogin() {
  const res = await fetch(`${API_BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'oxford' }),
  }).then((r) => r.json());
  return res.token;
}

const allClosedWeek = () =>
  Array.from({ length: 7 }, (_, day) => ({ day, open: false, opens: null, closes: null }));

// Known starting point for every scenario: every day closed, so toggling
// Monday open is always a real change.
async function resetHours(token) {
  await fetch(`${API_BASE}/api/admin/hours`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ weekly: allClosedWeek() }),
  });
}

// Runs one section; if it throws (for example Playwright cannot click a
// button because something is covering it, which is exactly the bug this
// check exists for), that is reported as a failure instead of aborting the
// whole run before the other results are printed.
async function guarded(name, fn) {
  try {
    await fn();
  } catch (err) {
    expect(`${name}: completed without the page blocking a tap`, false, String(err?.message || err).split('\n').slice(0, 3).join(' | ').slice(0, 400));
  }
}

async function openHoursPage(browser, token, viewport, tab = 'hours') {
  const context = await browser.newContext({ viewport });
  await context.addInitScript((t) => sessionStorage.setItem('ssga-admin-token', t), token);
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await page.goto(`${BASE}/?tab=${tab}`, { waitUntil: 'networkidle' });
  if (tab === 'hours') await page.waitForSelector('.hp-week-row', { timeout: 10000 });
  await page.waitForTimeout(250);
  return { context, page, pageErrors };
}

// Turn Monday on: a real, visible change, so the Save bar appears.
async function makeDirty(page) {
  await page.click('.hp-week-row:nth-child(2) .hp-switch');
  await page.waitForSelector('.hp-save-bar', { timeout: 5000 });
  await page.waitForTimeout(150);
}

// Runs in the page: where a button is, and what a finger would hit there.
function probe(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const top = document.elementFromPoint(cx, cy);
  return {
    left: r.left, right: r.right, top: r.top, bottom: r.bottom,
    width: r.width, height: r.height,
    inViewport: r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight + 0.5 && r.right <= window.innerWidth + 0.5,
    hit: Boolean(top && el.contains(top)),
    vw: window.innerWidth, vh: window.innerHeight,
  };
}

const rect = (page, selector) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, width: r.width };
  }, selector);

function luminance([r, g, b]) {
  const c = [r, g, b].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const parseRgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);

await cleanData();
console.error('building...');
execSync('npm run build', { stdio: 'ignore' });
const devApi = await startDevApi();
const staticServer = await startStaticProxy();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`],
});
console.error('chromium launched');

try {
  const token = await adminLogin();

  // ================= Layout, four phone sizes =================
  const SIZES = [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 360, height: 640 },
  ];
  for (const size of SIZES) await guarded(`${size.width}x${size.height}`, async () => {
    const tag = `${size.width}x${size.height}`;
    await resetHours(token);
    const { context, page, pageErrors } = await openHoursPage(browser, token, size);
    await makeDirty(page);

    const save = await page.evaluate(probe, '.hp-save-btn-main');
    const discard = await page.evaluate(probe, '.hp-save-bar-actions .btn-secondary');
    for (const [label, b] of [['Save', save], ['Discard', discard]]) {
      expect(`${tag}: ${label} is inside the viewport`, Boolean(b?.inViewport), JSON.stringify(b));
      expect(`${tag}: ${label} is at least 44px tall and wide`, Boolean(b && b.height >= 44 && b.width >= 44), JSON.stringify(b));
      expect(`${tag}: a tap at the center of ${label} lands on ${label}, not the tab bar`, Boolean(b?.hit), JSON.stringify(b));
    }

    const dock = await rect(page, '.hp-dock');
    const bar = await rect(page, '.admin-tabbar');
    expect(`${tag}: the Save bar and the tab bar do not overlap`, Boolean(dock && bar && dock.bottom <= bar.top + 0.5), JSON.stringify({ dock, bar }));
    expect(`${tag}: the Save bar sits directly above the tab bar`, Boolean(dock && bar && Math.abs(dock.bottom - bar.top) <= 1), JSON.stringify({ dock, bar }));
    expect(`${tag}: the tab bar is pinned to the bottom of the screen`, Boolean(bar && Math.abs(bar.bottom - size.height) <= 1), JSON.stringify(bar));

    const tabs = await page.evaluate(() => {
      const root = document.querySelector('.admin-app');
      const nav = document.querySelector('.admin-tabbar');
      const items = [...document.querySelectorAll('.admin-tab')].map((tab) => {
        const span = tab.querySelector('span');
        const cs = getComputedStyle(span);
        const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
        const t = tab.getBoundingClientRect();
        const s = span.getBoundingClientRect();
        return {
          label: span.textContent,
          oneLine: s.height <= lineHeight * 1.2,
          fits: s.width <= t.width + 0.5,
          tabHeight: t.height,
          tabWidth: t.width,
        };
      });
      return {
        items,
        variable: parseFloat(getComputedStyle(root).getPropertyValue('--tabbar-h')),
        navHeight: nav.getBoundingClientRect().height,
      };
    });
    expect(`${tag}: five tabs`, tabs.items.length === 5, `found ${tabs.items.length}`);
    expect(
      `${tag}: every tab label is on one line and fits its tab`,
      tabs.items.every((t) => t.oneLine && t.fits),
      JSON.stringify(tabs.items.filter((t) => !t.oneLine || !t.fits))
    );
    expect(
      `${tag}: every tab is the same height and at least 44px`,
      new Set(tabs.items.map((t) => Math.round(t.tabHeight))).size === 1 && tabs.items.every((t) => t.tabHeight >= 44 && t.tabWidth >= 44),
      JSON.stringify(tabs.items.map((t) => [t.label, t.tabHeight, t.tabWidth]))
    );
    expect(`${tag}: --tabbar-h equals the real tab bar height`, Math.abs(tabs.variable - tabs.navHeight) <= 0.5, JSON.stringify({ variable: tabs.variable, navHeight: tabs.navHeight }));

    // Scroll all the way down (instantly: the site uses smooth scrolling, which
    // would still be animating when we measure): the last card has to clear the Save bar.
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await page.waitForTimeout(200);
    const lastCard = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.hp-body > .hp-card')];
      const r = cards[cards.length - 1].getBoundingClientRect();
      return { bottom: r.bottom };
    });
    const dockAtBottom = await rect(page, '.hp-dock');
    expect(
      `${tag}: scrolled to the end, the last content ends above the Save bar`,
      lastCard.bottom <= dockAtBottom.top + 0.5,
      JSON.stringify({ lastCard, dockAtBottom })
    );
    // The last day row (Saturday) can be brought fully above the Save bar.
    await page.evaluate(() => document.querySelector('.hp-week-row:last-child').scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(150);
    const lastRow = await rect(page, '.hp-week-row:last-child');
    const dockNow = await rect(page, '.hp-dock');
    expect(
      `${tag}: the last day row scrolls fully above the Save bar`,
      lastRow.bottom <= dockNow.top + 0.5 && lastRow.top >= 0,
      JSON.stringify({ lastRow, dockNow })
    );

    if (size.width === 390) {
      const meta = await page.evaluate(() => document.querySelector('meta[name="viewport"]').getAttribute('content'));
      expect('the dashboard asks for viewport-fit=cover', /viewport-fit=cover/.test(meta), meta);
    }
    expect(`${tag}: no JS errors`, pageErrors.length === 0, pageErrors.join(' | '));
    await context.close();
  });

  // ===== No fixed or sticky element on any dashboard page overlaps the tab bar =====
  for (const tab of ['overview', 'products', 'sales', 'hours', 'history']) await guarded(`dashboard "${tab}" page`, async () => {
    await resetHours(token);
    const { context, page } = await openHoursPage(browser, token, { width: 375, height: 667 }, tab === 'overview' ? '' : tab);
    if (tab === 'hours') await makeDirty(page);
    await page.waitForTimeout(200);
    const hits = await page.evaluate(() => {
      const bar = document.querySelector('.admin-tabbar');
      const br = bar.getBoundingClientRect();
      const found = [];
      for (const el of document.querySelectorAll('body *')) {
        if (bar.contains(el)) continue;
        const cs = getComputedStyle(el);
        if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const overlap = Math.min(r.bottom, br.bottom) - Math.max(r.top, br.top);
        if (overlap > 1 && r.left < br.right && r.right > br.left) found.push(el.className || el.tagName);
      }
      return found;
    });
    expect(`dashboard "${tab}" page: no fixed or sticky element is hidden behind the tab bar`, hits.length === 0, hits.join(', '));
    await context.close();
  });

  // ================= The Closed switch looks like a switch =================
  await guarded('Closed switch', async () => {
    await resetHours(token);
    const { context, page } = await openHoursPage(browser, token, { width: 390, height: 844 });
    const colors = await page.evaluate(() => {
      const sw = document.querySelector('.hp-week-row:nth-child(2) .hp-switch');
      const card = document.querySelector('.hp-card');
      return {
        track: getComputedStyle(sw).backgroundColor,
        card: getComputedStyle(card).backgroundColor,
        pressed: sw.getAttribute('aria-checked'),
        word: document.querySelector('.hp-week-row:nth-child(2) .hp-week-status').textContent,
        w: sw.getBoundingClientRect().width,
        h: sw.getBoundingClientRect().height,
      };
    });
    const ratio = contrast(parseRgb(colors.track), parseRgb(colors.card));
    expect('Closed switch: the track is a filled color with at least 3:1 contrast against the card', ratio >= 3, `ratio ${ratio.toFixed(2)} track ${colors.track} card ${colors.card}`);
    expect('Closed switch: the state is also written out as the word Closed', colors.word === 'Closed' && colors.pressed === 'false', JSON.stringify(colors));
    expect('Closed switch: the target is at least 44px', colors.h >= 44 && colors.w >= 44, JSON.stringify(colors));
    await context.close();
  });

  // ================= Feedback, 390x844 on the real dashboard host =================
  const PHONE = { width: 390, height: 844 };
  const saveBtn = '.hp-save-btn-main';

  async function scenario(name, setup, assertions) {
    await guarded(name, async () => {
      await resetHours(token);
      const { context, page, pageErrors } = await openHoursPage(browser, token, PHONE);
      const seen = { puts: 0, gets: 0 };
      await page.route(/\/api\/admin\/hours$/, async (route) => {
        const method = route.request().method();
        if (method === 'PUT') seen.puts += 1;
        if (method === 'GET') seen.gets += 1;
        return setup ? setup(route, method, seen) : route.continue();
      });
      await makeDirty(page);
      seen.puts = 0;
      seen.gets = 0;
      await assertions(page, seen);
      expect(`${name}: no JS errors`, pageErrors.length === 0, pageErrors.join(' | '));
      await context.close();
    });
  }

  async function expectFailureShown(name, page, message) {
    await page.click(saveBtn);
    await page.waitForSelector('.hp-save-bar-error', { timeout: 8000 });
    await page.waitForTimeout(150);
    const text = await page.evaluate(() => document.querySelector('.hp-save-bar-error').textContent.trim());
    expect(`${name}: the owner sees the plain message`, text === message, JSON.stringify(text));
    expect(`${name}: no raw error text or codes shown`, !/DATABASE_MONGODB_URI|DB_NOT_CONFIGURED|50\d|Error|undefined/.test(text), text);
    const err = await rect(page, '.hp-save-bar-error');
    const btn = await rect(page, saveBtn);
    const bar = await rect(page, '.admin-tabbar');
    expect(`${name}: the message is above the buttons and above the tab bar, on screen`, Boolean(err && btn && err.bottom <= btn.top + 0.5 && err.top >= 0 && err.bottom <= bar.top), JSON.stringify({ err, btn, bar }));
    expect(`${name}: the unsaved changes are kept and the bar stays open`, await page.evaluate(() => Boolean(document.querySelector('.hp-save-bar')) && document.querySelector('.hp-week-row:nth-child(2) .hp-switch').getAttribute('aria-checked') === 'true'));
    expect(`${name}: the owner is still signed in`, await page.evaluate(() => !document.querySelector('input[type="password"]')));
    expect(`${name}: Save works again (not stuck on Saving...)`, await page.evaluate((s) => { const b = document.querySelector(s); return !b.disabled && b.textContent.trim() === 'Save'; }, saveBtn));
  }

  await scenario('Saving state', async (route, method) => {
    if (method === 'PUT') await new Promise((r) => setTimeout(r, 900));
    return route.continue();
  }, async (page) => {
    await page.click(saveBtn);
    await page.waitForTimeout(250);
    const state = await page.evaluate((s) => { const b = document.querySelector(s); return { text: b.textContent.trim(), disabled: b.disabled }; }, saveBtn);
    expect('Saving state: the button says Saving... and is disabled', state.text === 'Saving...' && state.disabled, JSON.stringify(state));
  });

  await scenario('Successful save', null, async (page, seen) => {
    await page.click(saveBtn);
    await page.waitForSelector('.hp-flash', { timeout: 8000 });
    await page.waitForTimeout(150);
    const text = await page.evaluate(() => document.querySelector('.hp-flash').textContent.trim());
    expect('Successful save: the confirmation says the hours are live', text === SAVED_MESSAGE, JSON.stringify(text));
    const flash = await rect(page, '.hp-flash');
    const bar = await rect(page, '.admin-tabbar');
    expect('Successful save: the confirmation is on screen, above the tab bar', Boolean(flash && flash.top >= 0 && flash.bottom <= bar.top + 0.5), JSON.stringify({ flash, bar }));
    expect('Successful save: the server was asked for the hours again to confirm', seen.puts === 1 && seen.gets >= 1, JSON.stringify(seen));
    expect('Successful save: the unsaved bar is gone', await page.evaluate(() => !document.querySelector('.hp-save-bar')));
    await page.waitForTimeout(5400);
    expect('Successful save: the confirmation clears after a few seconds', await page.evaluate(() => !document.querySelector('.hp-flash')));
  });

  await scenario('503 database not configured', (route, method) =>
    method === 'PUT'
      ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'DB_NOT_CONFIGURED', error: 'Database not configured. Set DATABASE_MONGODB_URI.' }) })
      : route.continue(),
  (page) => expectFailureShown('503 database not configured', page, DB_MESSAGE));

  await scenario('500 server error', (route, method) =>
    method === 'PUT'
      ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Something went wrong on the server. Try again.' }) })
      : route.continue(),
  (page) => expectFailureShown('500 server error', page, DB_MESSAGE));

  await scenario('Platform timeout page (not JSON)', (route, method) =>
    method === 'PUT'
      ? route.fulfill({ status: 504, contentType: 'text/html', body: '<html><body>An error occurred with your deployment</body></html>' })
      : route.continue(),
  (page) => expectFailureShown('Platform timeout page (not JSON)', page, DB_MESSAGE));

  await scenario('Offline', (route, method) => (method === 'PUT' ? route.abort('internetdisconnected') : route.continue()),
  (page) => expectFailureShown('Offline', page, NETWORK_MESSAGE));

  await scenario('Server forgets the hours', (route, method) =>
    method === 'GET'
      ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, configured: true, timezone: 'America/New_York', weekly: allClosedWeek(), closures: [] }) })
      : route.continue(),
  (page) => expectFailureShown('Server forgets the hours', page, DB_MESSAGE));

  await scenario('Bad time range', null, async (page, seen) => {
    await page.selectOption('.hp-week-row:nth-child(2) .hp-time-field:nth-child(2) select', '06:00');
    await page.click(saveBtn);
    await page.waitForSelector('.hp-week-error', { timeout: 4000 });
    const rowText = await page.evaluate(() => document.querySelector('.hp-week-error').textContent.trim());
    expect('Bad time range: the row says closing has to be after opening', rowText === 'Closing time has to be after opening time.', JSON.stringify(rowText));
    const summary = await page.evaluate(() => document.querySelector('.hp-save-bar-error')?.textContent.trim());
    expect('Bad time range: a plain message sits above the buttons too', Boolean(summary && summary.includes('Check the days marked below')), JSON.stringify(summary));
    expect('Bad time range: nothing was sent to the server', seen.puts === 0, JSON.stringify(seen));
  });

  // A failure, then a retry that works, in one visit.
  await guarded('Retry after a failure', async () => {
    await resetHours(token);
    const { context, page, pageErrors } = await openHoursPage(browser, token, PHONE);
    let failNext = true;
    await page.route(/\/api\/admin\/hours$/, (route) => {
      if (route.request().method() === 'PUT' && failNext) {
        failNext = false;
        return route.abort('internetdisconnected');
      }
      return route.continue();
    });
    await makeDirty(page);
    await page.click(saveBtn);
    await page.waitForSelector('.hp-save-bar-error', { timeout: 8000 });
    await page.click(saveBtn);
    await page.waitForSelector('.hp-flash', { timeout: 8000 });
    expect('Retry after a failure: it saves, and the old error message is gone', await page.evaluate(() => !document.querySelector('.hp-save-bar-error') && !document.querySelector('.hp-save-bar')));
    expect('Retry after a failure: no JS errors', pageErrors.length === 0, pageErrors.join(' | '));
    await context.close();
  });
} finally {
  await browser.close();
  staticServer.close();
  devApi.kill();
  await cleanData();
}

console.log(JSON.stringify({ failed, results }));
process.exit(failed === 0 ? 0 : 1);
