// App chrome: sticky navbar (horizontal wordmark slot, five links, persistent
// "Call the Shop" CTA, accessible mobile drawer that closes on route change)
// and the dark heritage footer. Also owns scroll restoration and the global
// reveal-on-scroll observer.

import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import Phone01 from '@untitled-ui/icons-react/build/esm/Phone01';
import MarkerPin01 from '@untitled-ui/icons-react/build/esm/MarkerPin01';
import Mail01 from '@untitled-ui/icons-react/build/esm/Mail01';
import Menu02 from '@untitled-ui/icons-react/build/esm/Menu02';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import Clock from '@untitled-ui/icons-react/build/esm/Clock';
import { BUSINESS, HOURS_SUMMARY, LOGO_ASSETS } from '../content/siteFacts.js';
import { useReveal } from '../lib/useReveal.js';

const NAV_ITEMS = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About' },
  { to: '/services', label: 'Services' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/transfers', label: 'Transfers & FAQ' },
  { to: '/contact', label: 'Contact' },
];

// Horizontal wordmark slot. Rob supplies the real file; until then the
// business name renders as styled type in the same reserved footprint.
// Never generated logo art.
// Renders a logo SLOT by path (see LOGO_ASSETS). If the file is missing it
// falls back to the raster submark rather than breaking, then to the name.
function Wordmark({ className = '', src = LOGO_ASSETS.navbar, height = '2.1rem' }) {
  return (
    <img
      src={src}
      alt={BUSINESS.name}
      className={className}
      style={{ height, width: 'auto' }}
      onError={(e) => {
        const fallback = LOGO_ASSETS.submark;
        if (!e.currentTarget.src.endsWith(fallback)) e.currentTarget.src = fallback;
      }}
    />
  );
}

