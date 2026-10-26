# STATUS REPORT: Hours and Closures

Read-only report, written before any change for the Save bar fix. Facts
come from commands run in this session (pasted or quoted below), not from
memory. "Not checked" means it was not run here. This sandbox has no
network access to the live site, Vercel or MongoDB Atlas, so nothing
about production was checked. No secret values appear in this file; only
environment variable names.

Report taken 2026-10-26 on branch `claude/ss-guns-ammo-backend-0owd06`.

## 1. Git

```
On branch claude/ss-guns-ammo-backend-0owd06
Your branch is up to date with 'origin/claude/ss-guns-ammo-backend-0owd06'.
nothing to commit, working tree clean

* claude/ss-guns-ammo-backend-0owd06 d902871 [origin/claude/ss-guns-ammo-backend-0owd06] Hours: seed script for the real weekly hours
  main                               811542a [origin/main] Hours: Sunday now opens at 10:00 AM
```

- `git stash list`: empty.
- HEAD `d902871` equals `origin/claude/ss-guns-ammo-backend-0owd06`. Nothing unpushed on this branch.
- `origin/main` and local `main` are both `811542a` (2026-10-19). `main` is
  NOT ahead of its remote, and it does NOT contain the Hours and Closures
  work. HEAD is 6 commits ahead of `origin/main` and 0 behind.
- So: main is pushed, but the pushed main commit (`811542a`) is not local
  HEAD. All Hours and Closures work lives only on the feature branch.
  This environment requires work to go on that branch, so nothing has been
  pushed to `main` and the live site does not have the feature until the
  branch is merged.

```
d902871 2026-10-26 Hours: seed script for the real weekly hours
13fea9a 2026-10-26 Hours: verify, docs, screens (Milestone 5)
43bb776 2026-10-26 Hours: public display (Milestone 4)
c9e9fec 2026-10-26 Hours: dashboard Hours page and nav (Milestone 3)
b479f1a 2026-10-26 Hours: store and API (Milestone 2)
4b60bf1 2026-10-26 Hours: shared logic and tests (Milestone 1)
811542a 2026-10-19 Hours: Sunday now opens at 10:00 AM
aa60e3f 2026-10-05 Fix: inventory page renders nothing (grid and empty state)
a73fc78 2026-09-20 Hours: shop is now open Sunday 9:00 AM to 2:00 PM
3d5eb2d 2026-09-18 Fix: announcement banner dismiss button tap target
92aa2ec 2026-09-18 Config: accept DATABASE_MONGODB_URI for the Mongo connection
810b740 2026-09-18 Production build sanity and env documentation
40371af 2026-09-18 Dashboard on dashboard.ssgunsandammo.com via host routing
03cc5b1 2026-09-18 Verify and fix full product and dashboard flow
ee5e4a1 2026-09-18 Storage: MongoDB adapters replace Postgres
cf2db48 2026-09-14 Owner's Dashboard UI/UX pass: tap targets, controls, feedback states
cc400c4 2026-09-14 Publish modal and publish history page
bdabcc2 2026-09-14 Images: Cloudinary storage, permanent uploads
39968b0 2026-09-14 Fix: production persistence, loud failure when DB unconfigured
aab5011 2026-08-30 Add dismissible new-site announcement banner
```

## 2. What went on, by milestone

| Milestone | Status | Commit |
| --- | --- | --- |
| 1. Shared logic and tests (`shared/hours.js`, `scripts/hours-check.mjs`) | DONE | `4b60bf1` |
| 2. Store and API (`api/_lib/hoursAdapter.js`, `api/hours.js`, rewrites, smoke) | DONE | `b479f1a` |
| 3. Dashboard Hours page and nav (`HoursPage.jsx`, 5 tab bar, Overview chip) | DONE | `c9e9fec` |
| 4. Public display (`ShopHours`, `ClosureBar`, `hours-render-check.mjs`) | DONE | `43bb776` |
| 5. Verify, docs, screenshots, push | DONE (pushed to the feature branch only, not `main`) | `13fea9a` |
| Extra job: seed script for the real hours | DONE | `d902871` |

- `scripts/set-hours.mjs` exists. It has only ever been run against
  throwaway copies of the local dev file store (dry run, apply, refuse
  without `--force`, closures preserved, unreachable database). It has
  never been run against a real database, so the real hours are most
  likely not saved in production yet (not checked; no database access).
