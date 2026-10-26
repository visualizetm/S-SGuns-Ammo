# SITE REPORT

Snapshot of the S&S Guns & Ammo codebase: routes, endpoints, components,
data model, env vars, and known gaps. Created for the Hours + Temporary
Closures feature; kept up to date as the codebase changes.

## Stack

Vite + React 18 + React Router 6 SPA. Vercel serverless functions under
`api/`. MongoDB (official driver) in production, a JSON file store in
local dev, with a loud 503 failure in production when no database is
configured (never a silent in-memory fallback). Host-based routing: the
public site and the Owner's Dashboard are the same deployment, split by
hostname.

## Hosts

- `https://ssgunsandammo.com` (and `www`): the public storefront.
- `https://dashboard.ssgunsandammo.com`: the Owner's Dashboard, mounted
  at `/`. Old `/admin` links on the public host 301 here.
- Local dev / previews: path-based `/admin` (neither hostname matches,
  so `isDashboardHost()` is false), matching `shared/hosts.js` /
  `src/config/hosts.js` / `src/App.jsx`.

## Public routes (`src/App.jsx`, under `Layout`)

| Path | Page |
| --- | --- |
| `/` | Home |
| `/about` | About |
| `/services` | Services |
| `/inventory` | Inventory (published catalog browse) |
| `/inventory/:id` | InventoryItem |
| `/transfers` | TransfersFaq |
| `/contact` | Contact |

No dedicated `/hours` route: hours are shown inline via `ShopHours`
(footer on every page, Home's visit block, and the full weekly table on
Contact), and `ClosureBar` (a closure notice, not a route) renders above
the navbar on every public page when a closure is active or upcoming.

## Owner's Dashboard pages (`src/pages/Admin.jsx`, `?tab=`)

| tab | Page | Notes |
| --- | --- | --- |
| `overview` (default) | OverviewPage | Read-only stats |
| `products` | ProductsPage | Draft then Publish |
| `sales` | QuickSalePage | Writes live immediately, no Publish |
| `history` | PublishHistoryPage | Read-only log |
| `hours` | HoursPage | Weekly hours + closures; writes live immediately, no Publish (see below) |

## API endpoints (`api/`)

Every route is wrapped in `guard()` (`api/_lib/http.js`): a thrown error
with `code: 'DB_NOT_CONFIGURED'` becomes a clean 503; anything else
becomes a clean 500. Every JSON response sets `Cache-Control: no-store`.

| Method + path | Auth | Purpose |
| --- | --- | --- |
| `POST /api/admin/login` | - | Password -> bearer token |
| `GET /api/inventory` | public | Published catalog (products/collections/bundles) |
| `GET/POST /api/admin/products` | admin | Product drafts |
| `GET/POST /api/admin/collections` | admin | Collection drafts |
| `GET/POST /api/admin/bundles` | admin | Bundle drafts |
| `POST /api/admin/publish` | admin | Publish or discard all drafts |
| `GET /api/admin/products-csv` / `POST` | admin | Bulk export/import |
| `POST /api/admin/inventory-image` | admin | Cloudinary upload (signed server-side) |
| `GET/POST/DELETE /api/admin/sales` | admin | Quick Sale log, writes live |
| `GET /api/admin/health` | admin | `{ ok, adapter, imageStorage, runtime }` |
| `GET /api/admin/publish-history` | admin | Read-only publish log |
| `GET /api/robots` | public | Host-aware robots.txt |
| `GET /api/hours` | public | Hours + active/notice-window closures |
| `GET/PUT /api/admin/hours` *(vercel.json rewrite to `/api/hours`)* | admin | Full weekly schedule + all closures |
| `POST/PUT/DELETE /api/admin/closures` *(rewrite)* | admin | Create/edit/delete a closure |
| `POST /api/admin/closures/reopen` *(rewrite)* | admin | Cancel the active closure |

Consolidation: the project was already at 12 serverless functions (the
commonly-cited Vercel Hobby limit) before this feature. All five new
hours/closures routes above are served by ONE new file, `api/hours.js`,
reached via `vercel.json` rewrites that add `?scope=admin` and an
optional `&route=` to distinguish the logical endpoint. See
`docs/DECISIONS.md` for the full reasoning and the resulting count.

## Data model

MongoDB collections: `products`, `collections`, `bundles`, `sales`,
`publishHistory`, and now `settings` (one document, `_id: "hours"`):

```
{
  _id: "hours",
  timezone: "America/New_York",
  weekly: [ { day: 0-6, open: bool, opens: "HH:MM" | null, closes: "HH:MM" | null } ] x7,
  closures: [
    {
      id, startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD" | null,
      reason, label, message, note, noticeDays,
      createdAt, cancelledAt: ISO string | null,
    }
  ],
  updatedAt,
}
```