function Navbar() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const toggleRef = useRef(null);
  const drawerRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);

  // Close the drawer on every route change.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Scroll-lock the page while the drawer is open; return focus to the
  // toggle when it closes.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      const first = drawerRef.current?.querySelector('a, button');
      first?.focus();
    } else {
      document.body.style.overflow = '';
      toggleRef.current?.focus({ preventScroll: true });
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Escape closes; Tab wraps inside the drawer.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = drawerRef.current?.querySelectorAll('a, button');
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`nav-header${scrolled ? ' nav-header--scrolled' : ''}`}>
      <div className="wrap nav-bar">
        <NavLink to="/" className="nav-wordmark" onClick={close}>
          <Wordmark />
        </NavLink>

        <nav aria-label="Main navigation" className="nav-desktop">
          <ul className="nav-list">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className="nav-link">
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="nav-actions">
          <a href={BUSINESS.phoneHref} className="btn btn-primary nav-call">
            <Phone01 aria-hidden="true" width={18} height={18} />
            <span>Call the Shop</span>
          </a>
          <a
            href={BUSINESS.phoneHref}
            className="nav-call-compact"
            aria-label={`Call the Shop at ${BUSINESS.phoneDisplay}`}
          >
            <Phone01 aria-hidden="true" width={20} height={20} />
          </a>
          <button
            type="button"
            ref={toggleRef}
            className="nav-toggle"
            aria-expanded={open}
            aria-controls="nav-drawer"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            <Menu02 aria-hidden="true" width={22} height={22} />
          </button>
        </div>
      </div>

      {open ? (
        <div
          className="nav-drawer"
          id="nav-drawer"
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div className="wrap nav-drawer-top">
            <span className="nav-wordmark nav-wordmark--drawer">
              <Wordmark />
            </span>
            <button
              type="button"
              className="nav-toggle"
              aria-label="Close menu"
              onClick={close}
            >
              <XClose aria-hidden="true" width={22} height={22} />
            </button>
          </div>
          <nav aria-label="Mobile navigation" className="wrap">
            <ul className="nav-drawer-list">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className="nav-drawer-link"
                    onClick={close}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
            <div className="nav-drawer-ctas">
              <a href={BUSINESS.phoneHref} className="btn btn-primary">
                <Phone01 aria-hidden="true" width={18} height={18} />
                Call the Shop
              </a>
              <a
                href={BUSINESS.directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                <MarkerPin01 aria-hidden="true" width={18} height={18} />
                Get Directions
              </a>
            </div>
          </nav>
        </div>
      ) : null}

      <style>{`
        .nav-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: var(--bg);
          border-bottom: 1px solid var(--border);
          transition: box-shadow var(--duration) var(--ease);
        }
        .nav-header--scrolled {
          box-shadow: 0 2px 10px color-mix(in srgb, var(--ink) 10%, transparent);
        }
        .nav-bar {
          display: flex;
          align-items: center;
          gap: 1rem;
          min-height: var(--header-h);
        }
        .nav-wordmark {
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          font-family: var(--font-display);
          font-size: 1.45rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: var(--text);
          text-decoration: none;
          white-space: nowrap;
        }
        .nav-wordmark:hover { color: var(--brand-dark); }
        /* The horizontal logo art is ivory (built for dark grounds); darken
           it to near-black ink for the light navbar and drawer. */
        .nav-wordmark img { filter: brightness(0); }
        .nav-desktop { margin-left: auto; }
        .nav-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          gap: 0.25rem;
        }
        .nav-link {
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          min-width: 44px;
          padding: 0 0.8rem;
          font-family: var(--font-display);
          font-size: 1.05rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-secondary);
          text-decoration: none;
          border-bottom: 2px solid transparent;
          white-space: nowrap;
          transition: color var(--duration-fast) var(--ease),
            border-color var(--duration-fast) var(--ease);
        }
        .nav-link:hover { color: var(--brand-dark); }
        .nav-link[aria-current='page'] {
          color: var(--text);
          border-bottom-color: var(--brand);
        }
        .nav-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .nav-call { min-height: 44px; font-size: 1rem; }
        .nav-call-compact {
          display: none;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border: 1.5px solid var(--border-strong);
          border-radius: var(--radius);
          color: var(--brand);
        }
        .nav-toggle {
          display: none;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          padding: 0;
          background: transparent;
          border: 1.5px solid var(--border-strong);
          border-radius: var(--radius);
          color: var(--text);
          cursor: pointer;
        }
        .nav-toggle {
          transition: border-color var(--duration-fast) var(--ease),
            color var(--duration-fast) var(--ease);
        }
        .nav-toggle:hover { border-color: var(--brand); color: var(--brand-dark); }
        .nav-toggle:active { transform: translateY(1px); }
        .nav-drawer {
          position: fixed;
          inset: 0;
          z-index: 120;
          background: var(--bg);
          overflow-y: auto;
        }
        .nav-drawer-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: var(--header-h);
          border-bottom: 1px solid var(--border);
          margin-bottom: 1.5rem;
        }
        .nav-drawer .nav-toggle { display: inline-flex; }
        .nav-drawer-list {
          list-style: none;
          margin: 0 0 2rem;
          padding: 0;
        }
        .nav-drawer-link {
          display: flex;
          align-items: center;
          min-height: 52px;
          font-family: var(--font-display);
          font-size: 1.9rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: var(--text);
          text-decoration: none;
          border-bottom: 1px solid var(--border);
        }
        .nav-drawer-link:hover { color: var(--brand-dark); }
        .nav-drawer-link[aria-current='page'] { color: var(--brand); }
        .nav-drawer-ctas {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          max-width: 22rem;
          padding-bottom: 2rem;
        }
        /* Mobile chrome below 1024: with five nowrap links plus wordmark
           and CTA, the desktop row only provably fits from 1024 up (even
           on fallback fonts, with the tightened padding below). */
        @media (max-width: 1023.98px) {
          .nav-desktop, .nav-call { display: none; }
          .nav-actions { margin-left: auto; }
          .nav-call-compact { display: inline-flex; }
          .nav-toggle { display: inline-flex; }
        }
        @media (min-width: 1024px) and (max-width: 1199.98px) {
          .nav-link { padding: 0 0.5rem; font-size: 1rem; }
          .nav-bar { gap: 0.75rem; }
        }
        /* Narrowest desktop band: compact call icon instead of the full
           CTA so the row fits even when web fonts fail to load. */
        @media (min-width: 1024px) and (max-width: 1099.98px) {
          .nav-call { display: none; }
          .nav-call-compact { display: inline-flex; }
        }
      `}</style>
    </header>
  );
}

