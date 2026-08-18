// GET /api/inventory?collection=<id>&q=          -> catalog browse payload
// GET /api/inventory?id=<productId>              -> single published product
// Public reads of the catalog. Serves ONLY the published snapshot: drafts,
// hidden items, and never-published items do not appear here, ever.
// Bundles are included only when at least two member products are live.
// Display data only: this site sells nothing online.
import { getCatalogAdapter } from '../_lib/catalogAdapter.js';
import { sendJson, methodNotAllowed } from '../_lib/http.js';
import {
  getPublicProduct,
  listPublicBundles,
} from '../../shared/catalogStore.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const url = new URL(req.url, 'http://localhost');
  const id = url.searchParams.get('id');
  const collectionId = url.searchParams.get('collection') || undefined;
  const q = (url.searchParams.get('q') || '').trim().slice(0, 80) || undefined;

  const adapter = getCatalogAdapter();

  if (id) {
    const item = await adapter.getPublicProduct(id);
    if (!item) {
      return sendJson(res, 404, { ok: false, error: 'Item not found.' });
    }
    return sendJson(res, 200, { ok: true, item });
  }

  const [items, collections, bundles] = await Promise.all([
    adapter.listProducts({ scope: 'published', collectionId, q }),
    adapter.listCollections({ scope: 'published' }),
    adapter.listPublicBundles(),
  ]);
  return sendJson(res, 200, { ok: true, items, collections, bundles });
}
