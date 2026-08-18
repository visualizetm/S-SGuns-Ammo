// Shared handler factory for the three public forms (contact, transfer
// inquiry, email capture). Nothing is stored server-side: validated
// submissions forward to the owner's email through Web3Forms. The access
// key lives ONLY in the WEB3FORMS_ACCESS_KEY env var; until it is set the
// forms answer with a graceful "being set up" failure.
// Validation runs server-side on every request; the client is never
// trusted, and the honeypot silently drops bot submissions.

import { validateLead, isSpam } from '../../shared/validation.js';
import { readJsonBody, sendJson, methodNotAllowed } from './http.js';

const WEB3FORMS_URL = 'https://api.web3forms.com/submit';

const SUBJECTS = {
  contact: 'S&S website: contact form message',
  transfer: 'S&S website: transfer inquiry',
  email_signup: 'S&S website: email updates signup',
};

const SETUP_MESSAGE =
  'This form is still being set up. Please call the shop at (610) 368-6984.';

export function createFormEndpoint(type) {
  return async function handler(req, res) {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

    const body = await readJsonBody(req);
    if (body === null || typeof body !== 'object') {
      return sendJson(res, 400, {
        ok: false,
        error: 'Request body must be valid JSON.',
      });
    }

    // Honeypot hit: pretend success, forward nothing.
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

    const accessKey = process.env.WEB3FORMS_ACCESS_KEY;
    if (!accessKey) {
      return sendJson(res, 503, { ok: false, setup: true, error: SETUP_MESSAGE });
    }

    try {
      const response = await fetch(WEB3FORMS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: accessKey,
          subject: SUBJECTS[type],
          from_name: 'S&S Guns & Ammo website',
          form_type: type,
          ...result.data,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.success) {
        return sendJson(res, 201, { ok: true });
      }
      return sendJson(res, 502, {
        ok: false,
        error:
          'Your message could not be sent right now. Please call the shop at (610) 368-6984.',
      });
    } catch {
      return sendJson(res, 502, {
        ok: false,
        error:
          'Your message could not be sent right now. Please call the shop at (610) 368-6984.',
      });
    }
  };
}
