// Local API server for development and curl testing. Mounts the same
// serverless handlers Vercel runs, on plain node http, so every endpoint
// can be exercised locally with zero credentials:
//   node scripts/dev-api.mjs   (PORT env to override, default 3999)

import { createServer } from 'node:http';
import contactHandler from '../api/leads/contact.js';
import transferHandler from '../api/leads/transfer.js';
import emailSignupHandler from '../api/leads/email-signup.js';
import loginHandler from '../api/admin/login.js';
import adminLeadsHandler from '../api/admin/leads.js';
import inventoryHandler from '../api/inventory/index.js';
import adminInventoryHandler from '../api/admin/inventory.js';
import adminInventoryImageHandler from '../api/admin/inventory-image.js';

const ROUTES = {
  '/api/leads/contact': contactHandler,
  '/api/leads/transfer': transferHandler,
  '/api/leads/email-signup': emailSignupHandler,
  '/api/admin/login': loginHandler,
  '/api/admin/leads': adminLeadsHandler,
  '/api/inventory': inventoryHandler,
  '/api/admin/inventory': adminInventoryHandler,
  '/api/admin/inventory-image': adminInventoryImageHandler,
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
