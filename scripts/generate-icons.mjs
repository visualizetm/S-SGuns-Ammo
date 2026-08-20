// Generates the raster favicon / app-icon slots from the owner's weapon-free
// scope-reticle SUBMARK (public/submark.svg) on the Vintage Ivory ground, and
// an og:image from the horizontal lockup on a Range Black ground:
//   - public/icon-192.png        PWA / manifest (192, padded, maskable-safe)
//   - public/icon-512.png        PWA / manifest (512, padded, maskable-safe)
//   - public/apple-touch-icon.png  iOS home screen (180)
//   - public/favicon.ico         classic favicon (48, PNG-in-ICO container)
//   - public/og-image.png        social share card (1200x630)
// The submark is the ONLY mark used for favicon and app icons (weapon-free).
// The og:image composes the horizontal wordmark lockup on brand black.
// These are asset SLOTS: replace the source SVGs (or the outputs) to rebrand.
// Run: node scripts/generate-icons.mjs   (requires sharp)

import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const SUBMARK = 'public/submark.svg';
const HORIZONTAL = 'public/logo-horizontal.svg';
const IVORY = { r: 242, g: 235, b: 221, alpha: 1 }; // #F2EBDD
const INK = { r: 16, g: 17, b: 15, alpha: 1 }; // #10110F

async function iconPng(size, padRatio) {
  const inner = Math.round(size * padRatio);
  const mark = await sharp(SUBMARK, { density: 384 })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: IVORY },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toBuffer();
}

// Minimal single-image ICO wrapping a PNG (widely supported).
function pngToIco(png, dim) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  const entry = Buffer.alloc(16);
  entry.writeUInt8(dim >= 256 ? 0 : dim, 0);
  entry.writeUInt8(dim >= 256 ? 0 : dim, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(6 + 16, 12);
  return Buffer.concat([header, entry, png]);
}

writeFileSync('public/icon-192.png', await iconPng(192, 0.72));
console.log('icons: icon-192.png (submark)');
writeFileSync('public/icon-512.png', await iconPng(512, 0.72));
console.log('icons: icon-512.png (submark)');
writeFileSync('public/apple-touch-icon.png', await iconPng(180, 0.78));
console.log('icons: apple-touch-icon.png (submark)');
writeFileSync('public/favicon.ico', pngToIco(await iconPng(48, 0.86), 48));
console.log('icons: favicon.ico (submark)');

// og:image 1200x630: the horizontal lockup (ivory) centered on brand black.
const lockup = await sharp(HORIZONTAL, { density: 384 })
  .resize(820, null, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer();
const og = await sharp({
  create: { width: 1200, height: 630, channels: 4, background: INK },
})
  .composite([{ input: lockup, gravity: 'center' }])
  .png()
  .toBuffer();
writeFileSync('public/og-image.png', og);
console.log('icons: og-image.png (horizontal lockup on brand black, 1200x630)');
