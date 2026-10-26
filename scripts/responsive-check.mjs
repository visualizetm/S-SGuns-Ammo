// Headless responsive / no-overlap acceptance checks against the built
// site. Run `npm run build` first; this script starts `vite preview`,
// drives Chromium through every route at the required viewports, and
// verifies: no horizontal scroll, no text overflowing its container, no
// element pair overlapping, and 44x44 minimum tap targets.
// Run: npm run responsive-check

import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const PORT = 4173;
const BASE = `http://localhost:${PORT}`;
const ROUTES = ['/', '/about', '/services', '/inventory', '/inventory/demo-rifle-bolt', '/inventory/no-such-item', '/transfers', '/contact', '/admin', '/no-such-page'];
// Admin screens behind the login gate: audited in a second context that
// pre-seeds the demo session token, so the dashboard renders through the
// in-browser demo adapter (vite preview has no serverless functions).
const AUTH_ROUTES = [
  '/admin', // Overview (default landing page)
  '/admin?tab=products', // Products manager (Products sub-section)
  '/admin?tab=products&section=collections',
  '/admin?tab=products&section=bundles',
  '/admin?tab=products&section=bulk',
  '/admin?tab=sales', // Quick Sale
  '/admin?tab=hours', // Hours (unconfigured/empty state: amber notice, 7 closed rows)
  '/admin?tab=history', // Publish History
];
const AUTH_INIT = `
  sessionStorage.setItem('ssga-admin-token', 'demo-local-token');
`;
// Seeds the in-browser demo hours store with a full week and one upcoming
// closure (far enough out that it is never active, so the status card's
// primary action stays "Close the Shop" and no reopen choreography is
// needed), so the Hours page's populated states (a non-empty closures
// list) and the Close the Shop sheet can both be audited, not just the
// empty unconfigured state the plain AUTH_ROUTES pass above exercises.
const HOURS_INIT = `
  localStorage.setItem('ssga-demo-hours-v1', JSON.stringify({
    timezone: 'America/New_York',
    weekly: [
      { day: 0, open: true, opens: '10:00', closes: '14:00' },
      { day: 1, open: false, opens: null, closes: null },
      { day: 2, open: false, opens: null, closes: null },
      { day: 3, open: true, opens: '13:00', closes: '17:00' },
      { day: 4, open: true, opens: '13:00', closes: '17:00' },
      { day: 5, open: true, opens: '13:00', closes: '17:00' },
      { day: 6, open: true, opens: '09:00', closes: '15:00' }
    ],
    closures: [{
      id: 'responsive-check-closure',
      startDate: '2099-01-01',
      endDate: '2099-01-02',
      reason: 'personal',
      label: 'Responsive check closure',
      message: 'Closed for testing',
      note: '',
      noticeDays: 7,
      createdAt: '2020-01-01T00:00:00.000Z',
      cancelledAt: null
    }],
    updatedAt: '2020-01-01T00:00:00.000Z'
  }));
`;
// Seeds the in-browser demo catalog (same storage the admin demo adapter
// reads) with one already-published product, so /inventory can be audited
// with the grid actually populated, not only its zero-products empty
// state (which the plain ROUTES pass above already covers).
const PUBLISHED_PRODUCT = {
  id: 'responsive-check-product',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  draft: {
    name: 'Responsive Check Rifle',
    manufacturer: 'Check Arms',
    model: 'C-1',
    caliber: '.308',
    condition: 'New',
    price: 599,
    compareAtPrice: null,
    saleLabel: '',
    stockStatus: 'In Stock',
    description: 'Responsive gate fixture',
    collectionIds: [],
    photos: [],
    featured: false,
    onSale: false,
  },
};
PUBLISHED_PRODUCT.published = { ...PUBLISHED_PRODUCT.draft };
const CATALOG_INIT = `
  localStorage.setItem('ssga-demo-catalog-v2', JSON.stringify({
    products: [${JSON.stringify(PUBLISHED_PRODUCT)}],
    collections: [],
    bundles: [],
  }));
`;
// Scoped to exactly the viewports the inventory-page gate is required at.
const INVENTORY_POPULATED_VIEWPORTS = new Set([375, 768, 1440]);
const VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 667 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'laptop-1024', width: 1024, height: 768 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'very-tall', width: 375, height: 1800 },
  { name: 'very-short', width: 1024, height: 480 },
];

function startPreview() {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => reject(new Error('preview did not start')), 20000);
    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes(String(PORT))) {
        clearTimeout(timer);
        resolve(child);
      }
    });
    child.on('exit', (code) => reject(new Error(`preview exited: ${code}`)));
  });
}

