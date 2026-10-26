// Owner's Dashboard Hours page: weekly hours (Part A) and temporary
// closures (Part B). Both write through immediately, like Quick Sale: no
// Publish step, a snow day has to go live in seconds.
//
// Never wrapped in .reveal/.stagger (see docs/DESIGN-SYSTEM.md): this is
// the owner's actual working tool, not decorative content.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Clock from '@untitled-ui/icons-react/build/esm/Clock';
import CheckCircle from '@untitled-ui/icons-react/build/esm/CheckCircle';
import AlertCircle from '@untitled-ui/icons-react/build/esm/AlertCircle';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import Edit01 from '@untitled-ui/icons-react/build/esm/Edit01';
import Trash01 from '@untitled-ui/icons-react/build/esm/Trash01';
import {
  adminGetHours,
  adminSaveHours,
  adminCreateClosure,
  adminUpdateClosure,
  adminDeleteClosure,
  adminReopenClosure,
} from '../../lib/apiClient.js';
import {
  DAY_NAMES,
  emptyWeekly,
  formatRange,
  formatTime,
  formatShopDate,
  getShopStatus,
  statusSentence,
  closureStatus,
  nextUpcomingClosure,
  upcomingHolidays,
  defaultClosureMessage,
  CLOSURE_REASONS,
  CLOSURE_REASON_LABELS,
  NOTICE_DAY_OPTIONS,
  validateHours,
  validateClosure,
  minutesToTimeString,
} from '../../../shared/hours.js';
import { ShopHours } from '../ShopHours.jsx';

// ---------- time select options: 6:00 AM to 10:00 PM, 15 minute steps ----------
const TIME_OPTIONS = (() => {
  const options = [];
  for (let m = 6 * 60; m <= 22 * 60; m += 15) {
    const hhmm = minutesToTimeString(m);
    options.push({ value: hhmm, label: formatTime(hhmm) });
  }
  return options;
})();

function sameWeekly(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Day by day comparison that ignores key order, used to confirm the server
// kept exactly the hours that were just sent.
function weeklyEqual(a, b) {
  const flat = (w) =>
    (w || [])
      .map((r) => `${r.day}|${r.open ? `1|${r.opens}|${r.closes}` : '0||'}`)
      .sort()
      .join(';');
  return flat(a) === flat(b);
}

// What the owner reads when a save does not go through. Plain words only:
// never a status code, a stack trace, or the server's own error text.
const SAVE_MESSAGES = {
  database:
    'The site could not reach its database, so nothing was saved. Try again in a minute. If it keeps happening, text Rob.',
  network: 'No connection. Nothing was saved. Try again.',
  fixDays: 'Some days need fixing. Check the days marked below, then tap Save.',
  other: 'Something went wrong and nothing was saved. Try again.',
};

const LOAD_MESSAGES = {
  database:
    'The site could not reach its database, so your hours could not be loaded. Try again in a minute. If it keeps happening, text Rob.',
  network: 'No connection. Your hours could not be loaded. Check your connection and try again.',
  other: 'Your hours could not be loaded. Try again.',
};

// status 0 is "the request never got an answer" (offline, timed out);
// 500 and up, and 503 DB_NOT_CONFIGURED, all mean the server or database.
function failureKind(res) {
  const status = res?.status;
  if (status === 0 || res?.body?.code === 'NETWORK') return 'network';
  if (status >= 500 || res?.body?.code === 'DB_NOT_CONFIGURED') return 'database';
  return 'other';
}

// The brief's wording for the one validation message the owner can hit
// with the dropdowns (closing earlier than opening).
function rowMessage(text) {
  return text === 'Closing time must be after opening time.'
    ? 'Closing time has to be after opening time.'
    : text;
}

function rowMessages(errors) {
  return Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, rowMessage(v)]));
}

// ---------- Status card ----------

