// Publish History: every Publish records what went live (timestamp, count,
// itemized added/updated/removed names, who published). Newest first, most
// recent highlighted as "Last publish" so the owner can always see what the
// latest publish covered. The store keeps the last 100 publishes.

import { useCallback, useEffect, useState } from 'react';
import ClockRewind from '@untitled-ui/icons-react/build/esm/ClockRewind';
import ChevronDown from '@untitled-ui/icons-react/build/esm/ChevronDown';
import { adminPublishHistory } from '../../lib/apiClient.js';
import { ChangesList } from './ChangesList.jsx';

function formatWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function HistoryEntry({ entry, isLatest }) {
  // The latest publish starts expanded; older ones start collapsed.
  const [open, setOpen] = useState(isLatest);
  const changes = `${entry.total} change${entry.total === 1 ? '' : 's'}`;

  return (
    <li className="ph-entry" data-latest={isLatest || undefined}>
      <button
        type="button"
        className="ph-entry-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ph-entry-main">
          {isLatest ? <span className="ph-latest-tag">Last publish</span> : null}
          <span className="ph-entry-when">{formatWhen(entry.publishedAt)}</span>
          <span className="ph-entry-meta">
            {changes} · Published by {entry.publishedBy || 'Owner'}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          width={20}
          height={20}
          className="ph-chevron"
          data-open={open || undefined}
        />
      </button>
      {open ? (
        <div className="ph-entry-body">
          <ChangesList detail={entry.detail} />
        </div>
      ) : null}
    </li>
  );
}

export function PublishHistoryPage({ token, version, onAuthFail }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    const { status, body } = await adminPublishHistory(token);
    setLoading(false);
    if (status === 401) {
      onAuthFail();
      return;
    }
    if (body?.ok) setItems(body.items || []);
    else setError(body?.error || 'Could not load the publish history.');
  }, [token, onAuthFail]);

  useEffect(() => {
    refresh();
  }, [refresh, version]);

  if (loading) {
    return <p role="status" className="ph-loading">Loading publish history...</p>;
  }

  return (
    <div className="ph-page">
      {error ? (
        <div role="alert" className="ph-error">
          <p>{error}</p>
          <button type="button" className="btn btn-secondary" onClick={refresh}>
            Try again
          </button>
        </div>
      ) : null}

      {!error && items.length === 0 ? (
        <div className="ph-empty">
          <ClockRewind aria-hidden="true" width={28} height={28} />
          <p>
            No publishes recorded yet. When you tap Publish, what went live is
            listed here so you can always check what changed.
          </p>
        </div>
      ) : null}

      <ul className="ph-list">
        {items.map((entry, index) => (
          <HistoryEntry key={entry.id} entry={entry} isLatest={index === 0} />
        ))}
      </ul>

      <style>{`
        .ph-page { max-width: 44rem; }
        .ph-loading { color: var(--text-secondary); }
        .ph-error {
          border: 1px solid color-mix(in srgb, var(--danger) 45%, transparent);
          border-radius: var(--radius);
          background: color-mix(in srgb, var(--danger) 7%, transparent);
          padding: 0.9rem 1rem;
          margin: 0 0 1rem;
        }
        .ph-error p { margin: 0 0 0.6rem; color: var(--danger); font-weight: 600; }
        .ph-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          text-align: center;
          padding: 2.5rem 1.25rem;
          border: 1px dashed var(--border-strong);
          border-radius: var(--radius);
          background: var(--bg-card);
          color: var(--text-muted);
        }
        .ph-empty svg { color: var(--brand); }
        .ph-empty p { margin: 0; max-width: 26rem; }
        .ph-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.7rem; }
        .ph-entry {
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--bg-card);
          overflow: hidden;
        }
        .ph-entry[data-latest] {
          border-color: var(--brand);
          border-left-width: 3px;
        }
        .ph-entry-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          width: 100%;
          min-height: 56px;
          padding: 0.75rem 1rem;
          border: none;
          background: transparent;
          color: var(--text);
          font-family: var(--font-body);
          text-align: left;
          cursor: pointer;
        }
        .ph-entry-head:hover { background: var(--bg-deep); }
        .ph-entry-main { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
        .ph-latest-tag {
          align-self: flex-start;
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 0.15rem 0.5rem;
          border-radius: 999px;
          background: color-mix(in srgb, var(--brand) 14%, transparent);
          color: var(--brand-dark);
          margin-bottom: 0.15rem;
        }
        .ph-entry-when { font-weight: 600; }
        .ph-entry-meta { font-size: 0.85rem; color: var(--text-muted); }
        .ph-chevron {
          flex-shrink: 0;
          color: var(--text-muted);
          transition: transform var(--duration-fast) var(--ease);
        }
        .ph-chevron[data-open] { transform: rotate(180deg); }
        @media (prefers-reduced-motion: reduce) {
          .ph-chevron { transition: none; }
        }
        .ph-entry-body {
          padding: 0.35rem 1rem 1rem;
          border-top: 1px solid var(--border);
        }
      `}</style>
    </div>
  );
}
