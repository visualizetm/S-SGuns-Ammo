// Products is one top-level admin page that gathers the four catalog managers
// under a single secondary tab bar: Products, Collections, Bundles, and the
// Bulk Editor. The top-level shell nav stays at three items (Overview,
// Products, Quick Sale); this secondary nav lives inside the Products page so
// the catalog tools no longer crowd the app-level navigation.
//
// The active sub-section is kept in the URL as ?section= so a staff member can
// deep-link or refresh without losing their place. Every panel keeps its
// existing draft/publish behavior unchanged.

import Package from '@untitled-ui/icons-react/build/esm/Package';
import Grid01 from '@untitled-ui/icons-react/build/esm/Grid01';
import LayersThree01 from '@untitled-ui/icons-react/build/esm/LayersThree01';
import Rows01 from '@untitled-ui/icons-react/build/esm/Rows01';
import { ProductsPanel } from './ProductsPanel.jsx';
import { CollectionsPanel } from './CollectionsPanel.jsx';
import { BundlesPanel } from './BundlesPanel.jsx';
import { BulkEditor } from './BulkEditor.jsx';

export const PRODUCTS_SECTIONS = [
  { id: 'items', label: 'Products', icon: Package, hint: 'Individual listings' },
  { id: 'collections', label: 'Collections', icon: Grid01, hint: 'Category groupings' },
  { id: 'bundles', label: 'Bundles', icon: LayersThree01, hint: 'Package deals' },
  { id: 'bulk', label: 'Bulk Editor', icon: Rows01, hint: 'CSV import / export' },
];

export function ProductsPage({ section, onSelectSection, panelProps }) {
  const active = PRODUCTS_SECTIONS.some((s) => s.id === section) ? section : 'items';

  return (
    <div className="products-page">
      <nav className="products-subnav" aria-label="Catalog sections">
        {PRODUCTS_SECTIONS.map(({ id, label, icon: Icon, hint }) => (
          <button
            key={id}
            type="button"
            className="products-subnav-item"
            aria-current={active === id ? 'true' : undefined}
            onClick={() => onSelectSection(id)}
          >
            <Icon aria-hidden="true" width={20} height={20} />
            <span className="products-subnav-text">
              <span className="products-subnav-label">{label}</span>
              <span className="products-subnav-hint">{hint}</span>
            </span>
          </button>
        ))}
      </nav>

      <div className="products-panel">
        {active === 'items' ? <ProductsPanel {...panelProps} /> : null}
        {active === 'collections' ? <CollectionsPanel {...panelProps} /> : null}
        {active === 'bundles' ? <BundlesPanel {...panelProps} /> : null}
        {active === 'bulk' ? <BulkEditor {...panelProps} /> : null}
      </div>

      <style>{`
        .products-page { display: flex; flex-direction: column; gap: 1.25rem; }
        .products-subnav {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.5rem;
        }
        .products-subnav-item {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          min-height: 44px;
          padding: 0.6rem 0.8rem;
          border: 1px solid var(--border-strong);
          border-radius: var(--radius);
          background: var(--bg-card);
          color: var(--text-secondary);
          font-family: var(--font-body);
          text-align: left;
          cursor: pointer;
          transition: border-color var(--duration-fast) var(--ease),
            background-color var(--duration-fast) var(--ease),
            color var(--duration-fast) var(--ease);
        }
        .products-subnav-item:hover { border-color: var(--brand); color: var(--text); }
        .products-subnav-item svg { flex-shrink: 0; color: var(--text-muted); }
        .products-subnav-text { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
        .products-subnav-label { font-weight: 600; font-size: 0.98rem; }
        .products-subnav-hint { font-size: 0.78rem; color: var(--text-muted); }
        .products-subnav-item[aria-current='true'] {
          border-color: var(--brand);
          background: color-mix(in srgb, var(--brand) 12%, transparent);
          color: var(--brand-dark);
        }
        .products-subnav-item[aria-current='true'] svg { color: var(--brand); }
        .products-subnav-item[aria-current='true'] .products-subnav-hint {
          color: color-mix(in srgb, var(--brand-dark) 75%, var(--text-muted));
        }

        @media (max-width: 720px) {
          .products-subnav { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}
