// Overview: the admin landing page. One screen that answers "how is the shop
// doing?" from two sources — the catalog (products/collections/bundles, stock
// mix, listed value) and the Quick Sale log (sales count and revenue over a
// selectable window, a trailing daily chart, and a recently-sold list). A Low
// Stock list links straight into the Products manager.
//
// All figures are read-only and computed client-side from the same admin data
// the other pages use, so nothing here can change catalog or sales state. The
// page refetches when the tab regains focus so the numbers stay current.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Package from '@untitled-ui/icons-react/build/esm/Package';
import CheckVerified01 from '@untitled-ui/icons-react/build/esm/CheckVerified01';
import CurrencyDollarCircle from '@untitled-ui/icons-react/build/esm/CurrencyDollarCircle';
import TrendUp02 from '@untitled-ui/icons-react/build/esm/TrendUp02';
import AlertTriangle from '@untitled-ui/icons-react/build/esm/AlertTriangle';
import { adminListCatalog, adminListSales } from '../../lib/apiClient.js';

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const USD0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const RANGES = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'all', label: 'All' },
];

function rangeStart(id) {
  const now = new Date();
  if (id === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (id === '7d') return new Date(now.getTime() - 7 * 86400000);
  if (id === '30d') return new Date(now.getTime() - 30 * 86400000);
  return new Date(0);
}

function dayKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function saleTotal(sale) {
  return (Number(sale.priceAtSale) || 0) * (Number(sale.quantity) || 0);
}

// A trailing daily-revenue bar chart, drawn as plain inline SVG (no chart lib).
function SalesChart({ sales, days = 14 }) {
  const buckets = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const list = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(today.getTime() - i * 86400000);
      list.push({ key: dayKey(d), date: d, total: 0 });
    }
    const index = new Map(list.map((b) => [b.key, b]));
    for (const sale of sales) {
      const d = new Date(sale.soldAt);
      if (Number.isNaN(d.getTime())) continue;
      const bucket = index.get(dayKey(d));
      if (bucket) bucket.total += saleTotal(sale);
    }
    return list;
  }, [sales, days]);

  const max = Math.max(1, ...buckets.map((b) => b.total));
  const anyValue = buckets.some((b) => b.total > 0);
  const W = 100;
  const H = 40;
  const gap = 1.4;
  const barW = (W - gap * (buckets.length - 1)) / buckets.length;

  return (
    <div className="ov-chart">
      <div className="ov-chart-head">
        <h3 className="ov-chart-title">Daily sales · last {days} days</h3>
      </div>
      {anyValue ? (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="ov-chart-svg"
          role="img"
          aria-label={`Daily sales revenue for the last ${days} days`}
        >
          {buckets.map((b, i) => {
            const h = (b.total / max) * (H - 2);
            const x = i * (barW + gap);
            return (
              <rect
                key={b.key}
                x={x}
                y={H - h}
                width={barW}
                height={h || 0.4}
                rx={0.6}
                className="ov-chart-bar"
              >
                <title>{`${b.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${USD.format(b.total)}`}</title>
              </rect>
            );
          })}
        </svg>
      ) : (
        <p className="ov-chart-empty">No sales in this window yet.</p>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className="ov-card" data-tone={tone || undefined}>
      <span className="ov-card-icon">
        <Icon aria-hidden="true" width={20} height={20} />
      </span>
      <span className="ov-card-label">{label}</span>
      <span className="ov-card-value">{value}</span>
      {sub ? <span className="ov-card-sub">{sub}</span> : null}
    </div>
  );
}

export function OverviewPage({ token, version, onAuthFail }) {
  const [products, setProducts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState('7d');

  const refresh = useCallback(async () => {
    setError('');
    const [prod, cols, bund, sale] = await Promise.all([
      adminListCatalog(token, 'products'),
      adminListCatalog(token, 'collections'),
      adminListCatalog(token, 'bundles'),
      adminListSales(token),
    ]);
    setLoading(false);
    if ([prod, cols, bund, sale].some((r) => r.status === 401)) {
      onAuthFail();
      return;
    }
    if (prod.body?.ok) setProducts(prod.body.items.filter((p) => p.status !== 'removing'));
    else setError(prod.body?.error || 'Could not load catalog.');
    if (cols.body?.ok) setCollections(cols.body.items.filter((c) => c.status !== 'removing'));
    if (bund.body?.ok) setBundles(bund.body.items.filter((b) => b.status !== 'removing'));
    if (sale.body?.ok) setSales(sale.body.items);
  }, [token, onAuthFail]);

  useEffect(() => {
    refresh();
  }, [refresh, version]);

  // Keep the numbers fresh when the owner comes back to the tab.
  useEffect(() => {
    let last = Date.now();
    const onFocus = () => {
      if (document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - last < 1500) return;
      last = now;
      refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refresh]);

  const stock = useMemo(() => {
    const counts = { 'In Stock': 0, 'Low Stock': 0, Sold: 0, Hidden: 0 };
    let listedValue = 0;
    for (const p of products) {
      if (counts[p.stockStatus] !== undefined) counts[p.stockStatus] += 1;
      if (p.stockStatus === 'In Stock' || p.stockStatus === 'Low Stock') {
        listedValue += Number(p.price) || 0;
      }
    }
    return { counts, listedValue };
  }, [products]);

  const lowStock = useMemo(
    () => products.filter((p) => p.stockStatus === 'Low Stock'),
    [products]
  );

  const windowSales = useMemo(() => {
    const start = rangeStart(range).getTime();
    return sales.filter((s) => {
      const t = new Date(s.soldAt).getTime();
      return !Number.isNaN(t) && t >= start;
    });
  }, [sales, range]);

  const windowRevenue = useMemo(
    () => windowSales.reduce((sum, s) => sum + saleTotal(s), 0),
    [windowSales]
  );

  const rangeLabel = RANGES.find((r) => r.id === range)?.label || '';
  const recentSold = sales.slice(0, 6);

  if (loading) {
    return <p role="status" className="ov-loading">Loading overview…</p>;
  }

  return (
    <div className="ov-page">
      {error ? <p role="alert" className="ssga-form-failure">{error}</p> : null}

      <div className="ov-grid">
        <KpiCard
          icon={Package}
          label="Products"
          value={products.length}
          sub={`${collections.length} collection${collections.length === 1 ? '' : 's'} · ${bundles.length} bundle${bundles.length === 1 ? '' : 's'}`}
        />
        <KpiCard
          icon={CheckVerified01}
          label="In stock"
          value={stock.counts['In Stock']}
          sub={`${stock.counts['Low Stock']} low · ${stock.counts.Sold} sold · ${stock.counts.Hidden} hidden`}
        />
        <KpiCard
          icon={CurrencyDollarCircle}
          label="Listed value"
          value={USD0.format(stock.listedValue)}
          sub="In Stock + Low Stock, at listed price"
        />
        <KpiCard
          icon={TrendUp02}
          label={`Sales · ${rangeLabel}`}
          value={windowSales.length}
          sub={`${USD.format(windowRevenue)} logged`}
          tone="brand"
        />
      </div>

      <div className="ov-rangebar" role="group" aria-label="Sales window">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            className="ov-range"
            aria-pressed={range === r.id ? 'true' : 'false'}
            onClick={() => setRange(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <SalesChart sales={sales} days={14} />

      <div className="ov-lists">
        <section className="ov-list-card" aria-label="Low stock">
          <div className="ov-list-head">
            <h3 className="ov-list-title">
              <AlertTriangle aria-hidden="true" width={18} height={18} />
              Low stock
            </h3>
            <Link to="/admin?tab=products" className="ov-list-link">Manage</Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="ov-empty">Nothing is low on stock.</p>
          ) : (
            <ul className="ov-list">
              {lowStock.slice(0, 8).map((p) => (
                <li key={p.id} className="ov-list-row">
                  <Link to="/admin?tab=products" className="ov-list-name">{p.name}</Link>
                  <span className="ov-list-meta">{USD.format(p.price)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ov-list-card" aria-label="Recently sold">
          <div className="ov-list-head">
            <h3 className="ov-list-title">
              <TrendUp02 aria-hidden="true" width={18} height={18} />
              Recently sold
            </h3>
            <Link to="/admin?tab=sales" className="ov-list-link">Quick Sale</Link>
          </div>
          {recentSold.length === 0 ? (
            <p className="ov-empty">No sales logged yet.</p>
          ) : (
            <ul className="ov-list">
              {recentSold.map((s) => (
                <li key={s.id} className="ov-list-row">
                  <span className="ov-list-name">
                    {s.productNameSnapshot}
                    {s.quantity > 1 ? ` ×${s.quantity}` : ''}
                  </span>
                  <span className="ov-list-meta">
                    {USD.format(saleTotal(s))} · {formatWhen(s.soldAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <OverviewStyles />
    </div>
  );
}

function OverviewStyles() {
  return (
    <style>{`
      .ov-page { display: flex; flex-direction: column; gap: 1.25rem; }
      .ov-loading { color: var(--text-secondary); }
      .ov-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.85rem;
      }
      .ov-card {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        padding: 1rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--bg-card);
      }
      .ov-card[data-tone='brand'] { border-left: 3px solid var(--brand); }
      .ov-card-icon {
        display: inline-flex;
        width: 34px;
        height: 34px;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-sm);
        background: color-mix(in srgb, var(--brand) 12%, transparent);
        color: var(--brand-dark);
        margin-bottom: 0.35rem;
      }
      .ov-card-label {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-muted);
      }
      .ov-card-value {
        font-family: var(--font-display);
        font-size: 1.9rem;
        line-height: 1.05;
        font-weight: 700;
      }
      .ov-card-sub { font-size: 0.8rem; color: var(--text-muted); }

      .ov-rangebar {
        display: inline-flex;
        gap: 0.25rem;
        padding: 0.25rem;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius);
        background: var(--bg-card);
        align-self: flex-start;
        flex-wrap: wrap;
      }
      .ov-range {
        min-height: 40px;
        padding: 0 0.9rem;
        border: none;
        border-radius: calc(var(--radius) - 2px);
        background: transparent;
        color: var(--text-secondary);
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;
      }
      .ov-range[aria-pressed='true'] {
        background: color-mix(in srgb, var(--brand) 16%, transparent);
        color: var(--brand-dark);
      }

      .ov-chart {
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--bg-card);
        padding: 1rem;
      }
      .ov-chart-head { display: flex; align-items: baseline; justify-content: space-between; }
      .ov-chart-title {
        margin: 0 0 0.75rem;
        font-size: 0.85rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-secondary);
      }
      .ov-chart-svg { width: 100%; height: 90px; display: block; }
      .ov-chart-bar { fill: var(--brand); }
      .ov-chart-bar:hover { fill: var(--brand-dark); }
      .ov-chart-empty { margin: 0; color: var(--text-muted); font-size: 0.9rem; }

      .ov-lists {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.85rem;
      }
      .ov-list-card {
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--bg-card);
        padding: 1rem;
      }
      .ov-list-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem; }
      .ov-list-title {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
      }
      .ov-list-title svg { color: var(--brand); }
      .ov-list-link { font-size: 0.82rem; font-weight: 600; }
      .ov-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
      .ov-list-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.5rem 0;
        border-top: 1px solid var(--border);
      }
      .ov-list-row:first-child { border-top: none; }
      .ov-list-name { font-weight: 600; font-size: 0.9rem; min-width: 0; }
      .ov-list-meta { font-size: 0.82rem; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }
      .ov-empty { margin: 0; color: var(--text-muted); font-size: 0.9rem; }

      @media (max-width: 899.98px) {
        .ov-grid { grid-template-columns: repeat(2, 1fr); }
      }
      @media (max-width: 620px) {
        .ov-lists { grid-template-columns: 1fr; }
      }
      @media (max-width: 420px) {
        .ov-grid { grid-template-columns: 1fr 1fr; }
        .ov-card-value { font-size: 1.6rem; }
      }
    `}</style>
  );
}
