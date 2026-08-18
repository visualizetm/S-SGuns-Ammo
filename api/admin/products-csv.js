// Bulk CSV for products. Requires Authorization: Bearer <token>.
//   GET  -> CSV export of ALL product drafts (text/csv download)
//   POST body: { csv } -> import: each row validates server-side; valid rows
//        create drafts (no id) or update drafts (id present); invalid rows
//        are rejected with a per-row error and change nothing.
// Everything written here is DRAFT; the Publish bar controls going live.
// Template with the expected headers: public/bulk-template.csv
import { isAuthorized } from '../_lib/auth.js';
import { getCatalogAdapter } from '../_lib/catalogAdapter.js';
import { readJsonBody, sendJson, methodNotAllowed } from '../_lib/http.js';
import { parseCsvWithHeaders, toCsv } from '../../shared/csv.js';
import { validateProduct, withComputedSale } from '../../shared/catalogValidation.js';

export const CSV_HEADERS = [
  'id',
  'name',
  'collections',
  'manufacturer',
  'model',
  'caliber',
  'condition',
  'price',
  'compareAtPrice',
  'saleLabel',
  'stockStatus',
  'description',
];

const MAX_ROWS = 500;

export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    return sendJson(res, 401, { ok: false, error: 'Not authorized.' });
  }
  const adapter = getCatalogAdapter();

  if (req.method === 'GET') {
    const [items, collections] = await Promise.all([
      adapter.listProducts({ scope: 'draft', includeHidden: true }),
      adapter.listCollections({ scope: 'draft' }),
    ]);
    const nameById = new Map(collections.map((c) => [c.id, c.name]));
    const rows = items.map((item) => ({
      id: item.id,
      name: item.name,
      collections: (item.collectionIds || [])
        .map((id) => nameById.get(id))
        .filter(Boolean)
        .join('; '),
      manufacturer: item.manufacturer,
      model: item.model,
      caliber: item.caliber || '',
      condition: item.condition,
      price: item.price,
      compareAtPrice: item.compareAtPrice ?? '',
      saleLabel: item.saleLabel || '',
      stockStatus: item.stockStatus,
      description: item.description || '',
    }));
    const csv = toCsv(CSV_HEADERS, rows);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
    res.setHeader('Cache-Control', 'no-store');
    res.end(csv);
    return;
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    if (!body || typeof body.csv !== 'string' || !body.csv.trim()) {
      return sendJson(res, 400, { ok: false, error: 'Body must include the "csv" text.' });
    }

    const { headers, records } = parseCsvWithHeaders(body.csv);
    if (!headers.includes('name')) {
      return sendJson(res, 422, {
        ok: false,
        error: 'The CSV is missing a "name" column. Start from the template file.',
      });
    }
    if (records.length === 0) {
      return sendJson(res, 422, { ok: false, error: 'The CSV has no data rows.' });
    }
    if (records.length > MAX_ROWS) {
      return sendJson(res, 422, {
        ok: false,
        error: `Import up to ${MAX_ROWS} rows at a time.`,
      });
    }

    const collections = await adapter.listCollections({ scope: 'draft' });
    const idByName = new Map(collections.map((c) => [c.name.toLowerCase(), c.id]));

    const results = [];
    let applied = 0;
    for (const { line, values } of records) {
      const rowErrors = {};
      const collectionIds = [];
      for (const rawName of (values.collections || '').split(';')) {
        const name = rawName.trim();
        if (!name) continue;
        const id = idByName.get(name.toLowerCase());
        if (!id) {
          rowErrors.collections = `Unknown collection "${name}". Create it first on the Collections tab.`;
        } else {
          collectionIds.push(id);
        }
      }

      const id = (values.id || '').trim();
      let base = {};
      if (id) {
        const existing = await adapter.getRecord('products', id);
        if (!existing || existing.draft === null) {
          rowErrors.id = `No product with id "${id}". Leave the id blank to create a new product.`;
        } else {
          base = existing.draft;
        }
      }

      const result = validateProduct({
        ...base,
        name: values.name,
        collectionIds,
        manufacturer: values.manufacturer,
        model: values.model,
        caliber: values.caliber ?? '',
        condition: values.condition,
        price: values.price,
        compareAtPrice: values.compareAtPrice ?? '',
        saleLabel: values.saleLabel ?? '',
        stockStatus: values.stockStatus,
        description: values.description ?? '',
        photos: base.photos || [],
        featured: base.featured || false,
      });

      if (!result.ok || Object.keys(rowErrors).length > 0) {
        results.push({
          line,
          ok: false,
          errors: { ...(result.ok ? {} : result.errors), ...rowErrors },
        });
        continue;
      }

      const record = await adapter.saveDraft(
        'products',
        id || null,
        withComputedSale(result.data)
      );
      applied++;
      results.push({ line, ok: true, id: record.id });
    }

    return sendJson(res, 200, {
      ok: true,
      applied,
      rejected: results.filter((r) => !r.ok).length,
      results,
    });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}
