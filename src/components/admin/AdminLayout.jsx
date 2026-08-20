// AdminLayout: the admin is its own product-management application, not a
// page of the public marketing site. The public navbar and footer never
// render here. The surface is a neutral application dashboard, visibly
// distinct from the ivory storefront: a scoped set of CSS-token overrides on
// .admin-app swaps the storefront palette for clean light neutrals, while the
// brand accent stays reserved for primary actions and the active nav state.
// (The locked brand has no red, so the brand accent plays the "primary" role
// the app palette calls for.)
//
// Navigation, by viewport:
//   Desktop / wide tablet (>= 1024px): a fixed left sidebar with the submark,
//   the three page items (icon + label, active highlighted), the persistent
//   Publish control, and log out. The top bar shows the page title, a Draft
//   indicator, and View live site.
//
//   Phone / narrow tablet (< 1024px): a persistent bottom tab bar with the
//   three pages (Overview, Products, Quick Sale) is the PRIMARY navigation,
//   one-thumb reachable. A sticky top app bar shows the submark, the current
//   page title, a compact Publish button with the unpublished count (so
//   Publish is never buried), and a menu button that opens a slide-in drawer
//   carrying the SECONDARY items only: the full Publish/Discard control, View
//   live site, and Log out. The drawer closes on action, backdrop tap, and
//   Escape; it traps focus while open and returns focus to the menu button.
//   The two menus never compete: pages live in the tab bar, chrome actions in
//   the drawer.
//
// The bottom tab bar is deliberate fixed chrome; it is marked data-fixed-nav
// and the content region reserves matching bottom padding (data-fixed-nav-pad)
// so it never covers the last row of a list or a form's submit button. The
// responsive audit understands this pair and still fails if the padding is
// missing. Drawer/scrim animations respect prefers-reduced-motion.

import { useCallback, useEffect, useRef, useState } from 'react';
import BarChartSquare02 from '@untitled-ui/icons-react/build/esm/BarChartSquare02';
import Package from '@untitled-ui/icons-react/build/esm/Package';
import Tag01 from '@untitled-ui/icons-react/build/esm/Tag01';
import Menu01 from '@untitled-ui/icons-react/build/esm/Menu01';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import UploadCloud01 from '@untitled-ui/icons-react/build/esm/UploadCloud01';
import LinkExternal01 from '@untitled-ui/icons-react/build/esm/LinkExternal01';
import LogOut01 from '@untitled-ui/icons-react/build/esm/LogOut01';
import AlertCircle from '@untitled-ui/icons-react/build/esm/AlertCircle';
import CheckCircle from '@untitled-ui/icons-react/build/esm/CheckCircle';
import { adminPublishSummary, adminPublishAction } from '../../lib/apiClient.js';
import { LOGO_ASSETS, BUSINESS } from '../../content/siteFacts.js';

