// Public shop-hours display, used everywhere hours appear (footer, Home's
// visit block, Contact) so there is exactly one source of truth for what a
// visitor is told. Two variants:
//   compact: one line ("Open now, closes at 6:00 PM."), for tight spots.
//   full: the weekly table plus the status line, for Contact.
//
// Reads GET /api/hours itself unless `overrideData` is supplied (used by
// the Owner's Dashboard's "How it looks on your site" preview, which
// renders this SAME component against its own current, possibly-unsaved
// data instead of a network round trip).
//
// Never wrapped in .reveal/.stagger: this is load-bearing content, not a
// decorative scroll animation (see docs/DESIGN-SYSTEM.md). Fails soft to
// the phone number only, with no spinner and a fixed-height line, so a
// slow or failed fetch never blocks the page or shifts layout.

import { useEffect, useState } from 'react';
import Clock from '@untitled-ui/icons-react/build/esm/Clock';
import { publicGetHours } from '../lib/apiClient.js';
import { getShopStatus, statusSentence, formatRange, DAY_NAMES, shopClockParts } from '../../shared/hours.js';
import { BUSINESS, HOURS as FALLBACK_HOURS, HOURS_SUMMARY as FALLBACK_SUMMARY } from '../content/siteFacts.js';

export function ShopHours({ variant = 'compact', overrideData = null, className = '' }) {
  const [data, setData] = useState(overrideData);
  const [failed, setFailed] = useState(false);
  const usingOverride = overrideData !== null;

  useEffect(() => {
    if (usingOverride) {
      setData(overrideData);
      return undefined;
    }
    let alive = true;
    (async () => {
      const { body } = await publicGetHours();
      if (!alive) return;
      if (body?.ok) setData(body);
      else setFailed(true);
    })();
    return () => {
      alive = false;
    };
  }, [usingOverride, overrideData]);

  // Unconfigured (nobody has saved real hours through the dashboard yet):
  // show the real, already-confirmed hours already on the site today
  // (src/content/siteFacts.js), never an invented placeholder, so saving
  // once in the dashboard is additive and launch behavior never regresses
  // (see docs/DECISIONS.md, decision 1).
  if (data && !data.configured) {
    return variant === 'compact' ? (
      <p className={`sh-compact ${className}`}>
        <Clock aria-hidden="true" width={16} height={16} />
        <span>{FALLBACK_SUMMARY}</span>
      </p>
    ) : (
      <div className={`sh-full ${className}`}>
        <dl className="sh-full-list">
          {FALLBACK_HOURS.map((row) => (
            <div key={row.day} className="sh-full-row" data-closed={row.opens ? undefined : 'true'}>
              <dt>{row.day}</dt>
              <dd>{row.label}</dd>
            </div>
          ))}
        </dl>
        <ShopHoursStyles />
      </div>
    );
  }

  // Still loading, or the fetch failed: fail soft, phone number only, no
  // spinner, same fixed-height line as the real content so nothing shifts
  // once data arrives.
  if (!data || failed) {
    return variant === 'compact' ? (
      <p className={`sh-compact ${className}`}>
        <Clock aria-hidden="true" width={16} height={16} />
        <a href={BUSINESS.phoneHref}>{BUSINESS.phoneDisplay}</a>
      </p>
    ) : (
      <p className={`sh-full-fallback ${className}`}>
        Call <a href={BUSINESS.phoneHref}>{BUSINESS.phoneDisplay}</a> for current hours.
      </p>
    );
  }

  const now = new Date();
  const status = getShopStatus(now, data.weekly, data.closures);
  const todayIndex = shopClockParts(now).dayIndex;

  if (variant === 'compact') {
    return (
      <p className={`sh-compact ${className}`}>
        <Clock aria-hidden="true" width={16} height={16} />
        <span>{statusSentence(status, now)}</span>
      </p>
    );
  }

  return (
    <div className={`sh-full ${className}`}>
      <p className="sh-full-status">{statusSentence(status, now)}</p>
      <dl className="sh-full-list">
        {data.weekly.map((row) => (
          <div
            key={row.day}
            className="sh-full-row"
            data-today={row.day === todayIndex ? 'true' : undefined}
            data-closed={row.open ? undefined : 'true'}
          >
            <dt>{DAY_NAMES[row.day]}</dt>
            <dd>{row.open ? formatRange(row.opens, row.closes) : 'Closed'}</dd>
          </div>
        ))}
      </dl>
      <ShopHoursStyles />
    </div>
  );
}

// Rendered once by the `full` variant; the `compact` variant's minimal
// styling is cheap enough to always inline without a separate style tag.
export function ShopHoursStyles() {
  return (
    <style>{`
      .sh-compact {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-height: 1.4em;
      }
      .sh-compact svg { flex-shrink: 0; }
      .sh-full-status {
        font-weight: 600;
        margin: 0 0 0.75rem;
      }
      .sh-full-list {
        margin: 0;
        max-width: 20rem;
        border-top: 1px solid var(--border);
      }
      .sh-full-row {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.35rem 0;
        border-bottom: 1px solid var(--border);
      }
      .sh-full-row dt { font-weight: 600; color: var(--text); }
      .sh-full-row dd { margin: 0; color: var(--text-secondary); }
      .sh-full-row[data-closed] dt,
      .sh-full-row[data-closed] dd { color: var(--text-muted); }
      .sh-full-row[data-today] { background: var(--bg-deep); }
      .sh-full-row[data-today] dt,
      .sh-full-row[data-today] dd { color: var(--brand-dark); }
      .sh-full-fallback { color: var(--text-secondary); margin: 0; }
    `}</style>
  );
}
