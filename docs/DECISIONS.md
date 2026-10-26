# DECISIONS

One entry per call made under the brief's decision rules, in order.

1. **Hours data already exists; the brief's "never supplied" premise is
   wrong for this repo.** `src/content/siteFacts.js`'s `HOURS` /
   `HOURS_SUMMARY` already hold real, owner-confirmed hours (set and
   confirmed across earlier work in this project: Wed-Fri 1-5pm, Sat
   9am-3pm, Sun 10am-2pm, closed Mon/Tue), not the placeholder the brief
   describes (`BLANK TEXT GOES HERE` does not exist anywhere in the
   repo). Decision: the new dashboard-editable `settings` collection
   starts genuinely unset in production (true to its actual state: this
   is brand-new infrastructure, nothing has been saved through it yet),
   so the amber "hours not set yet" notice and empty 7-day-Closed start
   state are built exactly as specified and are accurate for a fresh
   deploy. But "launch behavior does not change" (an explicit brief
   requirement) is honored literally: `ShopHours`'s fallback when the
   new store is unconfigured renders `siteFacts.js`'s real
   `HOURS`/`HOURS_SUMMARY` (today's actual displayed content), not a
   generic placeholder string, so visitors never see a regression and no
   real data is invented or lost. `src/content/siteFacts.js` itself is
   left untouched. Once the owner saves once through the new Hours page
   (which takes under a minute, since the real hours are already known),
   the new dynamic source takes over everywhere.

2. **Day index convention: 0 = Sunday .. 6 = Saturday.** Not specified
   by the brief. Chosen to match `Date.prototype.getDay()` and
   `Intl.DateTimeFormat`'s weekday output directly, so no translation
   table is needed anywhere `shared/hours.js` touches a real clock.

3. **Serverless function consolidation.** `api/` was already at 12
   files outside `_lib/` (the commonly-cited Vercel Hobby plan limit)
   before this feature: `admin/bundles`, `admin/collections`,
   `admin/health`, `admin/inventory-image`, `admin/login`,
   `admin/products-csv`, `admin/products`, `admin/publish-history`,
   `admin/publish`, `admin/sales`, `inventory/index`, `robots`. All five
   new logical routes (`GET /api/hours`, `GET/PUT /api/admin/hours`,
   `POST/PUT/DELETE /api/admin/closures`, `POST
   /api/admin/closures/reopen`) are served by ONE new file,
   `api/hours.js`, reached everywhere except its own natural path via
   `vercel.json` rewrites that add `?scope=admin` and `&route=closures`
   / `&route=closures-reopen`. This brings the count to 13: one over the
   limit this brief's own resolution (one consolidated file) still lands
   on, since the feature cannot ship with zero new files. Flagged as a
   follow-up in the final report: confirm Rob's actual Vercel plan tier
   before deploy. No further consolidation (e.g. merging into an
   unrelated existing route) was done, since that would hurt clarity for
   a 1-function difference the plan tier may not even enforce.

4. **One open range per day only.** Logged as a follow-up per the brief;
   not built. A lunch-break second range would change the weekly data
   shape and every status computation; out of scope for this job.

5. **Closures stored as an embedded array on the single `settings`
   document**, not a separate collection, matching the brief's literal
   data model. Atomic updates use Mongo array operators (`$push` to add,
   `$pull` to delete, an array filter + positional `$set` to edit or
   reopen) against that one document, so two quick saves cannot clobber
   each other without needing a transaction.

6. **Preflight's `[[...]]` placeholder scan needed no change.** The
   brief anticipated "if preflight counts the hours placeholder as an
   owner TODO, update it." There is no `[[HOURS...]]`-style placeholder
   in `siteFacts.js` (see decision 1): hours are real data, not an
   owner-confirmation placeholder, so this check's existing generic
   `[[...]]` scan already behaves correctly with no change needed.

7. **Amber/warning color: reused `--accent-fall`.** No dedicated
   `--warning` token exists in the design system. `--accent-fall` is
   already used for the "Low Stock" warning badge, the closest existing
   semantic match; reused rather than inventing a new token.

8. **Success color: reused `--brand`/`--brand-dark`.** No dedicated
   `--success` token exists. Quick Sale's existing flash-message pattern
   already uses brand-olive for a successful-action confirmation; the
   same pattern is reused for "Open now" and save-confirmation states.

9. **`hours-check.mjs` as a separate script, not inlined into
   `smoke-test.mjs`.** The brief offered both. Given the breadth of
   cases (status, closures, DST x2, holidays x2 years, validation), a
   separate pure-logic script (no browser, fast) keeps
   `smoke-test.mjs` from growing unwieldy and matches the existing
   `prod-guard-check.mjs` / `inventory-render-check.mjs` pattern of a
   spawned child script reporting one JSON line, already used twice in
   this codebase.

10. **SMS/email notifications, Google Business Profile sync, and
    structured data (JSON-LD) for hours: not built.** All three are
    explicitly named as out-of-scope follow-ups in the brief itself;
    logged here and in `docs/SITE-REPORT.md`'s known gaps, not built.

11. **Early close / late open on a single date (without a full day
    closure): not built.** Explicitly out of scope per the brief;
    logged as a follow-up.
