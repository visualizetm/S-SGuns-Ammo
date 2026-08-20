# PRODUCTION-SETUP

How to promote the demo-mode backends to production. Nothing here is
required to run locally: with zero env vars the site uses the dev/demo
implementations (JSON-file catalog with DEMO seeds, data-URL images,
demo admin password).

The public site is phone-first: there are no contact forms and no
message backend to configure. Every "get in touch" action is a
click-to-call link, so there is nothing to set up for contact.

## Environment variables (Vercel project settings)

| Variable | Purpose | Behavior when unset |
| --- | --- | --- |
| `ADMIN_PASSWORD` | Real admin password for `/admin` | Documented demo password `oxford` |
| `ADMIN_SESSION_SECRET` | Random secret that signs admin session tokens | Secret derived from the admin password (demo grade) |
| `POSTGRES_URL` (or `DATABASE_URL`) | Pooled Postgres connection string for the catalog store. Vercel's Supabase integration sets `POSTGRES_URL` automatically | Dev JSON file store (`.data/catalog-dev.json`), in-memory on read-only filesystems |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token for photo storage | Photos stored as small data URLs inside the records |

Set all four for a real deployment. Redeploy after changing any of them.

Copy-paste with the Vercel CLI (or paste the same values into Project
Settings, Environment Variables, in the dashboard):

```sh
# Generate the two secrets first and keep the password for the owner.
openssl rand -base64 24   # -> ADMIN_PASSWORD (or any strong password)
openssl rand -hex 32      # -> ADMIN_SESSION_SECRET

vercel env add ADMIN_PASSWORD production
vercel env add ADMIN_SESSION_SECRET production
vercel env add POSTGRES_URL production
vercel env add BLOB_READ_WRITE_TOKEN production
vercel --prod   # redeploy so the new env takes effect
```

## Pre-deploy gate

Run `npm run build` then `npm run preflight` before any production
deploy. It fails the deploy if the retired phone number reappears, if an
em or en dash slips into copy, if DEMO seed data could reach the
Postgres path, or if the build did not emit robots.txt, sitemap.xml,
and the web manifest. It also lists every `[[...]]` owner-confirmation
placeholder still in `src/content/siteFacts.js`.

## Store photos

- Real store photography lives in `public/photos/` (separate from the
  logo marks in `public/brand/`). See `public/photos/README.md` for the
  exact file names the site looks for.
- Dropping a correctly named `.jpg` into that folder makes it appear on
  the site with no code change. Missing files show a labeled placeholder,
  never a broken image.
- The gallery list and captions live in `src/content/siteFacts.js`
  (`SHOP_GALLERY` and `PHOTOS`).

## Admin auth

- Login exchanges the password for an HMAC-SHA256-signed bearer token
  that expires after 7 days. Stateless; nothing stored server-side.
- Rotating `ADMIN_SESSION_SECRET` logs every device out immediately.
- Generate a secret: `openssl rand -hex 32`
- Not yet implemented (fine for a single-owner admin): login rate
  limiting, multiple users, per-token revocation.

## Catalog database (Supabase, or any Postgres)

The catalog store uses the `postgres` driver, which works with Supabase,
Neon, Vercel Postgres, or a self-hosted database.

1. Supabase via Vercel: add the Supabase integration to the project; it
   sets `POSTGRES_URL` (the pooled, transaction-mode connection) and other
   vars automatically. The adapter reads `POSTGRES_URL` first, then
   `DATABASE_URL`. Use the POOLED connection string for serverless (the
   driver sets `prepare:false` and TLS, which the Supabase pooler needs).
2. No migration step: the adapter creates its three tables on first use
   (`catalog_products`, `catalog_collections`, `catalog_bundles`), each
   `id TEXT PRIMARY KEY, created_at, updated_at, draft JSONB, published
   JSONB`.
3. Draft/publish semantics are identical to the dev store because both
   run the same operations (shared/catalogStore.js). Publish and Discard
   write through a single transaction, so the promotion is atomic.
4. Production starts EMPTY on purpose. The owner adds real products
   through the admin; DEMO seeds never promote to production.
5. Single-editor assumption: writes are read-modify-write without row
   locking. Fine for one owner on one phone; revisit before adding a
   second concurrent editor.
6. Verify locally against any Postgres: `POSTGRES_URL=... node
   scripts/test-postgres.mjs` exercises create, publish, edit, and delete.

## Photo storage (Vercel Blob)

1. Storage tab, create a Blob store, connect it to the project (injects
   `BLOB_READ_WRITE_TOKEN`).
2. Uploads return public blob URLs stored on the records.
3. The admin downscales photos in the browser (max edge 1200px, JPEG)
   before upload; server caps ~1.5 MB, JPEG/PNG/WebP only.
4. Deleting a product does not delete its blobs; prune from the Blob
   dashboard if storage ever matters.

## SEO output (automatic at build)

- `npm run build` runs `scripts/generate-seo.mjs` after vite: it writes
  `robots.txt` (public routes allowed, `/admin` and `/api` disallowed),
  `sitemap.xml`, prerendered head metadata for each static public route,
  and LocalBusiness JSON-LD (confirmed fields only) on the home page.
- `BASE_URL` lives in `src/content/siteFacts.js`; swap it to the custom
  domain at launch and redeploy so the sitemap and JSON-LD follow.
- Documented limitation: item pages (`/inventory/:id`) are
  client-rendered. Their titles and og tags are set dynamically in the
  browser, which most modern crawlers execute, but raw-HTML scrapers see
  the site defaults. Revisit with prerendering or SSR if item-level
  social previews matter later.

## Local development

- `node scripts/dev-api.mjs` serves every endpoint on
  http://localhost:3999 with zero credentials for curl testing.
- The dev catalog persists to `.data/catalog-dev.json` (gitignored).
  Delete the folder to reseed the DEMO catalog.
- `npm run smoke` covers validation, auth, the draft/publish flow, CSV,
  and every endpoint. `npm run responsive-check` audits every public
  page and all four admin tabs.
