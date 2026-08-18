// Admin bundles endpoint (drafts). Bundles are display-only package deals:
// no inventory math, no purchasing logic. Requires Authorization: Bearer.
//   GET                              -> draft list
//   POST   body: { id?, ...fields }  -> save draft (members must exist)
//   PATCH  body: { id, restore: true } -> undo pending removal
//   DELETE body: { id }              -> delete draft
import { createCatalogEndpoint } from '../_lib/catalogEndpoint.js';
import { sendJson } from '../_lib/http.js';
import { validateBundle } from '../../shared/catalogValidation.js';

export default createCatalogEndpoint({
  kind: 'bundles',
  validate: (fields) => validateBundle(fields),
  async prepare(data, adapter) {
    const known = new Set(
      (await adapter.listProducts({ scope: 'draft', includeHidden: true })).map(
        (p) => p.id
      )
    );
    const missing = (data.memberProductIds || []).filter((id) => !known.has(id));
    if (missing.length > 0) {
      return {
        error: 'Please correct the highlighted fields.',
        errors: {
          memberProductIds: 'One of those products no longer exists. Re-pick the bundle members.',
        },
      };
    }
    return data;
  },
  async list(req, res, adapter) {
    const items = await adapter.listBundles({ scope: 'draft' });
    return sendJson(res, 200, { ok: true, items });
  },
});
