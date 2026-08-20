// AdminLayout: the admin is its own product-management application, not a
// page of the public marketing site. The public navbar and footer never
// render here. The surface is a neutral application dashboard, visibly
// distinct from the ivory storefront: a scoped set of CSS-token overrides on
// .admin-app swaps the storefront palette for clean light neutrals, while the
// brand accent (Field Olive) stays reserved for primary actions and the
// active nav state. The locked brand has no red, so the brand accent plays
// the "primary" role the app palette calls for.
//
// Desktop: a fixed left sidebar (submark, section nav, a persistent Publish
// control, log out). Mobile: a bottom tab bar for sections and a sticky
// Publish bar, both reachable without scrolling. A top bar shows the current
// section title, a Draft indicator, and a View live site link.
//
// This is a UI restructure only. Auth, drafts/publish, and every panel keep
// their existing behavior.

import { useCallback, useEffect, useState } from 'react';
import Package from '@untitled-ui/icons-react/build/esm/Package';
import Grid01 from '@untitled-ui/icons-react/build/esm/Grid01';
import LayersThree01 from '@untitled-ui/icons-react/build/esm/LayersThree01';
import Rows01 from '@untitled-ui/icons-react/build/esm/Rows01';
import UploadCloud01 from '@untitled-ui/icons-react/build/esm/UploadCloud01';
import LinkExternal01 from '@untitled-ui/icons-react/build/esm/LinkExternal01';
import LogOut01 from '@untitled-ui/icons-react/build/esm/LogOut01';
import AlertCircle from '@untitled-ui/icons-react/build/esm/AlertCircle';
import CheckCircle from '@untitled-ui/icons-react/build/esm/CheckCircle';
import { adminPublishSummary, adminPublishAction } from '../../lib/apiClient.js';
import { LOGO_ASSETS, BUSINESS } from '../../content/siteFacts.js';

export const ADMIN_SECTIONS = [
  { id: 'products', label: 'Products', icon: Package },
  { id: 'collections', label: 'Collections', icon: Grid01 },
  { id: 'bundles', label: 'Bundles', icon: LayersThree01 },
  { id: 'bulk', label: 'Bulk Editor', icon: Rows01 },
];

