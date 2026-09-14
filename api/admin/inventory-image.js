// POST /api/admin/inventory-image
// Body: { filename?, dataUrl } where dataUrl is a downscaled JPEG/PNG/WebP
// data URL from the admin form. Returns { ok, url } to attach to an item.
// Requires Authorization: Bearer <token>. Storage backend selected by env;
// see api/_lib/imageStorage.js and PRODUCTION-SETUP.md.
import { isAuthorized } from '../_lib/auth.js';
import { storeImage } from '../_lib/imageStorage.js';
import { readJsonBody, sendJson, methodNotAllowed, guard } from '../_lib/http.js';

async function handler(req, res) {
  if (!isAuthorized(req)) {
    return sendJson(res, 401, { ok: false, error: 'Not authorized.' });
  }
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const body = await readJsonBody(req);
  const result = await storeImage(body || {});
  if (!result.ok) {
    // A misconfigured storage backend is a service problem (503), not a
    // problem with the owner's photo (422).
    const status = result.code === 'IMAGE_STORAGE_NOT_CONFIGURED' ? 503 : 422;
    return sendJson(res, status, { ok: false, error: result.error, code: result.code });
  }
  return sendJson(res, 201, {
    ok: true,
    url: result.url,
    ...(result.publicId ? { publicId: result.publicId } : {}),
  });
}

export default guard(handler);
