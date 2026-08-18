// Public Inventory browse page. Renders ONLY the published snapshot from
// GET /api/inventory: collections-first chips, search, condition and
// in-stock filters, product cards, and package deals when valid bundles
// exist. Display catalog for a licensed dealer: customers transact in the
// store; the only next step anywhere is calling or asking.

import { useEffect, useMemo, useState } from 'react';
import Phone01 from '@untitled-ui/icons-react/build/esm/Phone01';
import {
  BUSINESS,
  LOGO_ASSETS,
  PAGE_META,
} from '../content/siteFacts.js';
import { publicGetCatalog } from '../lib/apiClient.js';
import {
  orderProducts,
  filterProducts,
} from '../lib/catalogView.js';
import { ProductCard, ProductCardStyles } from '../components/ProductCard.jsx';
import { usePageMeta } from '../lib/usePageMeta.js';

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const BUNDLES_TAB = '__bundles__';

function BundleCard({ bundle }) {
  return (
    <article className="cat-bundle">
      <span className="cat-bundle-photo">
        {bundle.photo ? (
          <img src={bundle.photo} alt={bundle.name} loading="lazy" />
        ) : (
          <span className="cat-bundle-photo-empty">
            <img src={LOGO_ASSETS.submark} alt="" loading="lazy" />
            <span>Package deal</span>
          </span>
        )}
      </span>
      <div className="cat-bundle-body">
        <p className="cat-bundle-kicker">Package Deal</p>
        <h3 className="cat-bundle-name">{bundle.name}</h3>
        <p className="cat-bundle-members">
          {bundle.members.map((m) => m.name).join(' + ')}
        </p>
        {bundle.description ? (
          <p className="cat-bundle-desc">{bundle.description}</p>
        ) : null}
        <p className="cat-bundle-price">
          {bundle.onSale && bundle.compareAtPrice ? (
            <>
              <s>{USD.format(bundle.compareAtPrice)}</s>{' '}
              <span>{USD.format(bundle.price)}</span>
            </>
          ) : (
            <span>{USD.format(bundle.price)}</span>
          )}
        </p>
        <p className="cat-bundle-note">
          Ask for this package at the counter or call the shop.
        </p>
      </div>
    </article>
  );
}

