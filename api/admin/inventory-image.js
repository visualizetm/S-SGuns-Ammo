// POST /api/admin/inventory-image
// Body: { filename?, dataUrl } where dataUrl is a downscaled JPEG/PNG/WebP
// data URL from the admin form. Returns { ok, url } to attach to an item.
// Requires Authorization: Bearer <token>. Storage backend selected by env;
// see api/_lib/imageStorage.js and PRODUCTION-SETUP.md.
import { isAuthorized } from '../_lib/auth.js';
import { storeImage } from '../_lib/imageStorage.js';
import { readJsonBody, sendJson, methodNotAllowed } from '../_lib/http.js';

export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    return sendJson(res, 401, { ok: false, error: 'Not authorized.' });
  }
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const body = await readJsonBody(req);
  const result = await storeImage(body || {});
  if (!result.ok) {
    return sendJson(res, 422, { ok: false, error: result.error });
  }
  return sendJson(res, 201, { ok: true, url: result.url });
}
