# Maintenance mode (taking the website down)

Turning maintenance mode on replaces the whole public website with a single
"Website is down until further notice" page that keeps the shop's phone
number and address on it. Nothing is deleted. It is a switch, and flipping it
back restores the site exactly as it was.

**The Owner's Dashboard stays up the whole time.** You can still sign in at
`/admin` and manage products while the public site is down.

## To take the site DOWN

1. Go to the project on Vercel: **Settings, Environment Variables**.
2. Set both of these to `true` (create them if they do not exist):
   - `VITE_MAINTENANCE_MODE` = `true`
   - `MAINTENANCE_MODE` = `true`
3. **Redeploy** (Deployments tab, latest deployment, Redeploy).

The public site now shows the down page.

## To bring the site BACK UP

1. Same place: **Settings, Environment Variables**.
2. Set both back to `false` (or delete both variables):
   - `VITE_MAINTENANCE_MODE` = `false`
   - `MAINTENANCE_MODE` = `false`
3. **Redeploy.**

The site returns to normal immediately. Nothing else needs to change.

## Why two variables

They do two different jobs, and you should always set them together.

| Variable | Job |
| --- | --- |
| `VITE_MAINTENANCE_MODE` | What people SEE. Built into the site, swaps every public page for the down page. |
| `MAINTENANCE_MODE` | What Google SEES. Makes public pages answer with HTTP 503 plus `Retry-After`, so search engines treat this as temporary and do not drop the site from search results. |

If only `VITE_MAINTENANCE_MODE` is set, visitors still get the correct down
page; only the search-engine status code is missed. If only
`MAINTENANCE_MODE` is set, crawlers get the 503 page but a visitor already on
the site could still navigate the storefront. Set both.

## Safety notes

- The default is OFF. If the variables are missing, empty, or misspelled, the
  site stays up. Only the exact word `true` takes it down.
- `/admin` (Owner's Dashboard) and `/api` are never affected by either switch.
- This only takes effect once deployed. Committing alone changes nothing on
  the live site.

## Files involved

- `src/config/maintenance.js` the switch the app reads
- `src/pages/Maintenance.jsx` the down page
- `shared/maintenance.js` on/off and public-path rules (covered by `npm run smoke`)
- `shared/maintenanceArt.js` the illustration and copy, shared by both renderings
- `middleware.js` returns the 503 for search engines
