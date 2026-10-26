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
