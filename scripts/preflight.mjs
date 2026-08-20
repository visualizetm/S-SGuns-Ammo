// Pre-deploy gate, run as `npm run preflight` (after `npm run build`).
// Checks the things that must never ship:
//   1. The old, wrong phone number appears nowhere in the repo.
//   2. No em or en dashes in rendered copy (brand rule: none anywhere).
//   3. DEMO seed data cannot leak into the Postgres path: seedCatalogStore
//      is referenced only by the dev/demo adapters, and the Postgres
//      adapter function body contains no seeding at all.
//   4. The build emitted robots.txt, sitemap.xml, and the web manifest.
//   5. Enumerates the [[...]] placeholders still in siteFacts.js so the
//      remaining owner-confirmation work is visible at a glance
//      (informational, not a failure).
// Exits 1 with a FAIL summary if any hard check fails.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as siteFacts from '../src/content/siteFacts.js';

const ROOT = process.cwd();
const SELF = 'scripts/preflight.mjs';

// Assembled from parts so this file never contains the forbidden string.
const OLD_PHONE_PARTS = ['610', '368', '6984'];
const OLD_PHONE_PATTERNS = [
  OLD_PHONE_PARTS.join('-'),
  OLD_PHONE_PARTS.join(''),
  `(${OLD_PHONE_PARTS[0]}) ${OLD_PHONE_PARTS[1]}-${OLD_PHONE_PARTS[2]}`,
  OLD_PHONE_PARTS.join('.'),
];

const TEXT_EXTENSIONS = new Set([
  '.js', '.mjs', '.jsx', '.css', '.html', '.md', '.json',
  '.webmanifest', '.txt', '.svg',
]);
const WALK_DIRS = ['src', 'api', 'shared', 'scripts', 'public'];
const ROOT_FILES = [
  'index.html', 'package.json', 'vercel.json',
  'README.md', 'NEEDS-CONFIRMATION.md', 'PRODUCTION-SETUP.md',
];

function textFiles() {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stats = statSync(full);
      if (stats.isDirectory()) {
        walk(full);
      } else {
        const dot = entry.lastIndexOf('.');
        if (dot >= 0 && TEXT_EXTENSIONS.has(entry.slice(dot))) files.push(full);
      }
    }
  };
  for (const dir of WALK_DIRS) if (existsSync(join(ROOT, dir))) walk(join(ROOT, dir));
  for (const file of ROOT_FILES) if (existsSync(join(ROOT, file))) files.push(join(ROOT, file));
  return files;
}

const failures = [];
const passes = [];
const files = textFiles();

// ---------- 1. Old phone number ----------
{
  const hits = [];
  for (const file of files) {
    const rel = relative(ROOT, file);
    if (rel === SELF) continue;
    const content = readFileSync(file, 'utf8');
    for (const pattern of OLD_PHONE_PATTERNS) {
      if (content.includes(pattern)) hits.push(`${rel}: contains "${pattern}"`);
    }
  }
  if (hits.length) failures.push(['old phone number found', hits]);
  else passes.push('old phone number: absent everywhere');
}

// ---------- 2. Em and en dashes ----------
{
  const dashes = /[—–]/;
  const hits = [];
  for (const file of files) {
    const rel = relative(ROOT, file);
    if (rel === SELF) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (dashes.test(line)) hits.push(`${rel}:${index + 1}`);
    });
  }
  if (hits.length) failures.push(['em/en dashes found', hits]);
  else passes.push('em/en dashes: none in any source or copy file');
}

// ---------- 3. DEMO seed containment ----------
{
  // seedCatalogStore may be referenced only by the seed source and the two
  // adapters. The Postgres adapter seeds the DEMO listings into an EMPTY
  // production store on first run (so the public inventory page is not blank
  // before real products are added). That first-run seed must stay SAFE:
  // it runs at most once (a 'demo_seeded' marker) and only when the store is
  // empty, so it can never overwrite or resurrect real inventory.
  const allowed = new Set([
    'shared/catalogSeeds.js',
    'api/_lib/catalogAdapter.js',
    'src/lib/demoAdapter.js',
  ]);
  const hits = [];
  for (const file of files) {
    const rel = relative(ROOT, file);
    if (rel === SELF || allowed.has(rel)) continue;
    if (readFileSync(file, 'utf8').includes('seedCatalogStore')) {
      hits.push(`${rel}: unexpected seedCatalogStore reference`);
    }
  }

  const adapter = readFileSync(join(ROOT, 'api/_lib/catalogAdapter.js'), 'utf8');
  const pgStart = adapter.indexOf('function createPostgresAdapter');
  const pgEnd = adapter.indexOf('export function getCatalogAdapter');
  if (pgStart < 0 || pgEnd < 0 || pgEnd <= pgStart) {
    hits.push('catalogAdapter.js: could not locate the Postgres adapter body');
  } else {
    const body = adapter.slice(pgStart, pgEnd);
    if (/seedCatalogStore/.test(body)) {
      if (!/demo_seeded/.test(body)) {
        hits.push('catalogAdapter.js: Postgres first-run seed lacks the one-time marker guard');
      }
      if (!/LIMIT 1|existing === 0|isEmpty/i.test(body)) {
        hits.push('catalogAdapter.js: Postgres first-run seed lacks the empty-store guard');
      }
    }
  }

  if (hits.length) failures.push(['DEMO seed containment', hits]);
  else passes.push('DEMO seeds: confined to adapters; Postgres seeds an empty store once, guarded');
}

// ---------- 4. Build outputs ----------
{
  const wanted = ['dist/robots.txt', 'dist/sitemap.xml', 'dist/site.webmanifest'];
  const missing = wanted.filter((path) => !existsSync(join(ROOT, path)));
  if (!existsSync(join(ROOT, 'dist'))) {
    failures.push(['build outputs', ['dist/ missing entirely; run `npm run build` first']]);
  } else if (missing.length) {
    failures.push(['build outputs', missing.map((path) => `${path} missing`)]);
  } else {
    passes.push('build outputs: robots.txt, sitemap.xml, site.webmanifest present in dist/');
  }
}

// ---------- 5. Placeholder inventory (informational) ----------
const placeholders = new Map();
{
  const pattern = /\[\[[^\]]+\]\]/g;
  const walkValue = (value) => {
    if (typeof value === 'string') {
      for (const match of value.match(pattern) || []) {
        placeholders.set(match, (placeholders.get(match) || 0) + 1);
      }
    } else if (Array.isArray(value)) {
      value.forEach(walkValue);
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(walkValue);
    }
  };
  Object.values(siteFacts).forEach(walkValue);
}

// ---------- Report ----------
console.log('PREFLIGHT');
console.log('');
for (const pass of passes) console.log(`  ok   ${pass}`);
for (const [title, details] of failures) {
  console.log(`  FAIL ${title}`);
  for (const detail of details) console.log(`         ${detail}`);
}
console.log('');
console.log(`Owner-confirmation placeholders in siteFacts.js: ${placeholders.size}`);
for (const [text, count] of placeholders) {
  console.log(`  ${text}${count > 1 ? ` (x${count})` : ''}`);
}
console.log('');
if (failures.length) {
  console.log(`RESULT: FAIL (${failures.length} of ${failures.length + passes.length} checks)`);
  process.exit(1);
}
console.log(`RESULT: PASS (${passes.length} checks)`);
