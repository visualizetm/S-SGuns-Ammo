// In-browser DEMO adapter.
//
// Used only when the serverless API is unreachable (e.g. `vite dev` or
// `vite preview` without Vercel functions). The catalog mirrors the server
// exactly because both wrap the same pure store operations in
// shared/catalogStore.js; persistence here is localStorage.
//
// The demo admin gate here is cosmetic by design: anything shipped to the
// browser can be inspected, so this path must never guard real data. Real
// deployments authenticate in api/_lib/auth.js on the server.

import {
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
  displayOf,
  statusOf,
} from '../../shared/catalogStore.js';
import { seedCatalogStore } from '../../shared/catalogSeeds.js';
import {
  validateProduct,
  validateCollection,
  validateBundle,
  withComputedSale,
} from '../../shared/catalogValidation.js';
import { seedSalesStore } from '../../shared/salesSeeds.js';
import { validateSale } from '../../shared/salesValidation.js';

const CATALOG_KEY = 'ssga-demo-catalog';
const SALES_KEY = 'ssga-demo-sales';
const DEMO_PASSWORD = 'oxford';
const DEMO_TOKEN = 'demo-local-token';

function loadCatalog() {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through to reseed
  }
  const seeded = seedCatalogStore();
  saveCatalog(seeded);
  return seeded;
}

function saveCatalog(store) {
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(store));
  } catch {
    // storage unavailable; demo continues in-memory for this page load
  }
}

