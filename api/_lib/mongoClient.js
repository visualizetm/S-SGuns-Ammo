// Shared MongoDB client for every Mongo-backed adapter (catalog, sales,
// publish history). Serverless-safe connection reuse: the MongoClient and
// its connect() promise are created ONCE per warm runtime and cached at
// module scope (also mirrored onto globalThis, matching the dev-file
// adapters' convention, so a hot-reloaded import in the same process still
// finds the same client instead of opening a second one). A cold start
// gets a fresh module and a fresh client, which is the correct behavior.
//
// Connection string: MONGODB_URI (MongoDB Atlas). Database name: MONGODB_DB
// (default "ssguns"). Both are read only when a connection is actually
// needed, never at import/build time.

import { MongoClient } from 'mongodb';
import { mongoUri, mongoDbName } from './runtimeEnv.js';

function connect() {
  if (!globalThis.__ssgaMongoClientPromise) {
    const client = new MongoClient(mongoUri(), {
      // A serverless function handles requests one at a time; keep the
      // pool small so many concurrent warm instances do not exhaust
      // Atlas's connection limit (tight on the free M0 tier).
      maxPoolSize: 5,
      // The driver's 30s default is longer than most Vercel function time
      // limits. A MONGODB_URI that is set but unreachable (wrong host,
      // network/firewall issue, bad credentials) must fail within a
      // bounded window and return a clean 500 via guard() (api/_lib/
      // http.js), not hang until the platform kills the function with an
      // opaque timeout that looks like the app crashed.
      serverSelectionTimeoutMS: 8000,
    });
    globalThis.__ssgaMongoClientPromise = client.connect();
  }
  return globalThis.__ssgaMongoClientPromise;
}

export async function getMongoClient() {
  return connect();
}

export async function getDb() {
  const client = await connect();
  return client.db(mongoDbName());
}

export async function getCollection(name) {
  return (await getDb()).collection(name);
}

// Index creation is idempotent (a no-op if an identical index already
// exists), but there is no reason to round-trip it on every request: run it
// once per warm instance. A failure here (e.g. a transient race with
// another instance creating the same index) never blocks the app; the
// store works correctly without indexes, just slower at real scale.
let indexesEnsured = false;

export async function ensureIndexes() {
  if (indexesEnsured) return;
  indexesEnsured = true;
  try {
    const db = await getDb();
    await Promise.all([
      db.collection('products').createIndex({ id: 1 }, { unique: true }),
      db.collection('products').createIndex({ updatedAt: 1 }),
      // Public reads filter products by stock status (Hidden never
      // serves), the product analog of collections/bundles' `visible`.
      db.collection('products').createIndex({ 'published.stockStatus': 1 }),
      db.collection('collections').createIndex({ id: 1 }, { unique: true }),
      db.collection('collections').createIndex({ updatedAt: 1 }),
      db.collection('collections').createIndex({ 'published.visible': 1 }),
      db.collection('bundles').createIndex({ id: 1 }, { unique: true }),
      db.collection('bundles').createIndex({ updatedAt: 1 }),
      db.collection('bundles').createIndex({ 'published.visible': 1 }),
      db.collection('sales').createIndex({ id: 1 }, { unique: true }),
      db.collection('sales').createIndex({ soldAt: -1 }),
      db.collection('publishHistory').createIndex({ id: 1 }, { unique: true }),
      db.collection('publishHistory').createIndex({ publishedAt: -1 }),
    ]);
  } catch {
    indexesEnsured = false;
  }
}

// True once this deployment's cluster is known to support multi-document
// transactions (every Atlas cluster does, including the free M0 tier,
// because Atlas clusters are always replica sets). False once it is known
// NOT to (a standalone mongod with no --replSet, which only happens for a
// developer pointing MONGODB_URI at a bare local `mongod`). Cached after
// the first attempt so every later publish/discard skips straight to the
// right path instead of re-discovering it.
let transactionsSupported = null;

// Runs `fn(session)` inside a MongoDB transaction when the cluster supports
// one. `fn` may run more than once: `session.withTransaction` retries its
// callback on a transient transaction error, so `fn` must be safe to run
// again from scratch (the catalog adapter's mutateAtomic re-reads the
// current store at the top of `fn` for exactly this reason).
//
// TRADEOFF (documented per the task): when the cluster does NOT support
// transactions (standalone mongod only; never true on Atlas), `fn(null)`
// runs as a plain, non-transactional bulkWrite per collection instead. That
// write is no longer all-or-nothing across collections: a crash between
// the products write and the collections write could leave the catalog
// showing a newly published product without its newly published
// collection. This fallback only exists for that unsupported local case;
// every real deployment (Atlas, any tier) always gets the transaction.
// Pure and exported so the smoke suite can assert this detection directly,
// without needing a real replica set (or the lack of one) to exercise it.
export function isTransactionUnsupportedError(err) {
  return (
    err?.code === 20 || // IllegalOperation: not a replica set member or mongos
    /Transaction numbers are only allowed on a replica set member or mongos/i.test(
      err?.message || ''
    )
  );
}

export async function withOptionalTransaction(fn) {
  const client = await getMongoClient();
  if (transactionsSupported === false) return fn(null);

  const session = client.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    transactionsSupported = true;
    return result;
  } catch (err) {
    if (!isTransactionUnsupportedError(err)) throw err;
    // Nothing committed (the transaction never started), so it is safe to
    // fall back and run the same operation without a session.
    transactionsSupported = false;
    return fn(null);
  } finally {
    await session.endSession();
  }
}
