// Itemized publish diff, shared by the Publish/Discard modal and the
// Publish History page: for each kind (Products, Collections, Bundles) the
// names grouped Added / Updated / Removed, matching the shape produced by
// shared/catalogStore.changesDetail. Kinds and groups with nothing in them
// render nothing, so short publishes read short.

const KIND_LABELS = [
  ['products', 'Products'],
  ['collections', 'Collections'],
  ['bundles', 'Bundles'],
];

const GROUP_LABELS = [
  ['added', 'Added'],
  ['updated', 'Updated'],
  ['removed', 'Removed'],
];

export function detailTotal(detail) {
  let total = 0;
  for (const [kind] of KIND_LABELS) {
    for (const [group] of GROUP_LABELS) {
      total += detail?.[kind]?.[group]?.length || 0;
    }
  }
  return total;
}

export function ChangesList({ detail }) {
  if (!detail || detailTotal(detail) === 0) {
    return <p className="chg-empty">No pending changes.</p>;
  }
  return (
    <div className="chg">
      {KIND_LABELS.map(([kind, kindLabel]) => {
        const groups = GROUP_LABELS.filter(
          ([group]) => (detail[kind]?.[group] || []).length > 0
        );
        if (groups.length === 0) return null;
        return (
          <div key={kind} className="chg-kind">
            <h3 className="chg-kind-title">{kindLabel}</h3>
            {groups.map(([group, groupLabel]) => (
              <div key={group} className="chg-group" data-group={group}>
                <p className="chg-group-label">{groupLabel}</p>
                <ul className="chg-names">
                  {detail[kind][group].map((name, index) => (
                    <li key={`${name}-${index}`}>{name}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        );
      })}
      <style>{`
        .chg { display: flex; flex-direction: column; gap: 0.9rem; text-align: left; }
        .chg-empty { margin: 0; color: var(--text-muted); }
        .chg-kind-title {
          margin: 0 0 0.4rem;
          font-family: var(--font-display);
          font-size: 0.95rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-secondary);
        }
        .chg-group { margin: 0 0 0.45rem; }
        .chg-group-label {
          margin: 0 0 0.2rem;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
        }
        .chg-group[data-group='added'] .chg-group-label { color: var(--brand-dark); }
        .chg-group[data-group='removed'] .chg-group-label { color: var(--danger); }
        .chg-names {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }
        .chg-names li {
          font-size: 0.95rem;
          padding: 0.2rem 0.55rem;
          border-left: 3px solid var(--border-strong);
          background: var(--bg-deep);
          border-radius: var(--radius-sm);
        }
        .chg-group[data-group='added'] .chg-names li { border-left-color: var(--brand); }
        .chg-group[data-group='removed'] .chg-names li {
          border-left-color: var(--danger);
          text-decoration: line-through;
          text-decoration-thickness: 1px;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
