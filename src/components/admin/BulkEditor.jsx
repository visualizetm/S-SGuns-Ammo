// Bulk editor: spreadsheet-style table for fast product entry and editing,
// plus CSV import/export. Photo uploads stay in the regular product form.
// Everything written here is a DRAFT; the Publish bar controls going live.
// On phones the table scrolls horizontally with the name column pinned.

import { useCallback, useEffect, useRef, useState } from 'react';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import Save01 from '@untitled-ui/icons-react/build/esm/Save01';
import UploadCloud01 from '@untitled-ui/icons-react/build/esm/UploadCloud01';
import Download01 from '@untitled-ui/icons-react/build/esm/Download01';
import {
  adminListCatalog,
  adminSaveDraft,
  adminImportCsv,
  adminExportCsv,
} from '../../lib/apiClient.js';
import { CONDITIONS, STOCK_STATUSES } from '../../../shared/catalogValidation.js';
import { StatusBadge } from './StatusBadge.jsx';

const NEW_ROW = {
  id: null,
  status: 'new',
  name: '',
  collectionIds: [],
  manufacturer: '',
  model: '',
  caliber: '',
  condition: 'New',
  price: '',
  compareAtPrice: '',
  stockStatus: 'In Stock',
};

function toRow(item) {
  return {
    id: item.id,
    status: item.status,
    name: item.name,
    collectionIds: item.collectionIds || [],
    manufacturer: item.manufacturer,
    model: item.model,
    caliber: item.caliber || '',
    condition: item.condition,
    price: String(item.price),
    compareAtPrice: item.compareAtPrice == null ? '' : String(item.compareAtPrice),
    stockStatus: item.stockStatus,
  };
}

function rowKey(row, index) {
  return row.id || `new-${index}`;
}

