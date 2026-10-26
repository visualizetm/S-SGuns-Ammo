// Pure-logic tests for shared/hours.js: no browser, no server, no network.
// Covers shop-timezone status computation (open, closed, before/after
// hours), closures (active, upcoming, open-ended, cancelled), "back at"
// across a weekend, DST fall back (Nov 1, 2026) and spring forward
// (Mar 14, 2027), holiday date computation for 2026 and 2027, and
// validation rejects. Run directly: node scripts/hours-check.mjs
// Invoked by: npm run smoke (scripts/smoke-test.mjs spawns this).
//
// Prints one JSON line at the end: {"failed": N, "results": {...}}.

import assert from 'node:assert/strict';
import {
  shopClockParts,
  shopDateString,
  formatTime,
  formatRange,
  emptyWeekly,
  getShopStatus,
  statusSentence,
  nextOpening,
  backAtSentence,
  closureStatus,
  isInNoticeWindow,
  activeClosure,
  pruneClosures,
  HOLIDAYS,
  upcomingHolidays,
  validateHours,
  validateClosure,
} from '../shared/hours.js';

const results = {};
let failed = 0;
function ok(name, fn) {
  try {
    fn();
    results[name] = 'ok';
  } catch (err) {
    results[name] = `FAIL ${err.message}`;
    failed += 1;
  }
}

// A full weekly schedule: closed Mon/Tue, 1-5pm Wed-Fri, 9-3 Sat, 10-2 Sun.
function sampleWeekly() {
  const w = emptyWeekly();
  w[0] = { day: 0, open: true, opens: '10:00', closes: '14:00' }; // Sun
  w[1] = { day: 1, open: false, opens: null, closes: null }; // Mon
  w[2] = { day: 2, open: false, opens: null, closes: null }; // Tue
  w[3] = { day: 3, open: true, opens: '13:00', closes: '17:00' }; // Wed
  w[4] = { day: 4, open: true, opens: '13:00', closes: '17:00' }; // Thu
  w[5] = { day: 5, open: true, opens: '13:00', closes: '17:00' }; // Fri
  w[6] = { day: 6, open: true, opens: '09:00', closes: '15:00' }; // Sat
  return w;
}

// ---------- formatting ----------

ok('formatTime: 24h to 12h display', () => {
  assert.equal(formatTime('09:00'), '9:00 AM');
  assert.equal(formatTime('13:00'), '1:00 PM');
  assert.equal(formatTime('00:00'), '12:00 AM');
  assert.equal(formatTime('12:00'), '12:00 PM');
});

ok('formatRange', () => {
  assert.equal(formatRange('09:00', '15:00'), '9:00 AM to 3:00 PM');
});

// ---------- shop-local clock across DST ----------
// 2026 DST ends (fall back) Sunday Nov 1 at 2:00 AM: EDT (UTC-4) before,
// EST (UTC-5) after. 2027 DST begins (spring forward) Sunday Mar 14 at
// 2:00 AM: EST (UTC-5) before, EDT (UTC-4) after.

ok('DST: fall back Nov 1 2026, before the transition is EDT (UTC-4)', () => {
  const p = shopClockParts(new Date('2026-10-31T13:00:00Z'));
  assert.equal(p.hour, 9);
  assert.equal(p.minute, 0);
});

ok('DST: fall back Nov 1 2026, after the transition is EST (UTC-5)', () => {
  const p = shopClockParts(new Date('2026-11-02T14:00:00Z'));
  assert.equal(p.hour, 9);
  assert.equal(p.minute, 0);
});

ok('DST: spring forward Mar 14 2027, before the transition is EST (UTC-5)', () => {
  const p = shopClockParts(new Date('2027-03-13T14:00:00Z'));
  assert.equal(p.hour, 9);
  assert.equal(p.minute, 0);
});

ok('DST: spring forward Mar 14 2027, after the transition is EDT (UTC-4)', () => {
  const p = shopClockParts(new Date('2027-03-15T13:00:00Z'));
  assert.equal(p.hour, 9);
  assert.equal(p.minute, 0);
});

// ---------- getShopStatus: open / closed / before / after ----------

ok('status: unconfigured when weekly is null', () => {
  const status = getShopStatus(new Date('2026-07-15T13:00:00Z'), null, []);
  assert.equal(status.state, 'unconfigured');
  assert.equal(statusSentence(status), 'Hours not set yet.');
});

ok('status: open during Wednesday afternoon hours', () => {
  // 2026-07-15 is a Wednesday. 3:00 PM EDT = 19:00Z.
  const now = new Date('2026-07-15T19:00:00Z');
  const status = getShopStatus(now, sampleWeekly(), []);
  assert.equal(status.state, 'open');
  assert.equal(status.closesAt, '17:00');
  assert.equal(statusSentence(status, now), 'Open now, closes at 5:00 PM.');
});

ok('status: closed before opening time on an open day', () => {
  // 11:00 AM EDT Wednesday, opens at 1:00 PM.
  const now = new Date('2026-07-15T15:00:00Z');
  const status = getShopStatus(now, sampleWeekly(), []);
  assert.equal(status.state, 'closed-hours');
  assert.equal(status.next.sameDay, true);
  assert.equal(status.next.opens, '13:00');
  assert.equal(statusSentence(status, now), 'Closed right now, opens at 1:00 PM.');
});

