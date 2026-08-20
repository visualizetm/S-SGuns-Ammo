// Generates the raster favicon / app-icon slots from the real weapon-free
// submark (public/brand/submark.png) onto the Vintage Ivory ground:
//   - public/icon-192.png        PWA / manifest (192, padded, maskable-safe)
//   - public/icon-512.png        PWA / manifest (512, padded, maskable-safe)
//   - public/apple-touch-icon.png  iOS home screen (180)
//   - public/favicon.ico         classic favicon (48, PNG-in-ICO container)
// These are asset SLOTS: dropping a replacement file at the same path (or a
// new submark and rerunning this script) updates the site with no code
// change. Run: node scripts/generate-icons.mjs
// Requires sharp (devDependency).

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'public/brand/submark.png';
const IVORY = { r: 242, g: 235, b: 221, alpha: 1 }; // #F2EBDD

async function iconPng(size, padRatio) {
  const inner = Math.round(size * padRatio);
  const mark = await sharp(SRC)
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
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  const entry = Buffer.alloc(16);
  entry.writeUInt8(dim >= 256 ? 0 : dim, 0); // width (0 = 256)
  entry.writeUInt8(dim >= 256 ? 0 : dim, 1); // height
  entry.writeUInt8(0, 2); // palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // size of image data
  entry.writeUInt32LE(6 + 16, 12); // offset to image data
  return Buffer.concat([header, entry, png]);
}

readFileSync(SRC); // fail loudly if the submark is missing

const icon192 = await iconPng(192, 0.72);
writeFileSync('public/icon-192.png', icon192);
console.log('icons: icon-192.png');

const icon512 = await iconPng(512, 0.72);
writeFileSync('public/icon-512.png', icon512);
console.log('icons: icon-512.png');

const apple = await iconPng(180, 0.78);
writeFileSync('public/apple-touch-icon.png', apple);
console.log('icons: apple-touch-icon.png');

const ico48 = await iconPng(48, 0.86);
writeFileSync('public/favicon.ico', pngToIco(ico48, 48));
console.log('icons: favicon.ico');