export function AdminLayout({
  activeTab,
  onSelectTab,
  token,
  version,
  notifyChange,
  onLogout,
  children,
}) {
  const [summary, setSummary] = useState(null);
  const [confirming, setConfirming] = useState(''); // '' | 'publish' | 'discard'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const refresh = useCallback(async () => {
    const { status, body } = await adminPublishSummary(token);
    if (status === 401) {
      onLogout();
      return;
    }
    if (body?.ok) setSummary(body.summary);
  }, [token, onLogout]);

  useEffect(() => {
    refresh();
  }, [refresh, version]);

  async function run(action) {
    setBusy(true);
    setError('');
    const { status, body } = await adminPublishAction(token, action);
    setBusy(false);
    setConfirming('');
    if (status === 401) {
      onLogout();
      return;
    }
    if (body?.ok) {
      setSummary(body.summary);
      setFlash(
        action === 'publish'
          ? 'Published. The site is up to date.'
          : 'Changes discarded.'
      );
      setTimeout(() => setFlash(''), 4000);
      notifyChange();
    } else {
      setError(body?.error || 'That did not go through. Try again.');
    }
  }

  const section = ADMIN_SECTIONS.find((s) => s.id === activeTab) || ADMIN_SECTIONS[0];
  const count = summary?.total ?? 0;

  function publishControl(variant) {
    return (
      <div className={`admin-pub admin-pub--${variant}`}>
        <p className="admin-pub-count">
          {count > 0 ? (
            <strong>
              {count} unpublished change{count === 1 ? '' : 's'}
            </strong>
          ) : (
            'Everything is published.'
          )}
        </p>
        <div className="admin-pub-actions">
          <button
            type="button"
            className="btn btn-primary admin-pub-btn"
            onClick={() => setConfirming('publish')}
            disabled={busy || count === 0}
          >
            <UploadCloud01 aria-hidden="true" width={18} height={18} />
            Publish
          </button>
          <button
            type="button"
            className="btn btn-secondary admin-pub-btn"
            onClick={() => setConfirming('discard')}
            disabled={busy || count === 0}
          >
            Discard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-app">
      {/* Sidebar (desktop) */}
      <aside className="admin-side" aria-label="Admin navigation">
        <div className="admin-brand">
          <img
            src={LOGO_ASSETS.submarkSvg}
            alt={BUSINESS.name}
            width={40}
            height={40}
            onError={(e) => {
              if (!e.currentTarget.src.endsWith(LOGO_ASSETS.submark))
                e.currentTarget.src = LOGO_ASSETS.submark;
            }}
          />
          <span className="admin-brand-text">
            <span className="admin-brand-name">S&amp;S</span>
            <span className="admin-brand-sub">Product Manager</span>
          </span>
        </div>

        <nav className="admin-nav" aria-label="Sections">
          {ADMIN_SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className="admin-nav-item"
              aria-current={activeTab === id ? 'page' : undefined}
              onClick={() => onSelectTab(id)}
            >
              <Icon aria-hidden="true" width={20} height={20} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="admin-side-foot">
          {publishControl('side')}
          <button type="button" className="admin-logout" onClick={onLogout}>
            <LogOut01 aria-hidden="true" width={18} height={18} />
            Log out
          </button>
        </div>
      </aside>

      {/* Body: top bar + content */}
      <div className="admin-body">
        <header className="admin-top">
          <h1 className="admin-top-title">{section.label}</h1>
          <div className="admin-top-right">
            <span className="admin-draft" data-dirty={count > 0 ? 'true' : undefined}>
              {count > 0 ? (
                <>
                  <AlertCircle aria-hidden="true" width={16} height={16} />
                  {count} draft{count === 1 ? '' : 's'} pending
                </>
              ) : (
                <>
                  <CheckCircle aria-hidden="true" width={16} height={16} />
                  All published
                </>
              )}
            </span>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="admin-viewlive"
            >
              <LinkExternal01 aria-hidden="true" width={16} height={16} />
              <span>View live site</span>
            </a>
          </div>
        </header>

        {(confirming || error || flash) ? (
          <div className="admin-banner" role="status">
            {flash ? <p className="admin-flash">{flash}</p> : null}
            {error ? <p className="admin-error" role="alert">{error}</p> : null}
            {confirming ? (
              <div className="admin-confirm" role="alert">
                <span>
                  {confirming === 'publish'
                    ? 'Put all unpublished changes on the public site?'
                    : 'Throw away all unpublished changes?'}
                </span>
                <span className="admin-confirm-actions">
                  <button
                    type="button"
                    className="btn btn-primary admin-pub-btn"
                    onClick={() => run(confirming)}
                    disabled={busy}
                  >
                    {busy
                      ? 'Working...'
                      : confirming === 'publish'
                        ? 'Yes, publish'
                        : 'Yes, discard'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary admin-pub-btn"
                    onClick={() => setConfirming('')}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        <main className="admin-main">{children}</main>
      </div>

      <style>{`
        .admin-app {
          /* Neutral application surface: distinct from the ivory storefront.
             Brand accent (olive) stays for primary actions and active nav. */
          --bg: #eef0f2;
          --bg-deep: #e7eaed;
          --bg-card: #ffffff;
          --bg-field: #ffffff;
          --border: #dbe0e5;
          --border-strong: #c4cbd3;
          --text-secondary: #454b52;
          --text-muted: #6a7178;

          min-height: 100vh;
          display: grid;
          grid-template-columns: 244px 1fr;
          background: var(--bg);
          color: var(--text);
        }
        .admin-side {
          position: sticky;
          top: 0;
          align-self: start;
          height: 100vh;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 1.1rem 0.9rem;
          background: var(--bg-card);
          border-right: 1px solid var(--border);
        }
        .admin-brand {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.25rem 0.5rem 0.9rem;
          border-bottom: 1px solid var(--border);
          margin-bottom: 0.5rem;
        }
        .admin-brand img { border-radius: var(--radius); }
        .admin-brand-text { display: flex; flex-direction: column; line-height: 1.1; }
        .admin-brand-name {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 1.35rem;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .admin-brand-sub {
          font-size: 0.72rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--text-muted);
        }
        .admin-nav { display: flex; flex-direction: column; gap: 0.2rem; }
        .admin-nav-item {
          display: flex;
          align-items: center;
          gap: 0.7rem;
          width: 100%;
          min-height: 44px;
          padding: 0 0.75rem;
          border: none;
          border-radius: var(--radius);
          background: transparent;
          color: var(--text-secondary);
          font-family: var(--font-body);
          font-size: 0.98rem;
          font-weight: 600;
          text-align: left;
          cursor: pointer;
          transition: background-color var(--duration-fast) var(--ease),
            color var(--duration-fast) var(--ease);
        }
        .admin-nav-item:hover { background: var(--bg-deep); color: var(--text); }
        .admin-nav-item svg { flex-shrink: 0; color: var(--text-muted); }
        .admin-nav-item[aria-current='page'] {
          background: color-mix(in srgb, var(--brand) 14%, transparent);
          color: var(--brand-dark);
        }
        .admin-nav-item[aria-current='page'] svg { color: var(--brand); }
        .admin-side-foot { margin-top: auto; display: flex; flex-direction: column; gap: 0.6rem; }
        .admin-pub {
          border: 1px solid var(--border-strong);
          border-left: 3px solid var(--brand);
          border-radius: var(--radius);
          background: var(--bg-deep);
          padding: 0.7rem 0.75rem;
        }
        .admin-pub-count { margin: 0 0 0.5rem; font-size: 0.9rem; }
        .admin-pub-actions { display: flex; flex-direction: column; gap: 0.4rem; }
        .admin-pub-btn { min-height: 44px; font-size: 0.95rem; }
        .admin-logout {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          min-height: 44px;
          border: 1px solid var(--border-strong);
          border-radius: var(--radius);
          background: var(--bg-card);
          color: var(--text-secondary);
          font-weight: 600;
          cursor: pointer;
        }
        .admin-logout:hover { border-color: var(--brand); color: var(--brand-dark); }

        .admin-body { display: flex; flex-direction: column; min-width: 0; }
        .admin-top {
          position: sticky;
          top: 0;
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.85rem 1.5rem;
          background: var(--bg-card);
          border-bottom: 1px solid var(--border);
        }
        .admin-top-title {
          margin: 0;
          font-family: var(--font-display);
          font-size: 1.5rem;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .admin-top-right { display: flex; align-items: center; gap: 0.85rem; }
        .admin-draft {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.82rem;
          font-weight: 600;
          padding: 0.3rem 0.6rem;
          border-radius: 999px;
          border: 1px solid var(--border-strong);
          color: var(--text-muted);
          white-space: nowrap;
        }
        .admin-draft svg { flex-shrink: 0; color: var(--brand); }
        .admin-draft[data-dirty='true'] {
          color: var(--accent-fall);
          border-color: color-mix(in srgb, var(--accent-fall) 55%, transparent);
          background: color-mix(in srgb, var(--accent-fall) 8%, transparent);
        }
        .admin-draft[data-dirty='true'] svg { color: var(--accent-fall); }
        .admin-viewlive {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          min-height: 44px;
          padding: 0 0.75rem;
          border: 1px solid var(--border-strong);
          border-radius: var(--radius);
          text-decoration: none;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-secondary);
          white-space: nowrap;
        }
        .admin-viewlive:hover { border-color: var(--brand); color: var(--brand-dark); }

        .admin-banner {
          position: sticky;
          top: 0;
          z-index: 15;
          padding: 0.6rem 1.5rem;
          background: var(--bg-deep);
          border-bottom: 1px solid var(--border);
        }
        .admin-flash { margin: 0; color: var(--brand-dark); font-weight: 600; }
        .admin-error { margin: 0; color: var(--danger); font-weight: 600; }
        .admin-confirm {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .admin-confirm-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

        .admin-main {
          flex: 1;
          width: 100%;
          max-width: 74rem;
          margin: 0 auto;
          padding: 1.5rem;
        }

        /* Mobile: the sidebar becomes a normal-flow top strip (nothing is
           position:fixed, so nothing overlays the panels). Brand, a
           horizontally scrollable section nav, and the Publish control all
           sit above the content and are reachable without scrolling. */
        @media (max-width: 899.98px) {
          .admin-app { display: block; }
          .admin-side {
            position: static;
            height: auto;
            flex-direction: column;
            gap: 0.6rem;
            padding: 0.85rem 1rem;
            border-right: none;
            border-bottom: 1px solid var(--border);
          }
          .admin-brand { margin-bottom: 0; padding-bottom: 0.6rem; }
          .admin-nav {
            flex-direction: row;
            gap: 0.4rem;
            overflow-x: auto;
            padding-bottom: 0.15rem;
          }
          .admin-nav-item { flex: 0 0 auto; white-space: nowrap; }
          .admin-side-foot { margin-top: 0; flex-direction: column; gap: 0.5rem; }
          .admin-pub-actions { flex-direction: row; }
          .admin-pub-actions .admin-pub-btn { flex: 1; }
          .admin-top {
            position: static;
            padding: 0.75rem 1rem;
            gap: 0.75rem;
          }
          .admin-top-title { font-size: 1.25rem; min-width: 0; }
          /* The Publish control in the top strip already shows the
             unpublished count on mobile, so the top-bar draft pill is
             redundant and only crowds the row. Hide it here; the top bar
             keeps just the section title and View live site. */
          .admin-draft { display: none; }
          .admin-viewlive { flex-shrink: 0; }
          .admin-main { padding: 1rem 1rem 2.5rem; max-width: none; }
        }

        .admin-side :focus-visible { outline-color: var(--brand); }
      `}</style>
    </div>
  );
}

// App-styled login: the neutral admin surface, never the storefront chrome.
export function AdminLogin({ onSubmit, error, submitting }) {
  const [password, setPassword] = useState('');

  return (
    <div className="admin-app admin-app--login">
      <div className="admin-login-card">
        <div className="admin-login-brand">
          <img
            src={LOGO_ASSETS.submarkSvg}
            alt={BUSINESS.name}
            width={52}
            height={52}
            onError={(e) => {
              if (!e.currentTarget.src.endsWith(LOGO_ASSETS.submark))
                e.currentTarget.src = LOGO_ASSETS.submark;
            }}
          />
          <span className="admin-brand-name">S&amp;S Product Manager</span>
          <span className="admin-brand-sub">Staff sign in</span>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!submitting) onSubmit(password);
          }}
          noValidate
          aria-label="Admin login form"
        >
          <p className="admin-login-field">
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={submitting}
            />
            {error ? (
              <span role="alert" className="admin-login-error">
                {error}
              </span>
            ) : null}
          </p>
          <button type="submit" className="btn btn-primary admin-login-btn" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
      <style>{`
        .admin-app--login {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          background: var(--bg, #eef0f2);
        }
        .admin-login-card {
          width: 100%;
          max-width: 24rem;
          background: #ffffff;
          border: 1px solid #dbe0e5;
          border-radius: var(--radius-lg);
          padding: 1.75rem;
          box-shadow: 0 6px 24px color-mix(in srgb, #10110f 8%, transparent);
        }
        .admin-login-brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 0.3rem;
          margin-bottom: 1.5rem;
        }
        .admin-login-brand img { border-radius: var(--radius); margin-bottom: 0.35rem; }
        .admin-login-field { display: flex; flex-direction: column; gap: 0.4rem; margin: 0 0 1rem; }
        .admin-login-field label { font-weight: 600; font-size: 0.9rem; }
        .admin-login-error { color: var(--danger); font-weight: 500; font-size: 0.9rem; }
        .admin-login-btn { width: 100%; min-height: 46px; }
      `}</style>
    </div>
  );
}
