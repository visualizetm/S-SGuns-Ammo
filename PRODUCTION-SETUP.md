# PRODUCTION-SETUP

How to promote the demo-mode backends to production. Nothing here is
required to run locally: with zero env vars the site uses the dev/demo
implementations (JSON-file catalog with DEMO seeds, data-URL images,
demo admin password, "form is being set up" answers on the public forms).

## Environment variables (Vercel project settings)

| Variable | Purpose | Behavior when unset |
| --- | --- | --- |
| `ADMIN_PASSWORD` | Real admin password for `/admin` | Documented demo password `oxford-demo` |
| `ADMIN_SESSION_SECRET` | Random secret that signs admin session tokens | Secret derived from the admin password (demo grade) |
| `DATABASE_URL` | Postgres connection string for the catalog store | Dev JSON file store (`.data/catalog-dev.json`), in-memory on read-only filesystems |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token for photo storage | Photos stored as small data URLs inside the records |
| `WEB3FORMS_ACCESS_KEY` | Web3Forms key; public forms forward to the owner's email | Forms answer 503 with a "form is being set up" message |

Set all five for a real deployment. Redeploy after changing any of them.

## Public forms (Web3Forms)

- Contact, transfer inquiry, and email signup validate server-side
  (shared/validation.js), drop honeypot hits silently, and forward to
  https://api.web3forms.com/submit with the env key. Nothing is stored
  server-side.
- Setup: create a free access key at https://web3forms.com using the
  confirmed owner email sandsammozone@gmail.com, set
  `WEB3FORMS_ACCESS_KEY`, redeploy, send a test through each form.
- The key never ships to the browser; it lives only in the env var.

## Admin auth

- Login exchanges the password for an HMAC-SHA256-signed bearer token
  that expires after 7 days. Stateless; nothing stored server-side.
- Rotating `ADMIN_SESSION_SECRET` logs every device out immediately.
- Generate a secret: `openssl rand -hex 32`
- Not yet implemented (fine for a single-owner admin): login rate
  limiting, multiple users, per-token revocation.

## Catalog database (Neon or Vercel Postgres)

1. Create a database (Neon free tier or Vercel Postgres, Storage tab).
2. Set the pooled connection string as `DATABASE_URL`.
3. No migration step: the adapter creates its three tables on first use
   (`catalog_products`, `catalog_collections`, `catalog_bundles`), each
   `id TEXT PRIMARY KEY, created_at, updated_at, draft JSONB, published
   JSONB`.
4. Draft/publish semantics are identical to the dev store because both
   run the same operations (shared/catalogStore.js). Publish and Discard
   write through a single transaction, so the promotion is atomic.
5. Production starts EMPTY on purpose. The owner adds real products
   through the admin; DEMO seeds never promote to production.
6. Single-editor assumption: writes are read-modify-write without row
   locking. Fine for one owner on one phone; revisit before adding a
   second concurrent editor.

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
