// GET /api/inventory?collection=<id>&q=
// Public read of the catalog. Serves ONLY the published snapshot: drafts,
// hidden items, and never-published items do not appear here, ever.
// Display data only: this site sells nothing online.
import { getCatalogAdapter } from '../_lib/catalogAdapter.js';
import { sendJson, methodNotAllowed } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const url = new URL(req.url, 'http://localhost');
  const collectionId = url.searchParams.get('collection') || undefined;
  const q = (url.searchParams.get('q') || '').trim().slice(0, 80) || undefined;

  const adapter = getCatalogAdapter();
  const [items, collections] = await Promise.all([
    adapter.listProducts({ scope: 'published', collectionId, q }),
    adapter.listCollections({ scope: 'published' }),
  ]);
  return sendJson(res, 200, { ok: true, items, collections });
}
