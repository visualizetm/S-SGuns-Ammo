// In-browser DEMO adapter.
//
// Used only when the serverless API is unreachable (e.g. `vite dev` or
// `vite preview` without Vercel functions). The catalog mirrors the server
// exactly because both wrap the same pure store operations in
// shared/catalogStore.js; persistence here is localStorage.
//
// Public forms: the real endpoints forward to the owner's email through
// Web3Forms and store nothing. With no API there is nothing to forward to,
// so the demo returns the same honest "form is being set up" answer the
// server gives without an access key.
//
// The demo admin gate here is cosmetic by design: anything shipped to the
// browser can be inspected, so this path must never guard real data. Real
// deployments authenticate in api/_lib/auth.js on the server.

import { validateLead, isSpam, LEAD_TYPES } from '../../shared/validation.js';
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

const CATALOG_KEY = 'ssga-demo-catalog';
const DEMO_PASSWORD = 'oxford-demo';
const DEMO_TOKEN = 'demo-local-token';

const SETUP_MESSAGE =
  'This form is still being set up. Please call the shop at (610) 368-6984.';

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
  // ---- Public forms ----

  async submitLead(type, input) {
    await delay(300);
    if (!LEAD_TYPES.includes(type)) {
      return { status: 404, body: { ok: false, error: 'Unknown form.' } };
    }
    if (isSpam(input)) {
      return { status: 200, body: { ok: true } };
    }
    const result = validateLead(type, input);
    if (!result.ok) {
      return invalid(result.errors);
    }
    // No API means no Web3Forms forwarding: honest setup answer.
    return { status: 503, body: { ok: false, setup: true, error: SETUP_MESSAGE } };
  },

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
