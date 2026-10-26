// One-time seed for the shop's real weekly hours.
//
// Writes the table below into the single `settings` document (_id "hours")
// through the SAME adapter and validator the API and dashboard use, so the
// saved shape is identical to what the Hours page saves. Only `weekly` (and
// timezone/updatedAt) is replaced; existing closures are never touched.
//
//   node scripts/set-hours.mjs                 dry run: shows saved vs new, writes nothing
//   node scripts/set-hours.mjs --apply         write (refuses if hours were already saved)
//   node scripts/set-hours.mjs --apply --force write even if hours were already saved
//
// Target: DATABASE_MONGODB_URI (then MONGODB_URI) / MONGODB_DB (default
// "ssguns"). With neither URI set outside production it targets the local
// dev file store (.data/hours-dev.json). Connection strings are never
// printed, only env var names.
//
// This table is the ONLY place the hours live in code. The database is the
// source of truth afterwards; the owner edits them on the dashboard Hours
// page. The smoke tests import it from here rather than keeping a copy.

import { pathToFileURL } from 'node:url';
import { DAY_NAMES, formatRange, validateHours } from '../shared/hours.js';
import { getHoursAdapter } from '../api/_lib/hoursAdapter.js';
import { getMongoClient } from '../api/_lib/mongoClient.js';
import { mongoDbName } from '../api/_lib/runtimeEnv.js';

// Timezone America/New_York. One range per day, 24-hour "HH:MM"; null = closed.
export const HOURS_TABLE = {
  Monday: null,
  Tuesday: null,
  Wednesday: ['13:00', '17:00'],
  Thursday: ['13:00', '17:00'],
  Friday: ['13:00', '17:00'],
  Saturday: ['09:00', '15:00'],
  Sunday: ['10:00', '14:00'],
};

// Same row shape the dashboard saves: day 0 = Sunday .. 6 = Saturday.
export function buildWeekly() {
  return DAY_NAMES.map((name, day) => {
    const range = HOURS_TABLE[name];
    return range
      ? { day, open: true, opens: range[0], closes: range[1] }
      : { day, open: false, opens: null, closes: null };
  });
}

function printTable(weekly) {
  const byDay = new Map(weekly.map((r) => [r.day, r]));
  // Monday first, the way the shop reads its week.
  for (const day of [1, 2, 3, 4, 5, 6, 0]) {
    const row = byDay.get(day);
    const text = row?.open ? formatRange(row.opens, row.closes) : 'Closed';
    console.log(`  ${DAY_NAMES[day].padEnd(10)} ${text}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const known = new Set(['--apply', '--force']);
  const unknown = args.filter((a) => !known.has(a));
  if (unknown.length) {
    console.error(`Unknown option: ${unknown.join(' ')}. Use --apply and/or --force.`);
    return 2;
  }
  const apply = args.includes('--apply');
  const force = args.includes('--force');

  const weekly = buildWeekly();
  const checked = validateHours(weekly);
  if (!checked.ok) {
    console.error('The hours table in this script is invalid:', JSON.stringify(checked.errors));
    return 1;
  }

  const adapter = getHoursAdapter();
  if (adapter.mode === 'unconfigured') {
    console.error('Database not configured. Set DATABASE_MONGODB_URI (or MONGODB_URI) and run again.');
    return 1;
  }
  if (adapter.mode === 'mongodb') {
    console.log(`Target: MongoDB, database "${mongoDbName()}", collection "settings", _id "hours".`);
  } else {
    console.log('Target: LOCAL dev file store (.data/hours-dev.json).');
    console.log('No DATABASE_MONGODB_URI or MONGODB_URI is set, so this is NOT the real database.');
  }

  let current;
  try {
    current = await adapter.getSettings();
  } catch (err) {
    console.error(`Could not reach the database (${err?.name || 'Error'}).`);
    console.error('If the Atlas cluster is on a free tier it may be paused after inactivity.');
    console.error('Resume it in the Atlas dashboard, then run this again.');
    return 1;
  }

  console.log('\nCurrently saved hours:');
  if (current.weekly) {
    printTable(current.weekly);
    console.log(`  (last updated ${current.updatedAt || 'unknown'}; ${current.closures?.length || 0} closure(s) on file)`);
  } else {
    console.log('  not set');
  }
  console.log('\nHours this script writes:');
  printTable(checked.data);

  if (!apply) {
    console.log('\nDry run: nothing was written. Run again with --apply to write these hours.');
    if (force) console.log('(--force only matters together with --apply.)');
    return 0;
  }

  if (current.weekly && !force) {
    console.error('\nRefusing to overwrite: hours were already saved (see above).');
    console.error('To replace them anyway, run again with --apply --force.');
    return 1;
  }

  try {
    await adapter.saveWeekly(checked.data);
  } catch (err) {
    console.error(`Write failed (${err?.name || 'Error'}). Nothing was changed if this was a connection problem.`);
    return 1;
  }

  const saved = await adapter.getSettings();
  const reread = validateHours(saved.weekly);
  if (!reread.ok) {
    console.error('Saved hours did not pass validation when read back:', JSON.stringify(reread.errors));
    return 1;
  }
  console.log('\nSaved. Read back from the database:');
  printTable(reread.data);
  console.log(`  (${saved.closures?.length || 0} closure(s) kept as they were)`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const code = await main();
  if (getHoursAdapter().mode === 'mongodb') {
    try {
      await (await getMongoClient()).close();
    } catch {
      // The connection never opened; nothing to close.
    }
  }
  process.exit(code);
}
