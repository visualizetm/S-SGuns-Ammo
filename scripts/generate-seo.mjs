// Build-time SEO output, run automatically after vite build (npm run build).
// Everything derives from src/content/siteFacts.js:
//   - dist/robots.txt        allow public routes, disallow /admin and /api
//   - dist/sitemap.xml       all public static routes
//   - dist/<route>/index.html  copies of the SPA shell with that route's
//     title, meta description, and og tags baked into the raw HTML, so
//     crawlers see correct metadata without executing JavaScript. Vercel
//     serves these static files before the SPA rewrite applies.
//   - LocalBusiness JSON-LD injected into the home page head (confirmed
//     fields only; unconfirmed fields like hours are omitted, never
//     invented).
// Item pages (/inventory/:id) stay client-rendered with their dynamic og
// handling: a documented limitation until prerendering or SSR exists.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BASE_URL,
  BUSINESS,
  HOURS,
  LOGO_ASSETS,
  PUBLIC_ROUTES,
} from '../src/content/siteFacts.js';

const DIST = 'dist';
const SITE_TITLE = `${BUSINESS.name} | ${BUSINESS.address.city}, ${BUSINESS.address.state}`;

function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const shell = readFileSync(join(DIST, 'index.html'), 'utf8');

function withMeta(html, { title, description }) {
  const fullTitle = title ? `${title} | ${BUSINESS.name}` : SITE_TITLE;
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(fullTitle)}</title>`)
    .replace(
      /(<meta\s+name="description"\s+content=")[\s\S]*?("\s*\/>)/,
      `$1${esc(description)}$2`
    )
    .replace(
      /(<meta\s+property="og:title"\s+content=")[\s\S]*?("\s*\/>)/,
      `$1${esc(fullTitle)}$2`
    )
    .replace(
      /(<meta\s+property="og:description"\s+content=")[\s\S]*?("\s*\/>)/,
      `$1${esc(description)}$2`
    );
}

// LocalBusiness JSON-LD: confirmed fields only. Hours are confirmed, so
// emit openingHoursSpecification for each open day (closed days omitted).
const openingHours = HOURS.filter((h) => h.opens).map((h) => ({
  '@type': 'OpeningHoursSpecification',
  dayOfWeek: `https://schema.org/${h.day}`,
  opens: h.opens,
  closes: h.closes,
}));
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: BUSINESS.name,
  telephone: '+16104670284',
  email: BUSINESS.emailDisplay,
  address: {
    '@type': 'PostalAddress',
    streetAddress: BUSINESS.address.line1,
    addressLocality: BUSINESS.address.city,
    addressRegion: BUSINESS.address.state,
    postalCode: BUSINESS.address.zip,
    addressCountry: 'US',
  },
  openingHoursSpecification: openingHours,
  url: BASE_URL,
  image: `${BASE_URL}/og-image.png`,
  logo: `${BASE_URL}${LOGO_ASSETS.submark}`,
};
const jsonLdTag = `    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n  </head>`;

// Per-route prerendered heads. The root file also gets the JSON-LD.
for (const route of PUBLIC_ROUTES) {
  let html = withMeta(shell, route.meta);
  if (route.path === '/') {
    html = html.replace('  </head>', jsonLdTag);
    writeFileSync(join(DIST, 'index.html'), html);
    console.log('seo: / (title, meta, og, JSON-LD)');
  } else {
    const dir = join(DIST, route.path.slice(1));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html);
    console.log(`seo: ${route.path} (title, meta, og)`);
  }
}

// robots.txt
const robots = [
  'User-agent: *',
  'Allow: /',
  'Disallow: /admin',
  'Disallow: /api',
  '',
  `Sitemap: ${BASE_URL}/sitemap.xml`,
  '',
].join('\n');
writeFileSync(join(DIST, 'robots.txt'), robots);
console.log('seo: robots.txt');

// sitemap.xml
const urls = PUBLIC_ROUTES.map(
  (route) =>
    `  <url><loc>${esc(BASE_URL + (route.path === '/' ? '' : route.path))}</loc></url>`
).join('\n');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
writeFileSync(join(DIST, 'sitemap.xml'), sitemap);
console.log('seo: sitemap.xml');
