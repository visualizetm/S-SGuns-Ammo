// Admin products endpoint (drafts). Requires Authorization: Bearer <token>.
//   GET    ?collection=&q=      -> draft list with status badges
//   POST   body: { id?, ...fields } -> save draft (create or update)
//   PATCH  body: { id, restore: true } -> undo a pending removal
//   DELETE body: { id }         -> delete draft (removal pending publish)
import { createCatalogEndpoint } from '../_lib/catalogEndpoint.js';
import { sendJson } from '../_lib/http.js';
import { validateProduct, withComputedSale } from '../../shared/catalogValidation.js';

export default createCatalogEndpoint({
  kind: 'products',
  validate: (fields) => validateProduct(fields),
  async prepare(data, adapter) {
    // Collections must exist (draft-alive) so products never point at
    // ghosts. Unknown ids are a validation error, not silently dropped.
    const known = new Set(
      (await adapter.listCollections({ scope: 'draft' })).map((c) => c.id)
    );
    const missing = (data.collectionIds || []).filter((id) => !known.has(id));
    if (missing.length > 0) {
      return {
        error: 'Please correct the highlighted fields.',
        errors: { collectionIds: 'One of those collections no longer exists.' },
      };
    }
    return withComputedSale(data);
  },
  async list(req, res, adapter) {
    const url = new URL(req.url, 'http://localhost');
    const collectionId = url.searchParams.get('collection') || undefined;
    const q = (url.searchParams.get('q') || '').trim().slice(0, 80) || undefined;
    const items = await adapter.listProducts({
      scope: 'draft',
      collectionId,
      q,
      includeHidden: true,
    });
    return sendJson(res, 200, { ok: true, items });
  },
});
