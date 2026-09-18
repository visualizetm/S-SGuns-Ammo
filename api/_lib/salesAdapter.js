// Sales log adapter: a flat, append-only log of Quick Sale entries, following
// the same dev/production split as the catalog adapter. Owner-only; never
// exposed on a public endpoint.
//
// This is a convenience business/inventory log, NOT the federal ATF or state
// Acquisition and Disposition record, and it stores NO buyer personal
// information (see api/admin/sales.js and shared/salesValidation.js).
//
//   listSales({ from, to })  -> entries newest first, optional soldAt range
//   createSale(fields)       -> created entry (adds id + createdAt)
//   getSale(id)              -> entry | null
//   deleteSale(id)           -> deleted entry | null
//
// Dev: JSON file .data/sales-dev.json.
// Production: `sales` collection in MongoDB Atlas via MONGODB_URI,
// self-creating (an index is enough; MongoDB creates the collection on
// first write), starts EMPTY.

import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { seedSalesStore } from '../../shared/salesSeeds.js';
import { isProductionRuntime, dbNotConfiguredError, mongoUri } from './runtimeEnv.js';
import { getCollection, ensureIndexes } from './mongoClient.js';

const DEV_STORE_PATH = join(process.cwd(), '.data', 'sales-dev.json');

function inRange(entry, from, to) {
  if (from && entry.soldAt < from) return false;
  if (to && entry.soldAt > to) return false;
  return true;
}

function sortedDesc(list) {
  return [...list].sort((a, b) => b.soldAt.localeCompare(a.soldAt));
}

function newEntry(fields) {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    productId: fields.productId,
    productNameSnapshot: fields.productNameSnapshot,
    priceAtSale: fields.priceAtSale,
    quantity: fields.quantity,
    soldAt: fields.soldAt,
    note: fields.note || '',
    markedSold: fields.markedSold === true,
    prevStockStatus: fields.prevStockStatus ?? null,
  };
}

// ---------- Dev store: JSON file with in-memory fallback ----------

function createDevSalesAdapter() {
  let canPersist = true;

  function load() {
    if (globalThis.__ssgaSalesStore) return globalThis.__ssgaSalesStore;
    let store;
    try {
      store = JSON.parse(readFileSync(DEV_STORE_PATH, 'utf8'));
    } catch {
      store = seedSalesStore();
    }
    globalThis.__ssgaSalesStore = store;
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

  return {
    mode: 'dev-file',
    async listSales({ from, to } = {}) {
      return sortedDesc(load().filter((e) => inRange(e, from, to)));
    },
    async createSale(fields) {
      const store = load();
      const entry = newEntry(fields);
      store.unshift(entry);
      persist(store);
      return entry;
    },
    async getSale(id) {
      return load().find((e) => e.id === id) || null;
    },
    async deleteSale(id) {
      const store = load();
      const index = store.findIndex((e) => e.id === id);
      if (index === -1) return null;
      const [removed] = store.splice(index, 1);
      persist(store);
      return removed;
    },
  };
}

// ---------- Production store: MongoDB Atlas ----------

function createMongoSalesAdapter() {
  async function col() {
    await ensureIndexes();
    return getCollection('sales');
  }

  return {
    mode: 'mongodb',
    async listSales({ from, to } = {}) {
      const c = await col();
      const filter = {};
      if (from || to) {
        filter.soldAt = {};
        if (from) filter.soldAt.$gte = from;
        if (to) filter.soldAt.$lte = to;
      }
      return c
        .find(filter, { projection: { _id: 0 } })
        .sort({ soldAt: -1 })
        .toArray();
    },
    async createSale(fields) {
      const c = await col();
      const entry = newEntry(fields);
      await c.insertOne({ ...entry });
      return entry;
    },
    async getSale(id) {
      const c = await col();
      return c.findOne({ id }, { projection: { _id: 0 } });
    },
    async deleteSale(id) {
      const c = await col();
      const entry = await c.findOne({ id }, { projection: { _id: 0 } });
      if (!entry) return null;
      await c.deleteOne({ id });
      return entry;
    },
  };
}

// Production with no database fails LOUD (same rule as every adapter).
function createUnconfiguredSalesAdapter() {
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

let salesAdapter = null;

export function getSalesAdapter() {
  if (!salesAdapter) {
    const uri = mongoUri();
    if (uri) salesAdapter = createMongoSalesAdapter();
    else if (isProductionRuntime()) salesAdapter = createUnconfiguredSalesAdapter();
    else salesAdapter = createDevSalesAdapter();
  }
  return salesAdapter;
}
