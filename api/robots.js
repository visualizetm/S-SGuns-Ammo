// GET /robots.txt (rewritten here from a static file so it can differ by
// host; see vercel.json's "/robots.txt" rewrite, which runs before the SPA
// catch-all).
//
// Owner's Dashboard host: disallow everything. It is a private operator
// tool, never meant to be indexed or crawled.
// Public host (and any other host, e.g. local dev / a preview deployment):
// the normal storefront robots.txt, disallowing only /admin and /api.

import { isDashboardHostname, DEFAULT_DASHBOARD_HOST } from '../shared/hosts.js';
import { BASE_URL } from '../src/content/siteFacts.js';

const DASHBOARD_HOST = process.env.VITE_DASHBOARD_HOST || DEFAULT_DASHBOARD_HOST;

export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.statusCode = 405;
    res.end('Method not allowed.');
    return;
  }

  const host = String(req.headers.host || '').split(':')[0];
  const body = isDashboardHostname(host, DASHBOARD_HOST)
    ? ['User-agent: *', 'Disallow: /', ''].join('\n')
    : [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /api',
        '',
        `Sitemap: ${BASE_URL}/sitemap.xml`,
        '',
      ].join('\n');

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}
