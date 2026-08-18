// Admin collections endpoint (drafts). Requires Authorization: Bearer <token>.
//   GET                              -> draft list, sorted
//   POST   body: { id?, ...fields }  -> save draft
//   PATCH  body: { id, restore: true } | { order: [ids] } -> restore / reorder
//   DELETE body: { id }              -> delete draft (products keep existing;
//                                       they just leave the collection)
import { createCatalogEndpoint } from '../_lib/catalogEndpoint.js';
import { sendJson } from '../_lib/http.js';
import { validateCollection } from '../../shared/catalogValidation.js';

export default createCatalogEndpoint({
  kind: 'collections',
  validate: (fields) => validateCollection(fields),
  async prepare(data, adapter) {
    if (data.sortOrder === undefined) {
      const existing = await adapter.listCollections({ scope: 'draft' });
      data.sortOrder = existing.length
        ? Math.max(...existing.map((c) => c.sortOrder ?? 0)) + 1
        : 0;
    }
    return data;
  },
  async list(req, res, adapter) {
    const items = await adapter.listCollections({ scope: 'draft' });
    return sendJson(res, 200, { ok: true, items });
  },
});
