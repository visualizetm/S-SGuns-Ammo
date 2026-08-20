// Quick Sale: the counter sales-logging tool.
//
// Staff search the catalog, tap a product, and log a sale prefilled with the
// item's listed price (quantity 1, time now, empty note). "Also mark this item
// as Sold" is ON by default; when left on, the item is set Sold LIVE on the
// public catalog immediately (no Publish step) via the sales endpoint's
// markStockImmediate write-through. A recently-logged list lets staff Undo a
// sale, which deletes the entry and restores the item's prior stock status.
//
// COMPLIANCE / PRIVACY: this is a convenience business and inventory log, NOT
// the federal ATF or state Acquisition and Disposition record. It stores NO
// buyer personal information; the note is for non-personal reminders only.
// (See api/admin/sales.js and shared/salesValidation.js.)

import { useCallback, useEffect, useMemo, useState } from 'react';
import SearchLg from '@untitled-ui/icons-react/build/esm/SearchLg';
import Tag01 from '@untitled-ui/icons-react/build/esm/Tag01';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import CheckCircle from '@untitled-ui/icons-react/build/esm/CheckCircle';
import Save01 from '@untitled-ui/icons-react/build/esm/Save01';
import ReverseLeft from '@untitled-ui/icons-react/build/esm/ReverseLeft';
import { adminListCatalog, adminListSales, adminLogSale, adminDeleteSale } from '../../lib/apiClient.js';
import { filterProducts } from '../../lib/catalogView.js';

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function toLocalInputValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
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

// The log form for one selected product. Prefilled from the listing.
function LogSaleForm({ token, product, onLogged, onCancel, onError }) {
  const [price, setPrice] = useState(String(product.price ?? ''));
  const [quantity, setQuantity] = useState('1');
  const [soldAtLocal, setSoldAtLocal] = useState(() => toLocalInputValue());
  const [note, setNote] = useState('');
  const [markSold, setMarkSold] = useState(true);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrors({});
    // Send an absolute timestamp: the datetime-local value has no timezone, so
    // convert it here (client local) to a full ISO string the server stores as-is.
    const soldAt = soldAtLocal ? new Date(soldAtLocal).toISOString() : undefined;
    const { status, body } = await adminLogSale(token, {
      productId: product.id,
      priceAtSale: price,
      quantity,
      soldAt,
      note,
      markSold,
    });
    setSaving(false);
    if (status === 401) {
      onError('Your session expired. Sign in again.');
      return;
    }
    if (body?.ok) {
      onLogged(body.sale);
      return;
    }
    if (status === 422 && body?.errors) {
      setErrors(body.errors);
      return;
    }
    onError(body?.error || 'Could not log that sale. Try again.');
  }

  const lineTotal =
    Number(price) >= 0 && Number(quantity) >= 1
      ? USD.format(Number(price) * Number(quantity))
      : null;

  return (
    <form className="qs-form" onSubmit={handleSubmit} noValidate aria-label="Log a sale">
      <div className="qs-form-head">
        <div>
          <p className="qs-form-eyebrow">Logging a sale for</p>
          <h2 className="qs-form-name">{product.name}</h2>
          <p className="qs-form-sub">
            Listed at {USD.format(product.price)}
            {product.stockStatus ? ` · ${product.stockStatus}` : ''}
          </p>
        </div>
        <button type="button" className="qs-close" aria-label="Cancel" onClick={onCancel} disabled={saving}>
          <XClose aria-hidden="true" width={20} height={20} />
        </button>
      </div>

      <div className="qs-form-grid">
        <p className="ssga-field qs-field">
          <label htmlFor="qs-price">Sale price</label>
          <input
            id="qs-price"
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={saving}
          />
          {errors.priceAtSale ? (
            <span role="alert" className="ssga-field-error">{errors.priceAtSale}</span>
          ) : null}
        </p>
        <p className="ssga-field qs-field">
          <label htmlFor="qs-qty">Quantity</label>
          <input
            id="qs-qty"
            type="text"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            disabled={saving}
          />
          {errors.quantity ? (
            <span role="alert" className="ssga-field-error">{errors.quantity}</span>
          ) : null}
        </p>
      </div>

      <p className="ssga-field qs-field">
        <label htmlFor="qs-when">Sold on</label>
        <input
          id="qs-when"
          type="datetime-local"
          value={soldAtLocal}
          onChange={(e) => setSoldAtLocal(e.target.value)}
          disabled={saving}
        />
        {errors.soldAt ? (
          <span role="alert" className="ssga-field-error">{errors.soldAt}</span>
        ) : null}
      </p>

      <p className="ssga-field qs-field">
        <label htmlFor="qs-note">Note (optional)</label>
        <input
          id="qs-note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reminder only, no customer information"
          maxLength={200}
          disabled={saving}
        />
        {errors.note ? (
          <span role="alert" className="ssga-field-error">{errors.note}</span>
        ) : null}
      </p>

      <label className="qs-toggle">
        <input
          type="checkbox"
          checked={markSold}
          onChange={(e) => setMarkSold(e.target.checked)}
          disabled={saving}
        />
        <span>
          <strong>Also mark this item as Sold</strong>
          <span className="qs-toggle-hint">
            Updates the public site right away, no Publish needed. Turn off for
            bulk items like ammo that stay in stock.
          </span>
        </span>
      </label>

      {lineTotal ? (
        <p className="qs-total">
          Sale total <strong>{lineTotal}</strong>
        </p>
      ) : null}

      <div className="qs-form-actions">
        <button type="submit" className="btn btn-primary qs-log-btn" disabled={saving}>
          <Save01 aria-hidden="true" width={18} height={18} />
          {saving ? 'Logging...' : 'Log Sale'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>

      <p className="qs-compliance">
        Quick Sale is an internal business and inventory log. It is not the ATF
        or state Acquisition &amp; Disposition record, and it stores no buyer
        information.
      </p>
    </form>
  );
}

