// Verifies the MongoDB connection string actually connects, and shows what
// is in each collection right now. Run this from your own machine (or
// anywhere with network access to Atlas) after setting the connection
// string, to confirm the database is reachable before trusting the live
// site to it:
//
//   DATABASE_MONGODB_URI="mongodb+srv://..." node scripts/db-check.mjs
//
// DATABASE_MONGODB_URI is checked first (the name Vercel's project
// settings use), falling back to MONGODB_URI if that is unset.
// Optional: MONGODB_DB to check a database name other than the default
// "ssguns". Prints collection names and document counts, then exits.
// Never prints the connection string itself.

import { MongoClient } from 'mongodb';

const uri = process.env.DATABASE_MONGODB_URI || process.env.MONGODB_URI;
if (!uri) {
  console.error('DATABASE_MONGODB_URI is not set. Example:');
  console.error('  DATABASE_MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net" node scripts/db-check.mjs');
  process.exit(1);
}

const dbName = process.env.MONGODB_DB || 'ssguns';
const EXPECTED_COLLECTIONS = ['products', 'collections', 'bundles', 'sales', 'publishHistory'];

console.log(`Connecting to database "${dbName}"...`);

const client = new MongoClient(uri, { maxPoolSize: 2 });

try {
  await client.connect();
  console.log('Connected.');

  // A real round-trip, not just a socket connect.
  await client.db(dbName).command({ ping: 1 });
  console.log('Ping OK.');

  const db = client.db(dbName);
  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));

  console.log('\nCollections:');
  for (const name of EXPECTED_COLLECTIONS) {
    if (!existing.has(name)) {
      console.log(`  ${name.padEnd(16)} (does not exist yet, created automatically on first write)`);
      continue;
    }
    const count = await db.collection(name).countDocuments();
    const indexes = await db.collection(name).indexes();
    console.log(`  ${name.padEnd(16)} ${count} document${count === 1 ? '' : 's'}, ${indexes.length} index${indexes.length === 1 ? '' : 'es'}`);
  }

  const extra = [...existing].filter((n) => !EXPECTED_COLLECTIONS.includes(n));
  if (extra.length) {
    console.log(`\nOther collections present: ${extra.join(', ')}`);
  }

  console.log('\nMongoDB is configured correctly.');
} catch (err) {
  console.error('\nCould not connect or query:');
  console.error(`  ${err.message}`);
  process.exit(1);
} finally {
  await client.close();
}
