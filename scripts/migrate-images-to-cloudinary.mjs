// One-time, admin-only migration: re-upload any legacy product/collection/
// bundle images (base64 data URLs or old Vercel Blob URLs) to Cloudinary and
// rewrite the stored references to the Cloudinary delivery URL + public_id.
// Never deletes anything anywhere (owner's permanence rule).
//
// Run from a terminal with the target store's env vars:
//
//   Production catalog (MongoDB Atlas):
//     DATABASE_MONGODB_URI=... CLOUDINARY_URL=... node scripts/migrate-images-to-cloudinary.mjs
//   Preview what would change without writing:
//     DATABASE_MONGODB_URI=... CLOUDINARY_URL=... node scripts/migrate-images-to-cloudinary.mjs --dry-run
//   Local dev store (.data/catalog-dev.json): omit DATABASE_MONGODB_URI
//   (MONGODB_URI is also accepted as a fallback name for either case).
//
// Idempotent: images already on Cloudinary (res.cloudinary.com) are skipped,
// so it is safe to run again after a partial failure.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { cloudinaryConfigured, uploadToCloudinary } from '../api/_lib/imageStorage.js';

const DRY_RUN = process.argv.includes('--dry-run');
const DEV_STORE = join(process.cwd(), '.data', 'catalog-dev.json');
const KINDS = ['products', 'collections', 'bundles'];

function needsMigration(url) {
  if (typeof url !== 'string' || !url) return false;
  if (url.includes('res.cloudinary.com')) return false;
  return url.startsWith('data:image/') || url.includes('blob.vercel-storage.com');
}

let uploaded = 0;
const failures = [];

async function migrateUrl(url, label) {
  if (!needsMigration(url)) return null;
  if (DRY_RUN) {
    console.log(`would migrate ${label} (${url.slice(0, 48)}...)`);
    return null;
  }
  try {
    const { url: newUrl, publicId } = await uploadToCloudinary(url);
    uploaded += 1;
    console.log(`migrated ${label} -> ${publicId}`);
    return { url: newUrl, publicId };
  } catch (err) {
    failures.push(`${label}: ${err?.message || err}`);
    return null;
  }
}

// Rewrites one side (draft or published) of a record. Returns true if changed.
async function migrateFields(kind, id, side, fields) {
  if (!fields) return false;
  let changed = false;
  if (kind === 'products' && Array.isArray(fields.photos)) {
    for (let i = 0; i < fields.photos.length; i += 1) {
      const photo = fields.photos[i];
      const result = await migrateUrl(photo?.url ?? photo, `${kind}/${id}/${side}/photos[${i}]`);
      if (result) {
        fields.photos[i] = result;
        changed = true;
      }
    }
  }
  const single = kind === 'collections' ? 'coverPhoto' : kind === 'bundles' ? 'photo' : null;
  if (single && fields[single]) {
    const result = await migrateUrl(fields[single], `${kind}/${id}/${side}/${single}`);
    if (result) {
      fields[single] = result.url;
      changed = true;
    }
  }
  return changed;
}

if (!cloudinaryConfigured()) {
  console.error('Cloudinary is not configured. Set CLOUDINARY_URL (or the three CLOUDINARY_* vars) and rerun.');
  process.exit(1);
}

const mongoUri = process.env.DATABASE_MONGODB_URI || process.env.MONGODB_URI;

if (mongoUri) {
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(mongoUri, { maxPoolSize: 2 });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'ssguns');
  for (const kind of KINDS) {
    const collection = db.collection(kind);
    const docs = await collection.find({}).toArray();
    for (const doc of docs) {
      const draftChanged = await migrateFields(kind, doc.id, 'draft', doc.draft);
      const publishedChanged = await migrateFields(kind, doc.id, 'published', doc.published);
      if ((draftChanged || publishedChanged) && !DRY_RUN) {
        await collection.updateOne(
          { id: doc.id },
          { $set: { draft: doc.draft, published: doc.published, updatedAt: new Date().toISOString() } }
        );
      }
    }
  }
  await client.close();
} else if (existsSync(DEV_STORE)) {
  const store = JSON.parse(readFileSync(DEV_STORE, 'utf8'));
  let changed = false;
  for (const kind of KINDS) {
    for (const record of store[kind] || []) {
      if (await migrateFields(kind, record.id, 'draft', record.draft)) changed = true;
      if (await migrateFields(kind, record.id, 'published', record.published)) changed = true;
    }
  }
  if (changed && !DRY_RUN) writeFileSync(DEV_STORE, JSON.stringify(store, null, 2));
} else {
  console.log('No store found (no DATABASE_MONGODB_URI/MONGODB_URI and no .data/catalog-dev.json). Nothing to migrate.');
}

console.log(`${DRY_RUN ? 'Dry run complete.' : 'Migration complete.'} ${uploaded} image(s) uploaded.`);
if (failures.length) {
  console.error(`Failures (rerun to retry; already-migrated images are skipped):`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