Dates are plain shop-local date strings, never UTC timestamps, so a
closure never shifts a day because of UTC. All shop-local time is
computed via `Intl.DateTimeFormat` against `America/New_York`
(`shared/hours.js`), never a fixed UTC offset, so it stays correct
across DST.

## Env vars

No new env vars. Same as before this feature:

Required in production: `DATABASE_MONGODB_URI` (fallback `MONGODB_URI`).
Also used: `MONGODB_DB`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`,
`CLOUDINARY_URL` (or the three discrete Cloudinary vars),
`VITE_MAINTENANCE_MODE`, `VITE_PUBLIC_HOST`, `VITE_DASHBOARD_HOST`.

## Components added by this feature

- `shared/hours.js`: pure shop-hours logic (status, closures, holidays,
  formatting, validation). No deps, used by both server and client.
- `api/_lib/hoursAdapter.js`: dev-file / MongoDB / loud-failure adapter,
  same pattern as `historyAdapter.js`.
- `api/hours.js`: the one consolidated serverless function for all
  hours/closures routes.
- `src/components/admin/HoursPage.jsx`: the dashboard Hours page (weekly
  hours editor, closures, status card, preview).
- `src/components/ShopHours.jsx`: public component, `compact` and `full`
  variants, used on the footer, Home, and Contact.
- `src/components/ClosureBar.jsx`: the public closure notice bar,
  stacked under the announcement bar.

## Hours page save path (current behavior)

Save button (`HoursPage.jsx` `handleSaveHours`) -> check the week locally
-> `adminSaveHours` (`src/lib/apiClient.js`) -> `PUT /api/admin/hours`
(rewritten to `api/hours.js`) -> `validateHours` -> adapter `saveWeekly`
(an atomic Mongo `$set` upsert) -> the page asks `GET /api/admin/hours`
again and only confirms if the same hours come back.

| Case | What the owner sees |
| --- | --- |
| Success | "Hours saved. They are live on your site now." in the dock above the tab bar for 5 seconds |
| Days that do not make sense | The row says "Closing time has to be after opening time." and the dock says to check the marked days; nothing is sent |
| 503 `DB_NOT_CONFIGURED`, any 5xx, a platform timeout page, or hours that do not match on the second look | "The site could not reach its database, so nothing was saved. Try again in a minute. If it keeps happening, text Rob." |
| Offline, or no answer within 15 seconds | "No connection. Nothing was saved. Try again." |
| Session expired (401) | Back to the login screen |

The unsaved changes and the open dock are kept after every failure. On the
real dashboard host a failed Hours request is never replaced by demo data
(see `docs/DECISIONS.md`, decision 20); on localhost and previews the demo
fallback still applies. If the free Atlas cluster is paused, every save
fails with the database message after about 8 seconds (the driver's
server selection timeout).

## Checks that cover this

- `scripts/hours-savebar-check.mjs` (run by `npm run smoke`): real Chromium
  at 375x667, 390x844, 430x932 and 360x640; Save and Discard on screen,
  44px or more, and tappable (`elementFromPoint`); the dock and tab bar do
  not overlap; five one-line tabs of one height; `--tabbar-h` equals the
  real bar; the last content scrolls clear of the dock; no fixed or sticky
  element on any dashboard page overlaps the tab bar; the Closed switch has
  3:1 contrast; and the saving, saved, 503, 500, timeout page, offline,
  server-forgets-the-hours, bad-range and retry cases.
- `scripts/responsive-check.mjs` (`npm run responsive-check`): the
  dashboard and public pages at six viewports. It no longer leaves a
  preview server running on port 4173.

## Known gaps / follow-ups (explicitly out of scope, logged per the brief)

- One open range per day only; a lunch-break second range is a follow up.
- No early-close / late-open override for a single date outside a full
  closure.
- No SMS/email notifications when a closure is created.
- No automatic sync to the Google Business Profile; that stays a manual,
  separate step for the owner.
- No structured data (JSON-LD) for opening hours.
- Item pages (`/inventory/:id`) stay client-rendered for OG tags (a
  pre-existing, documented limitation, unrelated to this feature).
- The other Hours page actions (create, edit, delete, reopen a closure)
  still fall back to demo data on any thrown error, so a network failure
  there signs the owner out silently on the real dashboard host.
- `src/content/siteFacts.js` still holds a second copy of the shop hours
  (the fallback shown until hours are saved in the database). Retire it
  after `scripts/set-hours.mjs` has been run against the real database.
- `api/` has 13 serverless functions, one over the commonly cited limit of
  12; confirm the real Vercel plan before deploying.
