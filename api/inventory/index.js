// GET /api/inventory?category=Rifles&q=demo
// Public read of the inventory. Hidden items never appear here. Display
// data only: this site sells nothing online.
import { getInventoryAdapter } from '../_lib/inventoryAdapter.js';
import { sendJson, methodNotAllowed } from '../_lib/http.js';
import { INVENTORY_CATEGORIES } from '../../shared/inventoryValidation.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const url = new URL(req.url, 'http://localhost');
  const category = url.searchParams.get('category') || undefined;
  const q = (url.searchParams.get('q') || '').trim().slice(0, 80) || undefined;

  if (category !== undefined && !INVENTORY_CATEGORIES.includes(category)) {
    return sendJson(res, 400, { ok: false, error: 'Unknown category.' });
  }

  const items = await getInventoryAdapter().listItems({
    includeHidden: false,
    category,
    q,
  });
  return sendJson(res, 200, { ok: true, items });
}