export function BulkEditor({ token, version, onAuthFail, notifyChange }) {
  const [rows, setRows] = useState([]);
  const [original, setOriginal] = useState({});
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rowErrors, setRowErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState('');
  const [importReport, setImportReport] = useState(null);
  // One collections dropdown open at a time, keyed by row. Controlled
  // rendering (not native details): closed content must have no layout
  // boxes at all, and it keeps the table tidy on phones.
  const [openCollectionsRow, setOpenCollectionsRow] = useState(-1);
  const fileRef = useRef(null);
  const tableRef = useRef(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    const [products, cols] = await Promise.all([
      adminListCatalog(token, 'products'),
      adminListCatalog(token, 'collections'),
    ]);
    setLoading(false);
    if (products.status === 401 || cols.status === 401) {
      onAuthFail();
      return;
    }
    if (products.body?.ok) {
      const active = products.body.items.filter((i) => i.status !== 'removing');
      const mapped = active.map(toRow);
      setRows(mapped);
      const orig = {};
      mapped.forEach((r, i) => {
        orig[rowKey(r, i)] = JSON.stringify(r);
      });
      setOriginal(orig);
      setRowErrors({});
    } else {
      setError(products.body?.error || 'Could not load products.');
    }
    if (cols.body?.ok) setCollections(cols.body.items.filter((c) => c.status !== 'removing'));
  }, [token, onAuthFail]);

  useEffect(() => {
    refresh();
  }, [refresh, version]);

  function setCell(index, field, value) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function toggleRowCollection(index, id) {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const has = row.collectionIds.includes(id);
        return {
          ...row,
          collectionIds: has
            ? row.collectionIds.filter((c) => c !== id)
            : [...row.collectionIds, id],
        };
      })
    );
  }

  function isDirty(row, index) {
    return original[rowKey(row, index)] !== JSON.stringify(row);
  }

  const dirtyCount = rows.filter((row, i) => isDirty(row, i)).length;

  async function saveAll() {
    if (saving) return;
    setSaving(true);
    setError('');
    setSavedFlash('');
    const nextErrors = {};
    let savedCount = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!isDirty(row, i)) continue;
      const payload = {
        name: row.name,
        collectionIds: row.collectionIds,
        manufacturer: row.manufacturer,
        model: row.model,
        caliber: row.caliber,
        condition: row.condition,
        price: Number(row.price),
        compareAtPrice: row.compareAtPrice === '' ? null : Number(row.compareAtPrice),
        stockStatus: row.stockStatus,
      };
      const { status, body } = await adminSaveDraft(token, 'products', row.id, payload);
      if (status === 401) {
        onAuthFail();
        return;
      }
      if (body?.ok) {
        savedCount++;
      } else {
        nextErrors[rowKey(row, i)] = body?.errors || { row: body?.error || 'Could not save.' };
      }
    }
    setSaving(false);
    setRowErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      setSavedFlash(`Saved ${savedCount} row${savedCount === 1 ? '' : 's'} as drafts.`);
      setTimeout(() => setSavedFlash(''), 4000);
      notifyChange();
      refresh();
    } else {
      setError('Some rows need fixing. They are marked below; the rest saved.');
      if (savedCount > 0) notifyChange();
    }
  }

  // Enter moves down a cell like a spreadsheet; inputs keep native Tab.
  function handleKeyDown(event) {
    if (event.key !== 'Enter' || event.target.tagName === 'TEXTAREA') return;
    const cell = event.target.closest('[data-col]');
    const tr = event.target.closest('tr');
    if (!cell || !tr) return;
    event.preventDefault();
    const col = cell.dataset.col;
    const nextRow = tr.nextElementSibling;
    const target = nextRow?.querySelector(`[data-col="${col}"] input, [data-col="${col}"] select`);
    target?.focus();
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImportReport(null);
    setError('');
    const text = await file.text();
    const { status, body } = await adminImportCsv(token, text);
    if (status === 401) {
      onAuthFail();
      return;
    }
    if (body?.ok) {
      setImportReport(body);
      notifyChange();
      refresh();
    } else {
      setError(body?.error || 'That CSV could not be imported.');
    }
  }

  async function handleExport() {
    setError('');
    const { status, body } = await adminExportCsv(token);
    if (status === 401) {
      onAuthFail();
      return;
    }
    if (typeof body === 'string') {
      const blob = new Blob([body], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'products.csv';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      setError(body?.error || 'Export is not available right now.');
    }
  }

  return (
    <div className="blk-panel">
      <div className="blk-toolbar">
        <button type="button" className="btn btn-primary" onClick={saveAll} disabled={saving || dirtyCount === 0}>
          <Save01 aria-hidden="true" width={18} height={18} />
          {saving ? 'Saving...' : `Save ${dirtyCount || ''} change${dirtyCount === 1 ? '' : 's'}`}
        </button>
        <button type="button" className="blk-tool-btn" onClick={() => setRows((prev) => [...prev, { ...NEW_ROW }])}>
          <Plus aria-hidden="true" width={16} height={16} /> Add row
        </button>
        <label className="blk-import">
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleImport} />
          <span><UploadCloud01 aria-hidden="true" width={16} height={16} /> Import CSV</span>
        </label>
        <button type="button" className="blk-tool-btn" onClick={handleExport}>
          <Download01 aria-hidden="true" width={16} height={16} /> Export CSV
        </button>
        <a href="/bulk-template.csv" download className="blk-template">
          Template file
        </a>
      </div>

      <p className="blk-note">
        Every change here saves as a draft. Use the Publish bar above to put drafts on the site.
      </p>

      {savedFlash ? <p role="status" className="blk-flash">{savedFlash}</p> : null}
      {error ? (
        <p role="alert" className="ssga-form-failure">{error}</p>
      ) : null}

      {importReport ? (
        <div className="blk-report" role="status">
          <p>
            CSV import: {importReport.applied} row{importReport.applied === 1 ? '' : 's'} saved as drafts,{' '}
            {importReport.rejected} rejected.
          </p>
          {importReport.rejected > 0 ? (
            <ul>
              {importReport.results
                .filter((r) => !r.ok)
                .slice(0, 10)
                .map((r) => (
                  <li key={r.line}>
                    Line {r.line}: {Object.values(r.errors).join(' ')}
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {loading ? <p role="status">Loading products...</p> : null}
      {!loading && rows.length === 0 ? (
        <p className="blk-empty">No products yet. Tap Add row to start, or import the CSV template.</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="blk-scroll" ref={tableRef}>
          <table className="blk-table" onKeyDown={handleKeyDown}>
            {/* Fixed layout with explicit column widths: cells can never
                get narrower than their inputs, so nothing bleeds into a
                neighboring cell at any viewport. */}
            <colgroup>
              <col style={{ width: '13rem' }} />
              <col style={{ width: '11rem' }} />
              <col style={{ width: '9.5rem' }} />
              <col style={{ width: '8.5rem' }} />
              <col style={{ width: '7.5rem' }} />
              <col style={{ width: '7.5rem' }} />
              <col style={{ width: '7rem' }} />
              <col style={{ width: '7rem' }} />
              <col style={{ width: '9rem' }} />
              <col style={{ width: '9rem' }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="blk-pin">Name</th>
                <th scope="col">Collections</th>
                <th scope="col">Manufacturer</th>
                <th scope="col">Model</th>
                <th scope="col">Caliber</th>
                <th scope="col">Condition</th>
                <th scope="col">Price</th>
                <th scope="col">Compare-at</th>
                <th scope="col">Stock status</th>
                <th scope="col">State</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const errs = rowErrors[rowKey(row, index)];
                return (
                  <tr key={rowKey(row, index)} data-dirty={isDirty(row, index) || undefined}>
                    <td className="blk-pin" data-col="name">
                      <input
                        type="text"
                        value={row.name}
                        aria-label={`Name, row ${index + 1}`}
                        onChange={(e) => setCell(index, 'name', e.target.value)}
                      />
                      {errs ? (
                        <span role="alert" className="blk-cell-error">
                          {Object.values(errs).join(' ')}
                        </span>
                      ) : null}
                    </td>
                    <td data-col="collections">
                      <div className="blk-collections">
                        <button
                          type="button"
                          className="blk-collections-toggle"
                          aria-expanded={openCollectionsRow === index}
                          onClick={() =>
                            setOpenCollectionsRow(
                              openCollectionsRow === index ? -1 : index
                            )
                          }
                        >
                          {row.collectionIds.length === 0
                            ? 'None'
                            : row.collectionIds
                                .map((id) => collections.find((c) => c.id === id)?.name)
                                .filter(Boolean)
                                .join(', ') || `${row.collectionIds.length} picked`}
                        </button>
                        {openCollectionsRow === index ? (
                          <ul>
                            {collections.map((c) => (
                              <li key={c.id}>
                                <label>
                                  <input
                                    type="checkbox"
                                    checked={row.collectionIds.includes(c.id)}
                                    onChange={() => toggleRowCollection(index, c.id)}
                                  />{' '}
                                  {c.name}
                                </label>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </td>
                    <td data-col="manufacturer">
                      <input
                        type="text"
                        value={row.manufacturer}
                        aria-label={`Manufacturer, row ${index + 1}`}
                        onChange={(e) => setCell(index, 'manufacturer', e.target.value)}
                      />
                    </td>
                    <td data-col="model">
                      <input
                        type="text"
                        value={row.model}
                        aria-label={`Model, row ${index + 1}`}
                        onChange={(e) => setCell(index, 'model', e.target.value)}
                      />
                    </td>
                    <td data-col="caliber">
                      <input
                        type="text"
                        value={row.caliber}
                        aria-label={`Caliber, row ${index + 1}`}
                        onChange={(e) => setCell(index, 'caliber', e.target.value)}
                      />
                    </td>
                    <td data-col="condition">
                      <select
                        value={row.condition}
                        aria-label={`Condition, row ${index + 1}`}
                        onChange={(e) => setCell(index, 'condition', e.target.value)}
                      >
                        {CONDITIONS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td data-col="price">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.price}
                        aria-label={`Price, row ${index + 1}`}
                        onChange={(e) => setCell(index, 'price', e.target.value)}
                      />
                    </td>
                    <td data-col="compareAtPrice">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.compareAtPrice}
                        aria-label={`Compare-at price, row ${index + 1}`}
                        onChange={(e) => setCell(index, 'compareAtPrice', e.target.value)}
                      />
                    </td>
                    <td data-col="stockStatus">
                      <select
                        value={row.stockStatus}
                        aria-label={`Stock status, row ${index + 1}`}
                        onChange={(e) => setCell(index, 'stockStatus', e.target.value)}
                      >
                        {STOCK_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="blk-state">
                      {row.id ? <StatusBadge status={row.status} /> : <StatusBadge status="new" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <style>{`
        .blk-panel { max-width: 100%; }
        .blk-toolbar {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-wrap: wrap;
          margin: 0 0 0.75rem;
        }
        .blk-toolbar .btn { min-height: 44px; font-size: 1rem; }
        .blk-tool-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
        }
        .blk-tool-btn svg { flex-shrink: 0; }
        .blk-import {
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          padding: 0 0.9rem;
          border: 1.5px dashed var(--border-strong);
          border-radius: var(--radius);
          cursor: pointer;
          font-weight: 500;
          background: var(--bg-card);
        }
        .blk-import span {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
        }
        .blk-import:hover { border-color: var(--brand); color: var(--brand-dark); }
        .blk-import input {
          position: absolute;
          width: 1px;
          height: 1px;
          min-height: 0;
          padding: 0;
          border: 0;
          overflow: hidden;
          clip: rect(0 0 0 0);
        }
        .blk-template {
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          padding: 0 0.5rem;
        }
        .blk-note { margin: 0 0 1rem; color: var(--text-muted); font-size: 0.9rem; }
        .blk-flash { color: var(--brand-dark); font-weight: 600; }
        .blk-empty { color: var(--text-secondary); }
        .blk-report {
          border: 1px solid var(--border-strong);
          border-left: 3px solid var(--brand);
          border-radius: var(--radius);
          background: var(--bg-card);
          padding: 0.75rem 1rem;
          margin: 0 0 1rem;
        }
        .blk-report p { margin: 0 0 0.35rem; }
        .blk-report ul { margin: 0; padding-left: 1.1rem; color: var(--danger); }
        .blk-scroll {
          overflow-x: auto;
          border: 1px solid var(--border-strong);
          border-radius: var(--radius);
          background: var(--bg-card);
        }
        .blk-table {
          border-collapse: collapse;
          table-layout: fixed;
          min-width: 89rem;
          width: 100%;
        }
        .blk-table th, .blk-table td {
          border-bottom: 1px solid var(--border);
          border-right: 1px solid var(--border);
          padding: 0.35rem;
          text-align: left;
          vertical-align: top;
          background: var(--bg-card);
        }
        .blk-table th {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          padding: 0.6rem 0.5rem;
          white-space: nowrap;
        }
        .blk-table tr[data-dirty] td { background: color-mix(in srgb, var(--brand) 6%, var(--bg-card)); }
        .blk-pin {
          position: sticky;
          left: 0;
          z-index: 2;
          min-width: 13rem;
          box-shadow: 1px 0 0 var(--border-strong);
        }
        .blk-table input[type='text'], .blk-table select {
          width: 100%;
          min-width: 0;
          min-height: 44px;
          padding: 0.4rem 0.5rem;
          border-radius: var(--radius-sm);
        }
        .blk-cell-error {
          display: block;
          color: var(--danger);
          font-size: 0.78rem;
          margin-top: 0.25rem;
          max-width: 13rem;
        }
        .blk-state { min-width: 8rem; }
        .blk-collections .blk-collections-toggle {
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          width: 100%;
          padding: 0.4rem 0.5rem;
          border: 1.5px solid var(--border-strong);
          border-radius: var(--radius-sm);
          background: var(--bg-field);
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 400;
          text-align: left;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          display: block;
        }
        .blk-collections ul {
          list-style: none;
          margin: 0.35rem 0 0;
          padding: 0.35rem 0.6rem;
          border: 1px solid var(--border-strong);
          border-radius: var(--radius-sm);
          background: var(--bg-field);
        }
        .blk-collections label {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          min-height: 40px;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