function StatusCard({ settings, onOpenSheet, onReopen, reopening }) {
  const now = new Date();
  const status = settings.configured ? getShopStatus(now, settings.weekly, settings.closures) : { state: 'unconfigured' };
  const sentence = statusSentence(status, now);
  const active = status.state === 'closed-today-closure' || status.state === 'closed-open-ended';
  const next = settings.configured ? nextUpcomingClosure(settings.closures, now) : null;

  return (
    <div className="hp-status" data-active={active || undefined}>
      {!settings.configured ? (
        <div className="hp-amber" role="status">
          <AlertCircle aria-hidden="true" width={20} height={20} />
          <p>
            Your hours are not set yet. Visitors are seeing a placeholder. Set
            them below and tap Save.
          </p>
        </div>
      ) : null}
      <p className="hp-status-sentence">{sentence}</p>
      {active ? (
        <button
          type="button"
          className="btn btn-secondary hp-status-btn"
          onClick={onReopen}
          disabled={reopening}
        >
          {reopening ? 'Reopening...' : 'Reopen Now'}
        </button>
      ) : (
        <button type="button" className="btn btn-primary hp-status-btn" onClick={onOpenSheet}>
          Close the Shop
        </button>
      )}
      {!active && next ? (
        <p className="hp-status-next">
          Next closure: {next.label || CLOSURE_REASON_LABELS[next.reason]}, starts{' '}
          {formatShopDate(next.startDate)}.
        </p>
      ) : null}
    </div>
  );
}

// ---------- Weekly hours editor ----------

function DaySwitch({ open, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={open}
      className="hp-switch"
      data-on={open || undefined}
      onClick={() => onChange(!open)}
    >
      <span className="hp-switch-thumb" />
    </button>
  );
}

