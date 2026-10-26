# DESIGN SYSTEM

Reference for the Owner's Dashboard and public site visual language, as
actually implemented. No new tokens, fonts, or colors are introduced by
the Hours feature; this file documents what already exists plus the new
components/states added on top of it.

## Brand tokens (`src/styles/base.css`, public site)

- `--ink: #10110f`, `--ivory: #f2ebdd`, `--brand: #454a3d` (Field
  Olive), `--brand-dark: #373b31`, `--brand-deep: #2a2d25`.
- `--kraft`, `--wood`, `--tan`, `--accent-fall` (muted rust, used for
  "Low Stock" and now the amber/warning tone), `--accent-holiday`,
  `--accent-winter`.
- `--bg`, `--bg-deep`, `--bg-card`, `--bg-field`, `--border`,
  `--border-strong`, `--border-brand`, `--text`, `--text-secondary`,
  `--text-muted`.
- `--danger: #7c2d21` is the only explicit semantic-danger token.
  There is no dedicated `--success` or `--warning` token; the existing
  pattern (see Quick Sale's flash message) uses `--brand`/`--brand-dark`
  for success, and this feature uses `--accent-fall` for warning/amber
  (both already-established uses, not new colors).
- `--font-display: 'Barlow Condensed', ...` (headings), `--font-body:
  'Inter', ...` (body).
- `--radius-sm: 2px`, `--radius: 4px`, `--radius-lg: 6px`.
- `--ease`, `--duration-fast: 0.15s`, `--duration: 0.2s`,
  `--duration-slow: 0.45s`.

## Owner's Dashboard palette (`.admin-app` override in `AdminLayout.jsx`)

A neutral application surface, distinct from the ivory storefront:
`--bg: #eef0f2`, `--bg-deep: #e7eaed`, `--bg-card: #ffffff`, `--border:
#dbe0e5`, `--border-strong: #c4cbd3`, `--text-secondary: #454b52`,
`--text-muted: #6a7178`. Brand accent (olive) is reserved for primary
actions and the active nav state.

## Navigation

- Desktop (>= 1024px): fixed left sidebar, submark + page list + Publish
  control + log out.
- Phone (< 1024px): persistent bottom tab bar (now 5 columns: Overview,
  Products, Quick Sale, Hours, History-shown-as-"History") plus a
  secondary drawer (full Publish/Discard, View live site, Log out).
- Icons: `@untitled-ui/icons-react`. Hours uses `Clock` (the same mark
  already used for hours elsewhere on the public site); History uses
  `ClockRewind`; the two are visually distinct.

## Fixed bottom elements (layout rule)

**Anything fixed or sticky at the bottom of the dashboard screen must be
positioned with `var(--tabbar-h)`, never with a guessed number.**

- `--tabbar-h` is the real height of the phone bottom tab bar (its border,
  tabs and the iPhone home indicator inset). `AdminLayout.jsx` measures
  the rendered bar with a `ResizeObserver` and sets it on `.admin-app`; it
  is `0px` on desktop where the bar is hidden. The CSS value before the
  first measurement is only an estimate.
- A fixed bottom element sits at `bottom: var(--tabbar-h)` so it is directly
  above the bar, never under it. Z-order, low to high: page content, bottom
  dock (40), tab bar (50), drawer (60), publish modal (70), closure sheet
  (150).
- The page content pads its own bottom by the same variable:
  `.admin-main` uses `calc(var(--tabbar-h) + 1rem)`. A page with its own
  fixed element adds that element's measured height on top (the Hours page
  publishes it as `--dockh`).
- Tab bar tabs share one fixed height and never wrap. The dashboard (only)
  asks for `viewport-fit=cover` so `env(safe-area-inset-*)` is real.
- `scripts/hours-savebar-check.mjs` enforces this on every dashboard page:
  no fixed or sticky element may overlap the tab bar, a tap at the center
  of a button must hit that button, and nothing may be left unreachable
  under a dock.
- Plain `<button>` elements get a white background and a 1.5px border from
  `base.css` (`button:not(.btn)`). A component rule that sets its own
  background or border on a bare class (for example the old `.hp-switch`)
  loses to it; scope it (`.hp-page button.hp-switch`).

## Semantic status chips

Text plus color, never color alone (existing rule, followed here):

- Active closure / danger: `--danger` background or border, white or
  `--danger` text depending on context (matches the existing red
  "saves are not being stored" banner).
- Upcoming closure: neutral `--border-strong` / `--text-secondary`
  (olive-neutral, not colored as a warning, since nothing is wrong yet).
