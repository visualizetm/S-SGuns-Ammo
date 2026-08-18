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
  saveDraft,
  deleteDraft,
  restoreDraft,
  reorderCollections,
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

function createPostgresAdapter(databaseUrl) {
  let clientPromise = null;

  async function sql() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const { neon } = await import('@neondatabase/serverless');
        const client = neon(databaseUrl);
        for (const table of Object.values(TABLES)) {
          await client(`CREATE TABLE IF NOT EXISTS ${table} (
            id TEXT PRIMARY KEY,
            created_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL,
            draft JSONB,
            published JSONB
          )`);
        }
        return client;
      })();
    }
    return clientPromise;
  }

  // The Postgres implementation loads the catalog, applies the same pure
  // operations as the dev store, then writes back only changed rows. The
  // catalog is shop-scale (hundreds of rows), so this stays fast, and
  // publish/discard persist through a single transaction for atomicity.
  async function loadStore(client) {
    const store = { products: [], collections: [], bundles: [] };
    for (const kind of KINDS) {
      const rows = await client(
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

  function diffQueries(client, before, after) {
    const queries = [];
    for (const kind of KINDS) {
      const beforeById = new Map(before[kind].map((r) => [r.id, r]));
      const afterIds = new Set(after[kind].map((r) => r.id));
      for (const record of after[kind]) {
        const prev = beforeById.get(record.id);
        if (prev && JSON.stringify(prev) === JSON.stringify(record)) continue;
        queries.push(
          client(
            `INSERT INTO ${TABLES[kind]} (id, created_at, updated_at, draft, published)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id) DO UPDATE SET
               updated_at = EXCLUDED.updated_at,
               draft = EXCLUDED.draft,
               published = EXCLUDED.published`,
            [
              record.id,
              record.createdAt,
              record.updatedAt,
              record.draft === null ? null : JSON.stringify(record.draft),
              record.published === null ? null : JSON.stringify(record.published),
            ]
          )
        );
      }
      for (const prev of before[kind]) {
        if (!afterIds.has(prev.id)) {
          queries.push(
            client(`DELETE FROM ${TABLES[kind]} WHERE id = $1`, [prev.id])
          );
        }
      }
    }
    return queries;
  }

  async function mutate(fn) {
    const client = await sql();
    const before = await loadStore(client);
    const after = JSON.parse(JSON.stringify(before));
    const result = fn(after);
    const queries = diffQueries(client, before, after);
    // neon's http driver runs each query independently; sequential await
    // keeps ordering. Publish/discard route through mutateAtomic below.
    for (const query of queries) await query;
    return result;
  }

  async function mutateAtomic(fn) {
    const { neon } = await import('@neondatabase/serverless');
    const client = await sql();
    const before = await loadStore(client);
    const after = JSON.parse(JSON.stringify(before));
    const result = fn(after);
    const tx = neon(databaseUrl);
    const statements = diffQueriesAsText(before, after);
    if (statements.length > 0) {
      await tx.transaction((txn) =>
        statements.map(({ text, params }) => txn(text, params))
      );
    }
    return result;
  }

  function diffQueriesAsText(before, after) {
    const statements = [];
    for (const kind of KINDS) {
      const beforeById = new Map(before[kind].map((r) => [r.id, r]));
      const afterIds = new Set(after[kind].map((r) => r.id));
      for (const record of after[kind]) {
        const prev = beforeById.get(record.id);
        if (prev && JSON.stringify(prev) === JSON.stringify(record)) continue;
        statements.push({
          text: `INSERT INTO ${TABLES[kind]} (id, created_at, updated_at, draft, published)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (id) DO UPDATE SET
                   updated_at = EXCLUDED.updated_at,
                   draft = EXCLUDED.draft,
                   published = EXCLUDED.published`,
          params: [
            record.id,
            record.createdAt,
            record.updatedAt,
            record.draft === null ? null : JSON.stringify(record.draft),
            record.published === null ? null : JSON.stringify(record.published),
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

  async function withStore(fn) {
    const client = await sql();
    const store = await loadStore(client);
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
    adapter = process.env.DATABASE_URL
      ? createPostgresAdapter(process.env.DATABASE_URL)
      : createDevAdapter();
  }
  return adapter;
}
