// Shared handler factory for the three public lead-capture endpoints.
// Validation runs server-side on every request; the client is never trusted.

import { validateLead, isSpam } from '../../shared/validation.js';
import { getLeadsAdapter } from './adapter.js';
import { readJsonBody, sendJson, methodNotAllowed } from './http.js';

export function createLeadEndpoint(type) {
  return async function handler(req, res) {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

    const body = await readJsonBody(req);
    if (body === null || typeof body !== 'object') {
      return sendJson(res, 400, {
        ok: false,
        error: 'Request body must be valid JSON.',
      });
    }

    // Honeypot hit: pretend success, store nothing.
    if (isSpam(body)) {
      return sendJson(res, 200, { ok: true });
    }

    const result = validateLead(type, body);
    if (!result.ok) {
      return sendJson(res, 422, {
        ok: false,
        error: 'Please correct the highlighted fields.',
        errors: result.errors,
      });
    }

    try {
      const lead = await getLeadsAdapter().createLead({
        type,
        data: result.data,
      });
      return sendJson(res, 201, { ok: true, id: lead.id });
    } catch {
      return sendJson(res, 500, {
        ok: false,
        error: 'Something went wrong saving your message. Please call the shop at (610) 368-6984.',
      });
    }
  };
}
