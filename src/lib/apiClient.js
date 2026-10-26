// API client used by the public catalog reads and the admin product studio.
//
// It calls the real serverless endpoints first. If the API is unreachable
// (plain `vite dev` / `vite preview` with no functions runtime), it falls
// back to the in-browser demo adapter so the admin stays fully interactive.
// Both paths return the same shape: { status, body }.

import { demoAdapter } from './demoAdapter.js';
import { isDashboardHost } from '../config/hosts.js';

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

// ---- Health (dashboard diagnostics) ----

export async function adminHealth(token) {
  try {
    return await callApi('/api/admin/health', {
      method: 'GET',
      headers: authHeaders(token, false),
    });
  } catch {
    return demoAdapter.health(token);
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

// ---- Publish history ----

export async function adminPublishHistory(token) {
  try {
    return await callApi('/api/admin/publish-history', {
      method: 'GET',
      headers: authHeaders(token, false),
    });
  } catch {
    return demoAdapter.publishHistory(token);
  }
}

// ---- Quick Sale: sales log ----

export async function adminListSales(token, { from, to } = {}) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString() ? `?${params.toString()}` : '';
  try {
    return await callApi(`/api/admin/sales${query}`, {
      method: 'GET',
      headers: authHeaders(token, false),
    });
  } catch {
    return demoAdapter.listSales(token, { from, to });
  }
}

export async function adminLogSale(token, input) {
  try {
    return await callApi('/api/admin/sales', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(input),
    });
  } catch {
    return demoAdapter.logSale(token, input);
  }
}

export async function adminDeleteSale(token, id) {
  try {
    return await callApi(`/api/admin/sales?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(token, false),
    });
  } catch {
    return demoAdapter.deleteSale(token, id);
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

// ---- Shop hours and temporary closures ----
// Writes through immediately, like Quick Sale: no draft/publish step.

export async function publicGetHours() {
  try {
    return await callApi('/api/hours', { method: 'GET' });
  } catch {
    return demoAdapter.publicGetHours();
  }
}

// Demo mode exists for previews and local dev with no serverless API. On the
// real Owner's Dashboard host a failed request is a real failure: falling
// back to demo data there would show fake hours, or (with the real token)
// look like an expired session and sign the owner out. So on that host the
// failure is returned as a plain result instead. status 0 = no answer at
// all (offline, timed out); 502 = the server answered with something that
// is not the API (for example a platform timeout page).
function realHostFailure(err) {
  if (err?.message === 'api-unavailable') {
    return { status: 502, body: { ok: false, code: 'SERVER_UNAVAILABLE', error: 'Server unavailable.' } };
  }
  return { status: 0, body: { ok: false, code: 'NETWORK', error: 'No connection.' } };
}

// A request that never gets an answer must end, so the page can say so.
const HOURS_REQUEST_TIMEOUT_MS = 15000;
function hoursTimeout() {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(HOURS_REQUEST_TIMEOUT_MS)
    : undefined;
}

export async function adminGetHours(token) {
  try {
    return await callApi('/api/admin/hours', {
      method: 'GET',
      headers: authHeaders(token, false),
      signal: hoursTimeout(),
    });
  } catch (err) {
    if (isDashboardHost()) return realHostFailure(err);
    return demoAdapter.getHours(token);
  }
}

export async function adminSaveHours(token, weekly) {
  try {
    return await callApi('/api/admin/hours', {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ weekly }),
      signal: hoursTimeout(),
    });
  } catch (err) {
    if (isDashboardHost()) return realHostFailure(err);
    return demoAdapter.saveHours(token, weekly);
  }
}

export async function adminCreateClosure(token, fields) {
  try {
    return await callApi('/api/admin/closures', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(fields),
    });
  } catch {
    return demoAdapter.createClosure(token, fields);
  }
}

export async function adminUpdateClosure(token, id, fields) {
  try {
    return await callApi('/api/admin/closures', {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ id, ...fields }),
    });
  } catch {
    return demoAdapter.updateClosure(token, id, fields);
  }
}

export async function adminDeleteClosure(token, id) {
  try {
    return await callApi(`/api/admin/closures?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(token, false),
    });
  } catch {
    return demoAdapter.deleteClosure(token, id);
  }
}

export async function adminReopenClosure(token, id) {
  try {
    return await callApi('/api/admin/closures/reopen', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ id }),
    });
  } catch {
    return demoAdapter.reopenClosure(token, id);
  }
}
