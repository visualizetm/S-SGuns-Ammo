// Pre-deploy gate, run as `npm run preflight` (after `npm run build`).
// Checks the things that must never ship:
//   1. The old, wrong phone number appears nowhere in the repo.
//   2. No em or en dashes in rendered copy (brand rule: none anywhere).
//   3. DEMO seed data cannot leak into the MongoDB path: every seed export
//      is empty, and the MongoDB adapter function body contains no seeding
//      call at all.
//   4. The build emitted sitemap.xml and the web manifest, and
//      api/robots.js (which serves /robots.txt at request time) exists.
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

// ---------- 3. Zero DEMO data anywhere ----------
{
  // The DEMO example data was removed before launch. Three hard guarantees:
  //   - every seed export is EMPTY, so no path (dev store, in-browser demo,
  //     production) can ever render a DEMO product, collection, bundle or sale;
  //   - the MongoDB adapter contains NO seeding call at all;
  //   - no "DEMO:" labeled content remains in shipped source.
  const hits = [];

  const { SEED_PRODUCTS, SEED_COLLECTIONS, SEED_BUNDLES, seedCatalogStore } =
    await import('../shared/catalogSeeds.js');
  const { seedSalesStore } = await import('../shared/salesSeeds.js');
  const emptyStore = seedCatalogStore();
  const counts = {
    'seed products': SEED_PRODUCTS.length,
    'seed collections': SEED_COLLECTIONS.length,
    'seed bundles': SEED_BUNDLES.length,
    'seeded store products': emptyStore.products.length,
    'seeded store collections': emptyStore.collections.length,
    'seeded store bundles': emptyStore.bundles.length,
    'seed sales': seedSalesStore().length,
  };
  for (const [label, count] of Object.entries(counts)) {
    if (count !== 0) hits.push(`${label}: expected 0, found ${count}`);
  }

  const adapter = readFileSync(join(ROOT, 'api/_lib/catalogAdapter.js'), 'utf8');
  const pgStart = adapter.indexOf('function createMongoAdapter');
  const pgEnd = adapter.indexOf('// Production with no database');
  if (pgStart < 0 || pgEnd < 0 || pgEnd <= pgStart) {
    hits.push('catalogAdapter.js: could not locate the MongoDB adapter body');
  } else if (/seedCatalogStore/.test(adapter.slice(pgStart, pgEnd))) {
    hits.push('catalogAdapter.js: the MongoDB adapter must never seed DEMO data');
  }

  for (const file of files) {
    const rel = relative(ROOT, file);
    if (rel === SELF || !/^(src|shared|api)\//.test(rel)) continue;
    if (readFileSync(file, 'utf8').includes('DEMO:')) {
      hits.push(`${rel}: contains "DEMO:" labeled content`);
    }
  }

  if (hits.length) failures.push(['DEMO data removal', hits]);
  else passes.push('DEMO data: all seeds empty, no MongoDB seeding, no DEMO content in src/shared/api');
}

// ---------- 4. Build outputs ----------
// robots.txt is intentionally NOT a static build output: it is served at
// request time by api/robots.js (see vercel.json's "/robots.txt" rewrite)
// so it can differ by host (dashboard vs. public). A static dist/robots.txt
// would shadow that rewrite, so its absence here is correct, not a bug.
{
  const wanted = ['dist/sitemap.xml', 'dist/site.webmanifest'];
  const missing = wanted.filter((path) => !existsSync(join(ROOT, path)));
  if (!existsSync(join(ROOT, 'dist'))) {
    failures.push(['build outputs', ['dist/ missing entirely; run `npm run build` first']]);
  } else if (missing.length) {
    failures.push(['build outputs', missing.map((path) => `${path} missing`)]);
  } else if (!existsSync(join(ROOT, 'api/robots.js'))) {
    failures.push(['build outputs', ['api/robots.js missing (serves /robots.txt at request time)']]);
  } else {
    passes.push('build outputs: sitemap.xml, site.webmanifest present in dist/; api/robots.js present');
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
