# PRODUCTION-SETUP

How to promote the demo-mode backends to production. Nothing here is
required to run locally: with zero env vars, LOCAL runs use the dev
implementations (JSON-file catalog, data-URL images, demo password).

PRODUCTION IS DIFFERENT ON PURPOSE. A deployed site (Vercel sets
VERCEL=1) REFUSES to run without a database: every store-backed endpoint
answers 503 "Database not configured. Set MONGODB_URI." and the Owner's
Dashboard shows a red "saves are not being stored" banner. This loud
failure replaced a silent one: without it, the serverless dev store held
data in per-instance memory, so Publish reported success and the changes
vanished when the function instance ended.

## REQUIRED in production (the site fails loud without these)

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB Atlas connection string for the catalog, sales, and publish-history stores. |

Verify after deploy: sign in to the dashboard, then
`GET /api/admin/health` (with the bearer token) must report
`{ "ok": true, "adapter": "mongodb" }`. From your own machine you can
also check the database directly: `MONGODB_URI=... node scripts/db-check.mjs`.

The public site is phone-first: there are no contact forms and no
message backend to configure. Every "get in touch" action is a
click-to-call link, so there is nothing to set up for contact.

## Environment variables (Vercel project settings)

| Variable | Purpose | Behavior when unset |
| --- | --- | --- |
| `ADMIN_PASSWORD` | Real admin password for `/admin` | Documented demo password `oxford` |
| `ADMIN_SESSION_SECRET` | Random secret that signs admin session tokens | Secret derived from the admin password (demo grade) |
| `MONGODB_URI` | REQUIRED. MongoDB Atlas connection string | PRODUCTION: loud 503 error + red dashboard banner. Local dev only: JSON file store |
| `MONGODB_DB` | Database name | Defaults to `ssguns` |
| `CLOUDINARY_URL` (or `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET`) | Cloudinary account for permanent photo storage | PRODUCTION: uploads answer 503 with a clear error. Local dev only: data-URL photos |

Set at least `MONGODB_URI` and the Cloudinary variable(s) for a real
deployment. Redeploy after changing any of them.

Copy-paste with the Vercel CLI (or paste the same values into Project
Settings, Environment Variables, in the dashboard):

```sh
# Generate the two secrets first and keep the password for the owner.
openssl rand -base64 24   # -> ADMIN_PASSWORD (or any strong password)
openssl rand -hex 32      # -> ADMIN_SESSION_SECRET

vercel env add ADMIN_PASSWORD production
vercel env add ADMIN_SESSION_SECRET production
vercel env add MONGODB_URI production
vercel env add CLOUDINARY_URL production
vercel --prod   # redeploy so the new env takes effect
```

## Pre-deploy gate

Run `npm run build` then `npm run preflight` before any production
deploy. It fails the deploy if the retired phone number reappears, if an
em or en dash slips into copy, if DEMO seed data could reach the
production path, or if the build did not emit robots.txt, sitemap.xml,
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

## Catalog database (MongoDB Atlas)

The catalog store uses the official `mongodb` driver, talking to a
MongoDB Atlas cluster (any tier, including the free M0).

1. Create a free cluster at mongodb.com/atlas. Under Database Access,
   create a user with a strong password. Under Network Access, allow
   access from anywhere (`0.0.0.0/0`) since Vercel's serverless functions
   do not have a fixed IP; Atlas's own auth (the connection string's
   username/password) is the actual security boundary. Under Database,
   click Connect, choose "Drivers", and copy the connection string; it
   looks like `mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/`. Set
   that as `MONGODB_URI` in Vercel.
2. Database name: `MONGODB_DB`, defaults to `ssguns` if unset. Nothing
   else to create; MongoDB creates each collection automatically the
   first time something is written to it.
3. Collections: `products`, `collections`, `bundles` (each document:
   `{ id, createdAt, updatedAt, draft, published }`, matching the dev
   store's shape exactly), `sales`, and `publishHistory`. Indexes (a
   unique index on `id`, plus `updatedAt` and the field each public read
   filters on) are created automatically the first time the app touches
   each collection; see `api/_lib/mongoClient.js`.
4. Draft/publish semantics are identical to the dev store because both
   run the same operations (`shared/catalogStore.js`). Publish and
   Discard run inside a MongoDB transaction when the cluster supports one
   (every Atlas tier does, since Atlas clusters are always replica
   sets), so the promotion is atomic. The one documented exception: a
   bare local `mongod` started without `--replSet` does NOT support
   transactions, and the adapter automatically falls back to a plain,
   non-transactional `bulkWrite` for that case only (never on Atlas). See
   the comment on `withOptionalTransaction` in `api/_lib/mongoClient.js`
   for the exact tradeoff.
5. Connection reuse: the `MongoClient` (and its `connect()` promise) is
   created once per warm serverless instance and cached at module scope,
   never reopened per request.
6. Production starts EMPTY on purpose. The owner adds real products
   through the admin; DEMO seeds never promote to production.
7. Single-editor assumption: non-publish writes are read-modify-write
   without document locking. Fine for one owner on one phone; revisit
   before adding a second concurrent editor.
8. Verify the connection from your own machine (or CI): `MONGODB_URI=...
   node scripts/db-check.mjs` connects, pings, and prints a document
   count per collection.

## Photo storage (Cloudinary)

1. Create a free Cloudinary account (cloudinary.com), open the dashboard,
   and copy the "API environment variable" (it looks like
   `cloudinary://KEY:SECRET@CLOUD_NAME`). Add it to Vercel as
   `CLOUDINARY_URL` and redeploy. (The three discrete vars
   `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   work too.)
2. Uploads go through the auth-gated `POST /api/admin/inventory-image`
   endpoint, which signs the request SERVER-SIDE; the API secret never
   reaches the browser. Records store only the secure delivery URL
   (with `f_auto,q_auto` for fast automatic format/quality) and the
   `public_id`, never image bytes.
3. Photos land in the `ss-guns-ammo/products` folder. The admin still
   downscales in the browser (max edge 1200px JPEG) before upload;
   server caps ~1.5 MB, JPEG/PNG/WebP only.
4. PERMANENCE: uploaded images STAY, by design. Nothing in the app ever
   deletes a Cloudinary asset; deleting or replacing a product removes
   only the reference. The smoke suite fails if a destroy call is added.
5. Migrating legacy images (base64 or old Vercel Blob URLs) into
   Cloudinary, one time:
   `MONGODB_URI=... CLOUDINARY_URL=... node scripts/migrate-images-to-cloudinary.mjs`
   (add `--dry-run` to preview; safe to rerun, already-migrated images
   are skipped).

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
- The dev catalog persists to `.data/catalog-dev.json` (gitignored) and
  starts empty. Delete the folder to reset it.
- `npm run smoke` covers validation, auth, the draft/publish flow, CSV,
  and every endpoint. `npm run responsive-check` audits every public
  page and every admin page.
