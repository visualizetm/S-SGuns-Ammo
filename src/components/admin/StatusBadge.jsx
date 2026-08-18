// Draft/publish status badge shared by every admin panel. Plain language:
// the owner should never have to learn the word "draft" to use this.

const LABELS = {
  new: 'Not on site yet',
  changed: 'Unpublished changes',
  removing: 'Removes on publish',
  live: 'On the site',
};

export function StatusBadge({ status }) {
  if (!status || status === 'live') return null;
  return (
    <>
      <span className="stb-badge" data-status={status}>
        {LABELS[status] || status}
      </span>
      <style>{`
        .stb-badge {
          display: inline-flex;
          align-items: center;
          font-size: 0.68rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 0.2rem 0.5rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-strong);
          color: var(--text-secondary);
          background: color-mix(in srgb, var(--ink) 5%, transparent);
          white-space: nowrap;
        }
        .stb-badge[data-status='new'] {
          border-color: color-mix(in srgb, var(--accent-winter) 60%, transparent);
          color: var(--accent-winter);
          background: color-mix(in srgb, var(--accent-winter) 10%, transparent);
        }
        .stb-badge[data-status='changed'] {
          border-color: color-mix(in srgb, var(--accent-fall) 60%, transparent);
          color: var(--accent-fall);
          background: color-mix(in srgb, var(--accent-fall) 10%, transparent);
        }
        .stb-badge[data-status='removing'] {
          border-color: color-mix(in srgb, var(--danger) 55%, transparent);
          color: var(--danger);
          background: color-mix(in srgb, var(--danger) 8%, transparent);
        }
      `}</style>
    </>
  );
}
