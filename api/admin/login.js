// POST /api/admin/login
// Body: { password }. Returns { ok, token } on success.
// Auth is checked server-side only; see api/_lib/auth.js.
import { login } from '../_lib/auth.js';
import { readJsonBody, sendJson, methodNotAllowed } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const body = await readJsonBody(req);
  const token = login(body?.password);
  if (!token) {
    return sendJson(res, 401, { ok: false, error: 'Incorrect password.' });
  }
  return sendJson(res, 200, { ok: true, token });
}
