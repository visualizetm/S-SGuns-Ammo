# S&S Guns & Ammo

Informational website for S&S Guns & Ammo, a family-owned firearms and
ammunition shop at 10 S. 3rd Street, Unit 5, Oxford, PA 19363.
Phone: (610) 368-6984.

Informational only. No e-commerce, no cart, no checkout, and no online
payments, by design. The catalog displays products and prices (public
pricing approved by the owner) with "call the shop" as the only next
step. See `NEEDS-CONFIRMATION.md` for every fact that still needs owner
confirmation before publish.

## Stack

- Vite + React + React Router (SPA)
- Vercel serverless functions in `api/`
- Demo-first data layer: everything runs with no database and no env vars
- Styling: CSS custom properties (design tokens in `src/styles/base.css`)
  plus a co-located `<style>` block per component, each with a unique class
  prefix (`nav-`, `hero-`, `hm-`, `ab-`, `svc-`, `xfer-`, `ct-`, `nf-`,
  `ft-`)

## Brand system

Light-first heritage brand. Tokens live in `src/styles/base.css`:

- Range Black `#10110F` (text, dark feature bands), Vintage Ivory `#F2EBDD`
  (ground), Field Olive `#454A3D` (`--brand`: buttons, links, focus ring)
- Barlow Condensed for uppercase display type, Inter for body
- Tight radii (2 to 6px), snappy grounded motion, reduced-motion respected
- Tinted borders and rings use `color-mix` on `--brand`, so a reskin is
  single-token
- Logo art lives in `public/brand/` (source PNGs) with paths wired in
  `LOGO_ASSETS` (`src/data/business.js`). Site-ready `.web.webp`
  versions, the favicon, apple-touch-icon, and og:image are derived with
  `node scripts/optimize-brand-assets.mjs`; rerun it after replacing any
  source PNG. Rifle art appears only as large feature graphics; the
  favicon and og:image use the weapon-free submark.

## Run it

```
npm install
npm run build        # production build to dist/
npm run preview      # serve the built site locally
npm run dev          # dev server with HMR
npm run smoke        # node smoke test for validation, adapter, endpoints
npm run responsive-check  # headless responsive / no-overlap checks
```

## Demo mode, and how it promotes to production

The public forms and the admin call the serverless endpoints first. When
those are unreachable (plain `vite dev` / `vite preview`), the client
falls back to an in-browser demo adapter (`src/lib/demoAdapter.js`). The
demo catalog mirrors the server exactly because both wrap the same pure
draft/publish operations (`shared/catalogStore.js`), persisted in
localStorage; the forms answer with the honest "being set up" message
since there is nothing to forward to. On Vercel the real API handles
everything; the promotion path to Postgres, Vercel Blob, and Web3Forms
is in `PRODUCTION-SETUP.md`.

## API

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/leads/contact` | POST | Contact form |
| `/api/leads/transfer` | POST | Transfer inquiry form |
| `/api/leads/email-signup` | POST | Email capture |
| `/api/admin/login` | POST | Admin login, returns signed expiring bearer token |
| `/api/inventory` | GET | Public catalog: PUBLISHED products and collections only, `?collection=&q=` |
| `/api/admin/products` | GET POST PATCH DELETE | Product drafts: list, save, restore, delete (auth) |
| `/api/admin/collections` | GET POST PATCH DELETE | Collection drafts, plus `{order:[ids]}` reorder (auth) |
| `/api/admin/bundles` | GET POST PATCH DELETE | Bundle drafts (auth) |
| `/api/admin/publish` | GET POST | Unpublished-changes summary; publish or discard all (auth) |
| `/api/admin/products-csv` | GET POST | CSV export / import of product drafts (auth) |
| `/api/admin/inventory-image` | POST | Upload a photo (auth) |

The catalog is a draft/publish store: every admin edit is a draft, and
the public read serves only the published snapshot, promoted atomically
by the Publish bar. Storage sits behind swappable adapters
(zero-credential JSON file and data-URL images in dev; Postgres and
Vercel Blob behind env vars in production; see `PRODUCTION-SETUP.md`).
The public forms store nothing server-side: they validate, drop
honeypot hits, and forward to the owner's email through Web3Forms.
Everything is display data only: no cart, no checkout, no purchase
flow.

Every POST body is validated server-side in `shared/validation.js` (also
reused client-side for inline errors). Invalid input returns 422 with
per-field errors. A hidden honeypot field silently drops bot submissions.

## Admin (demo)

- Visit `/admin`, password: `oxford-demo`. Tabs: Products, Collections,
  Bundles, Bulk Editor, with the persistent Publish bar on top.
- Auth is checked server-side only (`api/_lib/auth.js`); the password never
  appears in a `VITE_` variable or the client bundle. Set `ADMIN_PASSWORD`
  in Vercel project settings to override the demo password.
- The in-browser demo fallback also gates on the demo password, but that
  gate is cosmetic by definition (it ships to the browser). It exists only
  so local demos work; real deployments authenticate on the server. Promote
  to real session auth alongside the database adapter before launch.

## Deploy

`vercel.json` sets the build command, `dist` output, an SPA rewrite that
excludes `api/` so functions are not shadowed, and security headers
(nosniff, DENY framing, XSS protection). The footer shows the git commit
SHA injected at build time (`VERCEL_GIT_COMMIT_SHA` on Vercel, `git
rev-parse` locally).