ok('status: closed after closing time rolls to the next open day', () => {
  // 6:00 PM EDT Wednesday, closed at 5:00 PM; Thursday is also 1-5pm.
  const now = new Date('2026-07-15T22:00:00Z');
  const status = getShopStatus(now, sampleWeekly(), []);
  assert.equal(status.state, 'closed-hours');
  assert.equal(status.next.dayIndex, 4); // Thursday
  assert.equal(status.next.sameDay, false);
});

ok('status: closed on a fully-closed day (Monday) rolls to Wednesday', () => {
  // Monday, 2026-07-13, noon EDT.
  const now = new Date('2026-07-13T16:00:00Z');
  const status = getShopStatus(now, sampleWeekly(), []);
  assert.equal(status.state, 'closed-hours');
  assert.equal(status.next.dayIndex, 3); // Wednesday
});

// ---------- closures ----------

ok('closure: active covers today between start and end', () => {
  const now = new Date('2026-11-26T18:00:00Z'); // Thanksgiving, 1pm EST
  const closure = { startDate: '2026-11-26', endDate: '2026-11-26', reason: 'holiday' };
  assert.equal(closureStatus(closure, now), 'active');
});

ok('closure: upcoming before its start date', () => {
  const now = new Date('2026-11-20T16:00:00Z');
  const closure = { startDate: '2026-11-26', endDate: '2026-11-26' };
  assert.equal(closureStatus(closure, now), 'upcoming');
});

ok('closure: past after its end date', () => {
  const now = new Date('2026-11-28T16:00:00Z');
  const closure = { startDate: '2026-11-26', endDate: '2026-11-26' };
  assert.equal(closureStatus(closure, now), 'past');
});

ok('closure: cancelled once cancelledAt is set, even if the dates are active', () => {
  const now = new Date('2026-11-26T18:00:00Z');
  const closure = { startDate: '2026-11-26', endDate: '2026-11-26', cancelledAt: '2026-11-26T17:00:00Z' };
  assert.equal(closureStatus(closure, now), 'cancelled');
});

ok('closure: open ended (no endDate) stays active indefinitely until cancelled', () => {
  const now = new Date('2027-01-15T16:00:00Z');
  const closure = { startDate: '2026-11-26', endDate: null, reason: 'personal' };
  assert.equal(closureStatus(closure, now), 'active');
  const status = getShopStatus(now, sampleWeekly(), [closure]);
  assert.equal(status.state, 'closed-open-ended');
  assert.equal(statusSentence(status), 'Closed until further notice.');
});

ok('closure: active with a known end date reports the day it reopens', () => {
  const now = new Date('2026-11-26T18:00:00Z'); // Thanksgiving (Thursday), closed through Thu
  const closure = { startDate: '2026-11-26', endDate: '2026-11-26' };
  const status = getShopStatus(now, sampleWeekly(), [closure]);
  assert.equal(status.state, 'closed-today-closure');
  assert.equal(status.next.dayIndex, 5); // Friday, next open day per sampleWeekly
});

ok('closure: notice window true once today is inside noticeDays of the start', () => {
  const closure = { startDate: '2026-11-26', endDate: '2026-11-26', noticeDays: 7 };
  assert.equal(isInNoticeWindow(closure, new Date('2026-11-18T16:00:00Z')), false); // 8 days out
  assert.equal(isInNoticeWindow(closure, new Date('2026-11-19T16:00:00Z')), true); // 7 days out
  assert.equal(isInNoticeWindow(closure, new Date('2026-11-25T16:00:00Z')), true); // 1 day out
});

ok('closure: activeClosure finds the one active entry among several', () => {
  const now = new Date('2026-11-26T18:00:00Z');
  const closures = [
    { startDate: '2026-12-24', endDate: '2026-12-25' },
    { startDate: '2026-11-26', endDate: '2026-11-26' },
  ];
  assert.equal(activeClosure(closures, now).startDate, '2026-11-26');
});

ok('pruneClosures: keeps all active/upcoming, caps past at keepPast, oldest dropped first', () => {
  const now = new Date('2027-01-15T16:00:00Z');
  const past = Array.from({ length: 25 }, (_, i) => ({
    id: `past-${i}`,
    startDate: `2026-01-${String(i + 1).padStart(2, '0')}`,
    endDate: `2026-01-${String(i + 1).padStart(2, '0')}`,
  }));
  const upcoming = { id: 'up-1', startDate: '2027-06-01', endDate: '2027-06-01' };
  const pruned = pruneClosures([...past, upcoming], now, { keepPast: 20, maxTotal: 100 });
  assert.equal(pruned.filter((c) => c.id === 'up-1').length, 1);
  const keptPast = pruned.filter((c) => c.id.startsWith('past-'));
  assert.equal(keptPast.length, 20);
  // The most recent 20 of 25 (day 6..25) survive; day 1..5 are dropped.
  assert.ok(!keptPast.some((c) => c.id === 'past-0'));
  assert.ok(keptPast.some((c) => c.id === 'past-24'));
});

