// Shop hours and temporary closures: one physical function serving five
// logical routes, consolidated because api/ was already at the Vercel
// Hobby plan's commonly-cited 12-function limit before this feature (see
// docs/DECISIONS.md). vercel.json rewrites the admin paths here with a
// `scope`/`route` query param; this file is the public GET /api/hours
// route on its own natural path, needing no rewrite for itself.
//
//   GET  /api/hours                                          public
//   GET  /api/admin/hours        -> ?scope=admin
//   PUT  /api/admin/hours        -> ?scope=admin               { weekly }
//   POST /api/admin/closures     -> ?scope=admin&route=closures  closure fields
//   PUT  /api/admin/closures     -> ?scope=admin&route=closures  { id, ...fields }
//   DELETE /api/admin/closures   -> ?scope=admin&route=closures  ?id= or { id }
//   POST /api/admin/closures/reopen -> ?scope=admin&route=closures-reopen  { id }
//
// Hours and closures write through immediately: the same operational-
// write exception Quick Sale already makes (no draft/publish step). The
// public response strips every internal field (createdAt, cancelledAt,
// note) and includes only active and in-notice-window closures.

import { isAuthorized } from './_lib/auth.js';
import { getHoursAdapter } from './_lib/hoursAdapter.js';
import { readJsonBody, sendJson, methodNotAllowed, guard } from './_lib/http.js';
import { validateHours, validateClosure, publicClosures } from '../shared/hours.js';

function toPublicClosure(c) {
  return {
    id: c.id,
    startDate: c.startDate,
    endDate: c.endDate,
    reason: c.reason,
    label: c.label,
    message: c.message,
    noticeDays: c.noticeDays,
  };
}

async function handlePublic(req, res, adapter) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  const settings = await adapter.getSettings();
  const now = new Date();
  return sendJson(res, 200, {
    ok: true,
    configured: Boolean(settings.weekly),
    timezone: settings.timezone,
    weekly: settings.weekly,
    closures: publicClosures(settings.closures, now).map(toPublicClosure),
  });
}

async function handleAdminHours(req, res, adapter) {
  if (req.method === 'GET') {
    const settings = await adapter.getSettings();
    return sendJson(res, 200, { ok: true, ...settings, configured: Boolean(settings.weekly) });
  }
  if (req.method === 'PUT') {
    const body = await readJsonBody(req);
    const result = validateHours(body?.weekly);
    if (!result.ok) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Please correct the highlighted days.',
        errors: result.errors,
      });
    }
    const settings = await adapter.saveWeekly(result.data);
    return sendJson(res, 200, { ok: true, ...settings, configured: true });
  }
  return methodNotAllowed(res, ['GET', 'PUT']);
}

async function handleClosures(req, res, adapter) {
  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const result = validateClosure(body || {});
    if (!result.ok) {
      return sendJson(res, 422, {
        ok: false,
        error: 'Please correct the highlighted fields.',
        errors: result.errors,
      });
    }
    const closure = await adapter.addClosure(result.data);
    return sendJson(res, 201, { ok: true, closure });
  }
  if (req.method === 'PUT') {
    const body = await readJsonBody(req);
    const id = body?.id;
    if (typeof id !== 'string' || !id) {
      return sendJson(res, 400, { ok: false, error: 'An "id" is required.' });
    }
    const result = validateClosure(body || {});
    if (!result.ok) {
      return sendJson(res, 422, {
        ok: false,
        error: 'Please correct the highlighted fields.',
        errors: result.errors,
      });
    }
    const closure = await adapter.updateClosure(id, result.data);
    if (!closure) return sendJson(res, 404, { ok: false, error: 'Closure not found.' });
    return sendJson(res, 200, { ok: true, closure });
  }
  if (req.method === 'DELETE') {
    const url = new URL(req.url, 'http://localhost');
    let id = url.searchParams.get('id');
    if (!id) {
      const body = await readJsonBody(req);
      id = body?.id;
    }
    if (typeof id !== 'string' || !id) {
      return sendJson(res, 400, { ok: false, error: 'An "id" is required.' });
    }
    const removed = await adapter.deleteClosure(id);
    if (!removed) return sendJson(res, 404, { ok: false, error: 'Closure not found.' });
    return sendJson(res, 200, { ok: true });
  }
  return methodNotAllowed(res, ['POST', 'PUT', 'DELETE']);
}

async function handleReopen(req, res, adapter) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const body = await readJsonBody(req);
  const id = body?.id;
  if (typeof id !== 'string' || !id) {
    return sendJson(res, 400, { ok: false, error: 'An "id" is required.' });
  }
  const closure = await adapter.reopenClosure(id);
  if (!closure) return sendJson(res, 404, { ok: false, error: 'Closure not found.' });
  return sendJson(res, 200, { ok: true, closure });
}

async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const scope = url.searchParams.get('scope');
  const route = url.searchParams.get('route');
  const adapter = getHoursAdapter();

  if (scope !== 'admin') return handlePublic(req, res, adapter);

  if (!isAuthorized(req)) {
    return sendJson(res, 401, { ok: false, error: 'Not authorized.' });
  }
  if (!route) return handleAdminHours(req, res, adapter);
  if (route === 'closures') return handleClosures(req, res, adapter);
  if (route === 'closures-reopen') return handleReopen(req, res, adapter);
  return sendJson(res, 404, { ok: false, error: 'Unknown route.' });
}

export default guard(handler);
