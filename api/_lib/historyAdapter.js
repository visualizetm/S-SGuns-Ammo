// Publish-history adapter: an append-only log of what each Publish put
// live, following the same dev/production split as the other adapters.
// Owner-only; never exposed on a public endpoint.
//
//   listHistory()            -> entries, newest first (capped at KEEP)
//   recordPublish(fields)    -> created entry { id, publishedAt, total,
//                               detail, publishedBy }
//
// detail is the itemized diff from shared/catalogStore.changesDetail:
// { products: { added, updated, removed }, collections: {...}, bundles: {...} }
// with each list holding item names. The last KEEP publishes are retained.

import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { isProductionRuntime, dbNotConfiguredError, databaseUrl } from './runtimeEnv.js';

const DEV_STORE_PATH = join(process.cwd(), '.data', 'publish-history-dev.json');
const TABLE = 'publish_history';
export const HISTORY_KEEP = 100;

function newEntry(fields) {
  return {
    id: randomUUID(),
    publishedAt: new Date().toISOString(),
    total: Number(fields.total) || 0,
    detail: fields.detail || {},
    publishedBy: fields.publishedBy || 'Owner',
  };
}

// ---------- Dev store: JSON file ----------

function createDevHistoryAdapter() {
  let canPersist = true;

  function load() {
    if (globalThis.__ssgaHistoryStore) return globalThis.__ssgaHistoryStore;
    let store;
    try {
      store = JSON.parse(readFileSync(DEV_STORE_PATH, 'utf8'));
    } catch {
      store = [];
    }
    globalThis.__ssgaHistoryStore = store;
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

  return {
    mode: 'dev-file',
    async listHistory() {
      return [...load()]
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
        .slice(0, HISTORY_KEEP);
    },
    async recordPublish(fields) {
      const store = load();
      const entry = newEntry(fields);
      store.unshift(entry);
      store.length = Math.min(store.length, HISTORY_KEEP);
      persist(store);
      return entry;
    },
  };
}

// ---------- Production store: Postgres ----------

function createPostgresHistoryAdapter(connectionString) {
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
        await sql.unsafe(`CREATE TABLE IF NOT EXISTS ${TABLE} (
          id TEXT PRIMARY KEY,
          published_at TIMESTAMPTZ NOT NULL,
          total INTEGER NOT NULL,
          detail JSONB NOT NULL,
          published_by TEXT NOT NULL
        )`);
        return sql;
      })();
    }
    return sqlPromise;
  }

  function rowToEntry(row) {
    return {
      id: row.id,
      publishedAt: new Date(row.published_at).toISOString(),
      total: Number(row.total),
      detail: row.detail || {},
      publishedBy: row.published_by,
    };
  }

  return {
    mode: 'postgres',
    async listHistory() {
      const sql = await getSql();
      const rows = await sql.unsafe(
        `SELECT * FROM ${TABLE} ORDER BY published_at DESC LIMIT ${HISTORY_KEEP}`
      );
      return rows.map(rowToEntry);
    },
    async recordPublish(fields) {
      const sql = await getSql();
      const entry = newEntry(fields);
      await sql.unsafe(
        `INSERT INTO ${TABLE} (id, published_at, total, detail, published_by)
         VALUES ($1, $2, $3, $4::jsonb, $5)`,
        [entry.id, entry.publishedAt, entry.total, entry.detail, entry.publishedBy]
      );
      // Keep at most HISTORY_KEEP entries.
      await sql.unsafe(
        `DELETE FROM ${TABLE} WHERE id NOT IN (
           SELECT id FROM ${TABLE} ORDER BY published_at DESC LIMIT ${HISTORY_KEEP}
         )`
      );
      return entry;
    },
  };
}

// Production with no database fails LOUD (same rule as every adapter).
function createUnconfiguredHistoryAdapter() {
  return new Proxy(
    { mode: 'unconfigured' },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (prop === 'then') return undefined;
        return async () => {
          throw dbNotConfiguredError();
        };
      },
    }
  );
}

let historyAdapter = null;

export function getHistoryAdapter() {
  if (!historyAdapter) {
    const url = databaseUrl();
    if (url) historyAdapter = createPostgresHistoryAdapter(url);
    else if (isProductionRuntime()) historyAdapter = createUnconfiguredHistoryAdapter();
    else historyAdapter = createDevHistoryAdapter();
  }
  return historyAdapter;
}
