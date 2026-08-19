// Product studio admin: the dashboard does ONE thing, manage the catalog.
// Tabs: Products, Collections, Bundles, Bulk Editor, plus the persistent
// Publish bar. All edits are drafts until published. Auth is checked
// server-side on every request (api/_lib/auth.js); the token held here is
// only a credential, never the gate itself.

import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Package from '@untitled-ui/icons-react/build/esm/Package';
import Grid01 from '@untitled-ui/icons-react/build/esm/Grid01';
import LayersThree01 from '@untitled-ui/icons-react/build/esm/LayersThree01';
import Rows01 from '@untitled-ui/icons-react/build/esm/Rows01';
import { adminLogin } from '../lib/apiClient.js';
import { usePageMeta } from '../lib/usePageMeta.js';
import { PublishBar } from '../components/admin/PublishBar.jsx';
import { ProductsPanel } from '../components/admin/ProductsPanel.jsx';
import { CollectionsPanel } from '../components/admin/CollectionsPanel.jsx';
import { BundlesPanel } from '../components/admin/BundlesPanel.jsx';
import { BulkEditor } from '../components/admin/BulkEditor.jsx';

const TOKEN_KEY = 'ssga-admin-token';

function LoginGate({ onToken }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    const { body } = await adminLogin(password);
    setSubmitting(false);
    if (body?.ok && body.token) {
      onToken(body.token);
    } else {
      setError(body?.error || 'Login failed. Try again.');
    }
  }

  return (
    <section className="wrap section" aria-labelledby="admin-login-heading">
      <h1 id="admin-login-heading" className="display">
        Admin login
      </h1>
      <form onSubmit={handleSubmit} noValidate aria-label="Admin login form">
        <p className="ssga-field">
          <label htmlFor="admin-password">Password (required)</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={submitting}
          />
          {error ? (
            <span role="alert" className="ssga-field-error">
              {error}
            </span>
          ) : null}
        </p>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </section>
  );
}

const TABS = [
  { id: 'products', label: 'Products', icon: Package },
  { id: 'collections', label: 'Collections', icon: Grid01 },
  { id: 'bundles', label: 'Bundles', icon: LayersThree01 },
  { id: 'bulk', label: 'Bulk Editor', icon: Rows01 },
];

export function Admin() {
  usePageMeta('Admin');
  const [token, setToken] = useState(
    () => sessionStorage.getItem(TOKEN_KEY) || ''
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const tab = TABS.some((t) => t.id === requested) ? requested : 'products';

  // Bumped after every draft write so the Publish bar and the open panel
  // stay in sync; bumped again after publish/discard so lists refresh.
  const [version, setVersion] = useState(0);
  const notifyChange = useCallback(() => setVersion((v) => v + 1), []);

  const handleToken = useCallback((next) => {
    sessionStorage.setItem(TOKEN_KEY, next);
    setToken(next);
  }, []);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken('');
  }, []);

  if (!token) {
    return <LoginGate onToken={handleToken} />;
  }

  const panelProps = { token, version, onAuthFail: handleLogout, notifyChange };

  return (
    <section className="wrap section" aria-labelledby="admin-heading">
      <div className="adm-top">
        <h1 id="admin-heading" className="display adm-title">
          Product studio
        </h1>
        <button type="button" onClick={handleLogout}>
          Log out
        </button>
      </div>

      <PublishBar
        token={token}
        version={version}
        onAuthFail={handleLogout}
        onPublished={notifyChange}
      />

      <nav aria-label="Admin sections" className="adm-tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className="adm-tab"
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setSearchParams(id === 'products' ? {} : { tab: id })}
          >
            <Icon aria-hidden="true" width={18} height={18} />
            {label}
          </button>
        ))}
      </nav>

      {tab === 'products' ? <ProductsPanel {...panelProps} /> : null}
      {tab === 'collections' ? <CollectionsPanel {...panelProps} /> : null}
      {tab === 'bundles' ? <BundlesPanel {...panelProps} /> : null}
      {tab === 'bulk' ? <BulkEditor {...panelProps} /> : null}

      <style>{`
        .adm-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          margin: 0 0 1.25rem;
        }
        .adm-title { margin: 0; }
        .adm-tabs {
          display: flex;
          gap: 0.25rem;
          margin: 0 0 1.5rem;
          border-bottom: 2px solid var(--border-strong);
          overflow-x: auto;
        }
        .adm-tabs .adm-tab {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          min-height: 48px;
          padding: 0 0.9rem;
          background: transparent;
          border: none;
          border-bottom: 3px solid transparent;
          border-radius: 0;
          font-family: var(--font-display);
          font-size: 1.1rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          cursor: pointer;
          white-space: nowrap;
          transition: color var(--duration-fast) var(--ease),
            border-color var(--duration-fast) var(--ease);
        }
        .adm-tabs .adm-tab:hover { color: var(--brand-dark); }
        .adm-tabs .adm-tab[aria-current='page'] {
          color: var(--text);
          border-bottom-color: var(--brand);
        }
      `}</style>
    </section>
  );
}
