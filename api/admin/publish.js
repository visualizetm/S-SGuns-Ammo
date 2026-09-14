// Publish flow. Requires Authorization: Bearer <token>.
//   GET  -> { ok, summary, detail } counts plus the itemized added/updated/
//           removed names per kind (what the publish modal lists)
//   POST body: { action: 'publish' } -> promote ALL drafts to published,
//        atomically (single file write in dev, one transaction in Postgres),
//        and record a publish-history entry with the itemized detail
//   POST body: { action: 'discard' } -> revert ALL drafts to last published
import { isAuthorized } from '../_lib/auth.js';
import { getCatalogAdapter } from '../_lib/catalogAdapter.js';
import { getHistoryAdapter } from '../_lib/historyAdapter.js';
import { readJsonBody, sendJson, methodNotAllowed, guard } from '../_lib/http.js';

async function handler(req, res) {
  if (!isAuthorized(req)) {
    return sendJson(res, 401, { ok: false, error: 'Not authorized.' });
  }
  const adapter = getCatalogAdapter();

  if (req.method === 'GET') {
    const summary = await adapter.changesSummary();
    const detail = await adapter.changesDetail();
    return sendJson(res, 200, { ok: true, summary, detail });
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    if (body?.action === 'publish') {
      // Snapshot what is about to go live BEFORE promoting, so the history
      // entry itemizes exactly this publish.
      const before = await adapter.changesSummary();
      const detail = await adapter.changesDetail();
      const summary = await adapter.publishAll();
      let entry = null;
      if (before.total > 0) {
        entry = await getHistoryAdapter().recordPublish({
          total: before.total,
          detail,
          publishedBy: 'Owner',
        });
      }
      return sendJson(res, 200, { ok: true, summary, entry });
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

export default guard(handler);
