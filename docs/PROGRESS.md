# PROGRESS

Hours + Temporary Closures feature, one entry per milestone commit.

## Milestone 1: shared logic and tests

- `shared/hours.js`: shop-timezone clock (`Intl.DateTimeFormat`, no
  fixed-offset math, correct across DST), weekly-schedule status,
  closures (active/upcoming/past/cancelled, notice window), holiday
  date computation (computed per year, not hardcoded), formatting, and
  `validateHours` / `validateClosure` as the server's source of truth.
- `scripts/hours-check.mjs`: 30 pure-logic checks, wired into
  `npm run smoke`. Covers open/closed/before/after, active and
  open-ended and cancelled closures, notice windows, "back at" across a
  closed weekend, DST fall back (Nov 1, 2026) and spring forward (Mar
  14, 2027) verified against concrete UTC instants, Thanksgiving/
  Memorial Day/Labor Day for 2026 and 2027, and validation rejects.
- `docs/SITE-REPORT.md`, `docs/DESIGN-SYSTEM.md`, `docs/DECISIONS.md`
  created.
- All 30 new checks pass locally.

## Milestone 2: store and API

- `api/_lib/hoursAdapter.js`: dev-file / MongoDB / loud-failure adapter,
  same pattern as `historyAdapter.js`. MongoDB writes use atomic `$push`
  (add), `$pull` (delete), and positional `$set` (edit, reopen) against
  the one `settings` document so two quick saves cannot clobber each
  other.
- `api/hours.js`: one consolidated serverless function for all five
  hours/closures routes (see `docs/DECISIONS.md` decision 3 for why).
  `vercel.json` rewrites the admin paths here with `?scope=admin` and
  `&route=`. `scripts/dev-api.mjs` mirrors the same rewrites locally so
  the handler sees an identical request shape in dev and production.
- `src/lib/apiClient.js` / `src/lib/demoAdapter.js`: `publicGetHours`,
  `adminGetHours`, `adminSaveHours`, `adminCreateClosure`,
  `adminUpdateClosure`, `adminDeleteClosure`, `adminReopenClosure`, each
  with a browser-localStorage demo fallback matching the existing
  pattern.
- Smoke coverage added: auth-gated on every admin route, validation
  rejects (bad reason, incomplete week), the public endpoint never
  leaks `note`/`createdAt`/`cancelledAt` and drops a closure the moment
  it is reopened (cancelled), full create/edit/reopen/delete cycle, and
  the production-no-database 503 path for both the public and admin
  routes (`scripts/prod-guard-check.mjs`).
- Manually verified end to end against a live local `dev-api.mjs`
  server: login, save weekly hours, public read reflects it
  immediately, create/edit/reopen/delete a closure.
- Function count: 12 before this feature, 13 after (one new file,
  `api/hours.js`, serving five logical routes). See
  `docs/DECISIONS.md` decision 3.
- `npm run build` clean, `npm run smoke`: 105/105, `npm run preflight`:
  PASS (4/4).

