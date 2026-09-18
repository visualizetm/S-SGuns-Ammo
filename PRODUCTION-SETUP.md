# PRODUCTION-SETUP

How to promote the demo-mode backends to production. Nothing here is
required to run locally: with zero env vars, LOCAL runs use the dev
implementations (JSON-file catalog, data-URL images, demo password).

PRODUCTION IS DIFFERENT ON PURPOSE. A deployed site (Vercel sets
VERCEL=1) REFUSES to run without a database: every store-backed endpoint
answers 503 "Database not configured. Set DATABASE_MONGODB_URI." and the
Owner's Dashboard shows a red "saves are not being stored" banner. This
loud failure replaced a silent one: without it, the serverless dev store
held data in per-instance memory, so Publish reported success and the
changes vanished when the function instance ended.

## REQUIRED in production (the site fails loud without these)

| Variable | Purpose |
| --- | --- |
| `DATABASE_MONGODB_URI` | MongoDB Atlas connection string for the catalog, sales, and publish-history stores. This is the name Vercel's project settings use (it cannot be renamed there); `MONGODB_URI` is accepted as a fallback name for local dev or any other environment. |

Verify after deploy: sign in to the dashboard, then
`GET /api/admin/health` (with the bearer token) must report
`{ "ok": true, "adapter": "mongodb" }`. From your own machine you can
also check the database directly:
`DATABASE_MONGODB_URI=... node scripts/db-check.mjs`.

The public site is phone-first: there are no contact forms and no
message backend to configure. Every "get in touch" action is a
click-to-call link, so there is nothing to set up for contact.

## Environment variables (Vercel project settings)

