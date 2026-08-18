// API client used by the public catalog reads and the admin product studio.
//
// It calls the real serverless endpoints first. If the API is unreachable
// (plain `vite dev` / `vite preview` with no functions runtime), it falls
// back to the in-browser demo adapter so the admin stays fully interactive.
// Both paths return the same shape: { status, body }.

import { demoAdapter } from './demoAdapter.js';

async function callApi(path, options) {
  const res = await fetch(path, options);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json') && !contentType.includes('text/csv')) {
    // Vite's SPA fallback answers unknown paths with index.html; treat any
    // non-JSON response as "no API available" so we switch to demo mode.
    throw new Error('api-unavailable');
  }
  if (contentType.includes('text/csv')) {
    return { status: res.status, body: await res.text() };
  }
  return { status: res.status, body: await res.json() };
}

function authHeaders(token, json = true) {
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  };
}

// ---- Admin auth ----

export async function adminLogin(password) {
  try {
    return await callApi('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
  } catch {
    return demoAdapter.login(password);
  }
}

// ---- Public catalog reads (published snapshot only) ----

export async function publicGetCatalog({ collectionId, q } = {}) {
  const params = new URLSearchParams();
  if (collectionId) params.set('collection', collectionId);
  if (q) params.set('q', q);
  const query = params.toString() ? `?${params.toString()}` : '';
  try {
    return await callApi(`/api/inventory${query}`, { method: 'GET' });
  } catch {
    return demoAdapter.publicGetCatalog({ collectionId, q });
  }
}

export async function publicGetItem(id) {
  try {
    return await callApi(`/api/inventory?id=${encodeURIComponent(id)}`, {
      method: 'GET',
    });
  } catch {
    return demoAdapter.publicGetItem(id);
  }
}

// ---- Catalog: generic admin CRUD over products / collections / bundles ----

const ADMIN_PATHS = {
  products: '/api/admin/products',
  collections: '/api/admin/collections',
  bundles: '/api/admin/bundles',
};

export async function adminListCatalog(token, kind, { collectionId, q } = {}) {
  const params = new URLSearchParams();
  if (collectionId) params.set('collection', collectionId);
  if (q) params.set('q', q);
  const query = params.toString() ? `?${params.toString()}` : '';
  try {
    return await callApi(`${ADMIN_PATHS[kind]}${query}`, {
      method: 'GET',
      headers: authHeaders(token, false),
    });
  } catch {
    return demoAdapter.listCatalog(token, kind, { collectionId, q });
  }
}

export async function adminSaveDraft(token, kind, idOrNull, fields) {
  try {
    return await callApi(ADMIN_PATHS[kind], {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(idOrNull ? { id: idOrNull, ...fields } : fields),
    });
  } catch {
    return demoAdapter.saveDraft(token, kind, idOrNull, fields);
  }
}

export async function adminDeleteDraft(token, kind, id) {
  try {
    return await callApi(ADMIN_PATHS[kind], {
      method: 'DELETE',
      headers: authHeaders(token),
      body: JSON.stringify({ id }),
    });
  } catch {
    return demoAdapter.deleteDraft(token, kind, id);
  }
}

export async function adminRestoreDraft(token, kind, id) {
  try {
    return await callApi(ADMIN_PATHS[kind], {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ id, restore: true }),
    });
  } catch {
    return demoAdapter.restoreDraft(token, kind, id);
  }
}

export async function adminReorderCollections(token, order) {
  try {
    return await callApi(ADMIN_PATHS.collections, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ order }),
    });
  } catch {
    return demoAdapter.reorderCollections(token, order);
  }
}

// ---- Publish flow ----

export async function adminPublishSummary(token) {
  try {
    return await callApi('/api/admin/publish', {
      method: 'GET',
      headers: authHeaders(token, false),
    });
  } catch {
    return demoAdapter.publishSummary(token);
  }
}

export async function adminPublishAction(token, action) {
  try {
    return await callApi('/api/admin/publish', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ action }),
    });
  } catch {
    return demoAdapter.publishAction(token, action);
  }
}

// ---- Bulk CSV ----

export async function adminExportCsv(token) {
  try {
    return await callApi('/api/admin/products-csv', {
      method: 'GET',
      headers: authHeaders(token, false),
    });
  } catch {
    return demoAdapter.exportCsv(token);
  }
}

export async function adminImportCsv(token, csv) {
  try {
    return await callApi('/api/admin/products-csv', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ csv }),
    });
  } catch {
    return demoAdapter.importCsv(token, csv);
  }
}

// ---- Photo upload (products, collection covers, bundle photos) ----

export async function adminUploadImage(token, payload) {
  try {
    return await callApi('/api/admin/inventory-image', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    });
  } catch {
    return demoAdapter.uploadImage(token, payload);
  }
}
