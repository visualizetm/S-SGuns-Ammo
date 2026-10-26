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
