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
// Dev: JSON file .data/sales-dev.json, seeded with DEMO sales.
// Production: `sales` table via POSTGRES_URL/DATABASE_URL, self-creating,
// starts EMPTY. DEMO sales never promote.

import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { seedSalesStore } from '../../shared/salesSeeds.js';

const DEV_STORE_PATH = join(process.cwd(), '.data', 'sales-dev.json');
const TABLE = 'sales';

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

// ---------- Production store: Postgres ----------

function createPostgresSalesAdapter(connectionString) {
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
          created_at TIMESTAMPTZ NOT NULL,
          product_id TEXT,
          product_name_snapshot TEXT NOT NULL,
          price_at_sale NUMERIC NOT NULL,
          quantity INTEGER NOT NULL,
          sold_at TIMESTAMPTZ NOT NULL,
          note TEXT,
          marked_sold BOOLEAN NOT NULL DEFAULT false,
          prev_stock_status TEXT
        )`);
        return sql;
      })();
    }
    return sqlPromise;
  }

  function rowToEntry(row) {
    return {
      id: row.id,
      createdAt: new Date(row.created_at).toISOString(),
      productId: row.product_id,
      productNameSnapshot: row.product_name_snapshot,
      priceAtSale: Number(row.price_at_sale),
      quantity: Number(row.quantity),
      soldAt: new Date(row.sold_at).toISOString(),
      note: row.note || '',
      markedSold: row.marked_sold === true,
      prevStockStatus: row.prev_stock_status ?? null,
    };
  }

  return {
    async listSales({ from, to } = {}) {
      const sql = await getSql();
      const clauses = [];
      const params = [];
      if (from) {
        params.push(from);
        clauses.push(`sold_at >= $${params.length}`);
      }
      if (to) {
        params.push(to);
        clauses.push(`sold_at <= $${params.length}`);
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const rows = await sql.unsafe(
        `SELECT * FROM ${TABLE} ${where} ORDER BY sold_at DESC`,
        params
      );
      return rows.map(rowToEntry);
    },
    async createSale(fields) {
      const sql = await getSql();
      const entry = newEntry(fields);
      await sql.unsafe(
        `INSERT INTO ${TABLE}
           (id, created_at, product_id, product_name_snapshot, price_at_sale,
            quantity, sold_at, note, marked_sold, prev_stock_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          entry.id,
          entry.createdAt,
          entry.productId,
          entry.productNameSnapshot,
          entry.priceAtSale,
          entry.quantity,
          entry.soldAt,
          entry.note,
          entry.markedSold,
          entry.prevStockStatus,
        ]
      );
      return entry;
    },
    async getSale(id) {
      const sql = await getSql();
      const rows = await sql.unsafe(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
      return rows[0] ? rowToEntry(rows[0]) : null;
    },
    async deleteSale(id) {
      const sql = await getSql();
      const rows = await sql.unsafe(
        `DELETE FROM ${TABLE} WHERE id = $1 RETURNING *`,
        [id]
      );
      return rows[0] ? rowToEntry(rows[0]) : null;
    },
  };
}

let salesAdapter = null;

export function getSalesAdapter() {
  if (!salesAdapter) {
    const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    salesAdapter = url
      ? createPostgresSalesAdapter(url)
      : createDevSalesAdapter();
  }
  return salesAdapter;
}
