// Local API server for development and curl testing. Mounts the same
// serverless handlers Vercel runs, on plain node http, so every endpoint
// can be exercised locally with zero credentials:
//   node scripts/dev-api.mjs   (PORT env to override, default 3999)

import { createServer } from 'node:http';
import loginHandler from '../api/admin/login.js';
import inventoryHandler from '../api/inventory/index.js';
import adminProductsHandler from '../api/admin/products.js';
import adminCollectionsHandler from '../api/admin/collections.js';
import adminBundlesHandler from '../api/admin/bundles.js';
import adminPublishHandler from '../api/admin/publish.js';
import adminProductsCsvHandler from '../api/admin/products-csv.js';
import adminInventoryImageHandler from '../api/admin/inventory-image.js';
import adminSalesHandler from '../api/admin/sales.js';
import adminHealthHandler from '../api/admin/health.js';
import adminPublishHistoryHandler from '../api/admin/publish-history.js';
import hoursHandler from '../api/hours.js';

// Mirrors vercel.json's rewrites for the consolidated hours endpoint:
// each admin path gets the same scope/route query params the real
// rewrite would add, so api/hours.js sees an identical request shape
// locally and in production.
function withQuery(handler, extraQuery) {
  return (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    for (const [key, value] of new URLSearchParams(extraQuery)) {
      url.searchParams.set(key, value);
    }
    req.url = url.pathname + url.search;
    return handler(req, res);
  };
}

const ROUTES = {
  '/api/admin/login': loginHandler,
  '/api/inventory': inventoryHandler,
  '/api/admin/products': adminProductsHandler,
  '/api/admin/collections': adminCollectionsHandler,
  '/api/admin/bundles': adminBundlesHandler,
  '/api/admin/publish': adminPublishHandler,
  '/api/admin/products-csv': adminProductsCsvHandler,
  '/api/admin/inventory-image': adminInventoryImageHandler,
  '/api/admin/sales': adminSalesHandler,
  '/api/admin/health': adminHealthHandler,
  '/api/admin/publish-history': adminPublishHistoryHandler,
  '/api/hours': hoursHandler,
  '/api/admin/hours': withQuery(hoursHandler, 'scope=admin'),
  '/api/admin/closures': withQuery(hoursHandler, 'scope=admin&route=closures'),
  '/api/admin/closures/reopen': withQuery(hoursHandler, 'scope=admin&route=closures-reopen'),
};

const PORT = Number(process.env.PORT || 3999);

const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '');
  const handler = ROUTES[path];
  if (!handler) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'No such endpoint.' }));
    return;
  }
  try {
    await handler(req, res);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: String(err.message || err) }));
  }
});

server.listen(PORT, () => {
  console.log(`dev api listening on http://localhost:${PORT}`);
});
