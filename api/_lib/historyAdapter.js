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
import { isProductionRuntime, dbNotConfiguredError, mongoUri } from './runtimeEnv.js';
import { getCollection, ensureIndexes } from './mongoClient.js';

const DEV_STORE_PATH = join(process.cwd(), '.data', 'publish-history-dev.json');
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

// ---------- Production store: MongoDB Atlas ----------

function createMongoHistoryAdapter() {
  async function col() {
    await ensureIndexes();
    return getCollection('publishHistory');
  }

  return {
    mode: 'mongodb',
    async listHistory() {
      const c = await col();
      return c
        .find({}, { projection: { _id: 0 } })
        .sort({ publishedAt: -1 })
        .limit(HISTORY_KEEP)
        .toArray();
    },
    async recordPublish(fields) {
      const c = await col();
      const entry = newEntry(fields);
      await c.insertOne({ ...entry });
      // Keep at most HISTORY_KEEP entries: find the ids of everything
      // beyond the newest HISTORY_KEEP and drop them.
      const overflow = await c
        .find({}, { projection: { _id: 0, id: 1 } })
        .sort({ publishedAt: -1 })
        .skip(HISTORY_KEEP)
        .toArray();
      if (overflow.length > 0) {
        await c.deleteMany({ id: { $in: overflow.map((o) => o.id) } });
      }
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
    const uri = mongoUri();
    if (uri) historyAdapter = createMongoHistoryAdapter();
    else if (isProductionRuntime()) historyAdapter = createUnconfiguredHistoryAdapter();
    else historyAdapter = createDevHistoryAdapter();
  }
  return historyAdapter;
}
