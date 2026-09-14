// GET /api/admin/publish-history (auth-gated)
// Returns the last publishes, newest first: { ok, items: [{ id,
// publishedAt, total, detail, publishedBy }] }. detail itemizes what each
// publish put live (added/updated/removed names per kind). At most the
// last 100 publishes are kept (see api/_lib/historyAdapter.js).

import { isAuthorized } from '../_lib/auth.js';
import { getHistoryAdapter } from '../_lib/historyAdapter.js';
import { sendJson, methodNotAllowed, guard } from '../_lib/http.js';

async function handler(req, res) {
  if (!isAuthorized(req)) {
    return sendJson(res, 401, { ok: false, error: 'Not authorized.' });
  }
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const items = await getHistoryAdapter().listHistory();
  return sendJson(res, 200, { ok: true, items });
}

export default guard(handler);
