// Data adapter for the inventory store, same pattern as the leads adapter:
// endpoints talk to storage ONLY through this interface.
//
// Interface (all methods return plain item objects):
//   listItems({ includeHidden?, category?, q? }) -> Promise<Item[]> (newest first)
//   getItem(id)                                  -> Promise<Item | null>
//   createItem(data)                             -> Promise<Item>
//   updateItem(id, patch)                        -> Promise<Item | null>
//   deleteItem(id)                               -> Promise<boolean>
//
// Implementations, selected from the environment at runtime:
//   - DATABASE_URL set  -> serverless Postgres (Neon / Vercel Postgres)
//   - otherwise         -> dev JSON file store at .data/inventory-dev.json,
//                          seeded with DEMO items; falls back to in-memory
//                          when the filesystem is read-only (deployed demo).
// Setup steps for production live in PRODUCTION-SETUP.md.

import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { SEED_INVENTORY } from '../../shared/inventorySeeds.js';

const DEV_STORE_PATH = join(process.cwd(), '.data', 'inventory-dev.json');

function matchesQuery(item, q) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return [item.name, item.manufacturer, item.model, item.caliber, item.description]
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

function applyFilters(items, { includeHidden = false, category, q } = {}) {
  return items
    .filter((item) => includeHidden || item.stockStatus !== 'Hidden')
    .filter((item) => !category || item.category === category)
    .filter((item) => matchesQuery(item, q))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function newItem(data) {
  const now = new Date().toISOString();
  return { id: randomUUID(), createdAt: now, updatedAt: now, ...data };
}

// ---------- Dev store: JSON file with in-memory fallback ----------

function createDevAdapter() {
  // The file store gives real persistence for local work with zero
  // credentials. On read-only serverless filesystems the write fails and we
  // silently run in-memory (resets on cold start, same as the leads demo).
  let canPersist = true;

  function load() {
    if (globalThis.__ssgaInventoryStore) return globalThis.__ssgaInventoryStore;
    let items;
    try {
      items = JSON.parse(readFileSync(DEV_STORE_PATH, 'utf8'));
    } catch {
      items = SEED_INVENTORY.map((item) => ({ ...item }));
    }
    globalThis.__ssgaInventoryStore = items;
    persist(items);
    return items;
  }

  function persist(items) {
    if (!canPersist) return;
    try {
      mkdirSync(dirname(DEV_STORE_PATH), { recursive: true });
      writeFileSync(DEV_STORE_PATH, JSON.stringify(items, null, 2));
    } catch {
      canPersist = false;
    }
  }

  return {
    async listItems(options) {
      return applyFilters(load(), options).map((item) => ({ ...item }));
    },
    async getItem(id) {
      const item = load().find((i) => i.id === id);
      return item ? { ...item } : null;
    },
    async createItem(data) {
      const items = load();
      const item = newItem(data);
      items.push(item);
      persist(items);
      return { ...item };
    },
    async updateItem(id, patch) {
      const items = load();
      const item = items.find((i) => i.id === id);
      if (!item) return null;
      Object.assign(item, patch, { updatedAt: new Date().toISOString() });
      persist(items);
      return { ...item };
    },
    async deleteItem(id) {
      const items = load();
      const index = items.findIndex((i) => i.id === id);
      if (index === -1) return false;
      items.splice(index, 1);
      persist(items);
      return true;
    },
  };
}

// ---------- Production store: serverless Postgres ----------

const TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS inventory_items (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    data JSONB NOT NULL
  )`;

function rowToItem(row) {
  return {
    ...row.data,
    id: row.id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function createPostgresAdapter(databaseUrl) {
  let sqlPromise = null;

  async function sql() {
    if (!sqlPromise) {
      sqlPromise = (async () => {
        const { neon } = await import('@neondatabase/serverless');
        const client = neon(databaseUrl);
        await client(TABLE_SQL);
        return client;
      })();
    }
    return sqlPromise;
  }

  function stripMeta(item) {
    const { id, createdAt, updatedAt, ...data } = item;
    return data;
  }

  return {
    async listItems(options = {}) {
      const client = await sql();
      const rows = await client`
        SELECT id, created_at, updated_at, data FROM inventory_items
        ORDER BY created_at DESC`;
      return applyFilters(rows.map(rowToItem), options);
    },
    async getItem(id) {
      const client = await sql();
      const rows = await client`
        SELECT id, created_at, updated_at, data FROM inventory_items
        WHERE id = ${id}`;
      return rows.length ? rowToItem(rows[0]) : null;
    },
    async createItem(data) {
      const client = await sql();
      const item = newItem(data);
      await client`
        INSERT INTO inventory_items (id, created_at, updated_at, data)
        VALUES (${item.id}, ${item.createdAt}, ${item.updatedAt},
                ${JSON.stringify(stripMeta(item))})`;
      return item;
    },
    async updateItem(id, patch) {
      const existing = await this.getItem(id);
      if (!existing) return null;
      const item = {
        ...existing,
        ...patch,
        id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      };
      const client = await sql();
      await client`
        UPDATE inventory_items
        SET updated_at = ${item.updatedAt}, data = ${JSON.stringify(stripMeta(item))}
        WHERE id = ${id}`;
      return item;
    },
    async deleteItem(id) {
      const client = await sql();
      const rows = await client`
        DELETE FROM inventory_items WHERE id = ${id} RETURNING id`;
      return rows.length > 0;
    },
  };
}

let adapter = null;

export function getInventoryAdapter() {
  if (!adapter) {
    adapter = process.env.DATABASE_URL
      ? createPostgresAdapter(process.env.DATABASE_URL)
      : createDevAdapter();
  }
  return adapter;
}