function WeeklyEditor({ draft, setDraft, errors }) {
  function setRow(day, patch) {
    setDraft((prev) => prev.map((row) => (row.day === day ? { ...row, ...patch } : row)));
  }

  function toggleOpen(day, open) {
    setRow(day, open ? { open: true, opens: '09:00', closes: '17:00' } : { open: false, opens: null, closes: null });
  }

  function copyMonday() {
    const monday = draft.find((r) => r.day === 1);
    setDraft((prev) =>
      prev.map((row) =>
        row.day >= 1 && row.day <= 5
          ? { ...row, open: monday.open, opens: monday.opens, closes: monday.closes }
          : row
      )
    );
  }

  function copyEveryDay() {
    const monday = draft.find((r) => r.day === 1);
    setDraft((prev) => prev.map((row) => ({ ...row, open: monday.open, opens: monday.opens, closes: monday.closes })));
  }

  return (
    <div className="hp-card">
      <div className="hp-card-head">
        <h2 className="hp-card-title">Weekly hours</h2>
        <div className="hp-copy-actions">
          <button type="button" className="btn btn-secondary hp-copy-btn" onClick={copyMonday}>
            Copy Monday to all weekdays
          </button>
          <button type="button" className="btn btn-secondary hp-copy-btn" onClick={copyEveryDay}>
            Copy to every day
          </button>
        </div>
      </div>
      <ul className="hp-week-list">
        {draft.map((row) => (
          <li key={row.day} className="hp-week-row">
            <span className="hp-week-day">{DAY_NAMES[row.day]}</span>
            <span className="hp-week-controls">
              <DaySwitch open={row.open} onChange={(open) => toggleOpen(row.day, open)} />
              <span className="hp-week-status">{row.open ? 'Open' : 'Closed'}</span>
              {row.open ? (
                <span className="hp-week-times">
                  <label className="hp-time-field">
                    <span className="hp-time-label">Opens</span>
                    <select value={row.opens || ''} onChange={(e) => setRow(row.day, { opens: e.target.value })}>
                      {TIME_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="hp-time-field">
                    <span className="hp-time-label">Closes</span>
                    <select value={row.closes || ''} onChange={(e) => setRow(row.day, { closes: e.target.value })}>
                      {TIME_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                </span>
              ) : null}
            </span>
            {errors[String(row.day)] ? (
              <span role="alert" className="ssga-field-error hp-week-error">{errors[String(row.day)]}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Close the Shop sheet ----------

function ClosureSheet({ token, editing, onClose, onSaved, onError }) {
  const holidays = useMemo(() => upcomingHolidays(), []);
  const isNew = !editing;
  const [reason, setReason] = useState(editing?.reason || '');
  const [label, setLabel] = useState(editing?.label || '');
  const [startDate, setStartDate] = useState(editing?.startDate || new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(editing?.endDate || '');
  const [openEnded, setOpenEnded] = useState(editing ? !editing.endDate : false);
  const [message, setMessage] = useState(editing?.message || '');
  const [messageTouched, setMessageTouched] = useState(Boolean(editing));
  const [note, setNote] = useState(editing?.note || '');
  const [noticeDays, setNoticeDays] = useState(editing?.noticeDays ?? 7);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const sheetRef = useRef(null);
  const firstFieldRef = useRef(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function pickHoliday(h) {
    setReason('holiday');
    setLabel(h.label);
    setStartDate(h.date);
    if (!openEnded) setEndDate(h.date);
    if (!messageTouched) setMessage(defaultClosureMessage('holiday', h.label));
  }

  function changeReason(r) {
    setReason(r);
    if (!messageTouched) {
      setMessage(defaultClosureMessage(r, r === 'holiday' ? label : undefined));
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const isFutureStart = startDate > today;
  const scheduling = isFutureStart;

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrors({});
    const fields = {
      reason,
      label,
      startDate,
      endDate: openEnded ? null : endDate || null,
      message,
      note,
      noticeDays: isFutureStart ? noticeDays : 0,
    };
    const result = isNew
      ? await adminCreateClosure(token, fields)
      : await adminUpdateClosure(token, editing.id, fields);
    setSaving(false);
    if (result.status === 401) {
      onError('Your session expired. Sign in again.');
      return;
    }
    if (result.body?.ok) {
      onSaved(result.body.closure, isNew);
      return;
    }
    if (result.body?.errors) {
      setErrors(result.body.errors);
      return;
    }
    onError(result.body?.error || 'Could not save that closure. Try again.');
  }

  const previewText = message || 'Closed';

  return (
    <div className="hp-sheet-backdrop" data-modal-backdrop onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="hp-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? 'Close the shop' : 'Edit closure'}
        ref={sheetRef}
      >
        <div className="hp-sheet-head">
          <h2>{isNew ? 'Close the Shop' : 'Edit Closure'}</h2>
          <button type="button" className="hp-sheet-close" aria-label="Cancel" onClick={onClose}>
            <XClose aria-hidden="true" width={20} height={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} noValidate className="hp-sheet-form">
          <fieldset className="hp-field-group">
            <legend>Reason</legend>
            <div className="hp-chip-row">
              {CLOSURE_REASONS.map((r, i) => (
                <button
                  key={r}
                  type="button"
                  ref={i === 0 ? firstFieldRef : undefined}
                  className="hp-chip"
                  aria-pressed={reason === r}
                  onClick={() => changeReason(r)}
                >
                  {CLOSURE_REASON_LABELS[r]}
                </button>
              ))}
            </div>
            {errors.reason ? <span role="alert" className="ssga-field-error">{errors.reason}</span> : null}
          </fieldset>

          {reason === 'holiday' ? (
            <fieldset className="hp-field-group">
              <legend>Quick pick</legend>
              <div className="hp-chip-row">
                {holidays.map((h) => (
                  <button
                    key={h.key}
                    type="button"
                    className="hp-chip hp-chip--holiday"
                    aria-pressed={label === h.label && startDate === h.date}
                    onClick={() => pickHoliday(h)}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}

          <div className="hp-form-grid">
            <p className="ssga-field">
              <label htmlFor="hp-start">Starts</label>
              <input
                id="hp-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              {errors.startDate ? <span role="alert" className="ssga-field-error">{errors.startDate}</span> : null}
            </p>
            <p className="ssga-field">
              <label htmlFor="hp-end">Ends</label>
              <input
                id="hp-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={openEnded}
              />
              {errors.endDate ? <span role="alert" className="ssga-field-error">{errors.endDate}</span> : null}
            </p>
          </div>
          <label className="hp-check">
            <input
              type="checkbox"
              checked={openEnded}
              onChange={(e) => setOpenEnded(e.target.checked)}
            />
            I do not know when we reopen
          </label>

          <p className="ssga-field">
            <label htmlFor="hp-message">Message on the website</label>
            <input
              id="hp-message"
              type="text"
              value={message}
              maxLength={80}
              onChange={(e) => {
                setMessage(e.target.value);
                setMessageTouched(true);
              }}
            />
            {errors.message ? <span role="alert" className="ssga-field-error">{errors.message}</span> : null}
          </p>
          <p className="ssga-field">
            <label htmlFor="hp-note">Extra note (optional, staff only)</label>
            <input
              id="hp-note"
              type="text"
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
            />
            {errors.note ? <span role="alert" className="ssga-field-error">{errors.note}</span> : null}
          </p>

          {scheduling ? (
            <p className="ssga-field">
              <label htmlFor="hp-notice">Show a heads up on the site before it starts</label>
              <select id="hp-notice" value={noticeDays} onChange={(e) => setNoticeDays(Number(e.target.value))}>
                <option value={0}>Off</option>
                {NOTICE_DAY_OPTIONS.filter((n) => n > 0).map((n) => (
                  <option key={n} value={n}>{n} day{n > 1 ? 's' : ''}</option>
                ))}
              </select>
            </p>
          ) : null}

          <div className="hp-preview">
            <p className="hp-preview-label">What the site will say</p>
            <p className="hp-preview-text">
              <Clock aria-hidden="true" width={16} height={16} />
              {previewText}
            </p>
          </div>

          <div className="hp-sheet-actions">
            <button type="submit" className="btn btn-primary hp-sheet-submit" disabled={saving}>
              {saving ? 'Saving...' : scheduling ? 'Schedule Closure' : 'Close the Shop'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Closures list ----------

function ClosureRow({ closure, now, onEdit, onDelete, deleting, confirmingDelete, onConfirmDelete, onCancelDelete }) {
  const status = closureStatus(closure, now);
  return (
    <li className="hp-closure-row">
      <span className="hp-closure-main">
        <span className="hp-closure-top">
          <span className="hp-closure-label">{closure.label || CLOSURE_REASON_LABELS[closure.reason]}</span>
          <span className="hp-chip hp-chip--status" data-status={status}>
            {status[0].toUpperCase() + status.slice(1)}
          </span>
        </span>
        <span className="hp-closure-meta">
          {closure.endDate
            ? `${formatShopDate(closure.startDate)} to ${formatShopDate(closure.endDate)}`
            : `${formatShopDate(closure.startDate)}, open ended`}
          {' · '}
          {CLOSURE_REASON_LABELS[closure.reason]}
        </span>
      </span>
      {confirmingDelete ? (
        <span className="hp-closure-confirm">
          <span>Remove this closure?</span>
          <button type="button" className="btn btn-secondary hp-closure-confirm-btn" onClick={onCancelDelete}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary hp-closure-confirm-btn hp-closure-confirm-danger" onClick={onDelete} disabled={deleting}>
            {deleting ? 'Removing...' : 'Remove'}
          </button>
        </span>
      ) : (
        <span className="hp-closure-actions">
          <button type="button" className="hp-icon-btn" aria-label="Edit closure" onClick={onEdit}>
            <Edit01 aria-hidden="true" width={18} height={18} />
          </button>
          <button type="button" className="hp-icon-btn" aria-label="Delete closure" onClick={onConfirmDelete}>
            <Trash01 aria-hidden="true" width={18} height={18} />
          </button>
        </span>
      )}
    </li>
  );
}

function ClosuresList({ closures, onEdit, onDelete }) {
  const now = new Date();
  const [confirmId, setConfirmId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [showPast, setShowPast] = useState(false);

  const live = closures
    .filter((c) => ['active', 'upcoming'].includes(closureStatus(c, now)))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const past = closures
    .filter((c) => ['past', 'cancelled'].includes(closureStatus(c, now)))
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .slice(0, 20);

  async function handleDelete(id) {
    setDeletingId(id);
    await onDelete(id);
    setDeletingId('');
    setConfirmId('');
  }

  return (
    <div className="hp-card">
      <h2 className="hp-card-title">Closures</h2>
      {live.length === 0 && past.length === 0 ? (
        <p className="hp-empty">
          No closures scheduled. If you need to close for a holiday or bad
          weather, tap Close the Shop.
        </p>
      ) : (
        <>
          {live.length > 0 ? (
            <ul className="hp-closure-list">
              {live.map((c) => (
                <ClosureRow
                  key={c.id}
                  closure={c}
                  now={now}
                  onEdit={() => onEdit(c)}
                  confirmingDelete={confirmId === c.id}
                  onConfirmDelete={() => setConfirmId(c.id)}
                  onCancelDelete={() => setConfirmId('')}
                  onDelete={() => handleDelete(c.id)}
                  deleting={deletingId === c.id}
                />
              ))}
            </ul>
          ) : (
            <p className="hp-empty">No upcoming or active closures.</p>
          )}
          {past.length > 0 ? (
            <div className="hp-past">
              <button type="button" className="hp-past-toggle" onClick={() => setShowPast((v) => !v)} aria-expanded={showPast}>
                {showPast ? 'Hide' : 'Show'} past closures ({past.length})
              </button>
              {showPast ? (
                <ul className="hp-closure-list">
                  {past.map((c) => (
                    <ClosureRow
                      key={c.id}
                      closure={c}
                      now={now}
                      onEdit={() => onEdit(c)}
                      confirmingDelete={confirmId === c.id}
                      onConfirmDelete={() => setConfirmId(c.id)}
                      onCancelDelete={() => setConfirmId('')}
                      onDelete={() => handleDelete(c.id)}
                      deleting={deletingId === c.id}
                    />
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

// ---------- Page ----------

export function HoursPage({ token, onAuthFail, notifyChange }) {
  const [settings, setSettings] = useState(null);
  const [draftWeekly, setDraftWeekly] = useState(emptyWeekly());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [hoursErrors, setHoursErrors] = useState({});
  const [savingHours, setSavingHours] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [sheetState, setSheetState] = useState(null); // null | 'new' | closure object
  const [reopening, setReopening] = useState(false);
  const pageRef = useRef(null);
  const dockRef = useRef(null);
  const flashTimerRef = useRef(null);

  const refresh = useCallback(async () => {
    const res = await adminGetHours(token);
    setLoading(false);
    if (res.status === 401) {
      onAuthFail();
      return;
    }
    if (res.body?.ok) {
      setSettings(res.body);
      setDraftWeekly(res.body.weekly || emptyWeekly());
    } else {
      setError(LOAD_MESSAGES[failureKind(res)]);
    }
  }, [token, onAuthFail]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const savedWeekly = settings?.weekly || emptyWeekly();
  const hasUnsavedChanges = !sameWeekly(draftWeekly, savedWeekly);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    function onBeforeUnload(e) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges]);

  // The Save bar and the confirmation share one dock pinned just above the
  // bottom tab bar on phones (see .hp-dock). Its measured height is
  // published as --dockh on the page so the content can pad itself by
  // exactly that much and the last rows always scroll clear of it.
  const dockVisible = hasUnsavedChanges || Boolean(flash);
  useEffect(() => {
    const page = pageRef.current;
    const dock = dockRef.current;
    if (!page) return undefined;
    if (!dock) {
      page.style.setProperty('--dockh', '0px');
      return undefined;
    }
    const apply = () => page.style.setProperty('--dockh', `${dock.getBoundingClientRect().height}px`);
    apply();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(apply);
    observer.observe(dock);
    return () => observer.disconnect();
  }, [dockVisible, loading, settings]);

  function flashFor(message) {
    setFlash(message);
    clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlash(''), 5000);
  }

  async function handleSaveHours() {
    if (savingHours) return;
    setSaveError('');
    setHoursErrors({});

    // Check the days here first so a mistake is caught before any request.
    const local = validateHours(draftWeekly);
    if (!local.ok) {
      setHoursErrors(rowMessages(local.errors));
      setSaveError(SAVE_MESSAGES.fixDays);
      return;
    }

    setSavingHours(true);
    const res = await adminSaveHours(token, draftWeekly);
    if (res.status === 401) {
      setSavingHours(false);
      onAuthFail();
      return;
    }
    if (!res.body?.ok) {
      setSavingHours(false);
      if (res.status === 400 && res.body?.errors) {
        setHoursErrors(rowMessages(res.body.errors));
        setSaveError(SAVE_MESSAGES.fixDays);
      } else {
        setSaveError(SAVE_MESSAGES[failureKind(res)]);
      }
      return;
    }

    // The server said yes. Ask it again and only believe it if it hands
    // back exactly the hours that were sent.
    const check = await adminGetHours(token);
    setSavingHours(false);
    if (!check.body?.ok || !weeklyEqual(check.body.weekly, local.data)) {
      setSaveError(SAVE_MESSAGES.database);
      return;
    }
    setSettings(check.body);
    setDraftWeekly(check.body.weekly);
    flashFor('Hours saved. They are live on your site now.');
  }

  function discardChanges() {
    setDraftWeekly(savedWeekly);
    setHoursErrors({});
    setSaveError('');
  }

  async function handleReopen() {
    const now = new Date();
    const active = (settings.closures || []).find((c) => closureStatus(c, now) === 'active');
    if (!active) return;
    setReopening(true);
    const res = await adminReopenClosure(token, active.id);
    setReopening(false);
    if (res.status === 401) {
      onAuthFail();
      return;
    }
    if (res.body?.ok) {
      await refresh();
      notifyChange?.();
      flashFor('Reopened. The site no longer shows a closure.');
    } else {
      setError(res.body?.error || 'Could not reopen.');
    }
  }

  async function handleClosureSaved(_closure, isNew) {
    setSheetState(null);
    await refresh();
    notifyChange?.();
    flashFor(isNew ? 'Done. Your site now says you are closed.' : 'Closure updated.');
  }

  async function handleDeleteClosure(id) {
    const res = await adminDeleteClosure(token, id);
    if (res.status === 401) {
      onAuthFail();
      return;
    }
    if (res.body?.ok) {
      await refresh();
      notifyChange?.();
    } else {
      setError(res.body?.error || 'Could not delete that closure.');
    }
  }

  if (loading) {
    return <p role="status" className="hp-loading">Loading hours...</p>;
  }
  if (!settings) {
    return <p role="alert" className="ssga-form-failure">{error || 'Could not load hours.'}</p>;
  }

  return (
    <div className="hp-page" ref={pageRef}>
      {error ? <p role="alert" className="ssga-form-failure">{error}</p> : null}

      {/* A true modal is open: the rest of the page is inert (hidden from
          assistive tech, unfocusable, unclickable) rather than merely
          covered in place. */}
      <div className="hp-body" inert={sheetState ? '' : undefined}>
        <StatusCard settings={settings} onOpenSheet={() => setSheetState('new')} onReopen={handleReopen} reopening={reopening} />

        <WeeklyEditor draft={draftWeekly} setDraft={setDraftWeekly} errors={hoursErrors} />

        <ClosuresList closures={settings.closures || []} onEdit={(c) => setSheetState(c)} onDelete={handleDeleteClosure} />

        <div className="hp-card">
          <h2 className="hp-card-title">How it looks on your site</h2>
          <ShopHours
            variant="full"
            overrideData={{
              ok: true,
              configured: true,
              timezone: settings.timezone,
              weekly: draftWeekly,
              closures: settings.closures || [],
            }}
          />
        </div>

        {dockVisible ? (
          <div className="hp-dock" ref={dockRef}>
            {flash ? (
              <p className="hp-flash" role="status">
                <CheckCircle aria-hidden="true" width={18} height={18} />
                {flash}
              </p>
            ) : null}
            {hasUnsavedChanges ? (
              <div className="hp-save-bar" role="region" aria-label="Unsaved changes">
                <p className="hp-save-bar-title">You have unsaved changes</p>
                {saveError ? (
                  <p role="alert" className="hp-save-bar-error">
                    <AlertCircle aria-hidden="true" width={18} height={18} />
                    <span>{saveError}</span>
                  </p>
                ) : null}
                <div className="hp-save-bar-actions">
                  <button type="button" className="btn btn-secondary hp-save-btn" onClick={discardChanges} disabled={savingHours}>
                    Discard
                  </button>
                  <button type="button" className="btn btn-primary hp-save-btn hp-save-btn-main" onClick={handleSaveHours} disabled={savingHours} aria-busy={savingHours || undefined}>
                    {savingHours ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {sheetState ? (
        <ClosureSheet
          token={token}
          editing={sheetState === 'new' ? null : sheetState}
          onClose={() => setSheetState(null)}
          onSaved={handleClosureSaved}
          onError={setError}
        />
      ) : null}

      <HoursPageStyles />
    </div>
  );
}

function HoursPageStyles() {
  return (
    <style>{`
      .hp-page { display: flex; flex-direction: column; gap: 1.25rem; max-width: 42rem; padding-bottom: 2rem; }
      /* Same layout as .hp-page, so the inert wrapper never costs the cards
         their spacing. */
      .hp-body { display: flex; flex-direction: column; gap: 1.25rem; }
      .hp-loading { color: var(--text-secondary); }
      .hp-flash {
        display: flex; align-items: center; gap: 0.5rem; margin: 0;
        padding: 0.7rem 0.9rem; border-radius: var(--radius);
        background: color-mix(in srgb, var(--brand) 12%, transparent);
        color: var(--brand-dark); font-weight: 600;
      }
      .hp-flash svg { flex-shrink: 0; }

      .hp-card {
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-lg);
        background: var(--bg-card);
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .hp-card-title {
        margin: 0;
        font-family: var(--font-display);
        font-size: 1.2rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .hp-card-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; }

      .hp-status {
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-lg);
        background: var(--bg-card);
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .hp-status[data-active] { border-left: 4px solid var(--danger); }
      .hp-status-sentence { margin: 0; font-size: 1.3rem; font-family: var(--font-display); }
      .hp-status-btn { align-self: flex-start; min-height: 48px; }
      .hp-status-next { margin: 0; font-size: 0.9rem; color: var(--text-muted); }
      .hp-amber {
        display: flex; align-items: flex-start; gap: 0.6rem;
        padding: 0.75rem; border-radius: var(--radius);
        background: color-mix(in srgb, var(--accent-fall) 14%, transparent);
        color: var(--accent-fall);
        font-weight: 600;
      }
      .hp-amber svg { flex-shrink: 0; margin-top: 0.1rem; }
      .hp-amber p { margin: 0; }

      .hp-copy-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
      .hp-copy-btn { min-height: 44px; font-size: 0.85rem; padding: 0 0.9rem; }

      .hp-week-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
      .hp-week-row {
        display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem;
        padding: 0.6rem 0; border-bottom: 1px solid var(--border);
      }
      .hp-week-row:last-child { border-bottom: none; }
      .hp-week-day { flex: 0 0 6rem; font-weight: 600; }
      .hp-week-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; flex: 1 1 auto; }
      .hp-week-status { font-size: 0.85rem; color: var(--text-muted); min-width: 3.5rem; }
      .hp-week-times { display: flex; flex-wrap: wrap; gap: 0.6rem; }
      .hp-time-field { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.8rem; }
      .hp-time-label { color: var(--text-muted); font-weight: 600; }
      .hp-time-field select { min-height: 44px; font-size: 1rem; }
      .hp-week-error { flex-basis: 100%; }

      /* "button.hp-switch" under .hp-page on purpose: base.css gives every plain
         button a white background and a 1.5px border (button:not(.btn)), and
         a bare .hp-switch loses that fight, which is why the Closed switch
         used to render as a white box. This is specific enough to win, hover
         state included. */
      .hp-page button.hp-switch {
        flex-shrink: 0;
        width: 50px;
        height: 44px;
        padding: 0;
        /* Closed: a filled gray pill (--text-muted, about 5:1 against the
           white card) with a white knob, so it reads as a switch and not
           as an empty checkbox. Open: olive. The words Open and Closed
           beside it carry the state too. */
        border: 1px solid var(--text-muted);
        border-radius: 22px;
        background: var(--text-muted);
        cursor: pointer;
        position: relative;
        transition: background-color var(--duration-fast) var(--ease);
      }
      .hp-page button.hp-switch:hover:not(:disabled) { border-color: var(--text-muted); }
      .hp-page button.hp-switch[data-on],
      .hp-page button.hp-switch[data-on]:hover:not(:disabled) { background: var(--brand); border-color: var(--brand); }
      .hp-switch-thumb {
        position: absolute;
        top: 4px;
        left: 4px;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: #ffffff;
        box-shadow: 0 1px 2px color-mix(in srgb, #10110f 25%, transparent);
        transition: transform var(--duration-fast) var(--ease);
      }
      .hp-switch[data-on] .hp-switch-thumb { transform: translateX(18px); }

      .hp-empty { color: var(--text-secondary); margin: 0; }
      .hp-closure-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
      .hp-closure-row {
        display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem;
        padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius);
      }
      .hp-closure-main { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
      .hp-closure-top { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
      .hp-closure-label { font-weight: 600; }
      .hp-closure-meta { font-size: 0.85rem; color: var(--text-muted); }
      .hp-closure-actions { display: flex; gap: 0.4rem; }
      .hp-icon-btn {
        width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center;
        border: 1px solid var(--border-strong); border-radius: var(--radius);
        background: var(--bg-card); color: var(--text-secondary); cursor: pointer;
      }
      .hp-icon-btn:hover { border-color: var(--brand); color: var(--brand-dark); }
      .hp-closure-confirm { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; flex-wrap: wrap; }
      .hp-closure-confirm-btn { min-height: 40px; padding: 0 0.75rem; font-size: 0.82rem; }
      .hp-closure-confirm-danger { background: var(--danger); border-color: var(--danger); }

      .hp-chip {
        min-height: 44px;
        padding: 0 1rem;
        border: 1.5px solid var(--border-strong);
        border-radius: var(--radius);
        background: var(--bg-card);
        color: var(--text-secondary);
        font-weight: 600;
        cursor: pointer;
      }
      .hp-chip[aria-pressed='true'] { background: var(--brand); border-color: var(--brand); color: #ffffff; }
      .hp-chip--holiday { border-style: dashed; }
      .hp-chip--status {
        min-height: auto;
        padding: 0.15rem 0.55rem;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        cursor: default;
      }
      .hp-chip--status[data-status='active'] { background: var(--danger); border-color: var(--danger); color: #ffffff; }
      .hp-chip--status[data-status='upcoming'] { background: var(--bg-deep); border-color: var(--border-strong); color: var(--text-secondary); }
      .hp-chip--status[data-status='past'],
      .hp-chip--status[data-status='cancelled'] { background: transparent; color: var(--text-muted); opacity: 0.8; }
      .hp-chip-row { display: flex; flex-wrap: wrap; gap: 0.5rem; }

      .hp-past { margin-top: 0.5rem; }
      .hp-past-toggle {
        min-height: 44px; padding: 0 0.5rem; border: none; background: transparent;
        color: var(--brand-dark); font-weight: 600; cursor: pointer;
      }

      .hp-field-group { border: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
      .hp-field-group legend { font-weight: 600; padding: 0; margin-bottom: 0.25rem; }
      .hp-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 1rem; }
      .hp-check { display: flex; align-items: center; gap: 0.5rem; min-height: 44px; }
      .hp-check input { width: 20px; height: 20px; }
      .hp-preview {
        padding: 0.8rem; border-radius: var(--radius); background: var(--bg-deep);
        display: flex; flex-direction: column; gap: 0.3rem;
      }
      .hp-preview-label { margin: 0; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
      .hp-preview-text { margin: 0; display: flex; align-items: center; gap: 0.5rem; font-weight: 600; }
      .hp-preview-text svg { flex-shrink: 0; color: var(--brand); }

      .hp-sheet-backdrop {
        position: fixed; inset: 0; z-index: 150;
        background: color-mix(in srgb, #10110f 55%, transparent);
        display: flex; align-items: center; justify-content: center;
        padding: 1rem;
      }
      .hp-sheet {
        width: 100%; max-width: 32rem; max-height: 90vh; overflow-y: auto;
        background: var(--bg-card); border-radius: var(--radius-lg);
        display: flex; flex-direction: column;
      }
      .hp-sheet-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 1.1rem 1.25rem; border-bottom: 1px solid var(--border);
        position: sticky; top: 0; background: var(--bg-card); z-index: 1;
      }
      .hp-sheet-head h2 { margin: 0; font-family: var(--font-display); font-size: 1.3rem; text-transform: uppercase; }
      .hp-sheet-close {
        width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center;
        border: 1px solid var(--border-strong); border-radius: var(--radius);
        background: var(--bg-card); color: var(--text-secondary); cursor: pointer;
      }
      .hp-sheet-form { padding: 1.25rem; display: flex; flex-direction: column; gap: 1.1rem; }
      .hp-sheet-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
      .hp-sheet-submit { min-height: 48px; flex: 1 1 12rem; }

      /* The dock holds the unsaved changes bar and the "saved" confirmation.
         Desktop: it sticks to the bottom of the content area. Phones: it is
         fixed directly above the bottom tab bar (bottom: var(--tabbar-h)),
         over the page content (z-index 40) but under the tab bar, drawer,
         modals and the closure sheet. */
      .hp-dock {
        position: sticky;
        bottom: var(--tabbar-h, 0px);
        z-index: 40;
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        padding: 0.8rem 1rem;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-lg);
        background: var(--bg-card);
        box-shadow: 0 -4px 16px color-mix(in srgb, #10110f 10%, transparent);
      }
      .hp-save-bar { display: flex; flex-direction: column; gap: 0.6rem; }
      .hp-save-bar-title { margin: 0; font-weight: 700; }
      .hp-save-bar-error {
        display: flex; align-items: flex-start; gap: 0.5rem; margin: 0;
        padding: 0.6rem 0.75rem; border-radius: var(--radius);
        border: 1px solid var(--danger); color: var(--danger);
        background: color-mix(in srgb, var(--danger) 8%, transparent);
        font-weight: 600; line-height: 1.4;
      }
      .hp-save-bar-error svg { flex-shrink: 0; margin-top: 0.1rem; }
      .hp-save-bar-actions { display: flex; gap: 0.6rem; }
      .hp-save-btn { min-height: 48px; }
      .hp-save-btn-main { flex: 1 1 auto; }

      @media (max-width: 1023.98px) {
        .hp-dock {
          position: fixed;
          left: 0;
          right: 0;
          bottom: var(--tabbar-h, 0px);
          padding-left: max(1rem, env(safe-area-inset-left, 0px));
          padding-right: max(1rem, env(safe-area-inset-right, 0px));
          border-width: 1px 0 0;
          border-radius: 0;
        }
        /* Room for the dock on top of the tab bar room .admin-main already
           reserves, so the last day row and the closures list always
           scroll fully clear of it. */
        .hp-page { padding-bottom: calc(var(--dockh, 0px) + 1rem); }
      }

      @media (max-width: 620px) {
        .hp-sheet-backdrop { padding: 0; align-items: stretch; }
        .hp-sheet { max-width: none; max-height: none; height: 100%; border-radius: 0; }
        .hp-form-grid { grid-template-columns: 1fr; gap: 0; }
        .hp-week-day { flex-basis: 100%; }
      }
    `}</style>
  );
}
