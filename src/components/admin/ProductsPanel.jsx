// Products panel: list with search and collection filter, one-tap stock
// status, sale pricing, confirm-step delete, restore for pending removals,
// and a phone-first add/edit form. Every write here is a DRAFT; the
// Publish bar controls what goes live. Display data only: no cart, no
// checkout, no purchase flow.

import { useCallback, useEffect, useState } from 'react';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import {
  adminListCatalog,
  adminSaveDraft,
  adminDeleteDraft,
  adminRestoreDraft,
  adminUploadImage,
} from '../../lib/apiClient.js';
import { downscaleImage } from '../../lib/downscaleImage.js';
import { CONDITIONS, STOCK_STATUSES } from '../../../shared/catalogValidation.js';
import { StatusBadge } from './StatusBadge.jsx';

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const EMPTY_FORM = {
  name: '',
  collectionIds: [],
  manufacturer: '',
  model: '',
  caliber: '',
  condition: 'New',
  price: '',
  compareAtPrice: '',
  saleLabel: '',
  stockStatus: 'In Stock',
  description: '',
  photos: [],
  featured: false,
};

function Field({ id, label, error, children, hint }) {
  return (
    <p className="ssga-field inv-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <span className="ssga-field-hint">{hint}</span> : null}
      {error ? (
        <span role="alert" className="ssga-field-error">
          {error}
        </span>
      ) : null}
    </p>
  );
}

