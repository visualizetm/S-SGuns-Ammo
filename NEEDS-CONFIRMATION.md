# NEEDS-CONFIRMATION

Confirmed facts hardcoded in `src/content/siteFacts.js`: business name
(S&S Guns & Ammo), address (10 S. 3rd Street, Unit 5, Oxford, PA 19363),
phone ((610) 467-0284), public email (sandsammozone@gmail.com), weekly
hours, the full service list (including buying/trade-in), and the About
copy (local, family-run, run by Steve). None of these are placeholders any
longer.

## Placeholders still rendered on the site

| Item | Where | Placeholder |
| --- | --- | --- |
| Founding year | About (optional slot, only shown if confirmed) | `[[FOUNDING YEAR - optional, confirm with owner]]` |

Founding year is the only `[[...]]` slot left in siteFacts. It is not
rendered publicly (no "EST." anywhere) until the owner confirms a year; the
slot is kept so `npm run preflight` keeps tracking it.

## Unconfirmed, keep flagged (do not fabricate)

- Founding year (no "EST. 19xx" until confirmed).
- Exact legal entity / DBA wording (how the business is legally named).
- Social media accounts, if any (`SOCIAL_LINKS` is empty; no social UI
  renders until real accounts are confirmed).
- Production domain: `BASE_URL` is still the staging host
  (`ssgunsammo.visualizeclients.com`). Swap to the real domain at launch so
  the sitemap, robots, and JSON-LD follow.

## Legal review required before publish

Transfer, background-check, and store-policy copy in
`src/content/siteFacts.js` carries a `// LEGAL REVIEW REQUIRED before
publish` comment (transfer intro, steps, what-to-bring, FAQ items, and the
FFL Transfers service). No fee numbers or legal claims appear; regulated
questions are answered with "Call the shop" language pending owner and
counsel review. Still open: transfer fees/specifics, whether transfers need
an appointment, and how FFL status may be described publicly.

## Brand logos (SUPPLIED, wired by role)

Real owner vector logos live at `public/*.svg` and are wired by role (see
the phase report and `src/content/siteFacts.js` `LOGO_ASSETS`):
horizontal lockup in the navbar and footer, the emblems as large feature
graphics, and the weapon-free submark for the admin and all app icons.
Raster app icons (favicon.ico, icon-192/512, apple-touch, og-image) are
generated from the submark by `scripts/generate-icons.mjs`.

## Assets still welcome (labeled slots render until then)

- Store photography: drop `.jpg` files into `public/photos/` using the
  names in `public/photos/README.md` (the home gallery and About storefront
  are currently turned off at the owner's request).
- Map image or embed (Home visit block, Contact).

## Product catalog

- Seeded catalog data is fictional and prefixed "DEMO:". The owner enters
  real items through `/admin`; production (Postgres) starts empty.
- Public pricing is owner-approved (prices and sale/compare-at values may
  show publicly).
- Condition values (New, Used) and stock statuses (In Stock, Low Stock,
  Sold, Hidden) are drafts to confirm with the owner.

## Demo-mode items to revisit at production

- Catalog storage is a JSON file (dev) until `DATABASE_URL` is set; see
  PRODUCTION-SETUP.md for the Postgres and Vercel Blob promotion steps.
- Admin gate uses a documented demo password; set `ADMIN_PASSWORD` and
  `ADMIN_SESSION_SECRET` in Vercel before launch.
