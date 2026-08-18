// Publish flow. Requires Authorization: Bearer <token>.
//   GET  -> { ok, summary } counts of unpublished changes per kind
//   POST body: { action: 'publish' } -> promote ALL drafts to published,
//        atomically (single file write in dev, one transaction in Postgres)
//   POST body: { action: 'discard' } -> revert ALL drafts to last published
import { isAuthorized } from '../_lib/auth.js';
import { getCatalogAdapter } from '../_lib/catalogAdapter.js';
import { readJsonBody, sendJson, methodNotAllowed } from '../_lib/http.js';

export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    return sendJson(res, 401, { ok: false, error: 'Not authorized.' });
  }
  const adapter = getCatalogAdapter();

  if (req.method === 'GET') {
    const summary = await adapter.changesSummary();
    return sendJson(res, 200, { ok: true, summary });
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    if (body?.action === 'publish') {
      const summary = await adapter.publishAll();
      return sendJson(res, 200, { ok: true, summary });
    }
    if (body?.action === 'discard') {
      const summary = await adapter.discardAll();
      return sendJson(res, 200, { ok: true, summary });
    }
    return sendJson(res, 400, {
      ok: false,
      error: 'Action must be "publish" or "discard".',
    });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}
