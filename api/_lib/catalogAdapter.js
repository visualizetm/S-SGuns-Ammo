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
//   - DATABASE_URL set -> serverless Postgres (Neon / Vercel Postgres),
//     one JSONB row per record, publish/discard in a single transaction.
//   - otherwise -> dev JSON file store at .data/catalog-dev.json seeded
//     with DEMO records; in-memory on read-only filesystems.
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
  publishAll,
  discardAll,
} from '../../shared/catalogStore.js';
import { seedCatalogStore } from '../../shared/catalogSeeds.js';

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

// ---------- Production store: serverless Postgres ----------

const TABLES = {
  products: 'catalog_products',
  collections: 'catalog_collections',
  bundles: 'catalog_bundles',
};

// One diff of two stores into the minimal set of write statements
// (parameterized text + params), shared by mutate and the atomic publish.
function diffStatements(before, after) {
  const statements = [];
  for (const kind of KINDS) {
    const beforeById = new Map(before[kind].map((r) => [r.id, r]));
    const afterIds = new Set(after[kind].map((r) => r.id));
    for (const record of after[kind]) {
      const prev = beforeById.get(record.id);
      if (prev && JSON.stringify(prev) === JSON.stringify(record)) continue;
      statements.push({
        text: `INSERT INTO ${TABLES[kind]} (id, created_at, updated_at, draft, published)
               VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
               ON CONFLICT (id) DO UPDATE SET
                 updated_at = EXCLUDED.updated_at,
                 draft = EXCLUDED.draft,
                 published = EXCLUDED.published`,
        // Pass the objects directly: the postgres driver serializes them to
        // jsonb once. Pre-stringifying would double-encode into a JSON string.
        params: [
          record.id,
          record.createdAt,
          record.updatedAt,
          record.draft,
          record.published,
        ],
      });
    }
    for (const prev of before[kind]) {
      if (!afterIds.has(prev.id)) {
        statements.push({
          text: `DELETE FROM ${TABLES[kind]} WHERE id = $1`,
          params: [prev.id],
        });
      }
    }
  }
  return statements;
}

// Production store: any standard Postgres reached over the wire, using the
// `postgres` driver. Works with Supabase (via the Vercel integration's
// pooled POSTGRES_URL), Neon, Vercel Postgres, or a self-hosted database.
// prepare:false is required for Supabase's transaction-mode pooler
// (pgBouncer), which does not support prepared statements.
function createPostgresAdapter(connectionString) {
  let sqlPromise = null;

  async function getSql() {
    if (!sqlPromise) {
      sqlPromise = (async () => {
        const { default: postgres } = await import('postgres');
        const local = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
        const sql = postgres(connectionString, {
          prepare: false,
          ssl: local ? false : 'require',
          max: 3,
          idle_timeout: 20,
          connect_timeout: 15,
        });
        for (const table of Object.values(TABLES)) {
          await sql.unsafe(`CREATE TABLE IF NOT EXISTS ${table} (
            id TEXT PRIMARY KEY,
            created_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL,
            draft JSONB,
            published JSONB
          )`);
        }
        return sql;
      })();
    }
    return sqlPromise;
  }

  // Load the catalog, apply the same pure operations as the dev store, then
  // write back only changed rows. The catalog is shop-scale (hundreds of
  // rows), so this stays fast; publish/discard persist in one transaction.
  async function loadStore(sql) {
    const store = { products: [], collections: [], bundles: [] };
    for (const kind of KINDS) {
      const rows = await sql.unsafe(
        `SELECT id, created_at, updated_at, draft, published FROM ${TABLES[kind]}`
      );
      store[kind] = rows.map((row) => ({
        id: row.id,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
        draft: row.draft,
        published: row.published,
      }));
    }
    return store;
  }

  async function mutate(fn) {
    const sql = await getSql();
    const before = await loadStore(sql);
    const after = JSON.parse(JSON.stringify(before));
    const result = fn(after);
    for (const { text, params } of diffStatements(before, after)) {
      await sql.unsafe(text, params);
    }
    return result;
  }

  async function mutateAtomic(fn) {
    const sql = await getSql();
    const before = await loadStore(sql);
    const after = JSON.parse(JSON.stringify(before));
    const result = fn(after);
    const statements = diffStatements(before, after);
    if (statements.length > 0) {
      await sql.begin(async (tx) => {
        for (const { text, params } of statements) await tx.unsafe(text, params);
      });
    }
    return result;
  }

  async function withStore(fn) {
    const sql = await getSql();
    const store = await loadStore(sql);
    return fn(store);
  }

  return {
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

let adapter = null;

export function getCatalogAdapter() {
  if (!adapter) {
    // Vercel's Supabase/Postgres integrations set POSTGRES_URL (the pooled,
    // transaction-mode connection string, ideal for serverless). DATABASE_URL
    // is also honored for other providers. With neither set, the dev store
    // (DEMO seeds) is used.
    const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    adapter = url ? createPostgresAdapter(url) : createDevAdapter();
  }
  return adapter;
}