| Variable | Purpose | Behavior when unset |
| --- | --- | --- |
| `ADMIN_PASSWORD` | Real admin password for `/admin` | Documented demo password `oxford` |
| `ADMIN_SESSION_SECRET` | Random secret that signs admin session tokens | Secret derived from the admin password (demo grade) |
| `DATABASE_MONGODB_URI` | REQUIRED. MongoDB Atlas connection string (fixed name in Vercel's project settings; `MONGODB_URI` is accepted as a fallback) | PRODUCTION: loud 503 error + red dashboard banner. Local dev only: JSON file store |
| `MONGODB_DB` | Database name | Defaults to `ssguns` |
| `CLOUDINARY_URL` (or `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET`) | Cloudinary account for permanent photo storage | PRODUCTION: uploads answer 503 with a clear error. Local dev only: data-URL photos |
| `VITE_MAINTENANCE_MODE` (optional) | Set to `true` to take the public site down for maintenance | `false`: public site serves normally |
| `VITE_PUBLIC_HOST` (optional) | Overrides the public storefront hostname baked into the client bundle | Defaults to `ssgunsandammo.com` |
| `VITE_DASHBOARD_HOST` (optional) | Overrides the Owner's Dashboard hostname baked into the client bundle | Defaults to `dashboard.ssgunsandammo.com` |

Set at least `DATABASE_MONGODB_URI` and the Cloudinary variable(s) for a
real deployment. Redeploy after changing any of them.

There is no contact-form or message-backend env var. The public site is
phone-first by explicit, standing design decision (see "REQUIRED in
production" above): every "get in touch" action is a click-to-call
link, so nothing needs to be configured for contact.

Copy-paste with the Vercel CLI (or paste the same values into Project
Settings, Environment Variables, in the dashboard):

```sh
# Generate the two secrets first and keep the password for the owner.
openssl rand -base64 24   # -> ADMIN_PASSWORD (or any strong password)
openssl rand -hex 32      # -> ADMIN_SESSION_SECRET

vercel env add ADMIN_PASSWORD production
vercel env add ADMIN_SESSION_SECRET production
vercel env add DATABASE_MONGODB_URI production
vercel env add CLOUDINARY_URL production
vercel --prod   # redeploy so the new env takes effect
```

## Pre-deploy gate

Run `npm run build` then `npm run preflight` before any production
deploy. It fails the deploy if the retired phone number reappears, if an
em or en dash slips into copy, if DEMO seed data could reach the
production path, or if the build did not emit sitemap.xml and the web
manifest (robots.txt is served at request time by `api/robots.js`, not
a build output; see "SEO output" below). It also lists every `[[...]]`
owner-confirmation placeholder still in `src/content/siteFacts.js`.

`npm run build` itself never requires any env var: it succeeds with a
completely empty environment, and every secret listed above is read
only at request time inside `api/` serverless functions, never at
build time. Confirmed by building both with zero env vars and with
every secret above set to a real-looking value: identical output.

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
   that as `DATABASE_MONGODB_URI` in Vercel (the fixed name Vercel's
   project settings use there; `MONGODB_URI` also works as a fallback
   name, for local dev or any other environment).
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
8. Verify the connection from your own machine (or CI):
   `DATABASE_MONGODB_URI=... node scripts/db-check.mjs` connects, pings,
   and prints a document count per collection.

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
   `DATABASE_MONGODB_URI=... CLOUDINARY_URL=... node scripts/migrate-images-to-cloudinary.mjs`
   (add `--dry-run` to preview; safe to rerun, already-migrated images
   are skipped).

## SEO output (automatic at build)

- `npm run build` runs `scripts/generate-seo.mjs` after vite: it writes
  `sitemap.xml`, prerendered head metadata for each static public route,
  and LocalBusiness JSON-LD (confirmed fields only) on the home page.
- `robots.txt` is NOT a static file. It is served at request time by
  `api/robots.js` (via the `/robots.txt` rewrite in `vercel.json`) so it
  can differ by host: full `Disallow: /` on the Owner's Dashboard host,
  and the normal public robots.txt (public routes allowed, `/admin` and
  `/api` disallowed) everywhere else.
- `BASE_URL` lives in `src/content/siteFacts.js`, set to
  `https://ssgunsandammo.com`. Update it (and redeploy) if the public
  domain ever changes, so the sitemap, robots.txt, and JSON-LD follow.
- Documented limitation: item pages (`/inventory/:id`) are
  client-rendered. Their titles and og tags are set dynamically in the
  browser, which most modern crawlers execute, but raw-HTML scrapers see
  the site defaults. Revisit with prerendering or SSR if item-level
  social previews matter later.

## Owner's Dashboard on its own domain

One Vite build and one Vercel deployment serve two hostnames. Which app
renders is decided by `window.location.hostname` (`src/config/hosts.js`,
`shared/hosts.js`):

- `https://ssgunsandammo.com` (and `www`) → the public storefront.
- `https://dashboard.ssgunsandammo.com` → the Owner's Dashboard, mounted
  at the root path. No public storefront route ever renders on this
  host, and any path other than `/` redirects (client-side) to the same
  path on the public host.

The API is same-origin on both hosts (no CORS changes needed) because
both hostnames point at the same deployment.

### Vercel domains

In the Vercel project, add all three domains under Project Settings ->
Domains: `ssgunsandammo.com`, `www.ssgunsandammo.com`,
`dashboard.ssgunsandammo.com`. Set `ssgunsandammo.com` as the primary
domain and redirect `www` to it (Vercel offers this as a toggle when you
add `www`).

### DNS records

At your DNS provider, point all three at Vercel exactly as Vercel's
domain-verification screen instructs for your account (it shows the
current recommended records when you add each domain there):

| Host | Type | Value |
| --- | --- | --- |
| `@` (apex, `ssgunsandammo.com`) | A (or ALIAS/ANAME if your provider supports it) | Vercel's apex IP/target, shown on the domain's setup screen |
| `www` | CNAME | `cname.vercel-dns.com` |
| `dashboard` | CNAME | `cname.vercel-dns.com` |

`www.ssgunsandammo.com` redirects to the apex (configured in Vercel, not
DNS). `dashboard.ssgunsandammo.com` is a normal Vercel domain on the same
project as the apex, not a separate deployment.

### Old `/admin` links

`vercel.json` 301-redirects `/admin` and `/admin/*` on the public
hostnames (`ssgunsandammo.com` and `www.ssgunsandammo.com` only, scoped
by `has: [{ "type": "host", ... }]`) to
`https://dashboard.ssgunsandammo.com/`, so any old bookmark or link to
the public site's `/admin` still works. The redirect is deliberately
scoped to the exact production hostnames, not a blanket rule, so
`/admin` keeps working path-based on Vercel preview deployments
(`*.vercel.app`) and in local dev.

### Host env vars (optional)

`VITE_PUBLIC_HOST` and `VITE_DASHBOARD_HOST` override the two hostnames
baked into the client bundle at build time (defaults are
`ssgunsandammo.com` and `dashboard.ssgunsandammo.com`). They are plain
hostnames, not secrets. Leave them unset for the real deployment; they
exist so the same code works if the domains ever change, or for testing
host-based routing under different names. Neither hostname matches
`localhost` or a `*.vercel.app` preview URL, so local dev and previews
keep the original path-based `/admin` behavior automatically.

## Local development

- `node scripts/dev-api.mjs` serves every endpoint on
  http://localhost:3999 with zero credentials for curl testing.
- The dev catalog persists to `.data/catalog-dev.json` (gitignored) and
  starts empty. Delete the folder to reset it.
- `npm run smoke` covers validation, auth, the draft/publish flow, CSV,
  and every endpoint. `npm run responsive-check` audits every public
  page and every admin page.
