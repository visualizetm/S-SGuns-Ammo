// Quick Sale sales-log endpoint. OWNER-ONLY behind admin auth; it is never
// mounted on a public route and never returns to an unauthenticated caller.
// All writes are validated server-side. It stores NO buyer personal data.
//
// LEGAL REVIEW REQUIRED: Quick Sale is a convenience business/inventory log,
// not the federal ATF or state Acquisition and Disposition record.
//
//   GET    ?from=&to=            -> sales, newest first, optional date range
//   POST   body: sale fields     -> log a sale. With markSold true, the item's
//                                   stock status is set to Sold LIVE on both
//                                   the draft and the published snapshot (the
//                                   one intentional exception to draft/publish;
//                                   see catalogStore.markStockImmediate).
//   DELETE ?id= (or body {id})   -> remove a sale (undo). If the sale had
//                                   marked the item Sold, restore its prior
//                                   stock status live.

import { isAuthorized } from '../_lib/auth.js';
import { getSalesAdapter } from '../_lib/salesAdapter.js';
import { getCatalogAdapter } from '../_lib/catalogAdapter.js';
import { readJsonBody, sendJson, methodNotAllowed } from '../_lib/http.js';
import { validateSale } from '../../shared/salesValidation.js';
import { displayOf } from '../../shared/catalogStore.js';

export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    return sendJson(res, 401, { ok: false, error: 'Not authorized.' });
  }
  const sales = getSalesAdapter();
  const catalog = getCatalogAdapter();

  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    const from = url.searchParams.get('from') || undefined;
    const to = url.searchParams.get('to') || undefined;
    const items = await sales.listSales({ from, to });
    return sendJson(res, 200, { ok: true, items });
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    if (body === null || typeof body !== 'object') {
      return sendJson(res, 400, { ok: false, error: 'Request body must be valid JSON.' });
    }
    const result = validateSale(body);
    if (!result.ok) {
      return sendJson(res, 422, {
        ok: false,
        error: 'Please correct the highlighted fields.',
        errors: result.errors,
      });
    }
    const data = result.data;

    // The product must exist; snapshot its current name server-side so the
    // log stays readable even if the product is later renamed or deleted.
    const record = await catalog.getRecord('products', data.productId);
    if (!record) {
      return sendJson(res, 422, {
        ok: false,
        error: 'That product no longer exists.',
        errors: { productId: 'That product no longer exists.' },
      });
    }
    const fields = displayOf(record) || {};
    const productNameSnapshot = fields.name || 'Unknown item';

    // Immediate stock write-through (Quick Sale ONLY): mark the item Sold on
    // BOTH draft and published so the public catalog reflects the counter
    // sale now, without a Publish step. Every other edit stays draft-first.
    let markedSold = false;
    let prevStockStatus = null;
    if (data.markSold) {
      const outcome = await catalog.markStockImmediate(data.productId, 'Sold');
      if (outcome) {
        markedSold = true;
        prevStockStatus = outcome.previous;
      }
    }

    const sale = await sales.createSale({
      productId: data.productId,
      productNameSnapshot,
      priceAtSale: data.priceAtSale,
      quantity: data.quantity,
      soldAt: data.soldAt,
      note: data.note,
      markedSold,
      prevStockStatus,
    });
    return sendJson(res, 201, { ok: true, sale });
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
    const removed = await sales.deleteSale(id);
    if (!removed) return sendJson(res, 404, { ok: false, error: 'Sale not found.' });

    // Undo: if this sale marked the item Sold, restore its prior status live.
    let restored = null;
    if (removed.markedSold && removed.prevStockStatus) {
      await catalog.markStockImmediate(removed.productId, removed.prevStockStatus);
      restored = { productId: removed.productId, stockStatus: removed.prevStockStatus };
    }
    return sendJson(res, 200, { ok: true, restored });
  }

  return methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
}
