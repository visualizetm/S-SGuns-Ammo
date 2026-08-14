// Generates PLACEHOLDER brand PNGs (og-image.png 1200x630, apple-touch-icon
// 180x180) by screenshotting typographic templates in headless Chromium.
// Weapon-free, type-only: these are stand-ins until Rob supplies the real
// submark art. Re-run: node scripts/generate-brand-assets.mjs

import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const IVORY = '#F2EBDD';
const INK = '#10110F';
const OLIVE = '#454A3D';

const ogHtml = `<!doctype html><html><head><style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; background: ${IVORY}; color: ${INK};
    font-family: 'Arial Narrow', Arial, sans-serif;
    display: flex; align-items: center; justify-content: center;
  }
  .frame {
    width: 1120px; height: 550px; border: 4px solid ${OLIVE};
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; text-align: center; gap: 26px;
  }
  .loc {
    font-size: 26px; font-weight: bold; letter-spacing: 10px;
    color: ${OLIVE}; text-transform: uppercase;
  }
  .rule { width: 70px; height: 4px; background: ${OLIVE}; }
  h1 {
    font-size: 120px; font-weight: bold; text-transform: uppercase;
    letter-spacing: 2px; line-height: 0.95;
  }
  .contact { font-size: 28px; letter-spacing: 2px; color: #3a3b34; }
</style></head><body>
  <div class="frame">
    <div class="loc">Oxford, Pennsylvania</div>
    <div class="rule"></div>
    <h1>S&amp;S Guns<br/>&amp; Ammo</h1>
    <div class="rule"></div>
    <div class="contact">10 S. 3rd Street, Unit 5, Oxford, PA 19363 &middot; (610) 368-6984</div>
  </div>
</body></html>`;

const iconHtml = `<!doctype html><html><head><style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 180px; height: 180px; background: ${IVORY};
    font-family: 'Arial Narrow', Arial, sans-serif;
    display: flex; align-items: center; justify-content: center;
  }
  .frame {
    width: 152px; height: 152px; border: 8px solid ${OLIVE};
    border-radius: 10px; display: flex; align-items: center;
    justify-content: center;
  }
  .mark { font-size: 64px; font-weight: bold; color: ${INK}; letter-spacing: 1px; }
</style></head><body>
  <div class="frame"><div class="mark">S&amp;S</div></div>
</body></html>`;

await mkdir('public', { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
});

async function shoot(html, width, height, path) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.screenshot({ path });
  await page.close();
  console.log(`wrote ${path}`);
}

try {
  await shoot(ogHtml, 1200, 630, 'public/og-image.png');
  await shoot(iconHtml, 180, 180, 'public/apple-touch-icon.png');
} finally {
  await browser.close();
}
