// Bundles panel: display-only package deals ("X + Y, one price, call the
// shop"). No inventory math, no purchasing logic. Members are picked from
// a searchable product list. All writes are DRAFTS.

import { useCallback, useEffect, useState } from 'react';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import Save01 from '@untitled-ui/icons-react/build/esm/Save01';
import Edit01 from '@untitled-ui/icons-react/build/esm/Edit01';
import Trash01 from '@untitled-ui/icons-react/build/esm/Trash01';
import SearchLg from '@untitled-ui/icons-react/build/esm/SearchLg';
import {
  adminListCatalog,
  adminSaveDraft,
  adminDeleteDraft,
  adminRestoreDraft,
  adminUploadImage,
} from '../../lib/apiClient.js';
import { downscaleImage } from '../../lib/downscaleImage.js';
import { StatusBadge } from './StatusBadge.jsx';

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function BundleForm({ token, item, products, onSaved, onCancel }) {
  const editing = Boolean(item);
  const [values, setValues] = useState(() =>
    editing
      ? {
          name: item.name,
          description: item.description || '',
          photo: item.photo || '',
          memberProductIds: item.memberProductIds || [],
          price: String(item.price),
          compareAtPrice: item.compareAtPrice == null ? '' : String(item.compareAtPrice),
          visible: item.visible !== false,
        }
      : {
          name: '',
          description: '',
          photo: '',
          memberProductIds: [],
          price: '',
          compareAtPrice: '',
          visible: true,
        }
  );
  const [memberSearch, setMemberSearch] = useState('');
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

  function toggleMember(id) {
    set(
      'memberProductIds',
      values.memberProductIds.includes(id)
        ? values.memberProductIds.filter((m) => m !== id)
        : [...values.memberProductIds, id]
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
      if (body?.ok && body.url) set('photo', body.url);
      else setGeneralError(body?.error || 'That photo could not be uploaded.');
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
      description: values.description,
      photo: values.photo,
      memberProductIds: values.memberProductIds,
      price: Number(values.price),
      compareAtPrice: values.compareAtPrice === '' ? null : Number(values.compareAtPrice),
      visible: values.visible,
    };
    const { status, body } = await adminSaveDraft(token, 'bundles', editing ? item.id : null, payload);
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

  const needle = memberSearch.trim().toLowerCase();
  const visibleProducts = products.filter(
    (p) =>
      values.memberProductIds.includes(p.id) ||
      !needle ||
      `${p.name} ${p.manufacturer} ${p.model}`.toLowerCase().includes(needle)
  );

  return (
    <form onSubmit={handleSubmit} noValidate aria-label={editing ? 'Edit bundle' : 'Add bundle'} className="bnd-form">
      <h2 className="display bnd-form-title">{editing ? 'Edit bundle' : 'Add bundle'}</h2>
      <p className="ssga-field-hint">
        A bundle is a package deal shown on the site: the products, one price, and
        "call the shop". It does not track stock or sell anything.
      </p>

      <p className="ssga-field bnd-field">
        <label htmlFor="bnd-name">Name (required)</label>
        <input id="bnd-name" type="text" value={values.name} onChange={(e) => set('name', e.target.value)} disabled={saving} />
        {errors.name ? (
          <span role="alert" className="ssga-field-error">{errors.name}</span>
        ) : null}
      </p>

      <div className="bnd-members" role="group" aria-labelledby="bnd-members-label">
        <p className="bnd-members-label" id="bnd-members-label">
          Products in this bundle (pick at least two)
        </p>
        {errors.memberProductIds ? (
          <p role="alert" className="ssga-field-error">{errors.memberProductIds}</p>
        ) : null}
        <span className="bnd-member-search-wrap">
          <SearchLg className="bnd-member-search-icon" aria-hidden="true" width={18} height={18} />
          <input
            type="search"
            className="bnd-member-search"
            placeholder="Search products"
            aria-label="Search products to add"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
          />
        </span>
        <ul className="bnd-member-list">
          {visibleProducts.map((p) => (
            <li key={p.id}>
              <label className="bnd-check">
                <input
                  type="checkbox"
                  checked={values.memberProductIds.includes(p.id)}
                  onChange={() => toggleMember(p.id)}
                  disabled={saving}
                />{' '}
                {p.name} ({USD.format(p.price)})
              </label>
            </li>
          ))}
          {visibleProducts.length === 0 ? (
            <li className="bnd-member-none">Nothing matches that search.</li>
          ) : null}
        </ul>
      </div>

      <div className="bnd-form-row">
        <p className="ssga-field bnd-field">
          <label htmlFor="bnd-price">Bundle price in dollars (required)</label>
          <input id="bnd-price" type="text" inputMode="decimal" value={values.price} onChange={(e) => set('price', e.target.value)} disabled={saving} />
          {errors.price ? (
            <span role="alert" className="ssga-field-error">{errors.price}</span>
          ) : null}
        </p>
        <p className="ssga-field bnd-field">
          <label htmlFor="bnd-compare">Compare-at price</label>
          <input id="bnd-compare" type="text" inputMode="decimal" value={values.compareAtPrice} onChange={(e) => set('compareAtPrice', e.target.value)} disabled={saving} />
          <span className="ssga-field-hint">Set higher than the bundle price to show the deal as a saving.</span>
          {errors.compareAtPrice ? (
            <span role="alert" className="ssga-field-error">{errors.compareAtPrice}</span>
          ) : null}
        </p>
      </div>

      <p className="ssga-field bnd-field">
        <label htmlFor="bnd-desc">Description</label>
        <textarea id="bnd-desc" rows={3} value={values.description} onChange={(e) => set('description', e.target.value)} disabled={saving} />
        {errors.description ? (
          <span role="alert" className="ssga-field-error">{errors.description}</span>
        ) : null}
      </p>

      <div className="bnd-photo-block">
        <p className="bnd-members-label" id="bnd-photo-label">Photo</p>
        {errors.photo ? (
          <p role="alert" className="ssga-field-error">{errors.photo}</p>
        ) : null}
        {values.photo ? (
          <div className="bnd-photo-preview">
            <img src={values.photo} alt={`Photo of ${values.name || 'bundle'}`} />
            <button type="button" className="bnd-photo-remove" aria-label="Remove photo" onClick={() => set('photo', '')} disabled={saving}>
              <XClose aria-hidden="true" width={16} height={16} />
            </button>
          </div>
        ) : null}
        <label className="bnd-upload">
          <input type="file" accept="image/*" onChange={handlePhoto} disabled={saving || uploading} />
          <span>{uploading ? 'Uploading...' : values.photo ? 'Replace photo' : 'Add a photo'}</span>
        </label>
      </div>

      <p className="bnd-visible">
        <label className="bnd-check">
          <input type="checkbox" checked={values.visible} onChange={(e) => set('visible', e.target.checked)} disabled={saving} />{' '}
          Visible on the site
        </label>
      </p>

      {generalError ? (
        <p role="alert" className="ssga-form-failure">{generalError}</p>
      ) : null}

      <div className="bnd-form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving || uploading}>
          <Save01 aria-hidden="true" width={18} height={18} />
          {saving ? 'Saving...' : 'Save draft'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function BundlesPanel({ token, version, onAuthFail, notifyChange }) {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('list');
  const [editingItem, setEditingItem] = useState(null);
  const [confirmingId, setConfirmingId] = useState('');
  const [busyId, setBusyId] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    const [bundles, prods] = await Promise.all([
      adminListCatalog(token, 'bundles'),
      adminListCatalog(token, 'products'),
    ]);
    setLoading(false);
    if (bundles.status === 401 || prods.status === 401) {
      onAuthFail();
      return;
    }
    if (bundles.body?.ok) setItems(bundles.body.items);
    else setError(bundles.body?.error || 'Could not load bundles.');
    if (prods.body?.ok) setProducts(prods.body.items.filter((p) => p.status !== 'removing'));
  }, [token, onAuthFail]);

  useEffect(() => {
    refresh();
  }, [refresh, version]);

  function changed() {
    notifyChange();
    refresh();
  }

  async function remove(id) {
    setBusyId(id);
    const { body } = await adminDeleteDraft(token, 'bundles', id);
    setBusyId('');
    setConfirmingId('');
    if (body?.ok) changed();
    else setError(body?.error || 'Could not delete the bundle.');
  }

  async function restore(id) {
    setBusyId(id);
    const { body } = await adminRestoreDraft(token, 'bundles', id);
    setBusyId('');
    if (body?.ok) changed();
    else setError(body?.error || 'Could not restore the bundle.');
  }

  function memberNames(bundle) {
    return (bundle.memberProductIds || [])
      .map((id) => products.find((p) => p.id === id)?.name)
      .filter(Boolean)
      .join(' + ');
  }

  if (mode !== 'list') {
    return (
      <div className="bnd-panel">
        <BundleForm
          token={token}
          item={mode === 'edit' ? editingItem : null}
          products={products}
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
        <BundlesStyles />
      </div>
    );
  }

  return (
    <div className="bnd-panel">
      <div className="bnd-toolbar">
        <p className="bnd-hint">
          Package deals for the site: the products, one price, call the shop. Nothing is sold online.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => setMode('add')}>
          <Plus aria-hidden="true" width={18} height={18} />
          Add bundle
        </button>
      </div>

      {error ? (
        <p role="alert" className="ssga-form-failure">{error}</p>
      ) : null}
      {loading ? <p role="status">Loading bundles...</p> : null}
      {!loading && items.length === 0 ? (
        <p className="bnd-empty">No bundles yet. Tap Add bundle to create the first one.</p>
      ) : null}

      <ul className="bnd-list">
        {items.map((item) => (
          <li key={item.id} className="bnd-row" data-removing={item.status === 'removing' || undefined}>
            <div className="bnd-row-main">
              <p className="bnd-row-name">
                {item.name} <StatusBadge status={item.status} />
                {item.visible === false ? <span className="bnd-hidden-tag">Hidden</span> : null}
              </p>
              <p className="bnd-row-meta">
                {memberNames(item) || `${(item.memberProductIds || []).length} products`}
              </p>
              <p className="bnd-row-price">
                {item.onSale && item.compareAtPrice ? (
                  <>
                    <s>{USD.format(item.compareAtPrice)}</s> {USD.format(item.price)}
                  </>
                ) : (
                  USD.format(item.price)
                )}
              </p>
            </div>
            <div className="bnd-row-actions">
              {item.status === 'removing' ? (
                <button type="button" onClick={() => restore(item.id)} disabled={busyId === item.id}>
                  {busyId === item.id ? 'Restoring...' : 'Restore'}
                </button>
              ) : confirmingId === item.id ? (
                <span className="bnd-confirm" role="alert">
                  <span>Delete this bundle?</span>
                  <button type="button" onClick={() => remove(item.id)} disabled={busyId === item.id}>
                    {busyId === item.id ? 'Deleting...' : 'Yes, delete'}
                  </button>
                  <button type="button" onClick={() => setConfirmingId('')}>
                    Keep it
                  </button>
                </span>
              ) : (
                <span className="bnd-row-buttons">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem(item);
                      setMode('edit');
                    }}
                  >
                    <Edit01 aria-hidden="true" width={16} height={16} />
                    Edit
                  </button>
                  <button type="button" onClick={() => setConfirmingId(item.id)}>
                    <Trash01 aria-hidden="true" width={16} height={16} />
                    Delete
                  </button>
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      <BundlesStyles />
    </div>
  );
}

function BundlesStyles() {
  return (
    <style>{`
      .bnd-panel { max-width: 48rem; }
      .bnd-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
        margin: 0 0 1.25rem;
      }
      .bnd-hint { margin: 0; color: var(--text-muted); font-size: 0.9rem; max-width: 26rem; }
      .bnd-empty { color: var(--text-secondary); }
      .bnd-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
      }
      .bnd-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.85rem;
        align-items: center;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-left: 3px solid var(--brand);
        border-radius: var(--radius);
        padding: 0.85rem 1rem;
      }
      .bnd-row[data-removing] { opacity: 0.6; }
      .bnd-row-name {
        margin: 0 0 0.15rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .bnd-hidden-tag {
        font-size: 0.68rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-muted);
        border: 1px dashed var(--border-strong);
        border-radius: var(--radius-sm);
        padding: 0.2rem 0.5rem;
      }
      .bnd-row-meta { margin: 0 0 0.15rem; font-size: 0.85rem; color: var(--text-muted); }
      .bnd-row-price { margin: 0; font-weight: 600; }
      .bnd-row-price s { color: var(--text-muted); font-weight: 400; }
      .bnd-row-actions { min-width: 9rem; }
      .bnd-row-buttons { display: flex; gap: 0.5rem; }
      .bnd-row-buttons button { flex: 1; }
      .bnd-confirm {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        font-size: 0.85rem;
        color: var(--danger);
      }
      .bnd-confirm button { width: 100%; }
      .bnd-form { max-width: 34rem; }
      .bnd-form-title { font-size: 1.6rem; margin: 0 0 0.5rem; }
      .bnd-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0 1rem; }
      .bnd-members { margin: 0 0 1.1rem; }
      .bnd-members-label {
        margin: 0.75rem 0 0.35rem;
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-secondary);
      }
      .bnd-member-search-wrap {
        position: relative;
        display: flex;
        align-items: center;
        margin: 0 0 0.6rem;
      }
      .bnd-member-search-icon {
        position: absolute;
        left: 0.65rem;
        color: var(--text-muted);
        pointer-events: none;
      }
      .bnd-member-search { width: 100%; padding-left: 2.4rem; }
      .bnd-row-buttons button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
      }
      .bnd-row-buttons button svg { flex-shrink: 0; }
      .bnd-member-list {
        list-style: none;
        margin: 0;
        padding: 0.35rem 0.75rem;
        max-height: 16rem;
        overflow-y: auto;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius);
        background: var(--bg-field);
      }
      .bnd-member-none { color: var(--text-muted); padding: 0.5rem 0; }
      .bnd-check {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-height: 44px;
        font-weight: 500;
      }
      .bnd-photo-block { margin: 0 0 1.1rem; }
      .bnd-photo-preview {
        position: relative;
        width: 10rem;
        height: 7rem;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-sm);
        overflow: hidden;
        margin: 0 0 0.6rem;
      }
      .bnd-photo-preview img { width: 100%; height: 100%; object-fit: cover; }
      .bnd-photo-preview .bnd-photo-remove {
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
      .bnd-upload {
        display: inline-flex;
        align-items: center;
        min-height: 48px;
        padding: 0 1.1rem;
        border: 1.5px dashed var(--border-strong);
        border-radius: var(--radius);
        cursor: pointer;
        font-weight: 600;
      }
      .bnd-upload:hover { border-color: var(--brand); color: var(--brand-dark); }
      .bnd-upload input {
        position: absolute;
        min-height: 0;
        padding: 0;
        border: 0;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
      }
      .bnd-form-actions { display: flex; gap: 0.85rem; flex-wrap: wrap; }
      @media (max-width: 599.98px) {
        .bnd-row { grid-template-columns: 1fr; }
        .bnd-form-row { grid-template-columns: 1fr; }
      }
    `}</style>
  );
}
