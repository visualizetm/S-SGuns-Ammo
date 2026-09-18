// Public site / Owner's Dashboard host names, and the pure logic for
// telling them apart. Shared by the client (src/config/hosts.js, reading
// import.meta.env.VITE_* at build time) and serverless functions
// (api/robots.js, reading process.env.VITE_* at request time) so both sides
// of the host-based routing agree on exactly the same rule.
//
// Same Vercel project and deployment, routed by hostname:
//   https://ssgunsandammo.com (and www)      -> the public storefront
//   https://dashboard.ssgunsandammo.com      -> the Owner's Dashboard
// Configurable via VITE_PUBLIC_HOST / VITE_DASHBOARD_HOST so local dev
// (localhost, matching neither) keeps working with the original
// path-based /admin, and so does any Vercel preview deployment (a
// *.vercel.app hostname also matches neither).

export const DEFAULT_PUBLIC_HOST = 'ssgunsandammo.com';
export const DEFAULT_DASHBOARD_HOST = 'dashboard.ssgunsandammo.com';

// True when `hostname` is the Owner's Dashboard host: an exact match on the
// configured dashboard host, OR (belt and suspenders, and matching the
// literal detection rule) any hostname starting with "dashboard.".
export function isDashboardHostname(hostname, dashboardHost = DEFAULT_DASHBOARD_HOST) {
  const host = String(hostname || '').toLowerCase();
  if (!host) return false;
  return host === dashboardHost.toLowerCase() || host.startsWith('dashboard.');
}