export function Inventory() {
  usePageMeta(PAGE_META.inventory.title, PAGE_META.inventory.description);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState('');
  const [search, setSearch] = useState('');
  const [condition, setCondition] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { body } = await publicGetCatalog();
      if (!alive) return;
      setLoading(false);
      if (body?.ok) setData(body);
      else setFailed(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const items = data?.items || [];
  const collections = data?.collections || [];
  const bundles = data?.bundles || [];

  const visible = useMemo(
    () =>
      orderProducts(
        filterProducts(items, {
          collectionId: tab === BUNDLES_TAB ? '' : tab,
          q: search,
          condition,
          inStockOnly,
        })
      ),
    [items, tab, search, condition, inStockOnly]
  );

  const activeCollection = collections.find((c) => c.id === tab);
  const showBundles = tab === BUNDLES_TAB;
  const filtersActive = search.trim() || condition || inStockOnly;

  return (
    <>
      <section className="cat-head" aria-labelledby="inventory-heading">
        <div className="wrap reveal">
          <p className="eyebrow">Behind the counter</p>
          <h1 id="inventory-heading" className="display cat-title">
            Inventory
          </h1>
          <p className="cat-lede">
            What the shop carries right now. Call to check availability or
            stop in and handle it at the counter. Nothing is sold online.
          </p>
        </div>
        <style>{`
          .cat-head {
            border-bottom: 1px solid var(--border);
            padding: 3.5rem 0 3rem;
          }
          .cat-title {
            font-size: clamp(2.3rem, 1.5rem + 3.6vw, 4rem);
            margin: 0 0 0.75rem;
          }
          .cat-lede {
            font-size: 1.1rem;
            color: var(--text-secondary);
            max-width: 36rem;
            margin: 0;
          }
        `}</style>
      </section>

      <section className="cat-browse section" aria-label="Browse inventory">
        <div className="wrap">
          {loading ? <p role="status">Loading the inventory...</p> : null}
          {failed ? (
            <p role="alert" className="cat-empty">
              The inventory list could not be loaded. Call the shop at{' '}
              <a href={BUSINESS.phoneHref}>{BUSINESS.phoneDisplay}</a> for
              current stock.
            </p>
          ) : null}

          {!loading && !failed && items.length === 0 && bundles.length === 0 ? (
            <div className="cat-empty-state reveal">
              <p className="cat-empty">
                The online list is being stocked. Call the shop for current
                inventory; we will tell you exactly what is in the case.
              </p>
              <a href={BUSINESS.phoneHref} className="btn btn-primary">
                <Phone01 aria-hidden="true" width={18} height={18} />
                Call the Shop
              </a>
            </div>
          ) : null}

          {!loading && !failed && (items.length > 0 || bundles.length > 0) ? (
            <>
              <nav aria-label="Collections" className="cat-chips">
                <button
                  type="button"
                  className="cat-chip"
                  aria-current={tab === '' ? 'true' : undefined}
                  onClick={() => setTab('')}
                >
                  All
                </button>
                {collections.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="cat-chip"
                    aria-current={tab === c.id ? 'true' : undefined}
                    onClick={() => setTab(c.id)}
                  >
                    {c.name}
                  </button>
                ))}
                {bundles.length > 0 ? (
                  <button
                    type="button"
                    className="cat-chip cat-chip--deals"
                    aria-current={showBundles ? 'true' : undefined}
                    onClick={() => setTab(BUNDLES_TAB)}
                  >
                    Package Deals
                  </button>
                ) : null}
              </nav>

              {activeCollection?.description ? (
                <p className="cat-collection-desc">{activeCollection.description}</p>
              ) : null}

              {!showBundles ? (
                <div className="cat-toolbar">
                  <input
                    type="search"
                    className="cat-search"
                    placeholder="Search name, maker, model, caliber"
                    aria-label="Search inventory"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <label className="cat-filter">
                    <span className="cat-filter-hidden">Condition</span>
                    <select value={condition} onChange={(e) => setCondition(e.target.value)}>
                      <option value="">New and Used</option>
                      <option value="New">New only</option>
                      <option value="Used">Used only</option>
                    </select>
                  </label>
                  <label className="cat-instock">
                    <input
                      type="checkbox"
                      checked={inStockOnly}
                      onChange={(e) => setInStockOnly(e.target.checked)}
                    />{' '}
                    In stock only
                  </label>
                </div>
              ) : null}

              {showBundles ? (
                <div className="cat-bundles stagger">
                  {bundles.map((bundle) => (
                    <BundleCard key={bundle.id} bundle={bundle} />
                  ))}
                </div>
              ) : visible.length === 0 ? (
                <p className="cat-empty">
                  {filtersActive
                    ? 'Nothing matches that search. Clear the filters or call the shop; the online list is only part of the story.'
                    : 'Nothing listed in this collection yet. Call the shop for what is in the case.'}
                </p>
              ) : (
                <div className="cat-grid stagger">
                  {visible.map((item) => (
                    <ProductCard key={item.id} item={item} />
                  ))}
                </div>
              )}

              <p className="cat-footnote">
                Availability changes daily. Call{' '}
                <a href={BUSINESS.phoneHref}>{BUSINESS.phoneDisplay}</a> to
                confirm before making the drive.
              </p>
            </>
          ) : null}
        </div>
        <ProductCardStyles />
        <style>{`
          .cat-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin: 0 0 1rem;
          }
          .cat-chip {
            min-height: 44px;
            padding: 0 1rem;
            background: var(--bg-card);
            border: 1.5px solid var(--border-strong);
            border-radius: var(--radius);
            font-family: var(--font-display);
            font-size: 1rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-secondary);
            cursor: pointer;
            transition: color var(--duration-fast) var(--ease),
              border-color var(--duration-fast) var(--ease),
              background-color var(--duration-fast) var(--ease);
          }
          .cat-chip:hover { border-color: var(--brand); color: var(--brand-dark); }
          .cat-chip[aria-current='true'] {
            background: var(--brand);
            border-color: var(--brand);
            color: var(--ivory);
          }
          .cat-chip--deals {
            border-style: dashed;
          }
          .cat-collection-desc {
            color: var(--text-secondary);
            max-width: 38rem;
            margin: 0 0 1rem;
          }
          .cat-toolbar {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 0.75rem;
            margin: 0 0 1.5rem;
          }
          .cat-search { flex: 1 1 15rem; }
          .cat-filter select { min-width: 10rem; }
          .cat-filter-hidden {
            position: absolute;
            width: 1px;
            height: 1px;
            overflow: hidden;
            clip: rect(0 0 0 0);
            white-space: nowrap;
          }
          .cat-instock {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            min-height: 44px;
            font-weight: 500;
          }
          .cat-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1.25rem;
          }
          .cat-empty { color: var(--text-secondary); max-width: 34rem; }
          .cat-empty-state {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }
          .cat-footnote {
            margin: 2rem 0 0;
            font-size: 0.9rem;
            color: var(--text-muted);
          }
          .cat-bundles {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1.25rem;
          }
          .cat-bundle {
            display: grid;
            grid-template-columns: 11rem 1fr;
            background: var(--bg-card);
            border: 1.5px solid var(--border-brand);
            border-radius: var(--radius-lg);
            overflow: hidden;
          }
          .cat-bundle-photo {
            position: relative;
            background: var(--bg-field);
            border-right: 1px solid var(--border);
            min-height: 11rem;
          }
          .cat-bundle-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
          .cat-bundle-photo-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            width: 100%;
            height: 100%;
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: var(--track-label);
            color: var(--text-muted);
          }
          .cat-bundle-photo-empty img { width: 3rem; height: 3rem; opacity: 0.35; }
          .cat-bundle-body { padding: 1.1rem 1.25rem; }
          .cat-bundle-kicker {
            margin: 0 0 0.3rem;
            font-size: 0.72rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: var(--track-label);
            color: var(--brand);
          }
          .cat-bundle-name { font-size: 1.4rem; margin: 0 0 0.25rem; }
          .cat-bundle-members {
            margin: 0 0 0.35rem;
            font-weight: 600;
            font-size: 0.9rem;
            color: var(--text-secondary);
          }
          .cat-bundle-desc { margin: 0 0 0.5rem; font-size: 0.9rem; color: var(--text-muted); }
          .cat-bundle-price {
            margin: 0 0 0.3rem;
            font-family: var(--font-display);
            font-size: 1.4rem;
            font-weight: 700;
          }
          .cat-bundle-price s { font-size: 0.95rem; font-weight: 500; color: var(--text-muted); }
          .cat-bundle-price span { color: var(--brand-dark); }
          .cat-bundle-note { margin: 0; font-size: 0.85rem; color: var(--text-muted); }
          @media (max-width: 1199.98px) {
            .cat-grid { grid-template-columns: repeat(3, 1fr); }
          }
          @media (max-width: 899.98px) {
            .cat-grid { grid-template-columns: repeat(2, 1fr); }
            .cat-bundles { grid-template-columns: 1fr; }
          }
          @media (max-width: 599.98px) {
            .cat-grid { grid-template-columns: 1fr; }
            .cat-bundle { grid-template-columns: 1fr; }
            .cat-bundle-photo { min-height: 10rem; border-right: none; border-bottom: 1px solid var(--border); }
          }
        `}</style>
      </section>
    </>
  );
}