// The admin has exactly three top-level pages. Overview is the landing page
// (statistics), Products is the full catalog manager (its own sub-sections),
// and Quick Sale is the counter sales-logging tool.
export const ADMIN_SECTIONS = [
  { id: 'overview', label: 'Overview', icon: BarChartSquare02 },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'sales', label: 'Quick Sale', icon: Tag01 },
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuBtnRef = useRef(null);
  const drawerRef = useRef(null);

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

  // Drawer behavior: focus the first control on open, trap Tab inside, close
  // on Escape, and hand focus back to the menu button on close.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const drawer = drawerRef.current;
    const focusables = () =>
      drawer ? [...drawer.querySelectorAll('a[href], button:not([disabled])')] : [];
    focusables()[0]?.focus();

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      menuBtnRef.current?.focus();
    };
  }, [drawerOpen]);

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

  // The confirm banner renders under the top bar, so a drawer-launched action
  // closes the drawer first to leave the banner visible.
  function startConfirm(action, fromDrawer) {
    setConfirming(action);
    if (fromDrawer) setDrawerOpen(false);
  }

  function publishControl(variant) {
    const fromDrawer = variant === 'drawer';
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
            onClick={() => startConfirm('publish', fromDrawer)}
            disabled={busy || count === 0}
          >
            <UploadCloud01 aria-hidden="true" width={18} height={18} />
            Publish
          </button>
          <button
            type="button"
            className="btn btn-secondary admin-pub-btn"
            onClick={() => startConfirm('discard', fromDrawer)}
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
      {/* Sidebar (desktop and wide tablet only) */}
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
          <img
            className="admin-top-mark"
            src={LOGO_ASSETS.submarkSvg}
            alt=""
            aria-hidden="true"
            width={30}
            height={30}
            onError={(e) => {
              if (!e.currentTarget.src.endsWith(LOGO_ASSETS.submark))
                e.currentTarget.src = LOGO_ASSETS.submark;
            }}
          />
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
            {/* Mobile: Publish is always one tap away in the app bar. */}
            <button
              type="button"
              className="admin-top-pub"
              data-dirty={count > 0 ? 'true' : undefined}
              onClick={() => startConfirm('publish', false)}
              disabled={busy || count === 0}
              aria-label={
                count > 0
                  ? `Publish ${count} unpublished change${count === 1 ? '' : 's'}`
                  : 'Everything is published'
              }
            >
              {count > 0 ? (
                <>
                  <UploadCloud01 aria-hidden="true" width={17} height={17} />
                  <span className="admin-top-pub-count">{count}</span>
                </>
              ) : (
                <CheckCircle aria-hidden="true" width={17} height={17} />
              )}
            </button>
            <button
              type="button"
              ref={menuBtnRef}
              className="admin-menu-btn"
              aria-label="Open admin menu"
              aria-haspopup="dialog"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
            >
              <Menu01 aria-hidden="true" width={22} height={22} />
            </button>
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

        <main className="admin-main" data-fixed-nav-pad>{children}</main>
      </div>

      {/* Mobile drawer: secondary chrome actions only (never the three pages;
          those live in the bottom tab bar so the two menus never compete). */}
      {drawerOpen ? (
        <div className="admin-drawer-root">
          <div
            className="admin-scrim"
            aria-hidden="true"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className="admin-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Admin menu"
            id="admin-drawer"
            ref={drawerRef}
          >
            <div className="admin-drawer-head">
              <span className="admin-drawer-title">Menu</span>
              <button
                type="button"
                className="admin-drawer-close"
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
              >
                <XClose aria-hidden="true" width={20} height={20} />
              </button>
            </div>
            {publishControl('drawer')}
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="admin-drawer-link"
              onClick={() => setDrawerOpen(false)}
            >
              <LinkExternal01 aria-hidden="true" width={18} height={18} />
              View live site
            </a>
            <button
              type="button"
              className="admin-drawer-link"
              onClick={() => {
                setDrawerOpen(false);
                onLogout();
              }}
            >
              <LogOut01 aria-hidden="true" width={18} height={18} />
              Log out
            </button>
          </div>
        </div>
      ) : null}

      {/* Mobile bottom tab bar: the primary one-thumb page switcher. */}
      <nav className="admin-tabbar" aria-label="Admin pages" data-fixed-nav>
        {ADMIN_SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className="admin-tab"
            aria-current={activeTab === id ? 'page' : undefined}
            onClick={() => onSelectTab(id)}
          >
            <Icon aria-hidden="true" width={22} height={22} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

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
        .admin-top-mark { display: none; }
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
        /* Mobile-only chrome, hidden on desktop. */
        .admin-top-pub, .admin-menu-btn { display: none; }

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

        .admin-placeholder {
          padding: 2.5rem 1.5rem;
          text-align: center;
          color: var(--text-muted);
          border: 1px dashed var(--border-strong);
          border-radius: var(--radius);
          background: var(--bg-card);
        }

        /* Drawer + scrim (rendered only while open, mobile-only styling but
           harmless if opened on desktop resize edge cases). */
        .admin-drawer-root { position: fixed; inset: 0; z-index: 60; }
        .admin-scrim {
          position: absolute;
          inset: 0;
          background: color-mix(in srgb, #10110f 45%, transparent);
          animation: admin-fade-in 160ms ease-out;
        }
        .admin-drawer {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: min(20rem, 86vw);
          background: var(--bg-card, #ffffff);
          border-left: 1px solid var(--border, #dbe0e5);
          box-shadow: -12px 0 32px color-mix(in srgb, #10110f 18%, transparent);
          padding: 0.9rem 1rem calc(1rem + env(safe-area-inset-bottom, 0px));
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          overflow-y: auto;
          animation: admin-slide-in 200ms ease-out;
        }
        @keyframes admin-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes admin-slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .admin-scrim, .admin-drawer { animation: none; }
        }
        .admin-drawer-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding-bottom: 0.6rem;
          border-bottom: 1px solid var(--border, #dbe0e5);
        }
        .admin-drawer-title {
          font-family: var(--font-display);
          font-size: 1.15rem;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          font-weight: 700;
        }
        .admin-drawer-close {
          width: 44px;
          height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border-strong, #c4cbd3);
          border-radius: var(--radius);
          background: transparent;
          color: var(--text-secondary, #454b52);
          cursor: pointer;
        }
        .admin-drawer-link {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          min-height: 48px;
          padding: 0 0.75rem;
          border: 1px solid var(--border-strong, #c4cbd3);
          border-radius: var(--radius);
          background: var(--bg-card, #ffffff);
          color: var(--text-secondary, #454b52);
          font-weight: 600;
          font-size: 0.95rem;
          text-decoration: none;
          cursor: pointer;
          width: 100%;
          text-align: left;
        }
        .admin-drawer-link:hover { border-color: var(--brand); color: var(--brand-dark); }
        .admin-drawer-link svg { flex-shrink: 0; }

        /* Bottom tab bar: hidden on desktop, fixed on mobile. */
        .admin-tabbar { display: none; }

        /* ---- Phone and narrow tablet (< 1024px) ---- */
        @media (max-width: 1023.98px) {
          .admin-app {
            display: block;
            /* Reserve space so the fixed tab bar never covers page content
               even if a child skips its own padding. */
          }
          .admin-side { display: none; }
          .admin-top {
            padding: 0.6rem 0.9rem;
            gap: 0.6rem;
          }
          .admin-top-mark {
            display: block;
            flex-shrink: 0;
            border-radius: var(--radius-sm);
          }
          .admin-top-title {
            font-size: 1.2rem;
            min-width: 0;
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .admin-top-right { gap: 0.5rem; flex-shrink: 0; }
          .admin-draft, .admin-viewlive { display: none; }
          .admin-top-pub {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.3rem;
            min-width: 44px;
            min-height: 44px;
            padding: 0 0.6rem;
            border: 1px solid var(--border-strong);
            border-radius: var(--radius);
            background: var(--bg-card);
            color: var(--text-muted);
            font-weight: 700;
            font-size: 0.9rem;
            cursor: pointer;
          }
          .admin-top-pub[data-dirty='true'] {
            border-color: var(--brand);
            background: color-mix(in srgb, var(--brand) 12%, transparent);
            color: var(--brand-dark);
          }
          .admin-top-pub:disabled { cursor: default; }
          .admin-menu-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 44px;
            height: 44px;
            border: 1px solid var(--border-strong);
            border-radius: var(--radius);
            background: var(--bg-card);
            color: var(--text-secondary);
            cursor: pointer;
          }
          /* The top app bar is sticky here; a sticky banner at top: 0 would
             slide beneath it. Keep the banner in normal flow right under the
             bar instead; it appears where the tap just happened. */
          .admin-banner { position: static; padding: 0.6rem 0.9rem; }
          .admin-main {
            max-width: none;
            /* Bottom padding reserves the fixed tab bar's height plus
               breathing room (audited via data-fixed-nav-pad). */
            padding: 1rem 1rem calc(5.5rem + env(safe-area-inset-bottom, 0px));
          }

          .admin-tabbar {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 50;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            background: var(--bg-card, #ffffff);
            border-top: 1px solid var(--border, #dbe0e5);
            box-shadow: 0 -4px 16px color-mix(in srgb, #10110f 8%, transparent);
            padding-bottom: env(safe-area-inset-bottom, 0px);
          }
          .admin-tab {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 0.15rem;
            min-height: 58px;
            padding: 0.4rem 0.25rem;
            border: none;
            background: transparent;
            color: var(--text-muted, #6a7178);
            font-family: var(--font-body);
            font-size: 0.72rem;
            font-weight: 600;
            letter-spacing: 0.02em;
            cursor: pointer;
          }
          .admin-tab svg { flex-shrink: 0; }
          .admin-tab[aria-current='page'] {
            color: var(--brand-dark);
          }
          .admin-tab[aria-current='page'] svg { color: var(--brand); }
        }

        .admin-side :focus-visible, .admin-tabbar :focus-visible,
        .admin-drawer :focus-visible { outline-color: var(--brand); }
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
