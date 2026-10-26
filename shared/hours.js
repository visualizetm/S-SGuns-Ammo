// Pure shop-hours logic: shop-timezone clock helpers, weekly schedule
// status, closures, holiday date computation, formatting, and validation.
// No React, no DOM, no fetch: safe to import from both server (api/) and
// client (src/) code so the two sides can never compute a different
// answer. All "now" is in the shop's own timezone (America/New_York),
// never the visitor's, via Intl.DateTimeFormat, which reads the IANA
// timezone database and so stays correct across DST changes with no
// date library and no manual offset math.

export const SHOP_TIMEZONE = 'America/New_York';

// Date.getDay() convention: 0 = Sunday .. 6 = Saturday. Not specified by
// the brief; picked to match Intl's weekday output and JS's own Date
// methods, so no day-index translation is needed anywhere in this file.
export const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];
export const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const WEEKDAY_TO_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// ---------- Shop-local clock ----------

let partsFormatter = null;
function getPartsFormatter() {
  if (!partsFormatter) {
    partsFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: SHOP_TIMEZONE,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  return partsFormatter;
}

// The wall-clock time in the shop's timezone for a given instant, as plain
// numbers. hour is 0-23 (24:00 is normalized to 0:00 of the next instant,
// which never actually happens for a real Date).
export function shopClockParts(now = new Date()) {
  const parts = getPartsFormatter().formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  let hour = Number(get('hour'));
  if (hour === 24) hour = 0;
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekdayAbbr: get('weekday'),
    dayIndex: WEEKDAY_TO_INDEX[get('weekday')],
    hour,
    minute: Number(get('minute')),
  };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// "YYYY-MM-DD" in the shop's local date, for comparing against closure
// startDate/endDate (plain shop-local dates, never UTC timestamps, so a
// closure never shifts by a day because of UTC).
export function shopDateString(now = new Date()) {
  const p = shopClockParts(now);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

export function shopMinutesSinceMidnight(now = new Date()) {
  const p = shopClockParts(now);
  return p.hour * 60 + p.minute;
}

// ---------- Time string helpers ----------

export function parseTimeToMinutes(hhmm) {
  const m = /^([0-2]\d):([0-5]\d)$/.exec(String(hhmm || ''));
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23) return null;
  return hour * 60 + minute;
}

export function minutesToTimeString(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

// "09:00" -> "9:00 AM"
export function formatTime(hhmm) {
  const minutes = parseTimeToMinutes(hhmm);
  if (minutes === null) return '';
  let h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${pad2(m)} ${suffix}`;
}

export function formatRange(opens, closes) {
  return `${formatTime(opens)} to ${formatTime(closes)}`;
}

// "YYYY-MM-DD" -> "Friday, Nov 27" (used in closure rows and notices).
export function formatShopDate(dateStr, { withYear = false } = {}) {
  const d = parseShopDate(dateStr);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: SHOP_TIMEZONE,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  }).format(d);
}

// A "YYYY-MM-DD" shop-local date string has no timezone of its own; build
// a real Date representing noon UTC on that calendar date so formatting it
// back in any timezone (including the shop's) never rolls to the
// adjacent day.
export function parseShopDate(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
}

// Valid "YYYY-MM-DD" and a real calendar date (rejects 2026-02-30).
export function isValidDateString(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
  if (!m) return false;
  const [, y, mo, d] = m.map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d
  );
}

// ---------- Holidays ----------
// Dates are computed, never hardcoded per year, so the quick-pick chips
// stay correct in 2027, 2028, and beyond with no maintenance.

function nthWeekdayOfMonth(year, month, weekday, n) {
  // month: 1-12, weekday: 0 (Sun) - 6 (Sat), n: 1-based occurrence.
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstWeekday = first.getUTCDay();
  const offset = (weekday - firstWeekday + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function lastWeekdayOfMonth(year, month, weekday) {
  const last = new Date(Date.UTC(year, month, 0)); // day 0 of next month = last day of this month
  const lastWeekday = last.getUTCDay();
  const offset = (lastWeekday - weekday + 7) % 7;
  const day = last.getUTCDate() - offset;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export const HOLIDAYS = [
  { key: 'new-years-day', label: "New Year's Day", dateFor: (y) => `${y}-01-01` },
  { key: 'memorial-day', label: 'Memorial Day', dateFor: (y) => lastWeekdayOfMonth(y, 5, 1) },
  { key: 'independence-day', label: 'Independence Day', dateFor: (y) => `${y}-07-04` },
  { key: 'labor-day', label: 'Labor Day', dateFor: (y) => nthWeekdayOfMonth(y, 9, 1, 1) },
  { key: 'thanksgiving', label: 'Thanksgiving', dateFor: (y) => nthWeekdayOfMonth(y, 11, 4, 4) },
  { key: 'christmas-eve', label: 'Christmas Eve', dateFor: (y) => `${y}-12-24` },
  { key: 'christmas-day', label: 'Christmas Day', dateFor: (y) => `${y}-12-25` },
];

// The next occurrence of each holiday (this year's, if it has not passed
// yet today in the shop's timezone; otherwise next year's), for the quick
// pick chips.
export function upcomingHolidays(now = new Date()) {
  const today = shopDateString(now);
  const year = shopClockParts(now).year;
  return HOLIDAYS.map((h) => {
    const thisYear = h.dateFor(year);
    const date = thisYear >= today ? thisYear : h.dateFor(year + 1);
    return { key: h.key, label: h.label, date };
  });
}

// ---------- Weekly schedule ----------

export function emptyWeekly() {
  return Array.from({ length: 7 }, (_, day) => ({
    day,
    open: false,
    opens: null,
    closes: null,
  }));
}

function rowForDay(weekly, dayIndex) {
  return (weekly || []).find((r) => r.day === dayIndex) || null;
}

// ---------- Closures ----------

// 'cancelled' | 'past' | 'active' | 'upcoming'
export function closureStatus(closure, now = new Date()) {
  if (!closure) return 'past';
  if (closure.cancelledAt) return 'cancelled';
  const today = shopDateString(now);
  if (closure.endDate && today > closure.endDate) return 'past';
  if (today >= closure.startDate && (!closure.endDate || today <= closure.endDate)) {
    return 'active';
  }
  if (today < closure.startDate) return 'upcoming';
  return 'past';
}

function closureCoversDate(closure, dateStr) {
  if (closure.cancelledAt) return false;
  if (dateStr < closure.startDate) return false;
  if (closure.endDate && dateStr > closure.endDate) return false;
  return true;
}

// True once "today" has entered the closure's heads-up window (and it is
// not active yet, not past, not cancelled).
export function isInNoticeWindow(closure, now = new Date()) {
  if (closureStatus(closure, now) !== 'upcoming') return false;
  const noticeDays = Number(closure.noticeDays);
  if (!Number.isFinite(noticeDays) || noticeDays <= 0) return false;
  const start = parseShopDate(closure.startDate);
  if (!start) return false;
  const windowStart = new Date(start.getTime() - noticeDays * 86_400_000);
  const today = parseShopDate(shopDateString(now));
  return today >= windowStart;
}

// The single active closure right now, if any (closures never overlap in
// the UI the owner is given, but defensively picks the first).
export function activeClosure(closures, now = new Date()) {
  return (closures || []).find((c) => closureStatus(c, now) === 'active') || null;
}

// Closures the public endpoint should ever mention: active right now, or
// upcoming and already inside their own notice window. Everything else
// (past, cancelled, upcoming outside its window) never reaches a visitor.
export function publicClosures(closures, now = new Date()) {
  return (closures || []).filter((c) => {
    const status = closureStatus(c, now);
    return status === 'active' || isInNoticeWindow(c, now);
  });
}

// Closures upcoming and currently inside their own notice window, earliest
// first.
export function noticeWindowClosures(closures, now = new Date()) {
  return (closures || [])
    .filter((c) => isInNoticeWindow(c, now))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

// Earliest upcoming closure regardless of notice window (used by the
// dashboard status card's "next scheduled closure" line).
export function nextUpcomingClosure(closures, now = new Date()) {
  return (closures || [])
    .filter((c) => closureStatus(c, now) === 'upcoming')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] || null;
}

// Storage policy: active and upcoming closures are always kept in full;
// past/cancelled ones are capped (most recent `keepPast` by start date),
// and the whole list is hard-capped at `maxTotal` as a final safety net.
// Pure so both the dev-file and MongoDB adapters share one rule.
export function pruneClosures(closures, now = new Date(), { keepPast = 20, maxTotal = 100 } = {}) {
  const list = closures || [];
  const live = list.filter((c) => {
    const s = closureStatus(c, now);
    return s === 'active' || s === 'upcoming';
  });
  const past = list
    .filter((c) => {
      const s = closureStatus(c, now);
      return s === 'past' || s === 'cancelled';
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .slice(0, keepPast);
  let combined = [...live, ...past];
  if (combined.length > maxTotal) {
    const overflow = combined.length - maxTotal;
    combined = [...live, ...past.slice(0, Math.max(0, past.length - overflow))];
  }
  return combined;
}

// ---------- Status and next opening ----------

// Scans forward from `now` (today, then up to 2 weeks ahead) for the next
// day the shop is actually open: on the weekly schedule AND not covered by
// a closure. Returns { dateStr, dayIndex, opens, sameDay } or null if none
// found in the window (treated as "call the shop").
export function nextOpening(now, weekly, closures, { skipToday = false } = {}) {
  const startParts = shopClockParts(now);
  const startDate = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day, 12));
  for (let i = skipToday ? 1 : 0; i <= 14; i++) {
    const d = new Date(startDate.getTime() + i * 86_400_000);
    const dateStr = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
    const dayIndex = d.getUTCDay();
    const row = rowForDay(weekly, dayIndex);
    if (!row || !row.open) continue;
    const closed = (closures || []).some((c) => closureCoversDate(c, dateStr));
    if (closed) continue;
    if (i === 0) {
      // Today: only a future opening counts (an already-passed opens time
      // today is not "next").
      const nowMinutes = startParts.hour * 60 + startParts.minute;
      const opensMinutes = parseTimeToMinutes(row.opens);
      if (opensMinutes !== null && opensMinutes <= nowMinutes) continue;
    }
    return { dateStr, dayIndex, opens: row.opens, sameDay: i === 0 };
  }
  return null;
}

// "today" | "tomorrow" | the weekday name, for human sentences.
function dayLabelFor(dateStr, now) {
  const today = shopDateString(now);
  if (dateStr === today) return 'today';
  const tomorrow = shopDateString(new Date(parseShopDate(today).getTime() + 86_400_000));
  if (dateStr === tomorrow) return 'tomorrow';
  return DAY_NAMES[parseShopDate(dateStr).getUTCDay()];
}

// One object describing "is the shop open right now", covering every
// state the dashboard status card and the public ShopHours component both
// need, so they can never disagree.
//
//   { state: 'unconfigured' }
//   { state: 'closed-today-closure', closure }                (active closure)
//   { state: 'closed-open-ended', closure }                    (active, no end date)
//   { state: 'open', closesAt: 'HH:MM' }
//   { state: 'closed-hours', next: {dateStr, dayIndex, opens, sameDay} | null }
export function getShopStatus(now, weekly, closures) {
  if (!weekly) return { state: 'unconfigured' };

  const closure = activeClosure(closures, now);
  if (closure) {
    if (!closure.endDate) return { state: 'closed-open-ended', closure };
    return { state: 'closed-today-closure', closure, next: nextOpening(now, weekly, closures) };
  }

  const today = shopDateString(now);
  const row = rowForDay(weekly, shopClockParts(now).dayIndex);
  const nowMinutes = shopMinutesSinceMidnight(now);
  const closedToday = (closures || []).some((c) => closureCoversDate(c, today));
  if (!closedToday && row?.open) {
    const opensMinutes = parseTimeToMinutes(row.opens);
    const closesMinutes = parseTimeToMinutes(row.closes);
    if (
      opensMinutes !== null &&
      closesMinutes !== null &&
      nowMinutes >= opensMinutes &&
      nowMinutes < closesMinutes
    ) {
      return { state: 'open', closesAt: row.closes };
    }
  }
  return { state: 'closed-hours', next: nextOpening(now, weekly, closures) };
}

// The one-line plain-English sentence for both the dashboard status card
// and the public compact ShopHours variant, so wording is identical
// everywhere "the current state" is shown.
export function statusSentence(status, now = new Date()) {
  switch (status.state) {
    case 'unconfigured':
      return 'Hours not set yet.';
    case 'open':
      return `Open now, closes at ${formatTime(status.closesAt)}.`;
    case 'closed-open-ended':
      return 'Closed until further notice.';
    case 'closed-today-closure':
    case 'closed-hours': {
      if (!status.next) return 'Closed right now. Call the shop for updates.';
      const label = dayLabelFor(status.next.dateStr, now);
      const when = label === 'today' ? `at ${formatTime(status.next.opens)}` : `${label} at ${formatTime(status.next.opens)}`;
      return `Closed right now, opens ${when}.`;
    }
    default:
      return '';
  }
}

// "Back Friday at 9:00 AM." / "Call the shop for updates." for the closure
// notice bar, derived from the same nextOpening the status card uses.
export function backAtSentence(now, weekly, closures) {
  const next = nextOpening(now, weekly, closures);
  if (!next) return 'Call the shop for updates.';
  const label = dayLabelFor(next.dateStr, now);
  const when = label === 'today' || label === 'tomorrow' ? label[0].toUpperCase() + label.slice(1) : label;
  return `Back ${when} at ${formatTime(next.opens)}.`;
}

// ---------- Default closure copy ----------

export const CLOSURE_REASONS = ['holiday', 'weather', 'vacation', 'personal', 'other'];
export const CLOSURE_REASON_LABELS = {
  holiday: 'Holiday',
  weather: 'Weather',
  vacation: 'Vacation',
  personal: 'Personal',
  other: 'Other',
};

export function defaultClosureMessage(reason, holidayLabel) {
  if (reason === 'holiday' && holidayLabel) return `Closed for ${holidayLabel}`;
  if (reason === 'weather') return 'Closed for weather';
  if (reason === 'vacation') return 'Closed for vacation';
  return 'Closed';
}

export const NOTICE_DAY_OPTIONS = [0, 1, 3, 7, 14];

// ---------- Validation (server source of truth; client reuses for inline errors) ----------

const MAX_MESSAGE_LENGTH = 80;
const MAX_NOTE_LENGTH = 200;
const DAY_START_MINUTES = 6 * 60; // 6:00 AM
const DAY_END_MINUTES = 22 * 60; // 10:00 PM

function isQuarterHour(minutes) {
  return minutes % 15 === 0;
}

// weekly: array of 7 rows, one per day 0-6. Returns { ok, data, errors }
// where errors is keyed by day index as a string ("0".."6").
export function validateHours(weekly) {
  const errors = {};
  if (!Array.isArray(weekly) || weekly.length !== 7) {
    return { ok: false, errors: { _: 'Hours must have all seven days.' } };
  }
  const byDay = new Map();
  const data = [];
  for (const row of weekly) {
    const day = Number(row?.day);
    if (!Number.isInteger(day) || day < 0 || day > 6 || byDay.has(day)) {
      return { ok: false, errors: { _: 'Each day must appear exactly once.' } };
    }
    byDay.set(day, true);
    const open = Boolean(row.open);
    if (!open) {
      data.push({ day, open: false, opens: null, closes: null });
      continue;
    }
    const opens = parseTimeToMinutes(row.opens);
    const closes = parseTimeToMinutes(row.closes);
    if (opens === null || opens < DAY_START_MINUTES || opens > DAY_END_MINUTES || !isQuarterHour(opens)) {
      errors[String(day)] = 'Pick an opening time.';
      continue;
    }
    if (closes === null || closes < DAY_START_MINUTES || closes > DAY_END_MINUTES || !isQuarterHour(closes)) {
      errors[String(day)] = 'Pick a closing time.';
      continue;
    }
    if (closes <= opens) {
      errors[String(day)] = 'Closing time must be after opening time.';
      continue;
    }
    data.push({ day, open: true, opens: row.opens, closes: row.closes });
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  data.sort((a, b) => a.day - b.day);
  return { ok: true, data };
}

// input: { reason, label, startDate, endDate, message, note, noticeDays }
// Returns { ok, data, errors } where errors is keyed by field name.
export function validateClosure(input, { now = new Date() } = {}) {
  const errors = {};
  const reason = CLOSURE_REASONS.includes(input?.reason) ? input.reason : null;
  if (!reason) errors.reason = 'Pick a reason.';

  const label = typeof input?.label === 'string' ? input.label.trim().slice(0, 120) : '';

  const startDate = typeof input?.startDate === 'string' ? input.startDate : '';
  if (!isValidDateString(startDate)) errors.startDate = 'Pick a start date.';

  let endDate = null;
  if (input?.endDate) {
    if (!isValidDateString(input.endDate)) {
      errors.endDate = 'Pick a valid end date.';
    } else if (isValidDateString(startDate) && input.endDate < startDate) {
      errors.endDate = 'End date must be on or after the start date.';
    } else {
      endDate = input.endDate;
    }
  }

  const message = typeof input?.message === 'string' ? input.message.trim() : '';
  if (!message) errors.message = 'Add a short message for the website.';
  else if (message.length > MAX_MESSAGE_LENGTH) errors.message = `Keep the message under ${MAX_MESSAGE_LENGTH} characters.`;

  const note = typeof input?.note === 'string' ? input.note.trim() : '';
  if (note.length > MAX_NOTE_LENGTH) errors.note = `Keep the note under ${MAX_NOTE_LENGTH} characters.`;

  let noticeDays = 7;
  if (input?.noticeDays !== undefined && input?.noticeDays !== null && input?.noticeDays !== '') {
    const n = Number(input.noticeDays);
    if (!NOTICE_DAY_OPTIONS.includes(n)) errors.noticeDays = 'Pick a valid heads up window.';
    else noticeDays = n;
  }

  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    data: {
      reason,
      label: label.slice(0, MAX_MESSAGE_LENGTH),
      startDate,
      endDate,
      message: message.slice(0, MAX_MESSAGE_LENGTH),
      note: note.slice(0, MAX_NOTE_LENGTH),
      noticeDays,
    },
  };
}
