// Site-wide temporary-closure notice, rendered on every PUBLIC page just
// above the sticky navbar (stacked below AnnouncementBar if that is still
// showing; never replaces it). Two states, one component:
//
//   active:   the shop is closed right now for a scheduled closure. Strong
//             style, click-to-call, no dismiss button (a visitor should
//             never be able to hide this and then show up at a locked
//             door).
//   heads-up: a closure starts soon and is inside its own notice window.
//             Softer style, dismissible for the session (by that specific
//             closure's id, so a later closure's heads-up still shows even
//             if an earlier one was dismissed).
//
// Fails soft: no data yet, the fetch failed, or hours were never
// configured all render nothing. Never blocks the page, no spinner.

import { useEffect, useState } from 'react';
import AlertTriangle from '@untitled-ui/icons-react/build/esm/AlertTriangle';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import { BUSINESS } from '../content/siteFacts.js';
import { publicGetHours } from '../lib/apiClient.js';
import { activeClosure, backAtSentence, formatShopDate, noticeWindowClosures } from '../../shared/hours.js';

const DISMISS_KEY = 'ssga-closure-heads-up-dismissed';

function readDismissedId() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) || '';
  } catch {
    return '';
  }
}

export function ClosureBar() {
  const [data, setData] = useState(null);
  const [dismissedId, setDismissedId] = useState(readDismissedId);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { body } = await publicGetHours();
      if (alive && body?.ok) setData(body);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!data || !data.configured) return null;

  const active = activeClosure(data.closures, new Date());
  const upcoming = active ? null : noticeWindowClosures(data.closures, new Date())[0] || null;
  if (!active && !upcoming) return null;
  if (upcoming && upcoming.id === dismissedId) return null;

  function dismiss(id) {
    setDismissedId(id);
    try {
      sessionStorage.setItem(DISMISS_KEY, id);
    } catch {
      // Storage blocked: the in-memory state still hides it for this page.
    }
  }

  const closure = active || upcoming;
  const dateRange =
    closure.endDate && closure.endDate !== closure.startDate
      ? `${formatShopDate(closure.startDate)} to ${formatShopDate(closure.endDate)}`
      : formatShopDate(closure.startDate);
  const text = active
    ? `${closure.message} ${backAtSentence(new Date(), data.weekly, data.closures)}`
    : `Heads up: ${closure.message}, ${dateRange}.`;

  return (
    <div className="clb" role="region" aria-label="Closure notice" data-active={active ? 'true' : undefined}>
      <p className="clb-text">
        <AlertTriangle aria-hidden="true" width={16} height={16} className="clb-icon" />
        <span>
          {text}
          {active ? (
            <>
              {' '}
              <a className="clb-phone" href={BUSINESS.phoneHref}>
                {BUSINESS.phoneDisplay}
              </a>
            </>
          ) : null}
        </span>
      </p>
      {!active ? (
        <button
          type="button"
          className="clb-close"
          aria-label="Dismiss closure notice"
          onClick={() => dismiss(upcoming.id)}
        >
          <XClose aria-hidden="true" width={20} height={20} />
        </button>
      ) : null}

      <style>{`
        .clb {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.4rem 0.5rem 0.4rem 1rem;
          background: var(--accent-fall);
          color: var(--ivory);
        }
        .clb[data-active] { background: var(--danger); }
        .clb-text {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0;
          font-size: 0.85rem;
          line-height: 1.45;
          font-weight: 500;
        }
        .clb-icon { flex-shrink: 0; }
        .clb-phone {
          color: var(--ivory);
          font-weight: 700;
          text-decoration: underline;
          text-underline-offset: 3px;
          white-space: nowrap;
        }
        .clb-phone:hover { color: var(--tan); }
        .clb .clb-close {
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--ivory);
          cursor: pointer;
          opacity: 0.85;
        }
        .clb .clb-close:hover {
          opacity: 1;
          background: color-mix(in srgb, var(--ivory) 12%, transparent);
          color: var(--ivory) !important;
        }
        .clb :focus-visible { outline-color: var(--ivory); }
        @media (max-width: 767.98px) {
          .clb { padding-left: 0.75rem; }
          .clb-text { font-size: 0.8rem; }
          .clb-phone { display: inline-flex; align-items: center; }
        }
      `}</style>
    </div>
  );
}
