// Shared handler factory for the admin catalog CRUD endpoints (products,
// collections, bundles). Same conventions as the rest of the API: bearer
// auth on every method, JSON in and out, server-side validation on every
// write, all writes are DRAFTS. The Publish endpoint is the only path that
// changes what the public site serves.

import { isAuthorized } from './auth.js';
import { getCatalogAdapter } from './catalogAdapter.js';
import { readJsonBody, sendJson, methodNotAllowed } from './http.js';
import { displayOf, statusOf } from '../../shared/catalogStore.js';

export function createCatalogEndpoint({ kind, list, validate, prepare }) {
  return async function handler(req, res) {
    if (!isAuthorized(req)) {
      return sendJson(res, 401, { ok: false, error: 'Not authorized.' });
    }
    const adapter = getCatalogAdapter();

    if (req.method === 'GET') {
      return list(req, res, adapter);
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      if (body === null || typeof body !== 'object') {
        return sendJson(res, 400, { ok: false, error: 'Request body must be valid JSON.' });
      }
      const { id, ...fields } = body;
      if (id !== undefined && typeof id !== 'string') {
        return sendJson(res, 400, { ok: false, error: 'The "id" must be a string.' });
      }

      let base = {};
      if (id) {
        const existing = await adapter.getRecord(kind, id);
        if (!existing || existing.draft === null) {
          return sendJson(res, 404, { ok: false, error: 'Not found.' });
        }
        base = existing.draft;
      }

      const result = validate({ ...base, ...fields });
      if (!result.ok) {
        return sendJson(res, 422, {
          ok: false,
          error: 'Please correct the highlighted fields.',
          errors: result.errors,
        });
      }

      const data = prepare ? await prepare(result.data, adapter) : result.data;
      if (data.error) {
        return sendJson(res, 422, { ok: false, error: data.error, errors: data.errors });
      }

      const record = await adapter.saveDraft(kind, id || null, data);
      if (!record) return sendJson(res, 404, { ok: false, error: 'Not found.' });
      return sendJson(res, id ? 200 : 201, {
        ok: true,
        item: { ...displayOf(record), id: record.id, status: statusOf(record) },
      });
    }

    if (req.method === 'DELETE') {
      const body = await readJsonBody(req);
      if (!body || typeof body.id !== 'string' || !body.id) {
        return sendJson(res, 400, { ok: false, error: 'Body must include the "id".' });
      }
      const deleted = await adapter.deleteDraft(kind, body.id);
      if (!deleted) return sendJson(res, 404, { ok: false, error: 'Not found.' });
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'PATCH') {
      const body = await readJsonBody(req);
      if (body?.restore === true && typeof body.id === 'string') {
        const record = await getCatalogAdapter().restoreDraft(kind, body.id);
        if (!record) {
          return sendJson(res, 404, { ok: false, error: 'Nothing to restore.' });
        }
        return sendJson(res, 200, {
          ok: true,
          item: { ...displayOf(record), id: record.id, status: statusOf(record) },
        });
      }
      if (kind === 'collections' && Array.isArray(body?.order)) {
        if (body.order.some((id) => typeof id !== 'string')) {
          return sendJson(res, 400, { ok: false, error: 'Order must be a list of ids.' });
        }
        await adapter.reorderCollections(body.order);
        return sendJson(res, 200, { ok: true });
      }
      return sendJson(res, 400, { ok: false, error: 'Unsupported PATCH payload.' });
    }

    return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE']);
  };
}