// Runs inside the page: report overflow, overlap, and tap target problems.
function auditPage(isMobile) {
  const problems = [];
  const doc = document.documentElement;

  if (doc.scrollWidth > window.innerWidth + 1) {
    problems.push(`horizontal scroll: scrollWidth ${doc.scrollWidth} > viewport ${window.innerWidth}`);
  }

  const describe = (el) => {
    const id = el.id ? `#${el.id}` : '';
    const cls = el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : '';
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };

  const els = [...document.querySelectorAll('body *')].filter((el) => {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    // A true modal (e.g. the Hours page's Close the Shop sheet) marks the
    // content behind it inert: hidden from assistive tech, unfocusable, and
    // unclickable. It is covered on screen by design, so it is excluded from
    // every check below exactly like display:none content, not flagged as
    // overlapping or clipped.
    if (el.closest('[inert]')) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    // Skip intentionally off-screen helpers (skip link, honeypot).
    if (rect.right < 0) return false;
    return true;
  });

  // Text clipping its container.
  for (const el of els) {
    const style = getComputedStyle(el);
    if (style.overflowX !== 'visible' || style.overflowY !== 'visible') continue;
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
      const hasTextOrInline = [...el.childNodes].some(
        (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim()
      );
      if (hasTextOrInline) {
        problems.push(`text overflow in ${describe(el)}: scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`);
      }
    }
  }

  // Deliberate fixed chrome (e.g. the admin bottom tab bar) is marked
  // data-fixed-nav. It floats above scrollable content by design, so
  // content passing under it is not an overlap defect. The contract is
  // enforced instead: a visible data-fixed-nav element REQUIRES a visible
  // data-fixed-nav-pad content region whose bottom padding reserves at
  // least the chrome's height, so the end of the content is never hidden.
  const inFixedNav = (el) => Boolean(el.closest('[data-fixed-nav]'));
  // A true full-screen modal (e.g. the Hours page's Close the Shop sheet,
  // marked data-modal-backdrop) stacks above everything outside it by
  // design, including sticky/fixed chrome like the admin top bar. Content
  // outside it is also inert (see above) and excluded from `els` entirely,
  // but outside chrome that isn't part of that inert subtree (parent-owned
  // layout like the sticky top bar) still needs this layer exemption.
  const inModal = (el) => Boolean(el.closest('[data-modal-backdrop]'));
  for (const nav of document.querySelectorAll('[data-fixed-nav]')) {
    const navStyle = getComputedStyle(nav);
    if (navStyle.display === 'none' || navStyle.visibility === 'hidden') continue;
    const navHeight = nav.getBoundingClientRect().height;
    const pads = [...document.querySelectorAll('[data-fixed-nav-pad]')].filter((p) => {
      const s = getComputedStyle(p);
      return s.display !== 'none' && parseFloat(s.paddingBottom) >= navHeight;
    });
    if (pads.length === 0) {
      problems.push(`fixed nav ${describe(nav)} (${Math.round(navHeight)}px) has no content region reserving matching bottom padding`);
    }
  }

  // Overlap between sibling leaf elements (visible text/interactive nodes).
  const leaves = els.filter(
    (el) =>
      el.children.length === 0 &&
      (el.textContent.trim() || ['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT', 'IMG', 'svg'].includes(el.tagName))
  );
  for (let i = 0; i < leaves.length; i++) {
    for (let j = i + 1; j < leaves.length; j++) {
      const a = leaves[i];
      const b = leaves[j];
      if (a.contains(b) || b.contains(a)) continue;
      // Fixed chrome layers over content by design (see above); only
      // pairs on the same layer count as defects.
      if (inFixedNav(a) !== inFixedNav(b)) continue;
      if (inModal(a) !== inModal(b)) continue;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const xOverlap = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const yOverlap = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (xOverlap > 2 && yOverlap > 2) {
        problems.push(`overlap: ${describe(a)} and ${describe(b)} (${Math.round(xOverlap)}x${Math.round(yOverlap)}px)`);
      }
    }
  }

  // Tap targets on mobile: anchors and buttons at least 44x44.
  if (isMobile) {
    for (const el of document.querySelectorAll('a, button, input, select, textarea, label')) {
      if (el.closest('[inert]')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.right < 0) continue;
      if (el.tagName === 'A' || el.tagName === 'BUTTON') {
        if (rect.height < 44 || rect.width < 44) {
          problems.push(`tap target under 44px: ${describe(el)} is ${Math.round(rect.width)}x${Math.round(rect.height)}`);
        }
      }
    }
  }

  return problems;
}

const preview = await startPreview();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
});