export function QuickSalePage({ token, version, onAuthFail, notifyChange }) {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [undoing, setUndoing] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    const [prod, sale] = await Promise.all([
      adminListCatalog(token, 'products'),
      adminListSales(token),
    ]);
    setLoading(false);
    if (prod.status === 401 || sale.status === 401) {
      onAuthFail();
      return;
    }
    if (prod.body?.ok) setProducts(prod.body.items.filter((p) => p.status !== 'removing'));
    else setError(prod.body?.error || 'Could not load products.');
    if (sale.body?.ok) setSales(sale.body.items);
  }, [token, onAuthFail]);

  useEffect(() => {
    refresh();
  }, [refresh, version]);

  const matches = useMemo(
    () => (search.trim() ? filterProducts(products, { q: search }) : products).slice(0, 40),
    [products, search]
  );

  const flashFor = useCallback((message) => {
    setFlash(message);
    setTimeout(() => setFlash(''), 4000);
  }, []);

  function handleLogged(sale) {
    setSelected(null);
    setSearch('');
    setSales((prev) => [sale, ...prev]);
    flashFor(
      sale.markedSold
        ? `Logged ${sale.productNameSnapshot} - marked Sold on the site.`
        : `Logged ${sale.productNameSnapshot}.`
    );
    notifyChange();
    refresh();
  }

  async function undo(sale) {
    setUndoing(sale.id);
    setError('');
    const { status, body } = await adminDeleteSale(token, sale.id);
    setUndoing('');
    if (status === 401) {
      onAuthFail();
      return;
    }
    if (body?.ok) {
      setSales((prev) => prev.filter((s) => s.id !== sale.id));
      flashFor(
        body.restored
          ? `Removed. ${sale.productNameSnapshot} restored to "${body.restored.stockStatus}".`
          : 'Sale removed.'
      );
      notifyChange();
      refresh();
    } else {
      setError(body?.error || 'Could not undo that sale.');
    }
  }

  return (
    <div className="qs-page">
      {flash ? (
        <p className="qs-flash" role="status">
          <CheckCircle aria-hidden="true" width={18} height={18} />
          {flash}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="ssga-form-failure">{error}</p>
      ) : null}

      {selected ? (
        <LogSaleForm
          token={token}
          product={selected}
          onLogged={handleLogged}
          onCancel={() => setSelected(null)}
          onError={setError}
        />
      ) : (
        <section className="qs-picker" aria-label="Pick a product to sell">
          <span className="qs-search-wrap">
            <SearchLg className="qs-search-icon" aria-hidden="true" width={18} height={18} />
            <input
              type="search"
              className="qs-search"
              placeholder="Search a product to sell"
              aria-label="Search products"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </span>

          {loading ? <p role="status">Loading products...</p> : null}
          {!loading && matches.length === 0 ? (
            <p className="qs-empty">
              {search.trim()
                ? 'No products match that search.'
                : 'No products in the catalog yet. Add products on the Products page first.'}
            </p>
          ) : null}

          <ul className="qs-list">
            {matches.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="qs-pick"
                  onClick={() => setSelected(item)}
                  data-sold={item.stockStatus === 'Sold' ? 'true' : undefined}
                >
                  <span className="qs-pick-main">
                    <span className="qs-pick-name">{item.name}</span>
                    <span className="qs-pick-meta">
                      {USD.format(item.price)}
                      {item.stockStatus ? ` · ${item.stockStatus}` : ''}
                    </span>
                  </span>
                  <Tag01 aria-hidden="true" width={18} height={18} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="qs-recent" aria-label="Recently logged sales">
        <h2 className="qs-recent-title">Recently logged</h2>
        {sales.length === 0 ? (
          <p className="qs-empty">No sales logged yet.</p>
        ) : (
          <ul className="qs-recent-list">
            {sales.slice(0, 20).map((sale) => (
              <li key={sale.id} className="qs-recent-row">
                <span className="qs-recent-main">
                  <span className="qs-recent-name">
                    {sale.productNameSnapshot}
                    {sale.quantity > 1 ? ` ×${sale.quantity}` : ''}
                    {sale.markedSold ? <span className="qs-recent-tag">Marked Sold</span> : null}
                  </span>
                  <span className="qs-recent-meta">
                    {USD.format(sale.priceAtSale * sale.quantity)} · {formatWhen(sale.soldAt)}
                    {sale.note ? ` · ${sale.note}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  className="qs-undo"
                  onClick={() => undo(sale)}
                  disabled={undoing === sale.id}
                >
                  <ReverseLeft aria-hidden="true" width={16} height={16} />
                  {undoing === sale.id ? 'Undoing...' : 'Undo'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <QuickSaleStyles />
    </div>
  );
}

function QuickSaleStyles() {
  return (
    <style>{`
      .qs-page { display: flex; flex-direction: column; gap: 1.5rem; max-width: 42rem; }
      .qs-flash {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0;
        padding: 0.7rem 0.9rem;
        border-radius: var(--radius);
        background: color-mix(in srgb, var(--brand) 12%, transparent);
        color: var(--brand-dark);
        font-weight: 600;
      }
      .qs-flash svg { flex-shrink: 0; }

      .qs-picker { display: flex; flex-direction: column; gap: 0.9rem; }
      .qs-search-wrap { position: relative; display: inline-flex; align-items: center; }
      .qs-search-icon { position: absolute; left: 0.65rem; color: var(--text-muted); pointer-events: none; }
      .qs-search { width: 100%; padding-left: 2.4rem; min-height: 48px; }
      .qs-empty { color: var(--text-secondary); margin: 0; }
      .qs-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
      .qs-pick {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        width: 100%;
        min-height: 56px;
        padding: 0.7rem 1rem;
        border: 1px solid var(--border);
        border-left: 3px solid var(--brand);
        border-radius: var(--radius);
        background: var(--bg-card);
        color: var(--text);
        text-align: left;
        cursor: pointer;
        transition: border-color var(--duration-fast) var(--ease),
          background-color var(--duration-fast) var(--ease);
      }
      .qs-pick:hover { border-color: var(--brand); background: var(--bg-deep); }
      .qs-pick[data-sold='true'] { border-left-color: var(--wood); opacity: 0.72; }
      .qs-pick-main { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
      .qs-pick-name { font-weight: 600; }
      .qs-pick-meta { font-size: 0.83rem; color: var(--text-muted); }
      .qs-pick svg { flex-shrink: 0; color: var(--brand); }

      .qs-form {
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-lg);
        background: var(--bg-card);
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .qs-form-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; }
      .qs-form-eyebrow {
        margin: 0;
        font-size: 0.72rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--text-muted);
      }
      .qs-form-name { margin: 0.1rem 0 0.15rem; font-size: 1.4rem; font-family: var(--font-display); }
      .qs-form-sub { margin: 0; font-size: 0.85rem; color: var(--text-muted); }
      .qs-close {
        flex-shrink: 0;
        width: 44px;
        height: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius);
        background: var(--bg-card);
        color: var(--text-secondary);
        cursor: pointer;
      }
      .qs-close:hover { border-color: var(--brand); color: var(--brand-dark); }
      .qs-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 1rem; }
      .qs-field { display: flex; flex-direction: column; gap: 0.35rem; margin: 0; }
      .qs-field label { font-weight: 600; font-size: 0.9rem; }
      .qs-field input { width: 100%; }

      .qs-toggle {
        display: flex;
        align-items: flex-start;
        gap: 0.65rem;
        padding: 0.8rem;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius);
        background: var(--bg-deep);
        cursor: pointer;
      }
      .qs-toggle input { margin-top: 0.2rem; width: 20px; height: 20px; flex-shrink: 0; }
      .qs-toggle span { display: flex; flex-direction: column; gap: 0.15rem; }
      .qs-toggle-hint { font-size: 0.82rem; color: var(--text-muted); font-weight: 400; }

      .qs-total { margin: 0; font-size: 1.05rem; }
      .qs-total strong { font-size: 1.2rem; }
      .qs-form-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
      .qs-log-btn { min-height: 48px; font-size: 1rem; flex: 1 1 12rem; }
      .qs-compliance {
        margin: 0;
        font-size: 0.75rem;
        color: var(--text-muted);
        line-height: 1.5;
        border-top: 1px solid var(--border);
        padding-top: 0.75rem;
      }

      .qs-recent-title {
        margin: 0 0 0.75rem;
        font-family: var(--font-display);
        font-size: 1.15rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .qs-recent-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
      .qs-recent-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.65rem 0.9rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--bg-card);
      }
      .qs-recent-main { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
      .qs-recent-name { font-weight: 600; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
      .qs-recent-tag {
        font-size: 0.65rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        padding: 0.12rem 0.4rem;
        border-radius: var(--radius-sm);
        color: var(--wood);
        background: color-mix(in srgb, var(--wood) 12%, transparent);
      }
      .qs-recent-meta { font-size: 0.82rem; color: var(--text-muted); }
      .qs-undo {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        min-height: 44px;
        padding: 0 0.75rem;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius);
        background: var(--bg-card);
        color: var(--text-secondary);
        font-weight: 600;
        font-size: 0.85rem;
        cursor: pointer;
      }
      .qs-undo:hover:not(:disabled) { border-color: var(--danger); color: var(--danger); }
      .qs-undo svg { flex-shrink: 0; }

      @media (max-width: 560px) {
        .qs-form-grid { grid-template-columns: 1fr; gap: 0; }
      }
    `}</style>
  );
}