- Until hours are saved in the database, the public site shows the older
  hardcoded hours in `src/content/siteFacts.js` (same values), by design.

## 3. What went wrong

No log of a failed earlier attempt exists on disk: no `*.log` files, no
shell history (`/root/.bash_history` does not exist), no conflict markers
(scan of js, jsx, mjs, json, md and css found none), clean working tree.
The only record is the session transcript
(`/root/.claude/projects/-home-user-S-SGuns-Ammo/868212dd-f856-5c0b-a56c-7913c46f9836.jsonl`,
4738 lines when read). It holds 25 tool errors. None are in shipped code.

- First recorded error (transcript line 575): `Exit code 144`, no output.
  Most of the 25 are this. Root cause: certain. `pkill -f "<pattern>"`
  matches the invoking shell's own command line (the pattern text is in
  it), so the shell kills itself. Reproduced again today:
  `pkill -f "vite preview" ...` returned `Exit code 144` and nothing after
  it ran.
- `preview exited: 1` (line 3011): a second `responsive-check` could not
  start because port 4173 was held. Root cause: certain.
  `scripts/responsive-check.mjs:369` calls `preview.kill()`, which kills
  the `npx` wrapper and not the `vite preview` process it spawned, so
  every run leaves an orphan on port 4173. Seen again today (PID 3460, now
  stopped).
- Test tooling mistakes, all found and fixed in the same session: sheet
  overlap false positives (line 3101), a Chromium "Failed to load
  resource" console echo counted as a JS error (line 3521), a Playwright
  `page.click: Timeout 30000ms exceeded` waiting for `.hp-status-btn`
  because the browser had no admin token and showed the login screen (line
  4080). Lines 995 and 2590 are edit anchors that did not match, 2954 is a
  blocked `sleep`, 2979 and 3173 are malformed tool calls, 3163 is
  `grep: Unmatched \{`, 4109 and 4114 are `ls` on paths that no longer
  exist.
- Last recorded error: line 4114,
  `ls: cannot access 'docs/screens': No such file or directory`
  (harmless cleanup check).
- The earlier attempt the owner mentioned ("hit an error"): I cannot
  identify a failure of the Hours job from anything on disk. Confidence
  that nothing in the repository is broken: certain (see section 5). An
  earlier session's notes (not on disk) mention the sandbox working tree
  once reverting to a stale state; that cannot be verified now.

## 4. Uncommitted or unrelated work

- Modified, staged, untracked files: none. `git status` is clean.
- The older Cloudinary image upload work is committed (`bdabcc2`,
  `39968b0` and later), not sitting uncommitted.
- Conflict markers: none. Syntax breakage: none (build, smoke and
  responsive-check all executed the changed files).

## 5. Checks, run fresh now

| Command | Result |
| --- | --- |
| `npm run build` | exit 0 |
| `npm run smoke` | `116 checks passed.` exit 0, 25 s |
| `npm run preflight` | `RESULT: PASS (4 checks)` exit 0 |
| `npm run responsive-check` | `All responsive checks passed.` 134 ok, 0 FAIL, exit 0, 213 s |

Nothing hung. `responsive-check` legitimately takes about 3.5 minutes
(six viewports). It left an orphaned `vite preview` behind (see section
3), stopped by PID afterwards. No failures, so no error text to paste.

## 6. Vercel function count

13 files under `api/` (ignoring underscore folders): `admin/bundles`,
`admin/collections`, `admin/health`, `admin/inventory-image`,
`admin/login`, `admin/products-csv`, `admin/products`,
`admin/publish-history`, `admin/publish`, `admin/sales`, `hours`,
`inventory/index`, `robots`. That is one over 12. It was 12 before this
feature; `api/hours.js` serves all five hours routes through
`vercel.json` rewrites. Whether the real Vercel plan enforces 12 is not
checked.

## 7. Save path audit for the Hours page (behavior BEFORE this fix)

Path: Save button, `HoursPage.jsx` `handleSaveHours` (line 599) ->
`src/lib/apiClient.js` `adminSaveHours` (line 289) -> `callApi` ->
`PUT /api/admin/hours` -> `vercel.json` rewrite -> `api/hours.js`
`handleAdminHours` (line 51) -> `validateHours` -> adapter `saveWeekly` ->
Mongo `updateOne` upsert. The route is wrapped in `guard()`
(`api/_lib/http.js`).

