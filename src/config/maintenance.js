// THE MAINTENANCE SWITCH.
//
// Turn the PUBLIC site off:  set VITE_MAINTENANCE_MODE = true   then redeploy
// Turn the PUBLIC site on:   set VITE_MAINTENANCE_MODE = false  then redeploy
//                            (deleting the variable also means "site normal")
//
// On Vercel: Project Settings, Environment Variables, then Redeploy. Set the
// SAME value for MAINTENANCE_MODE so the edge middleware returns a real 503
// to search engines (see middleware.js). Full steps: MAINTENANCE.md.
//
// The default is OFF. Any value other than the exact word "true" leaves the
// site running normally, so a typo can never take the shop offline.
//
// The Owner's Dashboard at /admin and the /api endpoints are NEVER covered by
// maintenance mode; the owner can keep working while the storefront is down.

import { isMaintenanceEnabled } from '../../shared/maintenance.js';

// Vite replaces import.meta.env.VITE_MAINTENANCE_MODE at build time. The
// try/catch keeps this module importable from plain node (scripts, tests),
// where import.meta.env does not exist.
function readFlag() {
  try {
    return import.meta.env.VITE_MAINTENANCE_MODE;
  } catch {
    return undefined;
  }
}

export const MAINTENANCE_MODE = isMaintenanceEnabled(readFlag());
