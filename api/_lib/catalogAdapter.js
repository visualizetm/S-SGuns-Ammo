// Catalog adapter: draft/publish store for products, collections, bundles.
// Endpoints talk ONLY to this interface (same pattern as Phase 1):
//
//   listProducts({ scope, collectionId?, q?, includeHidden? })
//   listCollections({ scope })
//   listBundles({ scope })
//   getRecord(kind, id)
//   saveDraft(kind, id | null, fields)   -> record | null (unknown id)
//   deleteDraft(kind, id)                -> true | null
//   restoreDraft(kind, id)               -> record | null
//   reorderCollections(orderedIds)       -> true
//   changesSummary()                     -> { products, collections, bundles, total }
//   publishAll() / discardAll()          -> summary after the operation
//
// Implementations, selected from the environment at runtime:
//   - DATABASE_MONGODB_URI (or MONGODB_URI) set -> MongoDB Atlas, one
//     document per record in the products / collections / bundles
//     collections, publish/discard in a single transaction (falls back to
//     a plain bulkWrite if the cluster does not support transactions; see
//     mongoClient.js).
//   - otherwise -> dev JSON file store at .data/catalog-dev.json; in-memory
//     on read-only filesystems.
// The draft/publish semantics live in shared/catalogStore.js and are
// identical across implementations. See PRODUCTION-SETUP.md.

import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  KINDS,
  listProducts,
  listCollections,
  listBundles,
  getRecord,
  getPublicProduct,
  listPublicBundles,
  saveDraft,
  deleteDraft,
  restoreDraft,
  reorderCollections,
  markStockImmediate,
  changesSummary,
  changesDetail,
  publishAll,
  discardAll,
} from '../../shared/catalogStore.js';
import { seedCatalogStore } from '../../shared/catalogSeeds.js';
import {
  isProductionRuntime,
  dbNotConfiguredError,
  mongoUri,
} from './runtimeEnv.js';
import { getCollection, ensureIndexes, withOptionalTransaction } from './mongoClient.js';

const DEV_STORE_PATH = join(process.cwd(), '.data', 'catalog-dev.json');

// ---------- Dev store: JSON file with in-memory fallback ----------

function createDevAdapter() {
  let canPersist = true;

  function load() {
    if (globalThis.__ssgaCatalogStore) return globalThis.__ssgaCatalogStore;
    let store;
    try {
      store = JSON.parse(readFileSync(DEV_STORE_PATH, 'utf8'));
    } catch {
      store = seedCatalogStore();
    }
    globalThis.__ssgaCatalogStore = store;
    persist(store);
    return store;
  }

  function persist(store) {
    if (!canPersist) return;
    try {
      mkdirSync(dirname(DEV_STORE_PATH), { recursive: true });
      writeFileSync(DEV_STORE_PATH, JSON.stringify(store, null, 2));
    } catch {
      canPersist = false;
    }
  }

  function mutate(fn) {
    const store = load();
    const result = fn(store);
    persist(store);
    return result;
  }

  return {
    mode: 'dev-file',
    async listProducts(options) {
      return listProducts(load(), options);
    },
    async listCollections(options) {
      return listCollections(load(), options);
    },
    async listBundles(options) {
      return listBundles(load(), options);
    },
    async getRecord(kind, id) {
      return getRecord(load(), kind, id);
    },
    async getPublicProduct(id) {
      return getPublicProduct(load(), id);
    },
    async listPublicBundles() {
      return listPublicBundles(load());
    },
    async saveDraft(kind, id, fields) {
      return mutate((s) => saveDraft(s, kind, id, fields, randomUUID));
    },
    async deleteDraft(kind, id) {
      return mutate((s) => deleteDraft(s, kind, id));
    },
    async restoreDraft(kind, id) {
      return mutate((s) => restoreDraft(s, kind, id));
    },
    async reorderCollections(orderedIds) {
      return mutate((s) => reorderCollections(s, orderedIds));
    },
    async markStockImmediate(productId, stockStatus) {
      return mutate((s) => markStockImmediate(s, productId, stockStatus));
    },
    async changesSummary() {
      return changesSummary(load());
    },
    async changesDetail() {
      return changesDetail(load());
    },
    async publishAll() {
      return mutate((s) => {
        publishAll(s);
        return changesSummary(s);
      });
    },
    async discardAll() {
      return mutate((s) => {
        discardAll(s);
        return changesSummary(s);
      });
    },
  };
}

// ---------- Production store: MongoDB Atlas ----------

const KIND_TO_COLLECTION = {
  products: 'products',
  collections: 'collections',
  bundles: 'bundles',
};

// One diff of two stores into the minimal set of MongoDB bulkWrite
// operations per kind: an upsert (by business id, not Mongo's own _id) for
// every new or changed record, a delete for every record that disappeared.
// Mirrors the Postgres adapter's diffStatements so both implementations
// write exactly the same minimal set of changes.
export function diffOps(beforeList, afterList) {
  const ops = [];
  const beforeById = new Map(beforeList.map((r) => [r.id, r]));
  const afterIds = new Set(afterList.map((r) => r.id));
  for (const record of afterList) {
    const prev = beforeById.get(record.id);
    if (prev && JSON.stringify(prev) === JSON.stringify(record)) continue;
    ops.push({
      replaceOne: {
        filter: { id: record.id },
        replacement: record,
        upsert: true,
      },
    });
  }
  for (const prev of beforeList) {
    if (!afterIds.has(prev.id)) {
      ops.push({ deleteOne: { filter: { id: prev.id } } });
    }
  }
  return ops;
}

