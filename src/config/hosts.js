// Client-side host configuration. Reads VITE_PUBLIC_HOST / VITE_DASHBOARD_HOST
// at build time (Vite injects import.meta.env.VITE_* into the bundle); both
// default to the real production domains when unset. These are plain
// hostnames, not secrets, so baking them into the client build is fine.
//
// See shared/hosts.js for the exact host-matching rule, reused here and by
// api/robots.js so the client and the server agree.

import { DEFAULT_PUBLIC_HOST, DEFAULT_DASHBOARD_HOST, isDashboardHostname } from '../../shared/hosts.js';

export const PUBLIC_HOST = import.meta.env.VITE_PUBLIC_HOST || DEFAULT_PUBLIC_HOST;
export const DASHBOARD_HOST = import.meta.env.VITE_DASHBOARD_HOST || DEFAULT_DASHBOARD_HOST;

// True when this page is currently being viewed on the Owner's Dashboard
// host. False on the public host, on localhost, and on any other hostname
// (e.g. a Vercel preview deployment), all of which keep the original
// path-based /admin behavior.
export function isDashboardHost() {
  if (typeof window === 'undefined') return false;
  return isDashboardHostname(window.location.hostname, DASHBOARD_HOST);
}

// The absolute URL of the public site for a given path (+ query string),
// used any time the dashboard needs to send someone to the storefront:
// "View live site" links, and the dashboard-host catch-all redirect for
// any path that is not the dashboard itself.
export function publicSiteUrl(pathname = '/', search = '') {
  return `https://${PUBLIC_HOST}${pathname}${search}`;
}