// ---------- "back at" across a weekend ----------

ok('nextOpening/backAtSentence: Friday night rolls to Monday across a closed weekend', () => {
  const weekly = emptyWeekly();
  weekly[1] = { day: 1, open: true, opens: '09:00', closes: '17:00' }; // Mon
  weekly[2] = { day: 2, open: true, opens: '09:00', closes: '17:00' };
  weekly[3] = { day: 3, open: true, opens: '09:00', closes: '17:00' };
  weekly[4] = { day: 4, open: true, opens: '09:00', closes: '17:00' };
  weekly[5] = { day: 5, open: true, opens: '09:00', closes: '17:00' }; // Fri
  // Sat/Sun stay default (closed).
  const fridayNight = new Date('2026-07-17T23:00:00Z'); // Friday 7pm EDT
  const next = nextOpening(fridayNight, weekly, []);
  assert.equal(next.dayIndex, 1); // Monday
  assert.equal(backAtSentence(fridayNight, weekly, []), 'Back Monday at 9:00 AM.');
});

ok('backAtSentence: open ended closure with no reachable reopening says call the shop', () => {
  const weekly = emptyWeekly(); // every day closed
  const now = new Date('2026-07-17T23:00:00Z');
  assert.equal(backAtSentence(now, weekly, []), 'Call the shop for updates.');
});

// ---------- holidays ----------

ok('holiday: Thanksgiving 2026 is November 26', () => {
  const t = HOLIDAYS.find((h) => h.key === 'thanksgiving');
  assert.equal(t.dateFor(2026), '2026-11-26');
});

ok('holiday: Thanksgiving 2027 is November 25', () => {
  const t = HOLIDAYS.find((h) => h.key === 'thanksgiving');
  assert.equal(t.dateFor(2027), '2027-11-25');
});

ok('holiday: Memorial Day is the last Monday of May (2026 and 2027)', () => {
  const m = HOLIDAYS.find((h) => h.key === 'memorial-day');
  assert.equal(m.dateFor(2026), '2026-05-25');
  assert.equal(m.dateFor(2027), '2027-05-31');
});

ok('holiday: Labor Day is the first Monday of September (2026 and 2027)', () => {
  const l = HOLIDAYS.find((h) => h.key === 'labor-day');
  assert.equal(l.dateFor(2026), '2026-09-07');
  assert.equal(l.dateFor(2027), '2027-09-06');
});

ok('holiday: upcomingHolidays rolls a passed date to next year', () => {
  // After New Year's Day 2026, the next occurrence is 2027-01-01.
  const list = upcomingHolidays(new Date('2026-03-01T16:00:00Z'));
  const ny = list.find((h) => h.key === 'new-years-day');
  assert.equal(ny.date, '2027-01-01');
});

// ---------- validation ----------

ok('validateHours: rejects closes before opens', () => {
  const w = sampleWeekly();
  w[3] = { day: 3, open: true, opens: '17:00', closes: '13:00' };
  const r = validateHours(w);
  assert.equal(r.ok, false);
  assert.ok(r.errors['3']);
});

ok('validateHours: rejects a time outside 6am-10pm or off the 15 minute grid', () => {
  const w = sampleWeekly();
  w[3] = { day: 3, open: true, opens: '05:00', closes: '17:00' };
  assert.equal(validateHours(w).ok, false);
  const w2 = sampleWeekly();
  w2[3] = { day: 3, open: true, opens: '13:05', closes: '17:00' };
  assert.equal(validateHours(w2).ok, false);
});

ok('validateHours: accepts a full valid week', () => {
  const r = validateHours(sampleWeekly());
  assert.equal(r.ok, true);
  assert.equal(r.data.length, 7);
});

ok('validateClosure: rejects missing reason, bad dates, end before start, long strings', () => {
  assert.equal(validateClosure({}).ok, false);
  assert.equal(
    validateClosure({ reason: 'holiday', startDate: 'not-a-date', message: 'x' }).ok,
    false
  );
  assert.equal(
    validateClosure({
      reason: 'holiday',
      startDate: '2026-11-26',
      endDate: '2026-11-20',
      message: 'x',
    }).ok,
    false
  );
  assert.equal(
    validateClosure({
      reason: 'other',
      startDate: '2026-11-26',
      message: 'x'.repeat(81),
    }).ok,
    false
  );
  assert.equal(
    validateClosure({
      reason: 'other',
      startDate: '2026-11-26',
      message: 'ok',
      note: 'x'.repeat(201),
    }).ok,
    false
  );
});

ok('validateClosure: accepts a valid open-ended closure', () => {
  const r = validateClosure({
    reason: 'weather',
    startDate: '2026-11-26',
    message: 'Closed for weather',
  });
  assert.equal(r.ok, true);
  assert.equal(r.data.endDate, null);
  assert.equal(r.data.noticeDays, 7);
});

console.log(JSON.stringify({ failed, results }));
process.exit(failed === 0 ? 0 : 1);