function Footer() {
  return (
    <footer className="ft-footer grain">
      <div className="wrap ft-grid">
        <div className="ft-brand">
          <span className="ft-wordmark">
            <Wordmark src={LOGO_ASSETS.footer} height="4.25rem" />
          </span>
          <p className="ft-tagline">
            Family-owned firearms and ammunition shop in Oxford, Pennsylvania.
          </p>
          <address className="ft-address">
            {BUSINESS.address.line1}
            <br />
            {BUSINESS.address.city}, {BUSINESS.address.state}{' '}
            {BUSINESS.address.zip}
          </address>
        </div>

        <nav aria-label="Footer navigation" className="ft-col">
          <h2 className="ft-heading">Pages</h2>
          <ul className="ft-links">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ft-col">
          <h2 className="ft-heading">Visit</h2>
          <p className="ft-line">
            <Phone01 aria-hidden="true" width={16} height={16} />
            <a href={BUSINESS.phoneHref}>Call {BUSINESS.phoneDisplay}</a>
          </p>
          <p className="ft-line">
            <MarkerPin01 aria-hidden="true" width={16} height={16} />
            <a
              href={BUSINESS.directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Get Directions
            </a>
          </p>
          <p className="ft-line">
            <Mail01 aria-hidden="true" width={16} height={16} />
            <a href={BUSINESS.emailHref}>{BUSINESS.emailDisplay}</a>
          </p>
          <p className="ft-line ft-hours">
            <Clock aria-hidden="true" width={16} height={16} />
            <span>{HOURS_SUMMARY}</span>
          </p>
        </div>
      </div>

      <div className="wrap ft-bottom">
        <p className="ft-copyright">
          {new Date().getFullYear()} {BUSINESS.name}. All rights reserved.
        </p>
        <p className="ssga-build-sha">Build {__COMMIT_SHA__}</p>
      </div>

      <style>{`
        .ft-footer {
          background: var(--surface-dark);
          color: var(--text-on-dark-secondary);
          border-top: 3px solid var(--brand);
          padding-top: 3.5rem;
        }
        .ft-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1.4fr;
          gap: 2.5rem;
          padding-bottom: 2.5rem;
        }
        .ft-wordmark {
          display: inline-block;
          font-family: var(--font-display);
          font-size: 1.5rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: var(--text-on-dark);
          margin-bottom: 0.75rem;
        }
        /* The footer emblem is near-black ink; invert it to read on the dark
           footer ground. */
        .ft-wordmark img { filter: invert(1) brightness(0.97); }
        .ft-tagline { max-width: 20rem; }
        .ft-address {
          font-style: normal;
          color: var(--text-on-dark-secondary);
          line-height: 1.7;
        }
        .ft-heading {
          font-size: 0.8rem;
          font-family: var(--font-body);
          font-weight: 600;
          letter-spacing: var(--track-label);
          color: var(--text-on-dark-muted);
          margin-bottom: 0.9rem;
        }
        .ft-links {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .ft-links a {
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          text-decoration: none;
        }
        .ft-links a:hover { text-decoration: underline; }
        .ft-line {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0 0 0.35rem;
        }
        .ft-line svg { flex-shrink: 0; }
        .ft-line a {
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          text-decoration: none;
        }
        .ft-line a:hover { text-decoration: underline; }
        .ft-hours { align-items: flex-start; }
        .ft-hours svg { margin-top: 0.7rem; }
        .ft-hours > span { padding: 0.5rem 0; }
        .ft-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          border-top: 1px solid color-mix(in srgb, var(--ivory) 14%, transparent);
          padding-top: 1.25rem;
          padding-bottom: 1.5rem;
        }
        .ft-copyright { margin: 0; font-size: 0.85rem; }
        @media (max-width: 899.98px) {
          .ft-grid { grid-template-columns: 1fr; gap: 2rem; }
        }
      `}</style>
    </footer>
  );
}

export function Layout() {
  const location = useLocation();
  useReveal(location.pathname);

  // Scroll restoration: top on route change, or to the anchor if a hash is
  // present (React Router does not do this for SPAs by itself).
  useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) {
        el.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  return (
    <div className="ssga-app">
      <a href="#main" className="ssga-skip-link">
        Skip to content
      </a>
      <Navbar />
      <main id="main" className="ssga-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