// Production store: MongoDB Atlas via the official driver. The connection
// itself is shared and cached across invocations by mongoClient.js; this
// function only implements the store operations on top of it.
function createMongoAdapter() {
  // Loads the whole catalog (all three kinds) into plain JS arrays, runs
  // the shared pure operations from shared/catalogStore.js against them in
  // memory, then writes back only the documents that actually changed.
  // This mirrors the Postgres adapter's approach exactly: some pure
  // operations (deleteDraft on a collection, for one) touch more than one
  // kind at once (removing a collection also edits every product that
  // referenced it), so the pure layer always expects the FULL store.
  async function loadStore(session) {
    const store = { products: [], collections: [], bundles: [] };
    for (const kind of KINDS) {
      const col = await getCollection(KIND_TO_COLLECTION[kind]);
      const findOpts = { projection: { _id: 0 } };
      if (session) findOpts.session = session;
      store[kind] = await col.find({}, findOpts).toArray();
    }
    return store;
  }

  async function persistDiff(before, after, session) {
    for (const kind of KINDS) {
      const ops = diffOps(before[kind], after[kind]);
      if (ops.length === 0) continue;
      const col = await getCollection(KIND_TO_COLLECTION[kind]);
      await col.bulkWrite(ops, session ? { session } : undefined);
    }
  }

  // Non-atomic mutation: every caller here (saveDraft, deleteDraft, etc.)
  // touches at most one business record (deleteDraft on a collection also
  // patches referencing products, but that is still one logical write).
  // A single MongoDB document write is already atomic, so no transaction
  // is needed for these.
  async function mutate(fn) {
    await ensureIndexes();
    const before = await loadStore();
    const after = JSON.parse(JSON.stringify(before));
    const result = fn(after);
    await persistDiff(before, after, null);
    return result;
  }

  // Atomic mutation: publish and discard can change many records across
  // all three kinds at once, and the app's contract is that this promotion
  // is all-or-nothing. Runs inside a MongoDB transaction when the cluster
  // supports one (every Atlas tier); see mongoClient.js for the documented
  // fallback when it does not (standalone mongod only).
  //
  // The callback re-reads the current store and recomputes the diff on
  // every attempt, because MongoDB retries a transaction's callback on a
  // transient error.
  async function mutateAtomic(fn) {
    await ensureIndexes();
    return withOptionalTransaction(async (session) => {
      const before = await loadStore(session);
      const after = JSON.parse(JSON.stringify(before));
      const result = fn(after);
      await persistDiff(before, after, session);
      return result;
    });
  }

  async function withStore(fn) {
    await ensureIndexes();
    const store = await loadStore();
    return fn(store);
  }

  return {
    mode: 'mongodb',
    async listProducts(options) {
      return withStore((s) => listProducts(s, options));
    },
    async listCollections(options) {
      return withStore((s) => listCollections(s, options));
    },
    async listBundles(options) {
      return withStore((s) => listBundles(s, options));
    },
    async getRecord(kind, id) {
      return withStore((s) => getRecord(s, kind, id));
    },
    async getPublicProduct(id) {
      return withStore((s) => getPublicProduct(s, id));
    },
    async listPublicBundles() {
      return withStore((s) => listPublicBundles(s));
    },
    async saveDraft(kind, id, fields) {
      return mutate((s) => saveDraft(s, kind, id, fields, randomUUID));
    },
    async deleteDraft(kind, id) {
      return mutate((s) => deleteDraft(s, kind, id));
    },
    async restoreDraft(kind, id) {
      return mutate((s) => restoreDraft(s, kind, id));
    },
    async reorderCollections(orderedIds) {
      return mutate((s) => reorderCollections(s, orderedIds));
    },
    async markStockImmediate(productId, stockStatus) {
      return mutate((s) => markStockImmediate(s, productId, stockStatus));
    },
    async changesSummary() {
      return withStore((s) => changesSummary(s));
    },
    async changesDetail() {
      return withStore((s) => changesDetail(s));
    },
    async publishAll() {
      return mutateAtomic((s) => {
        publishAll(s);
        return changesSummary(s);
      });
    },
    async discardAll() {
      return mutateAtomic((s) => {
        discardAll(s);
        return changesSummary(s);
      });
    },
  };
}

// Production with no database: every call fails LOUD with the exact
// configuration error. Silent in-memory fallback is what caused the live
// "publish succeeds but nothing appears" bug; it must never happen again.
function createUnconfiguredAdapter() {
  return new Proxy(
    { mode: 'unconfigured' },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (prop === 'then') return undefined; // keep `await adapter` sane
        return async () => {
          throw dbNotConfiguredError();
        };
      },
    }
  );
}

let adapter = null;

export function getCatalogAdapter() {
  if (!adapter) {
    // DATABASE_MONGODB_URI (or MONGODB_URI) set -> MongoDB Atlas. With it
    // unset: local dev uses the JSON file store; PRODUCTION refuses to run
    // (loud failure, see runtimeEnv.js) because serverless memory loses
    // every write.
    const uri = mongoUri();
    if (uri) adapter = createMongoAdapter();
    else if (isProductionRuntime()) adapter = createUnconfiguredAdapter();
    else adapter = createDevAdapter();
  }
  return adapter;
}
