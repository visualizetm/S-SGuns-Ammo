// Admin inventory CRUD. Every method requires Authorization: Bearer <token>
// (server-side check only, api/_lib/auth.js).
//
//   GET    /api/admin/inventory?category=&q=   -> list ALL items, Hidden included
//   POST   /api/admin/inventory  body: item    -> create
//   PATCH  /api/admin/inventory  body: { id, ...fields } -> partial update
//   DELETE /api/admin/inventory  body: { id }  -> delete
import { isAuthorized } from '../_lib/auth.js';
import { getInventoryAdapter } from '../_lib/inventoryAdapter.js';
import { readJsonBody, sendJson, methodNotAllowed } from '../_lib/http.js';
import {
  validateInventoryItem,
  INVENTORY_CATEGORIES,
} from '../../shared/inventoryValidation.js';

export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    return sendJson(res, 401, { ok: false, error: 'Not authorized.' });
  }

  const adapter = getInventoryAdapter();

  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    const category = url.searchParams.get('category') || undefined;
    const q = (url.searchParams.get('q') || '').trim().slice(0, 80) || undefined;
    if (category !== undefined && !INVENTORY_CATEGORIES.includes(category)) {
      return sendJson(res, 400, { ok: false, error: 'Unknown category.' });
    }
    const items = await adapter.listItems({ includeHidden: true, category, q });
    return sendJson(res, 200, { ok: true, items });
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const result = validateInventoryItem(body);
    if (!result.ok) {
      return sendJson(res, 422, {
        ok: false,
        error: 'Please correct the highlighted fields.',
        errors: result.errors,
      });
    }
    const item = await adapter.createItem(result.data);
    return sendJson(res, 201, { ok: true, item });
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req);
    if (!body || typeof body.id !== 'string' || !body.id) {
      return sendJson(res, 400, { ok: false, error: 'Body must include the item "id".' });
    }
    const { id, ...fields } = body;
    if (Object.keys(fields).length === 0) {
      return sendJson(res, 400, { ok: false, error: 'Nothing to update.' });
    }
    const result = validateInventoryItem(fields, { partial: true });
    if (!result.ok) {
      return sendJson(res, 422, {
        ok: false,
        error: 'Please correct the highlighted fields.',
        errors: result.errors,
      });
    }
    const item = await adapter.updateItem(id, result.data);
    if (!item) return sendJson(res, 404, { ok: false, error: 'Item not found.' });
    return sendJson(res, 200, { ok: true, item });
  }

  if (req.method === 'DELETE') {
    const body = await readJsonBody(req);
    if (!body || typeof body.id !== 'string' || !body.id) {
      return sendJson(res, 400, { ok: false, error: 'Body must include the item "id".' });
    }
    const deleted = await adapter.deleteItem(body.id);
    if (!deleted) return sendJson(res, 404, { ok: false, error: 'Item not found.' });
    return sendJson(res, 200, { ok: true });
  }

  return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE']);
}