- Past closure: muted, `--text-muted`, reduced opacity.
- Open now / success: `--brand` / `--brand-dark` (matches Quick Sale's
  existing flash-message success pattern).
- Hours-not-set-yet / amber notice: `--accent-fall` (matches the
  existing "Low Stock" warning use of the same token).

## Forms and feedback (existing patterns, reused as-is)

- `.ssga-field` / `.ssga-field-error` / `.ssga-form-failure`: label +
  input + inline `role="alert"` error, never a native `alert()`.
- Flash/confirmation pattern (Quick Sale's `.qs-flash`): a dismissing
  inline banner with an icon, `role="status"`.
- Sheets: centered card on desktop, full-screen on phone, focus trap,
  Escape to close, backdrop tap to close, returns focus to the trigger
  (existing admin drawer pattern in `AdminLayout.jsx`, reused for the
  Close the Shop sheet).
- Tap targets 44px minimum (buttons, switches, chips). Inputs 16px
  minimum (prevents iOS zoom-on-focus, existing site-wide rule in
  `base.css`).
- No scroll-reveal animation (`.reveal` / `.stagger`) on anything that
  is the actual content of a page: this is the explicit lesson from the
  inventory-blank-page bug (see `docs/SITE-REPORT.md`'s known gaps and
  the "Fix: inventory page renders nothing" commit). The Hours page,
  `ShopHours`, and `ClosureBar` never use these classes.
- `prefers-reduced-motion` respected everywhere (existing global rule).

## New components (this feature)

### Dashboard: `HoursPage.jsx`

- Status card (top): one sentence plus a primary action button (Close
  the Shop / Reopen Now), amber "hours not set yet" notice when
  unconfigured.
- Weekly hours: 7 rows (day, Open/Closed switch, Opens/Closes selects
  shown only when open), "Copy Monday to all weekdays" / "Copy to every
  day" helper buttons. The Open/Closed switch is a pill: filled gray with
  the knob on the left when Closed (about 5:1 against the card), olive with
  the knob on the right when Open, 64 by 44px, with the word Open or Closed
  beside it.
- Save bar (the dock): appears only with unsaved changes. Title "You have
  unsaved changes", then a plain failure message when a save did not go
  through, then Discard and a wide Save (48px). On phones it is fixed
  directly above the tab bar; on desktop it sticks to the bottom of the
  content. Save shows "Saving..." while disabled, then re-asks the server
  and confirms "Hours saved. They are live on your site now." in the same
  dock for 5 seconds, only if the server returns the same hours.
- Failure messages (never raw server text, codes or stack traces):
  days to fix (checked before sending, shown on each row too), "The site
  could not reach its database, so nothing was saved. Try again in a minute.
  If it keeps happening, text Rob." (503, any 5xx, a platform timeout page,
  or the server not returning what was sent), and "No connection. Nothing
  was saved. Try again." (offline or a 15 second timeout). The unsaved
  changes always stay.
- Close the Shop sheet: reason chips, holiday quick-pick chips (shown
  only for the Holiday reason), start/end date pickers with an
  open-ended checkbox, message (80 char) + note (200 char) fields, a
  heads-up select (shown only for a future start date), a live preview
  line, and a Confirm button whose label changes between "Close the
  Shop" and "Schedule Closure" depending on whether the start date is
  today.
- Closures list: Upcoming/Active first (sorted by start date), then a
  collapsed Past group (last 20). Inline delete confirm, no
  `window.confirm`.
- "How it looks on your site" preview: renders the real public
  `ShopHours` component with the dashboard's own current (even unsaved)
  data, so the owner sees the real output before leaving the page.

### Public: `ShopHours.jsx`

- `compact`: one line ("Open now, closes at 6:00 PM."), used in the
  footer and Home's visit block, replacing the static `HOURS_SUMMARY`
  text in both places.
- `full`: the weekly table plus the status line, used on Contact,
  replacing the static `HOURS` table there.
- Reserves the height of the compact line before data arrives (a fixed
  min-height on the wrapper) so there is no layout shift (CLS) while
  `GET /api/hours` is in flight; fails soft to the phone number only if
  the fetch fails, never a spinner that moves layout.

### Public: `ClosureBar.jsx`

- Sits between the existing new-site `AnnouncementBar` and the navbar
  (stacked, never replacing). Two visual strengths: Active (stronger,
  `--danger`-toned, includes a click-to-call link, no dismiss button)
  and Heads-up (calmer, `--accent-fall`-toned, dismissible for the
  session via `sessionStorage`, matching `AnnouncementBar`'s own
  dismiss-for-session pattern).
