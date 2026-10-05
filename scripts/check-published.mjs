// Read-only diagnostic: connects to MongoDB Atlas and prints the count of
// published, visible products, collections, and bundles, exactly what
// GET /api/inventory would serve. Run this to confirm whether a blank
// public inventory page is because the catalog genuinely has nothing
// published (the designed empty state should show), or whether products
// exist and the page itself is failing to render them.
//
//   DATABASE_MONGODB_URI="mongodb+srv://..." node scripts/check-published.mjs
//
// DATABASE_MONGODB_URI is checked first (the name Vercel's project
// settings use), falling back to MONGODB_URI if that is unset. Optional:
// MONGODB_DB to check a database name other than the default "ssguns".
// Never prints the connection string, and never prints more than a name
// and status per record, never full product data.

import { MongoClient } from 'mongodb';

const uri = process.env.DATABASE_MONGODB_URI || process.env.MONGODB_URI;
if (!uri) {
  console.error('DATABASE_MONGODB_URI is not set. Example:');
  console.error('  DATABASE_MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net" node scripts/check-published.mjs');
  process.exit(1);
}

const dbName = process.env.MONGODB_DB || 'ssguns';
const client = new MongoClient(uri, { maxPoolSize: 2, serverSelectionTimeoutMS: 8000 });

try {
  await client.connect();
  const db = client.db(dbName);

  const products = await db.collection('products').find({}).toArray();
  const collections = await db.collection('collections').find({}).toArray();
  const bundles = await db.collection('bundles').find({}).toArray();

  // Mirrors the public read: a record counts as "published and visible"
  // only if it has a published sub-document (collections/bundles also
  // check published.visible, matching shared/catalogStore.js's
  // getPublicProduct/listPublicBundles).
  const publishedProducts = products.filter((p) => p.published);
  const publishedCollections = collections.filter((c) => c.published && c.published.visible !== false);
  const publishedBundles = bundles.filter((b) => b.published && b.published.visible !== false);

  console.log(`Database: "${dbName}"`);
  console.log('');
  console.log(`Products:    ${products.length} total, ${publishedProducts.length} published`);
  console.log(`Collections: ${collections.length} total, ${publishedCollections.length} published and visible`);
  console.log(`Bundles:     ${bundles.length} total, ${publishedBundles.length} published and visible`);
  console.log('');

  if (publishedProducts.length === 0) {
    console.log('No published products. The public /inventory page SHOULD show');
    console.log('the designed empty state ("the online list is being stocked").');
  } else {
    console.log('Published products (name, stock status):');
    for (const p of publishedProducts) {
      const name = p.published?.name ?? p.draft?.name ?? '(unnamed)';
      const stock = p.published?.stockStatus ?? '(unknown)';
      console.log(`  - ${name} [${stock}]`);
    }
    console.log('');
    console.log('Published products exist. The public /inventory page SHOULD');
    console.log('render product cards, not a blank area or the empty state.');
  }
} catch (err) {
  console.error('\nCould not connect or query:');
  console.error(`  ${err.message}`);
  process.exit(1);
} finally {
  await client.close();
}
