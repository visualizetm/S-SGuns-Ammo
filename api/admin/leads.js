// GET  /api/admin/leads?type=contact|transfer|email_signup  -> list leads
// PATCH /api/admin/leads  body: { id, read }                -> mark read/unread
// Both require Authorization: Bearer <token> (server-side check only).
import { isAuthorized } from '../_lib/auth.js';
import { getLeadsAdapter } from '../_lib/adapter.js';
import { readJsonBody, sendJson, methodNotAllowed } from '../_lib/http.js';
import { LEAD_TYPES } from '../../shared/validation.js';

export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    return sendJson(res, 401, { ok: false, error: 'Not authorized.' });
  }

  const adapter = getLeadsAdapter();

  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    const type = url.searchParams.get('type') || undefined;
    if (type !== undefined && !LEAD_TYPES.includes(type)) {
      return sendJson(res, 400, { ok: false, error: 'Unknown lead type.' });
    }
    const leads = await adapter.listLeads({ type });
    return sendJson(res, 200, { ok: true, leads });
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req);
    if (!body || typeof body.id !== 'string' || typeof body.read !== 'boolean') {
      return sendJson(res, 400, {
        ok: false,
        error: 'Body must include string "id" and boolean "read".',
      });
    }
    const lead = await adapter.setLeadRead(body.id, body.read);
    if (!lead) {
      return sendJson(res, 404, { ok: false, error: 'Lead not found.' });
    }
    return sendJson(res, 200, { ok: true, lead });
  }

  return methodNotAllowed(res, ['GET', 'PATCH']);
}