let failures = 0;
try {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();
    async function audit(page, route) {
      // 'load' + a bounded networkidle wait: external requests (web fonts)
      // can hang forever in sandboxed environments, and the audit must not
      // hang with them. The extra settle delay lets reveal-on-scroll
      // transitions finish so rects are final.
      await page.goto(`${BASE}${route}`, { waitUntil: 'load' });
      await page
        .waitForLoadState('networkidle', { timeout: 5000 })
        .catch(() => {});
      await page.waitForTimeout(900);
      const problems = await page.evaluate(auditPage, viewport.width < 768);
      if (problems.length === 0) {
        console.log(`ok - ${viewport.name} ${route}`);
      } else {
        failures += problems.length;
        for (const p of problems) console.log(`FAIL - ${viewport.name} ${route}: ${p}`);
      }
    }

    for (const route of ROUTES) {
      await audit(page, route);
    }
    await context.close();

    const authContext = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    await authContext.addInitScript(AUTH_INIT);
    await authContext.addInitScript(HOURS_INIT);
    const authPage = await authContext.newPage();
    for (const route of AUTH_ROUTES) {
      await audit(authPage, route);
    }

    // The product add/edit form (photo upload lives here) only appears
    // after clicking "Add product": a plain route visit never renders it,
    // so it needs its own step to be covered by this gate.
    await authPage.goto(`${BASE}/admin?tab=products`, { waitUntil: 'load' });
    await authPage.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await authPage.click('.inv-add');
    await authPage.waitForSelector('.inv-form', { timeout: 5000 }).catch(() => {});
    await authPage.waitForTimeout(900);
    const formProblems = await authPage.evaluate(auditPage, viewport.width < 768);
    const formLabel = '/admin?tab=products [add product form open]';
    if (formProblems.length === 0) {
      console.log(`ok - ${viewport.name} ${formLabel}`);
    } else {
      failures += formProblems.length;
      for (const p of formProblems) console.log(`FAIL - ${viewport.name} ${formLabel}: ${p}`);
    }

    // Hours page with real demo data: the closures list populated (the
    // seeded upcoming closure), then Close the Shop opens the sheet (full
    // screen on phone, a centered card above that) for its own audit pass.
    await authPage.goto(`${BASE}/admin?tab=hours`, { waitUntil: 'load' });
    await authPage.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await authPage.waitForSelector('.hp-closure-row', { timeout: 5000 }).catch(() => {});
    await authPage.waitForTimeout(900);
    const hoursProblems = await authPage.evaluate(auditPage, viewport.width < 768);
    const hoursLabel = '/admin?tab=hours [closures populated]';
    if (hoursProblems.length === 0) {
      console.log(`ok - ${viewport.name} ${hoursLabel}`);
    } else {
      failures += hoursProblems.length;
      for (const p of hoursProblems) console.log(`FAIL - ${viewport.name} ${hoursLabel}: ${p}`);
    }

    await authPage.click('.hp-status-btn'); // "Close the Shop" (no closure is active)
    await authPage.waitForSelector('.hp-sheet', { timeout: 5000 }).catch(() => {});
    await authPage.waitForTimeout(900);
    const sheetProblems = await authPage.evaluate(auditPage, viewport.width < 768);
    const sheetLabel = '/admin?tab=hours [Close the Shop sheet open]';
    if (sheetProblems.length === 0) {
      console.log(`ok - ${viewport.name} ${sheetLabel}`);
    } else {
      failures += sheetProblems.length;
      for (const p of sheetProblems) console.log(`FAIL - ${viewport.name} ${sheetLabel}: ${p}`);
    }

    await authContext.close();

    // /inventory with a published product actually in the demo catalog,
    // at exactly the viewports this gate is required at: the plain ROUTES
    // pass above only ever exercises the zero-products empty state, since
    // the demo catalog starts empty.
    if (INVENTORY_POPULATED_VIEWPORTS.has(viewport.width)) {
      const catalogContext = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      await catalogContext.addInitScript(CATALOG_INIT);
      const catalogPage = await catalogContext.newPage();
      await audit(catalogPage, '/inventory');

      const cardState = await catalogPage.evaluate(() => {
        const card = document.querySelector('.pc-card');
        if (!card) return { present: false };
        const style = getComputedStyle(card);
        const rect = card.getBoundingClientRect();
        return {
          present: true,
          visible:
            Number(style.opacity) > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            rect.width > 0 &&
            rect.height > 0,
        };
      });
      const cardLabel = '/inventory [published product visible]';
      if (cardState.present && cardState.visible) {
        console.log(`ok - ${viewport.name} ${cardLabel}`);
      } else {
        failures += 1;
        console.log(`FAIL - ${viewport.name} ${cardLabel}: ${JSON.stringify(cardState)}`);
      }
      await catalogContext.close();
    }
  }
} finally {
  await browser.close();
  preview.kill();
}

console.log(failures === 0 ? '\nAll responsive checks passed.' : `\n${failures} problem(s) found.`);
process.exit(failures === 0 ? 0 : 1);
