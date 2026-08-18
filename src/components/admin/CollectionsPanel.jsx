// Collections panel: create, rename, reorder (up/down, phone-friendly),
// hide, and delete collections. Deleting a collection never deletes its
// products; they just leave the collection. All writes are DRAFTS.

import { useCallback, useEffect, useState } from 'react';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import ChevronUp from '@untitled-ui/icons-react/build/esm/ChevronUp';
import ChevronDown from '@untitled-ui/icons-react/build/esm/ChevronDown';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import {
  adminListCatalog,
  adminSaveDraft,
  adminDeleteDraft,
  adminRestoreDraft,
  adminReorderCollections,
  adminUploadImage,
} from '../../lib/apiClient.js';
import { downscaleImage } from '../../lib/downscaleImage.js';
import { StatusBadge } from './StatusBadge.jsx';

function CollectionForm({ token, item, onSaved, onCancel }) {
  const editing = Boolean(item);
  const [values, setValues] = useState(() =>
    editing
      ? { name: item.name, description: item.description || '', coverPhoto: item.coverPhoto || '', visible: item.visible !== false }
      : { name: '', description: '', coverPhoto: '', visible: true }
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

  async function handlePhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setGeneralError('');
    try {
      const dataUrl = await downscaleImage(file);
      const { body } = await adminUploadImage(token, { filename: file.name, dataUrl });
      if (body?.ok && body.url) set('coverPhoto', body.url);
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
    const { status, body } = await adminSaveDraft(token, 'collections', editing ? item.id : null, values);
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
    <form onSubmit={handleSubmit} noValidate aria-label={editing ? 'Edit collection' : 'Add collection'} className="col-form">
      <h2 className="display col-form-title">{editing ? 'Edit collection' : 'Add collection'}</h2>

      <p className="ssga-field col-field">
        <label htmlFor="col-name">Name (required)</label>
        <input id="col-name" type="text" value={values.name} onChange={(e) => set('name', e.target.value)} disabled={saving} />
        {errors.name ? (
          <span role="alert" className="ssga-field-error">{errors.name}</span>
        ) : null}
      </p>

      <p className="ssga-field col-field">
        <label htmlFor="col-desc">Description</label>
        <textarea id="col-desc" rows={3} value={values.description} onChange={(e) => set('description', e.target.value)} disabled={saving} />
        {errors.description ? (
          <span role="alert" className="ssga-field-error">{errors.description}</span>
        ) : null}
      </p>

      <div className="col-cover">
        <p className="col-cover-label" id="col-cover-label">Cover photo</p>
        {errors.coverPhoto ? (
          <p role="alert" className="ssga-field-error">{errors.coverPhoto}</p>
        ) : null}
        {values.coverPhoto ? (
          <div className="col-cover-preview">
            <img src={values.coverPhoto} alt={`Cover of ${values.name || 'collection'}`} />
            <button type="button" className="col-cover-remove" aria-label="Remove cover photo" onClick={() => set('coverPhoto', '')} disabled={saving}>
              <XClose aria-hidden="true" width={16} height={16} />
            </button>
          </div>
        ) : null}
        <label className="col-upload">
          <input type="file" accept="image/*" onChange={handlePhoto} disabled={saving || uploading} />
          <span>{uploading ? 'Uploading...' : values.coverPhoto ? 'Replace photo' : 'Add a photo'}</span>
        </label>
      </div>

      <p className="col-visible">
        <label className="col-check">
          <input type="checkbox" checked={values.visible} onChange={(e) => set('visible', e.target.checked)} disabled={saving} />{' '}
          Visible on the site
        </label>
      </p>

      {generalError ? (
        <p role="alert" className="ssga-form-failure">{generalError}</p>
      ) : null}

      <div className="col-form-actions">
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

export function CollectionsPanel({ token, version, onAuthFail, notifyChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('list');
  const [editingItem, setEditingItem] = useState(null);
  const [confirmingId, setConfirmingId] = useState('');
  const [busyId, setBusyId] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    const { status, body } = await adminListCatalog(token, 'collections');
    setLoading(false);
    if (status === 401) {
      onAuthFail();
      return;
    }
    if (body?.ok) setItems(body.items);
    else setError(body?.error || 'Could not load collections.');
  }, [token, onAuthFail]);

  useEffect(() => {
    refresh();
  }, [refresh, version]);

  function changed() {
    notifyChange();
    refresh();
  }

  async function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const order = items.map((c) => c.id);
    [order[index], order[target]] = [order[target], order[index]];
    const { body } = await adminReorderCollections(token, order);
    if (body?.ok) changed();
    else setError(body?.error || 'Could not reorder.');
  }

  async function remove(id) {
    setBusyId(id);
    const { body } = await adminDeleteDraft(token, 'collections', id);
    setBusyId('');
    setConfirmingId('');
    if (body?.ok) changed();
    else setError(body?.error || 'Could not delete the collection.');
  }

  async function restore(id) {
    setBusyId(id);
    const { body } = await adminRestoreDraft(token, 'collections', id);
    setBusyId('');
    if (body?.ok) changed();
    else setError(body?.error || 'Could not restore the collection.');
  }

  if (mode !== 'list') {
    return (
      <div className="col-panel">
        <CollectionForm
          token={token}
          item={mode === 'edit' ? editingItem : null}
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
        <CollectionsStyles />
      </div>
    );
  }

  return (
    <div className="col-panel">
      <div className="col-toolbar">
        <p className="col-hint">
          Deleting a collection never deletes its products; they just leave the collection.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => setMode('add')}>
          <Plus aria-hidden="true" width={18} height={18} />
          Add collection
        </button>
      </div>

      {error ? (
        <p role="alert" className="ssga-form-failure">{error}</p>
      ) : null}
      {loading ? <p role="status">Loading collections...</p> : null}
      {!loading && items.length === 0 ? (
        <p className="col-empty">No collections yet. Tap Add collection to create the first one.</p>
      ) : null}

      <ul className="col-list">
        {items.map((item, index) => (
          <li key={item.id} className="col-row" data-removing={item.status === 'removing' || undefined}>
            <div className="col-row-order">
              <button
                type="button"
                aria-label={`Move ${item.name} up`}
                onClick={() => move(index, -1)}
                disabled={index === 0 || item.status === 'removing'}
              >
                <ChevronUp aria-hidden="true" width={18} height={18} />
              </button>
              <button
                type="button"
                aria-label={`Move ${item.name} down`}
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1 || item.status === 'removing'}
              >
                <ChevronDown aria-hidden="true" width={18} height={18} />
              </button>
            </div>
            <div className="col-row-main">
              <p className="col-row-name">
                {item.name} <StatusBadge status={item.status} />
                {item.visible === false ? <span className="col-hidden-tag">Hidden</span> : null}
              </p>
              {item.description ? <p className="col-row-desc">{item.description}</p> : null}
            </div>
            <div className="col-row-actions">
              {item.status === 'removing' ? (
                <button type="button" onClick={() => restore(item.id)} disabled={busyId === item.id}>
                  {busyId === item.id ? 'Restoring...' : 'Restore'}
                </button>
              ) : confirmingId === item.id ? (
                <span className="col-confirm" role="alert">
                  <span>Delete? Products are kept.</span>
                  <button type="button" onClick={() => remove(item.id)} disabled={busyId === item.id}>
                    {busyId === item.id ? 'Deleting...' : 'Yes, delete'}
                  </button>
                  <button type="button" onClick={() => setConfirmingId('')}>
                    Keep it
                  </button>
                </span>
              ) : (
                <span className="col-row-buttons">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem(item);
                      setMode('edit');
                    }}
                  >
                    Edit
                  </button>
                  <button type="button" onClick={() => setConfirmingId(item.id)}>
                    Delete
                  </button>
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      <CollectionsStyles />
    </div>
  );
}

function CollectionsStyles() {
  return (
    <style>{`
      .col-panel { max-width: 48rem; }
      .col-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
        margin: 0 0 1.25rem;
      }
      .col-hint { margin: 0; color: var(--text-muted); font-size: 0.9rem; max-width: 26rem; }
      .col-empty { color: var(--text-secondary); }
      .col-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
      }
      .col-row {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 0.85rem;
        align-items: center;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-left: 3px solid var(--brand);
        border-radius: var(--radius);
        padding: 0.75rem 1rem;
      }
      .col-row[data-removing] { opacity: 0.6; }
      .col-row-order { display: flex; flex-direction: column; gap: 0.25rem; }
      .col-row-order button {
        width: 44px;
        height: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
      }
      .col-row-name {
        margin: 0;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .col-hidden-tag {
        font-size: 0.68rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-muted);
        border: 1px dashed var(--border-strong);
        border-radius: var(--radius-sm);
        padding: 0.2rem 0.5rem;
      }
      .col-row-desc { margin: 0.2rem 0 0; font-size: 0.85rem; color: var(--text-muted); }
      .col-row-actions { min-width: 9rem; }
      .col-row-buttons { display: flex; gap: 0.5rem; }
      .col-row-buttons button { flex: 1; }
      .col-confirm {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        font-size: 0.85rem;
        color: var(--danger);
      }
      .col-confirm button { width: 100%; }
      .col-form { max-width: 30rem; }
      .col-form-title { font-size: 1.6rem; margin: 0 0 1.25rem; }
      .col-cover { margin: 0 0 1.1rem; }
      .col-cover-label {
        margin: 0 0 0.35rem;
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-secondary);
      }
      .col-cover-preview {
        position: relative;
        width: 10rem;
        height: 7rem;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-sm);
        overflow: hidden;
        margin: 0 0 0.6rem;
      }
      .col-cover-preview img { width: 100%; height: 100%; object-fit: cover; }
      .col-cover-preview .col-cover-remove {
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
      .col-upload {
        display: inline-flex;
        align-items: center;
        min-height: 48px;
        padding: 0 1.1rem;
        border: 1.5px dashed var(--border-strong);
        border-radius: var(--radius);
        cursor: pointer;
        font-weight: 600;
      }
      .col-upload:hover { border-color: var(--brand); color: var(--brand-dark); }
      .col-upload input {
        position: absolute;
        min-height: 0;
        padding: 0;
        border: 0;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
      }
      .col-check {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        min-height: 44px;
        font-weight: 500;
      }
      .col-form-actions { display: flex; gap: 0.85rem; flex-wrap: wrap; }
      @media (max-width: 599.98px) {
        .col-row { grid-template-columns: auto 1fr; }
        .col-row-actions { grid-column: 1 / -1; }
      }
    `}</style>
  );
}