function loadSales() {
  try {
    const raw = localStorage.getItem(SALES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through to reseed
  }
  const seeded = seedSalesStore();
  saveSales(seeded);
  return seeded;
}

function saveSales(list) {
  try {
    localStorage.setItem(SALES_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable; demo continues in-memory for this page load
  }
}

function delay(ms = 250) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeId() {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function denied() {
  return { status: 401, body: { ok: false, error: 'Not authorized.' } };
}

function invalid(errors) {
  return {
    status: 422,
    body: { ok: false, error: 'Please correct the highlighted fields.', errors },
  };
}

function itemOf(record) {
  return { ...displayOf(record), id: record.id, status: statusOf(record) };
}

const VALIDATORS = {
  products: validateProduct,
  collections: validateCollection,
  bundles: validateBundle,
};

export const demoAdapter = {
  async login(password) {
    await delay(200);
    if (password === DEMO_PASSWORD) {
      return { status: 200, body: { ok: true, token: DEMO_TOKEN } };
    }
    return { status: 401, body: { ok: false, error: 'Incorrect password.' } };
  },

  // ---- Public catalog reads (published snapshot only) ----

  async publicGetCatalog({ collectionId, q } = {}) {
    await delay(150);
    const store = loadCatalog();
    return {
      status: 200,
      body: {
        ok: true,
        items: listProducts(store, { scope: 'published', collectionId, q }),
        collections: listCollections(store, { scope: 'published' }),
        bundles: listPublicBundles(store),
      },
    };
  },

  async publicGetItem(id) {
    await delay(150);
    const item = getPublicProduct(loadCatalog(), id);
    if (!item) {
      return { status: 404, body: { ok: false, error: 'Item not found.' } };
    }
    return { status: 200, body: { ok: true, item } };
  },

  // ---- Catalog (same pure operations as the server dev store) ----

  async listCatalog(token, kind, { collectionId, q } = {}) {
    await delay(150);
    if (token !== DEMO_TOKEN) return denied();
    const store = loadCatalog();
    const items =
      kind === 'products'
        ? listProducts(store, { scope: 'draft', collectionId, q, includeHidden: true })
        : kind === 'collections'
          ? listCollections(store, { scope: 'draft' })
          : listBundles(store, { scope: 'draft' });
    return { status: 200, body: { ok: true, items } };
  },

  async saveDraft(token, kind, id, fields) {
    await delay(150);
    if (token !== DEMO_TOKEN) return denied();
    const store = loadCatalog();

    let base = {};
    if (id) {
      const existing = getRecord(store, kind, id);
      if (!existing || existing.draft === null) {
        return { status: 404, body: { ok: false, error: 'Not found.' } };
      }
      base = existing.draft;
    }

    const result = VALIDATORS[kind]({ ...base, ...fields });
    if (!result.ok) return invalid(result.errors);
    let data = result.data;

    if (kind === 'products') {
      const known = new Set(listCollections(store, { scope: 'draft' }).map((c) => c.id));
      if ((data.collectionIds || []).some((cid) => !known.has(cid))) {
        return invalid({ collectionIds: 'One of those collections no longer exists.' });
      }
      data = withComputedSale(data);
    }
    if (kind === 'collections' && data.sortOrder === undefined) {
      const existing = listCollections(store, { scope: 'draft' });
      data.sortOrder = existing.length
        ? Math.max(...existing.map((c) => c.sortOrder ?? 0)) + 1
        : 0;
    }
    if (kind === 'bundles') {
      const known = new Set(
        listProducts(store, { scope: 'draft', includeHidden: true }).map((p) => p.id)
      );
      if ((data.memberProductIds || []).some((pid) => !known.has(pid))) {
        return invalid({
          memberProductIds: 'One of those products no longer exists. Re-pick the bundle members.',
        });
      }
    }

    const record = saveDraft(store, kind, id || null, data, makeId);
    saveCatalog(store);
    return { status: id ? 200 : 201, body: { ok: true, item: itemOf(record) } };
  },

  async deleteDraft(token, kind, id) {
    await delay(150);
    if (token !== DEMO_TOKEN) return denied();
    const store = loadCatalog();
    const deleted = deleteDraft(store, kind, id);
    if (!deleted) return { status: 404, body: { ok: false, error: 'Not found.' } };
    saveCatalog(store);
    return { status: 200, body: { ok: true } };
  },

  async restoreDraft(token, kind, id) {
    await delay(150);
    if (token !== DEMO_TOKEN) return denied();
    const store = loadCatalog();
    const record = restoreDraft(store, kind, id);
    if (!record) return { status: 404, body: { ok: false, error: 'Nothing to restore.' } };
    saveCatalog(store);
    return { status: 200, body: { ok: true, item: itemOf(record) } };
  },

  async reorderCollections(token, order) {
    await delay(150);
    if (token !== DEMO_TOKEN) return denied();
    const store = loadCatalog();
    reorderCollections(store, order);
    saveCatalog(store);
    return { status: 200, body: { ok: true } };
  },

  async publishSummary(token) {
    await delay(120);
    if (token !== DEMO_TOKEN) return denied();
    return { status: 200, body: { ok: true, summary: changesSummary(loadCatalog()) } };
  },

  async publishAction(token, action) {
    await delay(250);
    if (token !== DEMO_TOKEN) return denied();
    if (action !== 'publish' && action !== 'discard') {
      return { status: 400, body: { ok: false, error: 'Action must be "publish" or "discard".' } };
    }
    const store = loadCatalog();
    if (action === 'publish') publishAll(store);
    else discardAll(store);
    saveCatalog(store);
    return { status: 200, body: { ok: true, summary: changesSummary(store) } };
  },

  // ---- Quick Sale: sales log (mirrors api/admin/sales.js) ----

  async listSales(token, { from, to } = {}) {
    await delay(120);
    if (token !== DEMO_TOKEN) return denied();
    const list = loadSales()
      .filter((e) => (!from || e.soldAt >= from) && (!to || e.soldAt <= to))
      .sort((a, b) => b.soldAt.localeCompare(a.soldAt));
    return { status: 200, body: { ok: true, items: list } };
  },

  async logSale(token, input) {
    await delay(180);
    if (token !== DEMO_TOKEN) return denied();
    const result = validateSale(input);
    if (!result.ok) return invalid(result.errors);
    const data = result.data;

    const catalog = loadCatalog();
    const record = getRecord(catalog, 'products', data.productId);
    if (!record) {
      return invalid({ productId: 'That product no longer exists.' });
    }
    const productNameSnapshot = (displayOf(record) || {}).name || 'Unknown item';

    // Immediate stock write-through (Quick Sale only): both draft + published.
    let markedSold = false;
    let prevStockStatus = null;
    if (data.markSold) {
      const outcome = markStockImmediate(catalog, data.productId, 'Sold');
      if (outcome) {
        markedSold = true;
        prevStockStatus = outcome.previous;
        saveCatalog(catalog);
      }
    }

    const now = new Date().toISOString();
    const sale = {
      id: makeId(),
      createdAt: now,
      productId: data.productId,
      productNameSnapshot,
      priceAtSale: data.priceAtSale,
      quantity: data.quantity,
      soldAt: data.soldAt,
      note: data.note || '',
      markedSold,
      prevStockStatus,
    };
    const sales = loadSales();
    sales.unshift(sale);
    saveSales(sales);
    return { status: 201, body: { ok: true, sale } };
  },

  async deleteSale(token, id) {
    await delay(150);
    if (token !== DEMO_TOKEN) return denied();
    const sales = loadSales();
    const index = sales.findIndex((e) => e.id === id);
    if (index === -1) return { status: 404, body: { ok: false, error: 'Sale not found.' } };
    const [removed] = sales.splice(index, 1);
    saveSales(sales);
    let restored = null;
    if (removed.markedSold && removed.prevStockStatus) {
      const catalog = loadCatalog();
      markStockImmediate(catalog, removed.productId, removed.prevStockStatus);
      saveCatalog(catalog);
      restored = { productId: removed.productId, stockStatus: removed.prevStockStatus };
    }
    return { status: 200, body: { ok: true, restored } };
  },

  // ---- CSV: needs the real API (server-side row validation) ----

  async exportCsv() {
    await delay(100);
    return {
      status: 503,
      body: { ok: false, error: 'CSV export runs on the deployed site, not the local demo.' },
    };
  },

  async importCsv() {
    await delay(100);
    return {
      status: 503,
      body: { ok: false, error: 'CSV import runs on the deployed site, not the local demo.' },
    };
  },

  // ---- Photo upload ----

  async uploadImage(token, { dataUrl } = {}) {
    await delay(150);
    if (token !== DEMO_TOKEN) return denied();
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      return { status: 422, body: { ok: false, error: 'Upload must be an image.' } };
    }
    return { status: 201, body: { ok: true, url: dataUrl } };
  },
};
