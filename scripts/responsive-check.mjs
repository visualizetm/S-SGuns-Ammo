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
const AUTH_ROUTES = ['/admin', '/admin?tab=collections', '/admin?tab=bundles', '/admin?tab=bulk'];
const AUTH_INIT = `
  sessionStorage.setItem('ssga-admin-token', 'demo-local-token');
`;
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
    const authPage = await authContext.newPage();
    for (const route of AUTH_ROUTES) {
      await audit(authPage, route);
    }
    await authContext.close();
  }
} finally {
  await browser.close();
  preview.kill();
}

console.log(failures === 0 ? '\nAll responsive checks passed.' : `\n${failures} problem(s) found.`);
process.exit(failures === 0 ? 0 : 1);
