# PRODUCTION-SETUP

How to promote the demo-mode backends to production. Nothing here is
required to run locally: with zero env vars the site uses the dev/demo
implementations (in-memory leads, JSON-file inventory, data-URL images,
demo admin password).

## Environment variables (Vercel project settings)

| Variable | Purpose | Behavior when unset |
| --- | --- | --- |
| `ADMIN_PASSWORD` | Real admin password for `/admin` | Documented demo password `oxford-demo` |
| `ADMIN_SESSION_SECRET` | Random secret that signs admin session tokens | Secret derived from the admin password (demo grade) |
| `DATABASE_URL` | Postgres connection string for the inventory store | Dev JSON file store (`.data/inventory-dev.json`), in-memory on read-only filesystems |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token for inventory photo storage | Photos stored as small data URLs inside the item records |

Set all four for a real deployment. Redeploy after changing any of them.

## Admin auth

- Login (`POST /api/admin/login`) exchanges the password for a bearer
  token signed with HMAC-SHA256 (`ADMIN_SESSION_SECRET`) that expires
  after 7 days. Tokens are stateless; nothing is stored server-side.
- Rotating `ADMIN_SESSION_SECRET` invalidates every issued token
  immediately (logs every device out).
- Generate a secret: `openssl rand -hex 32`
- The password and secret never appear in any `VITE_` variable or the
  client bundle. The in-browser demo gate only exists when the API is
  unreachable and never guards real data.
- Not yet implemented (acceptable for a single-owner admin, revisit if
  that changes): login rate limiting, multiple users, token revocation
  short of rotating the secret.

## Inventory database (Neon or Vercel Postgres)

1. Create a database: either [Neon](https://neon.tech) (free tier is
   fine) or Vercel Postgres from the Vercel dashboard (Storage tab).
2. Copy the pooled connection string and set it as `DATABASE_URL`.
3. There is no migration step: the adapter creates its table on first
   use with

   ```sql
   CREATE TABLE IF NOT EXISTS inventory_items (
     id TEXT PRIMARY KEY,
     created_at TIMESTAMPTZ NOT NULL,
     updated_at TIMESTAMPTZ NOT NULL,
     data JSONB NOT NULL
   )
   ```

4. The driver is `@neondatabase/serverless` (HTTP-based, works on any
   serverless runtime; also compatible with Vercel Postgres). It is only
   imported when `DATABASE_URL` is set.
5. Seeding: production starts empty on purpose. The owner adds real
   items through the admin. Do not copy the DEMO seed items into
   production.

## Photo storage (Vercel Blob)

1. In the Vercel dashboard: Storage tab, create a Blob store, connect it
   to the project. That injects `BLOB_READ_WRITE_TOKEN`.
2. Uploads then return public `*.public.blob.vercel-storage.com` URLs
   stored on the item; nothing else changes.
3. The admin form downscales photos in the browser (max edge 1200px,
   JPEG) before upload, so blobs stay small. Server-side cap: ~1.5 MB
   per image, JPEG/PNG/WebP only.
4. Deleting an item does not delete its blobs yet; prune from the Blob
   dashboard if storage ever matters. Listed as a follow-up.

## Leads store

Leads still use the demo in-memory adapter (`api/_lib/adapter.js`).
When a database exists (step above), the same promotion pattern applies:
implement the four leads adapter methods against Postgres and return
that adapter from `getLeadsAdapter()` when `DATABASE_URL` is set. This
is the next production task and is intentionally out of scope for the
inventory phase.

## Local development

- `node scripts/dev-api.mjs` starts every serverless endpoint on
  http://localhost:3999 with zero credentials for curl testing.
- The dev inventory store persists to `.data/inventory-dev.json`
  (gitignored). Delete the file to reseed the DEMO items.
- `npm run smoke` covers validation, auth, and every endpoint.
