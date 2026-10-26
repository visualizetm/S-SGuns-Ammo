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

## Set the real shop hours (seed script job)

12. **The seed script calls the app's own adapter instead of writing its
    own Mongo code.** `getHoursAdapter().saveWeekly()` is already the
    exact write the brief asks for (an atomic `$set` of `weekly`,
    `timezone` and `updatedAt`, with `$setOnInsert: { closures: [] }`
    and upsert), and it is the same call the dashboard's PUT makes, so
    the saved document cannot differ in shape from a dashboard save.
    Closures are never part of the update, so they are preserved by
    construction.

13. **The hours table lives only in `scripts/set-hours.mjs`.** It is
    exported (`HOURS_TABLE`, `buildWeekly()`) and the script's own run is
    guarded by an entrypoint check, so `scripts/smoke-test.mjs` imports
    the table from the script instead of keeping a second copy. The
    nine status checks therefore cannot drift from what gets written.

14. **`src/content/siteFacts.js` still holds the same hours and was left
    alone.** Its `HOURS` / `HOURS_SUMMARY` are older code (decision 1)
    and `ShopHours` shows them only while the database has no saved
    hours. They match the new table exactly (Wed to Fri 1 to 5 PM, Sat
    9 to 3, Sun 10 to 2, closed Mon and Tue), so nothing conflicts. This
    job adds no new hardcoded copy, but removing the old one would
    change what visitors see before the seed has run, and repairing
    feature behavior is outside this job. Logged as a follow-up: once
    the seed has been applied, retire that fallback so the database is
    the only source.

15. **Tuesday 2:00 PM is asserted as "opens tomorrow at 1:00 PM".** The
    brief says it "opens Wednesday at 1:00 PM". The existing
    `statusSentence` says "tomorrow" for the next calendar day and the
    weekday name beyond that; changing it is outside this job. The test
    asserts the structured fact (next opening is Wednesday, 13:00) and
    the existing wording, so both stay true. Sunday 2:00 PM and Monday
    (two and three days out) do read "Wednesday" literally.

16. **`--apply` refuses whenever hours are already saved, even if they
    are identical.** Simplest rule, matches the brief, no equality
    special case. The dry run prints both tables side by side so an
    identical result is obvious.

17. **When no database URI is set the script says so loudly.** It prints
    that it is targeting the local dev file store and that this is not
    the real database, so a missing env var on Rob's machine can never
    be mistaken for a successful production seed.

## Hours page Save bar fix

18. **`viewport-fit=cover` is added by the dashboard page at runtime, not in
    `index.html`.** The brief says to confirm the viewport meta has it. The
    same `index.html` serves the public site, where `cover` would let
    content slide under the notch on a phone held sideways. `Admin.jsx`
    adds it while the dashboard is mounted and restores the original
    value when it unmounts, so the dashboard gets real
    `env(safe-area-inset-*)` values and the public site is unchanged. The
    new check asserts the dashboard meta contains it.

19. **One dock for the Save bar and the confirmation.** `.hp-dock` is a
    single element: sticky at the bottom of the content on desktop, fixed
    directly above the tab bar on phones (`bottom: var(--tabbar-h)`,
    z-index 40: over the page, under the tab bar, drawer, modals and the
    closure sheet). The "Hours saved" confirmation (and the other Hours
    confirmations) moved into it from the top of the page, where the owner
    could not see them. Its measured height is published as `--dockh` on
    the page, which pads the page's bottom on phones; `.admin-main` pads
    for the tab bar from `--tabbar-h`, so the two add up to dock height
    plus tab bar height plus a gap.

20. **On the real dashboard host a failed Hours request is never turned
    into demo data.** `adminGetHours` and `adminSaveHours` used to fall
    back to the browser demo adapter on any thrown error. With the real
    token the demo adapter answers 401, which signed the owner out with no
    message and lost the unsaved changes. On the real dashboard host
    (`isDashboardHost()`) these two calls now return `status 0` (no answer
    or timed out) or `status 502` (the server replied with something that
    is not the API, such as a platform timeout page); on localhost and
    previews the demo fallback is unchanged. A 15 second timeout stops a
    hung request. The other closure actions (create, edit, delete,
    reopen) still use the old pattern; they are outside the brief and are
    listed under found but not fixed.

21. **The validation sentence is mapped on the page, not changed in
    `shared/hours.js`.** The brief wants "Closing time has to be after
    opening time". The shared validator says "must be". Editing the shared
    validator would change an API response, which this job must not touch,
    so `HoursPage.jsx` maps that one message and also checks the week
    before sending, so a bad range never causes a request.

22. **Save is the wide button, not a separate full-width row.** The bar is
    the title, then Discard and Save side by side with Save taking all the
    remaining width (48px tall). Stacking Save on its own row would make
    the bar roughly 40px taller on a 640px screen for no gain in
    tappability.

23. **Tab labels were tightened, not shortened.** At 360px the font drops
    to 0.66rem with no letter spacing and "Quick Sale" fits on one line at
    360, 375, 390 and 430, so it is not renamed "Sale".

24. **Milestones 2 and 3 are one commit.** Both change `HoursPage.jsx`
    (dock layout and save feedback) and cannot be split by file without
    an interactive patch split. Progress notes list them separately.

25. **Small fixes made on the way, each needed to do this job.**
    (a) The Closed switch rule lost to `base.css`'s `button:not(.btn)`
    (white background, 1.5px border), which is why it looked like a white
    box; it is now `.hp-page button.hp-switch`. (b) The `inert` wrapper
    from the earlier job was a plain block, so the cards lost the page's
    gap; it now uses the same flex layout (`.hp-body`). (c)
    `responsive-check.mjs` started vite through `npx` and killed only the
    wrapper, leaving an orphaned server on port 4173 after every run;
    it now spawns vite directly.
