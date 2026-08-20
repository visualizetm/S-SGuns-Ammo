// Admin mobile-structure checks: DOM-level assertions of the phone navigation
// that terminal-only verification cannot see rendered. Complements the
// responsive/no-overlap gate (responsive-check.mjs) with behavior:
//   - at 375px the sidebar is gone, the bottom tab bar (3 pages) is the
//     primary navigation, and the top app bar carries the Publish pill and
//     the menu button
//   - the drawer opens via state, traps focus, closes on Escape / backdrop /
//     close button, and returns focus to the menu button
//   - the tab bar actually navigates between the three pages
//   - the content region reserves bottom padding for the fixed tab bar
//   - no admin container forces horizontal page scroll via min-width
//   - at 1280px the desktop sidebar returns and mobile chrome disappears
// Run `npm run build` first. Run: node scripts/admin-mobile-check.mjs

import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const PORT = 4180;
const BASE = `http://localhost:${PORT}`;
const AUTH_INIT = `sessionStorage.setItem('ssga-admin-token', 'demo-local-token');`;

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

let passed = 0;
let failed = 0;
function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`ok - ${label}`);
  } else {
    failed += 1;
    console.log(`FAIL - ${label}${detail ? `: ${detail}` : ''}`);
  }
}

const preview = await startPreview();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
});