function ProductForm({ token, item, collections, onSaved, onCancel }) {
  const editing = Boolean(item);
  const [values, setValues] = useState(() =>
    editing
      ? {
          ...EMPTY_FORM,
          ...item,
          price: String(item.price),
          compareAtPrice: item.compareAtPrice == null ? '' : String(item.compareAtPrice),
        }
      : EMPTY_FORM
  );
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  function set(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function toggleCollection(id) {
    set(
      'collectionIds',
      values.collectionIds.includes(id)
        ? values.collectionIds.filter((c) => c !== id)
        : [...values.collectionIds, id]
    );
  }

  async function handlePhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setGeneralError('');
    try {
      const dataUrl = await downscaleImage(file);
      const { body } = await adminUploadImage(token, { filename: file.name, dataUrl });
      if (body?.ok && body.url) {
        set('photos', [...values.photos, { url: body.url }]);
      } else {
        setGeneralError(body?.error || 'That photo could not be uploaded.');
      }
    } catch (err) {
      setGeneralError(err.message || 'That photo could not be uploaded.');
    }
    setUploading(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setGeneralError('');
    const payload = {
      name: values.name,
      collectionIds: values.collectionIds,
      manufacturer: values.manufacturer,
      model: values.model,
      caliber: values.caliber,
      condition: values.condition,
      price: Number(values.price),
      compareAtPrice: values.compareAtPrice === '' ? null : Number(values.compareAtPrice),
      saleLabel: values.saleLabel,
      stockStatus: values.stockStatus,
      description: values.description,
      photos: values.photos,
      featured: values.featured,
    };
    const { status, body } = await adminSaveDraft(
      token,
      'products',
      editing ? item.id : null,
      payload
    );
    setSaving(false);
    if (body?.ok) {
      onSaved();
      return;
    }
    if (status === 422 && body?.errors) {
      setErrors(body.errors);
      setGeneralError('Check the highlighted fields and save again.');
      return;
    }
    setGeneralError(body?.error || 'Could not save. Try again.');
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label={editing ? 'Edit product' : 'Add product'} className="inv-form">
      <h2 className="display inv-form-title">{editing ? 'Edit product' : 'Add product'}</h2>
      <p className="ssga-field-hint">
        Saving stores a draft. Nothing changes on the public site until you tap Publish.
      </p>

      <Field id="inv-name" label="Name (required)" error={errors.name}>
        <input id="inv-name" type="text" value={values.name} onChange={(e) => set('name', e.target.value)} disabled={saving} />
      </Field>

      <div className="inv-collections" role="group" aria-labelledby="inv-collections-label">
        <p className="inv-photos-label" id="inv-collections-label">Collections</p>
        {errors.collectionIds ? (
          <p role="alert" className="ssga-field-error">{errors.collectionIds}</p>
        ) : null}
        {collections.length === 0 ? (
          <p className="ssga-field-hint">No collections yet. Create them on the Collections tab.</p>
        ) : (
          <ul className="inv-collection-list">
            {collections.map((c) => (
              <li key={c.id}>
                <label className="inv-check">
                  <input
                    type="checkbox"
                    checked={values.collectionIds.includes(c.id)}
                    onChange={() => toggleCollection(c.id)}
                    disabled={saving}
                  />{' '}
                  {c.name}
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="inv-form-row">
        <Field id="inv-manufacturer" label="Manufacturer (required)" error={errors.manufacturer}>
          <input id="inv-manufacturer" type="text" value={values.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} disabled={saving} />
        </Field>
        <Field id="inv-model" label="Model (required)" error={errors.model}>
          <input id="inv-model" type="text" value={values.model} onChange={(e) => set('model', e.target.value)} disabled={saving} />
        </Field>
      </div>

      <div className="inv-form-row">
        <Field id="inv-caliber" label="Caliber" error={errors.caliber} hint="Leave blank if it does not apply.">
          <input id="inv-caliber" type="text" value={values.caliber} onChange={(e) => set('caliber', e.target.value)} disabled={saving} />
        </Field>
        <Field id="inv-condition" label="Condition" error={errors.condition}>
          <select id="inv-condition" value={values.condition} onChange={(e) => set('condition', e.target.value)} disabled={saving}>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="inv-form-row">
        <Field id="inv-price" label="Price in dollars (required)" error={errors.price}>
          <input id="inv-price" type="text" inputMode="decimal" value={values.price} onChange={(e) => set('price', e.target.value)} disabled={saving} />
        </Field>
        <Field
          id="inv-compare"
          label="Compare-at price"
          error={errors.compareAtPrice}
          hint="Set this higher than the price to show the item on sale."
        >
          <input id="inv-compare" type="text" inputMode="decimal" value={values.compareAtPrice} onChange={(e) => set('compareAtPrice', e.target.value)} disabled={saving} />
        </Field>
      </div>

      <Field id="inv-salelabel" label="Sale label" error={errors.saleLabel} hint='Short text shown with the sale, like "Holiday Sale".'>
        <input id="inv-salelabel" type="text" value={values.saleLabel} onChange={(e) => set('saleLabel', e.target.value)} disabled={saving} />
      </Field>

      <Field id="inv-status" label="Stock status" error={errors.stockStatus} hint="Hidden items never show on the public site.">
        <select id="inv-status" value={values.stockStatus} onChange={(e) => set('stockStatus', e.target.value)} disabled={saving}>
          {STOCK_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </Field>

      <Field id="inv-description" label="Description" error={errors.description}>
        <textarea id="inv-description" rows={4} value={values.description} onChange={(e) => set('description', e.target.value)} disabled={saving} />
      </Field>

      <div className="inv-photos-block">
        <p className="inv-photos-label" id="inv-photos-label">Photos</p>
        {errors.photos ? (
          <p role="alert" className="ssga-field-error">{errors.photos}</p>
        ) : null}
        <ul className="inv-photo-list" aria-labelledby="inv-photos-label">
          {values.photos.map((photo, index) => (
            <li key={index} className="inv-photo">
              <img src={photo.url} alt={`Photo ${index + 1} of ${values.name || 'product'}`} />
              {index === 0 ? <span className="inv-photo-primary">Primary</span> : null}
              <button
                type="button"
                className="inv-photo-remove"
                aria-label={`Remove photo ${index + 1}`}
                onClick={() => set('photos', values.photos.filter((_, i) => i !== index))}
                disabled={saving}
              >
                <XClose aria-hidden="true" width={16} height={16} />
              </button>
            </li>
          ))}
        </ul>
        <label className="inv-upload">
          <input type="file" accept="image/*" onChange={handlePhoto} disabled={saving || uploading} />
          <span>{uploading ? 'Uploading photo...' : 'Add a photo'}</span>
        </label>
        <p className="ssga-field-hint">Photos are shrunk on your phone before upload, so camera shots are fine.</p>
      </div>

      <p className="inv-featured">
        <label className="inv-check">
          <input type="checkbox" checked={values.featured} onChange={(e) => set('featured', e.target.checked)} disabled={saving} />{' '}
          Featured (for future homepage use)
        </label>
      </p>

      {generalError ? (
        <p role="alert" className="ssga-form-failure">{generalError}</p>
      ) : null}

      <div className="inv-form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving || uploading}>
          {saving ? 'Saving...' : 'Save draft'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function ProductRow({ token, item, collections, onEdit, onChanged, onError }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const removing = item.status === 'removing';
  const primaryPhoto = item.photos?.[0]?.url;
  const collectionNames = (item.collectionIds || [])
    .map((id) => collections.find((c) => c.id === id)?.name)
    .filter(Boolean)
    .join(', ');

  async function changeStatus(stockStatus) {
    setBusy(true);
    const { body } = await adminSaveDraft(token, 'products', item.id, { stockStatus });
    setBusy(false);
    if (body?.ok) onChanged();
    else onError(body?.error || 'Could not change the status.');
  }

  async function confirmDelete() {
    setBusy(true);
    const { body } = await adminDeleteDraft(token, 'products', item.id);
    setBusy(false);
    if (body?.ok) onChanged();
    else onError(body?.error || 'Could not delete the product.');
  }

  async function restore() {
    setBusy(true);
    const { body } = await adminRestoreDraft(token, 'products', item.id);
    setBusy(false);
    if (body?.ok) onChanged();
    else onError(body?.error || 'Could not restore the product.');
  }

  return (
    <li className="inv-row" data-status={item.stockStatus} data-removing={removing || undefined}>
      <div className="inv-thumb" aria-hidden={primaryPhoto ? undefined : 'true'}>
        {primaryPhoto ? <img src={primaryPhoto} alt="" loading="lazy" /> : <span className="inv-thumb-empty">No photo</span>}
      </div>
      <div className="inv-row-main">
        <p className="inv-row-name">
          {item.name} <StatusBadge status={item.status} />
        </p>
        <p className="inv-row-meta">
          {item.onSale ? (
            <>
              <s>{USD.format(item.compareAtPrice)}</s> {USD.format(item.price)}
              {item.saleLabel ? ` (${item.saleLabel})` : ' (Sale)'}
            </>
          ) : (
            USD.format(item.price)
          )}
          {' | '}
          {item.condition}
          {collectionNames ? ` | ${collectionNames}` : ''}
        </p>
      </div>
      <div className="inv-row-actions">
        {removing ? (
          <button type="button" onClick={restore} disabled={busy}>
            {busy ? 'Restoring...' : 'Restore'}
          </button>
        ) : (
          <>
            <label className="inv-status-label">
              <span className="inv-visually-hidden">Stock status for {item.name}</span>
              <select className="inv-status-select" value={item.stockStatus} onChange={(e) => changeStatus(e.target.value)} disabled={busy}>
                {STOCK_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            {confirming ? (
              <span className="inv-confirm" role="alert">
                <span>Delete this product?</span>
                <button type="button" onClick={confirmDelete} disabled={busy}>
                  {busy ? 'Deleting...' : 'Yes, delete'}
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={busy}>
                  Keep it
                </button>
              </span>
            ) : (
              <span className="inv-row-buttons">
                <button type="button" onClick={() => onEdit(item)} disabled={busy}>
                  Edit
                </button>
                <button type="button" onClick={() => setConfirming(true)} disabled={busy}>
                  Delete
                </button>
              </span>
            )}
          </>
        )}
      </div>
    </li>
  );
}

export function ProductsPanel({ token, version, onAuthFail, notifyChange }) {
  const [items, setItems] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('list');
  const [editingItem, setEditingItem] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    const [products, cols] = await Promise.all([
      adminListCatalog(token, 'products', { collectionId: collectionId || undefined, q: query || undefined }),
      adminListCatalog(token, 'collections'),
    ]);
    setLoading(false);
    if (products.status === 401 || cols.status === 401) {
      onAuthFail();
      return;
    }
    if (products.body?.ok) setItems(products.body.items);
    else setError(products.body?.error || 'Could not load products.');
    if (cols.body?.ok) setCollections(cols.body.items.filter((c) => c.status !== 'removing'));
  }, [token, collectionId, query, onAuthFail]);

  useEffect(() => {
    refresh();
  }, [refresh, version]);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  function changed() {
    notifyChange();
    refresh();
  }

  if (mode !== 'list') {
    return (
      <div className="inv-panel">
        <ProductForm
          token={token}
          item={mode === 'edit' ? editingItem : null}
          collections={collections}
          onSaved={() => {
            setMode('list');
            setEditingItem(null);
            changed();
          }}
          onCancel={() => {
            setMode('list');
            setEditingItem(null);
          }}
        />
        <ProductsStyles />
      </div>
    );
  }

  return (
    <div className="inv-panel">
      <div className="inv-toolbar">
        <input
          type="search"
          className="inv-search"
          placeholder="Search name, model, caliber"
          aria-label="Search products"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="inv-filter-label">
          <span className="inv-visually-hidden">Filter by collection</span>
          <select value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
            <option value="">All collections</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-primary inv-add" onClick={() => setMode('add')}>
          <Plus aria-hidden="true" width={18} height={18} />
          Add product
        </button>
      </div>

      {error ? (
        <p role="alert" className="ssga-form-failure">{error}</p>
      ) : null}
      {loading ? <p role="status">Loading products...</p> : null}
      {!loading && items.length === 0 ? (
        <p className="inv-empty">
          {query || collectionId
            ? 'Nothing matches that filter. Clear the search or pick another collection.'
            : 'No products yet. Tap Add product to create the first one.'}
        </p>
      ) : null}

      <ul className="inv-list">
        {items.map((item) => (
          <ProductRow
            key={item.id}
            token={token}
            item={item}
            collections={collections}
            onEdit={(target) => {
              setEditingItem(target);
              setMode('edit');
            }}
            onChanged={changed}
            onError={setError}
          />
        ))}
      </ul>
      <ProductsStyles />
    </div>
  );
}

function ProductsStyles() {
  return (
    <style>{`
      .inv-panel { max-width: 56rem; }
      .inv-visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }
      .inv-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
        align-items: center;
        margin: 0 0 1.25rem;
      }
      .inv-search { flex: 1 1 14rem; }
      .inv-filter-label select { min-width: 11rem; }
      .inv-add { font-size: 1rem; min-height: 48px; }
      .inv-empty { color: var(--text-secondary); }
      .inv-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
      }
      .inv-row {
        display: grid;
        grid-template-columns: 4rem 1fr auto;
        gap: 0.85rem;
        align-items: center;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-left: 3px solid var(--brand);
        border-radius: var(--radius);
        padding: 0.85rem 1rem;
      }
      .inv-row[data-status='Sold'] { border-left-color: var(--wood); }
      .inv-row[data-status='Hidden'] { border-left-color: var(--border-strong); opacity: 0.75; }
      .inv-row[data-status='Low Stock'] { border-left-color: var(--accent-fall); }
      .inv-row[data-removing] { opacity: 0.6; }
      .inv-thumb {
        width: 4rem;
        height: 4rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        background: var(--bg-field);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .inv-thumb img { width: 100%; height: 100%; object-fit: cover; }
      .inv-thumb-empty {
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-muted);
        text-align: center;
      }
      .inv-row-name {
        margin: 0 0 0.15rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .inv-row-meta { margin: 0; font-size: 0.85rem; color: var(--text-muted); }
      .inv-row-meta s { color: var(--text-faint, var(--text-muted)); }
      .inv-row-actions {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        align-items: stretch;
        min-width: 9rem;
      }
      .inv-status-select { min-height: 44px; width: 100%; }
      .inv-row-buttons { display: flex; gap: 0.5rem; }
      .inv-row-buttons button { flex: 1; }
      .inv-confirm {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        font-size: 0.85rem;
        color: var(--danger);
      }
      .inv-confirm button { width: 100%; }
      .inv-form { max-width: 34rem; }
      .inv-form-title { font-size: 1.6rem; margin: 0 0 0.5rem; }
      .inv-form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0 1rem;
      }
      .inv-field select { width: 100%; }
      .inv-collections { margin: 0 0 1.1rem; }
      .inv-collection-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 0 1.25rem;
      }
      .inv-photos-block { margin: 0 0 1.1rem; }
      .inv-photos-label {
        margin: 0.75rem 0 0.35rem;
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-secondary);
      }
      .inv-photo-list {
        list-style: none;
        margin: 0 0 0.6rem;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
      }
      .inv-photo {
        position: relative;
        width: 6.5rem;
        height: 6.5rem;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-sm);
        overflow: hidden;
      }
      .inv-photo img { width: 100%; height: 100%; object-fit: cover; }
      .inv-photo-primary {
        position: absolute;
        left: 0;
        bottom: 0;
        right: 0;
        font-size: 0.6rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        text-align: center;
        background: color-mix(in srgb, var(--ink) 70%, transparent);
        color: var(--ivory);
        padding: 0.1rem 0;
      }
      .inv-photo .inv-photo-remove {
        position: absolute;
        top: 0;
        right: 0;
        width: 44px;
        height: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        background: color-mix(in srgb, var(--ivory) 88%, transparent);
        border: 1px solid var(--border-strong);
        border-radius: 0 0 0 var(--radius-sm);
      }
      .inv-upload {
        display: inline-flex;
        align-items: center;
        min-height: 48px;
        padding: 0 1.1rem;
        border: 1.5px dashed var(--border-strong);
        border-radius: var(--radius);
        cursor: pointer;
        font-weight: 600;
      }
      .inv-upload:hover { border-color: var(--brand); color: var(--brand-dark); }
      .inv-upload input {
        position: absolute;
        min-height: 0;
        padding: 0;
        border: 0;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
      }
      .inv-check {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        min-height: 44px;
        font-weight: 500;
      }
      .inv-form-actions {
        display: flex;
        gap: 0.85rem;
        flex-wrap: wrap;
        margin-top: 0.5rem;
      }
      @media (max-width: 599.98px) {
        .inv-row { grid-template-columns: 3.25rem 1fr; }
        .inv-thumb { width: 3.25rem; height: 3.25rem; }
        .inv-row-actions { grid-column: 1 / -1; }
        .inv-form-row { grid-template-columns: 1fr; }
        .inv-toolbar .inv-add { flex: 1 1 100%; }
      }
    `}</style>
  );
}
