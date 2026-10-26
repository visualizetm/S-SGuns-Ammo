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

## Milestone 3: dashboard Hours page and nav

- `src/components/admin/HoursPage.jsx`: weekly editor (7 rows, 44px
  Open/Closed switch, Opens/Closes selects only when open, "copy
  Monday to all weekdays" / "copy to every day" fill helpers, inline
  per-row validation), sticky unsaved-changes Save bar
  (`beforeunload` confirm while dirty), status card (amber "hours not
  set yet" notice, plain-sentence status, Close the Shop / Reopen Now),
  Close the Shop sheet (reason chips, holiday quick-picks from
  `upcomingHolidays()`, start/end dates with an open-ended checkbox,
  80/200-char message/note fields, notice-days select shown only for a
  future start, live preview line, Escape + focus-on-open), closures
  list (upcoming/active always shown, last 20 past collapsed, inline
  "Remove this closure?" confirm, never `window.confirm`), and a "How
  it looks on your site" card rendering the real `ShopHours` component
  against the unsaved draft.
- `src/components/ShopHours.jsx`: the shared public/admin-preview
  component (`compact` / `full` variants), built this milestone so the
  dashboard preview can render it; wired into the public pages next
  milestone.
- Nav: "Hours" added to `ADMIN_SECTIONS` with a `Clock` icon (distinct
  from History's `ClockRewind`); bottom tab bar is 5 columns now.
  Overview page gets a non-blocking status chip (`ov-hours-chip`)
  linking to `?tab=hours`, loaded in its own effect so a slow/failed
  hours fetch never blocks or errors the rest of the page.
- Accessibility/audit fix found and fixed before verifying: the Close
  the Shop sheet renders as a sibling over the rest of the page, not in
  place of it, so the page underneath stayed mounted, focusable, and
  "visible" to the responsive-check audit. Fixed two ways: (1) the
  page content behind the sheet is now wrapped in a div marked `inert`
  while the sheet is open (hidden from assistive tech, unfocusable,
  unclickable — a real accessibility fix, on top of the sheet's
  existing `role="dialog"`/`aria-modal`/focus-trap); (2) the sheet
  backdrop is marked `data-modal-backdrop`, and
  `scripts/responsive-check.mjs`'s overlap check now treats that the
  same way it already treats `data-fixed-nav` (a layer boundary, not a
  defect) so a full-screen sheet stacking above sticky chrome like the
  admin top bar is never flagged.
- `scripts/responsive-check.mjs` extended per the brief: opens
  `/admin?tab=hours` with a seeded weekly schedule and one upcoming
  closure (an active one was tried first but forces an awkward
  Reopen-then-Close-the-Shop sequence to reach the sheet; an upcoming
  closure still populates the list while keeping "Close the Shop" as
  the direct primary action), audits the closures-populated state, then
  clicks "Close the Shop" and audits the open sheet, at all six
  viewports (375/768/1024/1440 plus very-tall/very-short).
- `npm run build` clean, `npm run smoke`: 105/105 (unchanged this
  milestone, UI only), `npm run preflight`: PASS (4/4, hours still
  correctly not flagged as an owner placeholder), `node
  scripts/responsive-check.mjs`: 134/134 checks pass, 0 failures,
  across all six viewports.

