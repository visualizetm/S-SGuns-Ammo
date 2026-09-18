// New-site announcement bar: a slim strip across the very top of every
// PUBLIC page (the Owner's Dashboard never renders it; this component lives
// in the public Layout only). Text and the on/off switch live in
// siteFacts.js (ANNOUNCEMENT), so the wording can change without touching
// this file.
//
// Dismissal is per visit: the close button hides the bar and remembers that
// in sessionStorage (wrapped in try/catch so a blocked-storage browser just
// falls back to in-memory state for the page). A fresh visit shows it again.
// The bar sits in normal document flow ABOVE the sticky navbar, so it can
// never overlap the navbar or content at any viewport; the page simply
// starts below it.

import { useState } from 'react';
import Announcement01 from '@untitled-ui/icons-react/build/esm/Announcement01';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import { ANNOUNCEMENT, BUSINESS } from '../content/siteFacts.js';
import { shouldShowAnnouncement } from '../lib/announcementView.js';

const DISMISS_KEY = 'ssga-announcement-dismissed';

function readDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(readDismissed);

  if (!shouldShowAnnouncement(ANNOUNCEMENT, dismissed)) return null;

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Storage blocked: the in-memory state still hides it for this page.
    }
  }

  return (
    <div className="anb" role="region" aria-label="Announcement">
      <p className="anb-text">
        <Announcement01 aria-hidden="true" width={16} height={16} className="anb-icon" />
        <span>
          {ANNOUNCEMENT.text}{' '}
          <a className="anb-phone" href={BUSINESS.phoneHref}>
            {BUSINESS.phoneDisplay}
          </a>
        </span>
      </p>
      <button
        type="button"
        className="anb-close"
        aria-label="Dismiss announcement"
        onClick={dismiss}
      >
        <XClose aria-hidden="true" width={20} height={20} />
      </button>

      <style>{`
        .anb {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          background: var(--brand);
          color: var(--ivory);
          padding: 0.4rem 0.5rem 0.4rem 1rem;
        }
        .anb-text {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0;
          font-size: 0.85rem;
          line-height: 1.45;
          font-weight: 500;
        }
        .anb-icon { flex-shrink: 0; color: var(--tan); }
        .anb-phone {
          color: var(--ivory);
          font-weight: 700;
          text-decoration: underline;
          text-underline-offset: 3px;
          white-space: nowrap;
        }
        .anb-phone:hover { color: var(--tan); }
        /* Scoped under .anb so this beats base.css's generic
           "button:not(.btn)" reset (border, background, color, padding)
           on specificity alone, no !important needed for the resting
           state. */
        .anb .anb-close {
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
        .anb .anb-close:hover {
          opacity: 1;
          background: color-mix(in srgb, var(--ivory) 12%, transparent);
          /* base.css's "button:not(.btn):hover:not(:disabled)" ties this
             selector's specificity, so without !important the icon could
             lose its color on hover depending on stylesheet order. */
          color: var(--ivory) !important;
        }
        .anb :focus-visible { outline-color: var(--ivory); }
        @media (max-width: 767.98px) {
          .anb { padding-left: 0.75rem; }
          .anb-text { font-size: 0.8rem; }
          /* base.css gives every anchor a 44px tap area on mobile; the phone
             link keeps it (the bar grows a little). Text may wrap to two
             lines here by design. */
          .anb-phone { display: inline-flex; align-items: center; }
        }
      `}</style>
    </div>
  );
}
