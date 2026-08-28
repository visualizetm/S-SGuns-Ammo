// Vercel Edge Middleware: returns a real HTTP 503 for PUBLIC routes while
// maintenance mode is on, so search engines treat the outage as temporary
// and do not deindex the site. The visual maintenance page is delivered by
// the app itself (src/pages/Maintenance.jsx); this file exists so crawlers
// get the correct status code and a Retry-After header alongside it.
//
// NEVER covered: /api/* and /admin/* (the Owner's Dashboard and its API keep
// working normally while the storefront is down), plus /assets/* and any
// file with an extension.
//
// SWITCH: environment variable MAINTENANCE_MODE = "true" turns this on. Set
// it to the same value as VITE_MAINTENANCE_MODE, which drives the app (see
// src/config/maintenance.js and MAINTENANCE.md).
//
// FAIL-SAFE: this middleware passes the request through untouched unless the
// flag is exactly "true" AND the path is public. Any unexpected error also
// falls through to the normal site, so the storefront cannot be taken down
// by a bug in here.

import {
  isMaintenanceEnabled,
  isPublicPath,
  RETRY_AFTER_SECONDS,
} from './shared/maintenance.js';
import {
  SICK_COMPUTER_SVG,
  MAINTENANCE_HEADLINE,
  MAINTENANCE_SUBLINE,
  MAINTENANCE_CONTACT_LEAD,
} from './shared/maintenanceArt.js';
import { BUSINESS } from './src/content/siteFacts.js';

export const config = {
  // Skip the middleware entirely for the paths that must always stay up.
  matcher: '/((?!api/|admin|assets/|.*\\.).*)',
};

// Vercel's documented "continue to the normal response" signal.
function passThrough() {
  return new Response(null, { headers: { 'x-middleware-next': '1' } });
}

function page() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Website Down for Maintenance | ${BUSINESS.name}</title>
<link rel="icon" href="/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
  *,*::before,*::after{box-sizing:border-box}
  body{margin:0;min-height:100vh;background:#10110f;color:#f2ebdd;
    font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    display:flex;align-items:center;justify-content:center;padding:3rem 1.25rem}
  .mt-inner{width:100%;max-width:34rem;text-align:center}
  .mt-art{margin:0 auto 2.25rem;max-width:16rem}
  .mt-art svg{width:100%;height:auto;display:block}
  h1{font-family:'Barlow Condensed','Arial Narrow',sans-serif;font-weight:700;
    text-transform:uppercase;line-height:.98;letter-spacing:.015em;
    font-size:clamp(2rem,1.3rem + 3.4vw,3.1rem);margin:0 0 1rem}
  .mt-sub{font-size:1.05rem;line-height:1.6;color:#cfc9b9;margin:0 auto 2.75rem;max-width:26rem}
  .mt-contact{border-top:1px solid rgba(242,235,221,.18);padding-top:1.75rem}
  .mt-lead{font-size:.75rem;font-weight:600;text-transform:uppercase;
    letter-spacing:.16em;color:#a9a492;margin:0 0 .9rem}
  .mt-shop{font-family:'Barlow Condensed','Arial Narrow',sans-serif;font-weight:700;
    text-transform:uppercase;font-size:1.25rem;letter-spacing:.02em;margin:0 0 .5rem}
  .mt-phone{display:inline-flex;align-items:center;justify-content:center;gap:.55rem;
    min-height:48px;padding:0 .5rem;font-family:'Barlow Condensed','Arial Narrow',sans-serif;
    font-weight:700;font-size:clamp(1.75rem,1.2rem + 2.2vw,2.35rem);
    color:#f2ebdd;text-decoration:none;margin-bottom:.65rem}
  .mt-phone:hover{color:#c9b58e;text-decoration:underline}
  .mt-phone svg{flex-shrink:0;color:#a45c38}
  address{font-style:normal;font-size:.95rem;line-height:1.65;color:#a9a492;margin:0}
  @media (max-width:480px){body{padding:2.25rem 1rem}.mt-art{max-width:12.5rem;margin-bottom:1.75rem}}
</style>
</head>
<body>
<main class="mt-inner">
  <div class="mt-art">${SICK_COMPUTER_SVG}</div>
  <h1>${MAINTENANCE_HEADLINE}</h1>
  <p class="mt-sub">${MAINTENANCE_SUBLINE}</p>
  <div class="mt-contact">
    <p class="mt-lead">${MAINTENANCE_CONTACT_LEAD}</p>
    <p class="mt-shop">${BUSINESS.name}</p>
    <a class="mt-phone" href="${BUSINESS.phoneHref}">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden="true"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.38 8.85c.36.75.85 1.46 1.47 2.08a8.4 8.4 0 0 0 2.08 1.47c.13.06.2.1.28.11a.7.7 0 0 0 .58-.15c.06-.05.12-.11.23-.22.33-.33.5-.5.66-.6a1.9 1.9 0 0 1 2.06 0c.17.1.33.27.66.6l.19.19c.5.5.76.76.9 1.03.28.55.28 1.2 0 1.74-.14.28-.4.53-.9 1.04l-.15.15c-.5.5-.75.75-1.1.94-.37.21-.94.36-1.37.36-.4 0-.67-.08-1.22-.24a12.2 12.2 0 0 1-5.3-3.13 12.2 12.2 0 0 1-3.14-5.3c-.16-.55-.24-.83-.24-1.22 0-.43.15-1 .36-1.38.2-.34.44-.59.94-1.09l.15-.15c.51-.5.76-.76 1.04-.9a1.9 1.9 0 0 1 1.74 0c.27.14.53.4 1.03.9l.19.19c.33.33.5.5.6.66a1.9 1.9 0 0 1 0 2.06c-.1.17-.27.33-.6.66-.11.11-.17.17-.22.23a.7.7 0 0 0-.15.58l.11.29Z"/></svg>
      ${BUSINESS.phoneDisplay}
    </a>
    <address>${BUSINESS.address.line1}<br>${BUSINESS.address.city}, ${BUSINESS.address.state} ${BUSINESS.address.zip}</address>
  </div>
</main>
</body>
</html>`;
}

export default function middleware(request) {
  try {
    if (!isMaintenanceEnabled(process.env.MAINTENANCE_MODE)) return passThrough();
    const { pathname } = new URL(request.url);
    if (!isPublicPath(pathname)) return passThrough();
    return new Response(page(), {
      status: 503,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Retry-After': String(RETRY_AFTER_SECONDS),
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    // Never let a bug here take the storefront down.
    return passThrough();
  }
}
