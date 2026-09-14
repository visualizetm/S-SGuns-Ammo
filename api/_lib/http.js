// Small helpers shared by all serverless endpoints.

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

// Wraps a handler so any thrown error becomes a clean JSON response instead
// of a crashed function. A missing production database is the loud, specific
// case: 503 with the exact configuration message, so the dashboard can tell
// the owner that saves are not being stored (never silent data loss).
export function guard(handler) {
  return async function guarded(req, res) {
    try {
      return await handler(req, res);
    } catch (err) {
      if (err?.code === 'DB_NOT_CONFIGURED') {
        return sendJson(res, 503, { ok: false, error: err.message, code: err.code });
      }
      return sendJson(res, 500, {
        ok: false,
        error: 'Something went wrong on the server. Try again.',
      });
    }
  };
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
}

// Vercel parses JSON bodies into req.body. Fall back to reading the stream
// (used by the local smoke test and any runtime that does not pre-parse).
export async function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch {
        return null;
      }
    }
    return req.body;
  }
  try {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return null;
  }
}
