// Renders the public Contact page in a real browser, once per shop-hours
// state, with the real serverless handlers behind it (the same dev-api
// Vercel-equivalent routing as scripts/inventory-render-check.mjs) and the
// browser's own clock frozen to a specific instant, so "is the shop open
// right now" is deterministic instead of depending on when this script
// happens to run. Asserts computed visibility, not just DOM presence, for
// every state the public site must get right:
//
//   never configured   -> shows today's real, already-confirmed hours
//                          (src/content/siteFacts.js), not an invented
//                          placeholder; launch behavior never regresses.
//   configured, open    -> compact status says "Open now..."
//   configured, closed  -> compact status says "Closed right now..."
//   active closure      -> ClosureBar shows the active (no-dismiss) notice
//                          and ShopHours reflects the closure, not regular
//                          hours
//   upcoming closure,
//   inside notice window -> ClosureBar shows a dismissible heads-up while
//                           regular weekly status is untouched (the
//                           closure has not started yet)
//   the GET /api/hours
//   request fails        -> ShopHours falls back to the phone number only,
//                           ClosureBar renders nothing, and the page never
//                           throws a JS error
//
// Prints one JSON line at the end: {"failed": N, "results": {...}}.
// Run directly: node scripts/hours-render-check.mjs
// Invoked by: npm run smoke.

import { spawn, execSync } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname } from 'node:path';
import { chromium } from 'playwright-core';
import { shopDateString, shopClockParts, parseShopDate } from '../shared/hours.js';

const API_PORT = 3997;
const STATIC_PORT = 4191;
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

// Mirrors Vercel's own routing (static files, then /api/*, then the SPA
// rewrite) so the real GET /api/hours code path is exercised.
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

// Mon-Sat 9am-5pm, Sunday closed.
function weeklyFixture() {
  return Array.from({ length: 7 }, (_, day) => ({
    day,
    open: day !== 0,
    opens: day === 0 ? null : '09:00',
    closes: day === 0 ? null : '17:00',
  }));
}

async function saveWeekly(token) {
  await fetch(`${API_BASE}/api/admin/hours`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ weekly: weeklyFixture() }),
  });
}

async function createClosure(token, fields) {
  const body = await fetch(`${API_BASE}/api/admin/closures`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(fields),
  }).then((r) => r.json());
  if (!body.ok) throw new Error(`fixture closure rejected: ${JSON.stringify(body)}`);
  return body.closure.id;
}