try {
  // ---- Phone (375px) ----
  const mobile = await browser.newContext({ viewport: { width: 375, height: 667 } });
  await mobile.addInitScript(AUTH_INIT);
  const page = await mobile.newPage();
  await page.goto(`${BASE}/admin`, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(700);

  const shell = await page.evaluate(() => {
    const visible = (el) => {
      if (!el) return false;
      const s = getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden';
    };
    const tabbar = document.querySelector('.admin-tabbar');
    const tabs = [...document.querySelectorAll('.admin-tab')].map((t) => ({
      label: t.textContent.trim(),
      current: t.getAttribute('aria-current') === 'page',
      w: Math.round(t.getBoundingClientRect().width),
      h: Math.round(t.getBoundingClientRect().height),
    }));
    const main = document.querySelector('[data-fixed-nav-pad]');
    return {
      sidebarVisible: visible(document.querySelector('.admin-side')),
      tabbarVisible: visible(tabbar),
      tabbarFixed: tabbar ? getComputedStyle(tabbar).position : '',
      tabbarMarked: Boolean(tabbar?.hasAttribute('data-fixed-nav')),
      tabs,
      menuVisible: visible(document.querySelector('.admin-menu-btn')),
      pubVisible: visible(document.querySelector('.admin-top-pub')),
      draftPillVisible: visible(document.querySelector('.admin-draft')),
      mainPadBottom: main ? parseFloat(getComputedStyle(main).paddingBottom) : 0,
      tabbarHeight: tabbar ? tabbar.getBoundingClientRect().height : 0,
      pageScrollX: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    };
  });

  check('375px: desktop sidebar hidden', shell.sidebarVisible === false);
  check('375px: bottom tab bar visible and fixed', shell.tabbarVisible && shell.tabbarFixed === 'fixed');
  check('375px: tab bar marked data-fixed-nav for the audit contract', shell.tabbarMarked);
  check(
    '375px: three tabs (Overview, Products, Quick Sale)',
    shell.tabs.length === 3 &&
      ['Overview', 'Products', 'Quick Sale'].every((l) => shell.tabs.some((t) => t.label === l)),
    JSON.stringify(shell.tabs.map((t) => t.label))
  );
  check(
    '375px: every tab is a 44px+ target',
    shell.tabs.every((t) => t.w >= 44 && t.h >= 44),
    JSON.stringify(shell.tabs)
  );
  check('375px: Overview tab is current on landing', shell.tabs.find((t) => t.label === 'Overview')?.current === true);
  check('375px: menu button visible in top app bar', shell.menuVisible);
  check('375px: Publish pill visible in top app bar', shell.pubVisible);
  check('375px: desktop draft pill hidden', shell.draftPillVisible === false);
  check(
    '375px: content reserves tab bar height as bottom padding',
    shell.mainPadBottom >= shell.tabbarHeight,
    `pad ${shell.mainPadBottom}px vs bar ${shell.tabbarHeight}px`
  );
  check('375px: no horizontal page scroll', shell.pageScrollX <= shell.viewport + 1, `${shell.pageScrollX} > ${shell.viewport}`);

  // No admin container forces page-wide horizontal scroll via min-width.
  const minWidthOffenders = await page.evaluate(() => {
    const offenders = [];
    for (const el of document.querySelectorAll('.admin-app *')) {
      const s = getComputedStyle(el);
      if (s.display === 'none') continue;
      const mw = parseFloat(s.minWidth);
      if (!Number.isFinite(mw) || mw <= window.innerWidth) continue;
      // A wide element inside its own scroll container is fine.
      let node = el.parentElement;
      let contained = false;
      while (node) {
        const ps = getComputedStyle(node);
        if (ps.overflowX === 'auto' || ps.overflowX === 'scroll') {
          contained = true;
          break;
        }
        node = node.parentElement;
      }
      if (!contained) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} min-width ${mw}px`);
    }
    return offenders;
  });
  check('375px: no uncontained min-width wider than the viewport', minWidthOffenders.length === 0, minWidthOffenders.join('; '));

  // ---- Drawer behavior ----
  await page.click('.admin-menu-btn');
  await page.waitForTimeout(300);
  const opened = await page.evaluate(() => {
    const drawer = document.querySelector('.admin-drawer');
    return {
      present: Boolean(drawer),
      role: drawer?.getAttribute('role'),
      modal: drawer?.getAttribute('aria-modal'),
      focusInside: Boolean(drawer && drawer.contains(document.activeElement)),
      hasPublish: Boolean(drawer?.querySelector('.admin-pub')),
      hasViewLive: Boolean(drawer?.querySelector('a[href="/"]')),
      hasLogout: [...(drawer?.querySelectorAll('button') || [])].some((b) => b.textContent.includes('Log out')),
      pagesInDrawer: [...(drawer?.querySelectorAll('button, a') || [])].filter((b) =>
        ['Overview', 'Products', 'Quick Sale'].includes(b.textContent.trim())
      ).length,
      expanded: document.querySelector('.admin-menu-btn')?.getAttribute('aria-expanded'),
    };
  });
  check('drawer: opens as role=dialog aria-modal', opened.present && opened.role === 'dialog' && opened.modal === 'true');
  check('drawer: focus moves inside on open', opened.focusInside);
  check('drawer: carries Publish control, View live site, Log out', opened.hasPublish && opened.hasViewLive && opened.hasLogout);
  check('drawer: does NOT duplicate the three pages (tab bar is primary)', opened.pagesInDrawer === 0);
  check('drawer: menu button reports aria-expanded=true', opened.expanded === 'true');

  // Tab wraps inside the drawer (focus trap).
  const trap = await page.evaluate(() => {
    const drawer = document.querySelector('.admin-drawer');
    const list = [...drawer.querySelectorAll('a[href], button:not([disabled])')];
    list[list.length - 1].focus();
    return list.length;
  });
  await page.keyboard.press('Tab');
  const wrapped = await page.evaluate(() => {
    const drawer = document.querySelector('.admin-drawer');
    const list = [...drawer.querySelectorAll('a[href], button:not([disabled])')];
    return document.activeElement === list[0];
  });
  check('drawer: Tab from the last control wraps to the first (focus trap)', trap > 1 && wrapped);

  // Escape closes and focus returns to the menu button.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const afterEsc = await page.evaluate(() => ({
    closed: !document.querySelector('.admin-drawer'),
    focusOnMenu: document.activeElement?.classList.contains('admin-menu-btn'),
  }));
  check('drawer: Escape closes it', afterEsc.closed);
  check('drawer: focus returns to the menu button on close', afterEsc.focusOnMenu === true);

  // Backdrop tap closes.
  await page.click('.admin-menu-btn');
  await page.waitForTimeout(250);
  await page.click('.admin-scrim', { position: { x: 10, y: 300 } });
  await page.waitForTimeout(200);
  check('drawer: backdrop tap closes it', await page.evaluate(() => !document.querySelector('.admin-drawer')));

  // Close button closes.
  await page.click('.admin-menu-btn');
  await page.waitForTimeout(250);
  await page.click('.admin-drawer-close');
  await page.waitForTimeout(200);
  check('drawer: close button closes it', await page.evaluate(() => !document.querySelector('.admin-drawer')));

  // ---- Tab bar navigation ----
  await page.click('.admin-tab:has-text("Quick Sale")');
  await page.waitForTimeout(400);
  const salesNav = await page.evaluate(() => ({
    url: location.search,
    title: document.querySelector('.admin-top-title')?.textContent,
    current: [...document.querySelectorAll('.admin-tab')].find((t) => t.getAttribute('aria-current') === 'page')?.textContent.trim(),
  }));
  check('tab bar: Quick Sale tab navigates (?tab=sales, title, current state)',
    salesNav.url.includes('tab=sales') && salesNav.title === 'Quick Sale' && salesNav.current === 'Quick Sale',
    JSON.stringify(salesNav));

  await page.click('.admin-tab:has-text("Products")');
  await page.waitForTimeout(400);
  const prodNav = await page.evaluate(() => ({
    url: location.search,
    subnav: document.querySelector('.products-subnav') ? getComputedStyle(document.querySelector('.products-subnav')).overflowX : null,
    subnavScrollsPage: document.documentElement.scrollWidth > window.innerWidth + 1,
  }));
  check('tab bar: Products tab navigates and mobile subnav scrolls horizontally itself',
    prodNav.url.includes('tab=products') && prodNav.subnav === 'auto' && prodNav.subnavScrollsPage === false,
    JSON.stringify(prodNav));

  await mobile.close();

  // ---- Desktop (1280px): mobile chrome disappears, sidebar returns ----
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await desktop.addInitScript(AUTH_INIT);
  const dpage = await desktop.newPage();
  await dpage.goto(`${BASE}/admin`, { waitUntil: 'load' });
  await dpage.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await dpage.waitForTimeout(600);
  const desk = await dpage.evaluate(() => {
    const visible = (el) => {
      if (!el) return false;
      const s = getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden';
    };
    return {
      sidebar: visible(document.querySelector('.admin-side')),
      sideNavItems: document.querySelectorAll('.admin-side .admin-nav-item').length,
      sidePublish: visible(document.querySelector('.admin-side .admin-pub')),
      tabbar: visible(document.querySelector('.admin-tabbar')),
      menuBtn: visible(document.querySelector('.admin-menu-btn')),
      pubPill: visible(document.querySelector('.admin-top-pub')),
      viewLive: visible(document.querySelector('.admin-viewlive')),
      draftPill: visible(document.querySelector('.admin-draft')),
    };
  });
  check('1280px: sidebar visible with 3 nav items and the Publish control',
    desk.sidebar && desk.sideNavItems === 3 && desk.sidePublish, JSON.stringify(desk));
  check('1280px: bottom tab bar, menu button, and mobile Publish pill hidden',
    !desk.tabbar && !desk.menuBtn && !desk.pubPill);
  check('1280px: View live site and draft pill visible in the top bar', desk.viewLive && desk.draftPill);
  await desktop.close();
} finally {
  await browser.close();
  preview.kill();
}

console.log(failed === 0 ? `\n${passed} admin mobile checks passed.` : `\n${failed} FAILED, ${passed} passed.`);
process.exit(failed === 0 ? 0 : 1);
