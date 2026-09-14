// GET /api/admin/health (auth-gated diagnostics, no secrets)
//
// Reports which backing services this deployment is actually running so a
// misconfiguration is visible instead of silent:
//   { ok, adapter: "postgres" | "dev-file" | "unconfigured",
//     imageStorage: "cloudinary" | "dev-data-url" | "unconfigured",
//     runtime: "production" | "dev" }
//
// ok is false whenever production is missing its database: in that state
// nothing the owner saves is stored, and the dashboard shows a red warning
// banner driven by this response. Values are computed from env presence
// only; no connection strings or keys ever leave the server.

import { isAuthorized } from '../_lib/auth.js';
import { sendJson, methodNotAllowed, guard } from '../_lib/http.js';
import { isProductionRuntime, databaseUrl } from '../_lib/runtimeEnv.js';
import { imageStorageMode } from '../_lib/imageStorage.js';

async function handler(req, res) {
  if (!isAuthorized(req)) {
    return sendJson(res, 401, { ok: false, error: 'Not authorized.' });
  }
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const production = isProductionRuntime();
  const adapter = databaseUrl()
    ? 'postgres'
    : production
      ? 'unconfigured'
      : 'dev-file';
  const imageStorage = imageStorageMode();

  return sendJson(res, 200, {
    ok: adapter !== 'unconfigured',
    adapter,
    imageStorage,
    runtime: production ? 'production' : 'dev',
  });
}

export default guard(handler);
