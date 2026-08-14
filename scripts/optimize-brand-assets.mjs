// Derives the site-ready brand assets from Rob's source PNGs in
// public/brand/ (kept verbatim as the source of truth):
//   - <name>.web.webp: right-sized, compressed versions the site references
//   - public/brand/favicon-64.png: weapon-free submark favicon
//   - public/apple-touch-icon.png: 180x180 submark flattened onto ivory
//   - public/og-image.png: 1200x630 ivory card with the submark lockup
//     (weapon-free, per brand guardrails)
// Re-run after replacing any source file: node scripts/optimize-brand-assets.mjs

import sharp from 'sharp';

const IVORY = { r: 242, g: 235, b: 221, alpha: 1 };
const DIR = 'public/brand';

// Site display sizes x2 for retina. trim strips the transparent canvas
// margins so logos render at their true size; the pattern is a repeating
// tile and must never be trimmed.
const WEB_SIZES = {
  'wordmark.png': { width: 900, trim: true },
  'wordmark-with-submark.png': { width: 1200, trim: true },
  'submark.png': { width: 512, trim: true },
  'seal-crossed-rifles.png': { width: 900, trim: true },
  'seal-rifle-badge.png': { width: 900, trim: true },
  'pattern-rifles.png': { width: 1254, trim: false },
};

for (const [file, { trim, ...size }] of Object.entries(WEB_SIZES)) {
  const out = `${DIR}/${file.replace('.png', '.web.webp')}`;
  let img = sharp(`${DIR}/${file}`);
  if (trim) img = img.trim({ threshold: 25 });
  const info = await img
    .resize({ ...size, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(out);
  console.log(`${out} ${info.width}x${info.height} ${Math.round(info.size / 1024)}KB`);
}

// Favicon: submark at 64px, transparency kept.
await sharp(`${DIR}/submark.png`)
  .trim({ threshold: 25 })
  .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(`${DIR}/favicon-64.png`);
console.log(`${DIR}/favicon-64.png`);

// Apple touch icon: 180x180, flattened onto ivory (iOS dislikes alpha).
await sharp(`${DIR}/submark.png`)
  .trim({ threshold: 25 })
  .resize(150, 150, { fit: 'contain', background: IVORY })
  .extend({ top: 15, bottom: 15, left: 15, right: 15, background: IVORY })
  .flatten({ background: IVORY })
  .png()
  .toFile('public/apple-touch-icon.png');
console.log('public/apple-touch-icon.png');

// og:image: 1200x630 ivory ground, submark lockup centered. Weapon-free.
const lockup = await sharp(`${DIR}/wordmark-with-submark.png`)
  .trim({ threshold: 25 })
  .resize({ width: 1040 })
  .toBuffer();
await sharp({
  create: { width: 1200, height: 630, channels: 4, background: IVORY },
})
  .composite([{ input: lockup, gravity: 'center' }])
  .flatten({ background: IVORY })
  .png()
  .toFile('public/og-image.png');
console.log('public/og-image.png');