| Case | What the owner saw before this fix |
| --- | --- |
| Success | A green line "Hours saved. They are live on your site now." at the TOP of the page for 4 s. The owner is at the bottom when tapping Save, so it is usually off screen. No refetch to confirm the server kept the hours. |
| 400 validation | Per-row error text inside the day row. Nothing near the buttons. Message says "Closing time must be after opening time." |
| 503 `DB_NOT_CONFIGURED` | Raw server text "Database not configured. Set DATABASE_MONGODB_URI." in red at the TOP of the page. Technical wording for the owner, and off screen. The error is never cleared by a later save. |
| Mongo connection failure (including a paused Atlas cluster) | The driver waits `serverSelectionTimeoutMS: 8000` (8 s), then `guard()` returns 500 "Something went wrong on the server. Try again.", shown in red at the TOP. If Vercel's own time limit hits first, the response is not JSON, `callApi` throws `api-unavailable` and the next row applies. |
| Network failure, offline, or timeout | `fetch` throws, `adminSaveHours` catches it and falls back to the browser demo adapter with the real token. The demo adapter answers 401, `HoursPage` calls `onAuthFail`, and the owner is silently signed out to the login screen with the unsaved changes lost. No message. There is no fetch timeout, so a hung request keeps "Saving..." until the browser gives up. |
| Real 401 (session expired) | Back to the login screen. Visible, but the unsaved changes are lost. |

If the free Atlas cluster is paused, every save and the Hours page load
fail. The owner would wait about 8 seconds, then see a small red
"Something went wrong on the server. Try again." line at the top of the
page, probably off screen. The cause (paused database) is never named.
Not checked live (no network).

Cause of the reported "can't save" bug (layout): `.admin-tabbar` is
`position: fixed; bottom: 0; z-index: 50` and `.hp-save-bar` is
`position: sticky; bottom: 0` in the page flow, so the tab bar paints over
it. `.admin-main` reserves a hardcoded `5.5rem` for the tab bar, which is
not tied to its real height, and the "Quick Sale" tab label wraps to two
lines because nothing prevents wrapping, making that tab taller. The
viewport meta is `width=device-width, initial-scale=1.0` with no
`viewport-fit=cover`. Certain (read from the CSS; reproduction on a real
iPhone not possible here).

## 8. Regressions

Files changed since the last known good commit `811542a` (name-status):
added `api/_lib/hoursAdapter.js`, `api/hours.js`, `shared/hours.js`,
`scripts/hours-check.mjs`, `scripts/hours-render-check.mjs`,
`scripts/set-hours.mjs`, `src/components/ClosureBar.jsx`,
`src/components/ShopHours.jsx`, `src/components/admin/HoursPage.jsx`,
`docs/*` and 12 screenshots; modified `scripts/dev-api.mjs`,
`scripts/prod-guard-check.mjs`, `scripts/responsive-check.mjs`,
`scripts/smoke-test.mjs`, `src/components/Layout.jsx`,
`src/components/admin/AdminLayout.jsx`,
`src/components/admin/OverviewPage.jsx`, `src/lib/apiClient.js`,
`src/lib/demoAdapter.js`, `src/pages/Admin.jsx`, `src/pages/Contact.jsx`,
`src/pages/Home.jsx`, `vercel.json`. No file was deleted.

Nothing unexpected. The modified public files (`Layout.jsx`, `Home.jsx`,
`Contact.jsx`) are the intended `ShopHours` and `ClosureBar` wiring.
`src/content/siteFacts.js` is untouched.

No real database was written to: `DATABASE_MONGODB_URI` and `MONGODB_URI`
are both unset in this sandbox (checked), there is no network, every test
uses the local dev file store or in-process mocks, and `set-hours.mjs`
only ever ran against temporary directories.

## Found but not fixed (carried into the Save bar job)

- Other Hours page actions (create, edit, delete, reopen a closure) use
  the same "fall back to demo on any thrown error" pattern, so a network
  failure there also signs the owner out silently.
- `scripts/responsive-check.mjs:369` leaves an orphaned `vite preview`.
- 13 functions under `api/` versus the commonly cited limit of 12.
