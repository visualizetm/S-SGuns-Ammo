// Maintenance mode: shared, framework-free logic.
//
// The switch itself is a single environment variable, VITE_MAINTENANCE_MODE
// ("true" turns the public site off; anything else, including unset, leaves
// the site normal). See src/config/maintenance.js for how the app reads it
// and MAINTENANCE.md for the on/off steps.
//
// Everything here is pure so the smoke suite can prove the decisions the
// app and the edge middleware both depend on.

// How long crawlers are asked to wait before trying again. One hour keeps
// search engines treating the outage as temporary without hammering the site.
export const RETRY_AFTER_SECONDS = 3600;

// The flag is a string in every source it can come from (an env var, a
// build-time define). Only the exact word "true" turns maintenance on, so a
// missing, empty, or misspelled value always fails SAFE: site stays up.
export function isMaintenanceEnabled(value) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

// Paths that maintenance mode must NEVER cover. The Owner's Dashboard and
// its API stay fully functional while the storefront is down, and static
// build assets must keep serving so the maintenance page can render.
const ALWAYS_UP = [/^\/api(\/|$)/, /^\/admin(\/|$)/, /^\/assets(\/|$)/];

// True only for a public storefront route. Static files (anything with a
// file extension, e.g. /favicon.svg, /og-image.png) are left alone too.
export function isPublicPath(pathname) {
  const path = String(pathname || '/');
  if (ALWAYS_UP.some((pattern) => pattern.test(path))) return false;
  const last = path.split('/').pop() || '';
  if (last.includes('.')) return false;
  return true;
}