async function reopenClosure(token, id) {
  await fetch(`${API_BASE}/api/admin/closures/reopen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id }),
  });
}

// Every test date is an offset from the real instant this script starts,
// not a hardcoded calendar date. The dev-api server's own clock cannot be
// faked (only the browser's can, via Playwright's Clock API below), so
// the closures scenarios need their dates to land on whatever day this
// suite actually runs, or the server's real-time closure filtering in
// api/hours.js would never agree with a faked browser "now".
const ANCHOR = new Date();
const today = shopDateString(ANCHOR);

function addDays(dateStr, days) {
  const d = parseShopDate(dateStr);
  return shopDateString(new Date(d.getTime() + days * 86_400_000));
}

function weekdayOf(dateStr) {
  return parseShopDate(dateStr).getUTCDay();
}

function nextDateWhere(dateStr, matches) {
  let d = dateStr;
  for (let i = 0; i < 8; i++) {
    if (matches(weekdayOf(d))) return d;
    d = addDays(d, 1);
  }
  throw new Error('no matching date found within a week');
}

// The UTC instant for a shop-local date at a shop-local wall-clock time,
// correct across the EST/EDT boundary: a guess assuming EST, corrected by
// however far off that guess reads back through the real IANA timezone
// data (the same lookup shared/hours.js itself uses), never a hardcoded
// offset.
function shopInstant(dateStr, hour, minute = 0) {
  const guess = new Date(new Date(`${dateStr}T00:00:00.000Z`).getTime() + (hour + 5) * 3_600_000 + minute * 60_000);
  const got = shopClockParts(guess);
  const wantMinutes = hour * 60 + minute;
  const gotMinutes = got.hour * 60 + got.minute;
  return new Date(guess.getTime() + (wantMinutes - gotMinutes) * 60_000);
}

const openDateStr = nextDateWhere(today, (w) => w !== 0); // any day but Sunday
const closedDateStr = nextDateWhere(today, (w) => w === 0); // the next Sunday
const upcomingStartDateStr = addDays(openDateStr, 5);

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

async function textOf(page, selector) {
  return page.evaluate((sel) => document.querySelector(sel)?.textContent || '', selector);
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

// A fresh context per scenario so Playwright's fixed clock and any route
// interception from one scenario never leak into the next; the dev-api's
// stored hours/closures DO carry over deliberately (see each scenario's
// comment), the same one settings document the dashboard itself would
// build up over time.
async function freshPage(fakedNow) {
  const context = await browser.newContext();
  if (fakedNow) await context.clock.install({ time: new Date(fakedNow) });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  page.on('console', (msg) => {
    // "Failed to load resource" is Chromium's own devtools-console echo of
    // a non-2xx HTTP response (expected and asserted on directly in the
    // API-failing scenario below, via a deliberate 500), not a JS error
    // the app produced.
    if (
      msg.type() === 'error' &&
      !msg.text().includes('CERT') &&
      !msg.text().includes('TUNNEL') &&
      !msg.text().includes('Failed to load resource')
    ) {
      consoleErrors.push(msg.text());
    }
  });
  return { context, page, consoleErrors };
}

try {
  // ---- Scenario 1: hours never configured ----
  // No PUT has happened yet: the public site must show exactly what it
  // showed before this feature existed (the real, owner-confirmed
  // siteFacts.js data), never an invented placeholder.
  {
    const { context, page, consoleErrors } = await freshPage(shopInstant(openDateStr, 12));
    await page.goto(`${BASE}/contact`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const compactText = await textOf(page, '.sh-compact');
    expect(
      'never configured: compact ShopHours shows the real siteFacts.js summary, not a placeholder',
      compactText.length > 0 && !compactText.includes('Hours not set'),
      `text was: ${JSON.stringify(compactText)}`
    );
    expect('never configured: compact ShopHours is actually visible', (await isVisible(page, '.sh-compact')) === true);
    const closureBarPresent = (await page.evaluate(() => document.querySelectorAll('.clb').length)) > 0;
    expect('never configured: no closure bar renders', !closureBarPresent);
    expect('never configured: no JS errors', consoleErrors.length === 0, consoleErrors.join(' | '));
    await context.close();
  }

  const token = await adminLogin();
  await saveWeekly(token);

  // ---- Scenario 2: configured, open right now ----
  // Noon on a day the weekly schedule has open (any day but Sunday).
  {
    const { context, page, consoleErrors } = await freshPage(shopInstant(openDateStr, 12));
    await page.goto(`${BASE}/contact`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const text = await textOf(page, '.sh-compact');
    expect('open: compact ShopHours says open now', text.includes('Open now'), `text was: ${JSON.stringify(text)}`);
    expect('open: compact ShopHours is actually visible', (await isVisible(page, '.sh-compact')) === true);
    const fullStatus = await textOf(page, '.sh-full-status');
    expect('open: full ShopHours status line also says open now', fullStatus.includes('Open now'), `text was: ${JSON.stringify(fullStatus)}`);
    expect('open: no JS errors', consoleErrors.length === 0, consoleErrors.join(' | '));
    await context.close();
  }

  // ---- Scenario 3: configured, closed right now (regular hours) ----
  // Noon on the next Sunday: closed on the weekly schedule, no closure
  // involved at all.
  {
    const { context, page, consoleErrors } = await freshPage(shopInstant(closedDateStr, 12));
    await page.goto(`${BASE}/contact`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const text = await textOf(page, '.sh-compact');
    expect('closed: compact ShopHours says closed right now', text.includes('Closed right now'), `text was: ${JSON.stringify(text)}`);
    expect('closed: compact ShopHours is actually visible', (await isVisible(page, '.sh-compact')) === true);
    expect('closed: no JS errors', consoleErrors.length === 0, consoleErrors.join(' | '));
    await context.close();
  }

  // ---- Scenario 4: active closure ----
  // A one-day weather closure covering today, which would otherwise be
  // whatever the weekly schedule says for today (open or closed) -- the
  // closure must override that either way.
  const weatherClosureId = await createClosure(token, {
    reason: 'weather',
    label: '',
    startDate: today,
    endDate: today,
    message: 'Closed for weather',
    note: '',
    noticeDays: 0,
  });
  {
    const { context, page, consoleErrors } = await freshPage(shopInstant(today, 12));
    await page.goto(`${BASE}/contact`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const barText = await textOf(page, '.clb');
    expect(
      'active closure: the closure bar shows the owner’s message and a "back at" line',
      barText.includes('Closed for weather') && barText.includes('Back'),
      `text was: ${JSON.stringify(barText)}`
    );
    expect('active closure: the closure bar is actually visible', (await isVisible(page, '.clb')) === true);
    expect('active closure: the closure bar is the active style, not the heads-up style', (await page.evaluate(() => document.querySelector('.clb')?.dataset.active)) === 'true');
    const dismissButton = await page.evaluate(() => Boolean(document.querySelector('.clb-close')));
    expect('active closure: no dismiss button on an active closure', !dismissButton);
    const compactText = await textOf(page, '.sh-compact');
    expect(
      'active closure: compact ShopHours reflects the closure, not today’s regular weekly hours',
      compactText.includes('Closed right now') || compactText.includes('further notice'),
      `text was: ${JSON.stringify(compactText)}`
    );
    expect('active closure: no JS errors', consoleErrors.length === 0, consoleErrors.join(' | '));
    await context.close();
  }

  // The weather closure is real-time "active" for the rest of this
  // script's run (the dev-api server's own clock cannot be faked), so it
  // must be reopened before the next scenario or it would still cover
  // today and shadow the heads-up closure below.
  await reopenClosure(token, weatherClosureId);

  // ---- Scenario 5: upcoming closure, inside its own notice window ----
  // A holiday closure starting 5 days from an open day, 14-day notice
  // window (comfortably inside it; noticeDays must be one of the
  // dashboard's fixed options, NOTICE_DAY_OPTIONS in shared/hours.js, not
  // an arbitrary number), checked on that open day: the heads-up must show
  // without touching the regular-hours status.
  await createClosure(token, {
    reason: 'holiday',
    label: 'Independence Day',
    startDate: upcomingStartDateStr,
    endDate: upcomingStartDateStr,
    message: 'Closed for Independence Day',
    note: '',
    noticeDays: 14,
  });
  {
    const { context, page, consoleErrors } = await freshPage(shopInstant(openDateStr, 12));
    await page.goto(`${BASE}/contact`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const barText = await textOf(page, '.clb');
    expect(
      'upcoming closure in notice window: the closure bar is a heads-up for the holiday',
      barText.includes('Heads up') && barText.includes('Independence Day'),
      `text was: ${JSON.stringify(barText)}`
    );
    expect('upcoming closure in notice window: the closure bar is actually visible', (await isVisible(page, '.clb')) === true);
    expect('upcoming closure in notice window: it is the heads-up style, not the active style', (await page.evaluate(() => document.querySelector('.clb')?.dataset.active)) === undefined);
    const dismissButton = await page.evaluate(() => Boolean(document.querySelector('.clb-close')));
    expect('upcoming closure in notice window: a heads-up notice can be dismissed', dismissButton);
    const compactText = await textOf(page, '.sh-compact');
    expect(
      'upcoming closure in notice window: regular hours today are untouched (the closure has not started)',
      compactText.includes('Open now'),
      `text was: ${JSON.stringify(compactText)}`
    );
    expect('upcoming closure in notice window: no JS errors', consoleErrors.length === 0, consoleErrors.join(' | '));
    await context.close();
  }

  // ---- Scenario 6: GET /api/hours fails ----
  // A real 500 with a JSON body (not a network-level abort, which would
  // be swallowed by apiClient.js's own offline/demo fallback and never
  // reach this code path at all): ShopHours must fail soft to the phone
  // number, the closure bar must render nothing, and the page must never
  // throw.
  {
    const { context, page, consoleErrors } = await freshPage(shopInstant(openDateStr, 12));
    await page.route('**/api/hours*', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'INTERNAL' }) })
    );
    await page.goto(`${BASE}/contact`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const compactHasPhoneLink = await page.evaluate(() => Boolean(document.querySelector('.sh-compact a[href^="tel:"]')));
    expect('API failing: compact ShopHours falls back to the phone number', compactHasPhoneLink);
    expect('API failing: the fallback is actually visible', (await isVisible(page, '.sh-compact')) === true);
    const fullFallbackText = await textOf(page, '.sh-full-fallback');
    expect('API failing: full ShopHours falls back to "call for current hours"', fullFallbackText.includes('for current hours'), `text was: ${JSON.stringify(fullFallbackText)}`);
    const closureBarPresent = (await page.evaluate(() => document.querySelectorAll('.clb').length)) > 0;
    expect('API failing: no closure bar renders (fail soft, never a stale or wrong notice)', !closureBarPresent);
    expect('API failing: the page never throws a JS error', consoleErrors.length === 0, consoleErrors.join(' | '));
    await context.close();
  }
} finally {
  await browser.close();
  staticServer.close();
  devApi.kill();
  await cleanData();
}

console.log(JSON.stringify({ failed, results }));
process.exit(failed === 0 ? 0 : 1);
