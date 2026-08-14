import { NavLink, Outlet } from 'react-router-dom';
import Phone01 from '@untitled-ui/icons-react/build/esm/Phone01';
import MarkerPin01 from '@untitled-ui/icons-react/build/esm/MarkerPin01';
import { BUSINESS, PLACEHOLDERS } from '../data/business.js';

const NAV_ITEMS = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About' },
  { to: '/services', label: 'Services' },
  { to: '/transfers', label: 'Transfers & FAQ' },
  { to: '/contact', label: 'Contact' },
];

export function Layout() {
  return (
    <div className="ssga-app">
      <a href="#main" className="ssga-skip-link">
        Skip to content
      </a>
      <header className="ssga-header">
        <p className="ssga-wordmark">
          <NavLink to="/">{BUSINESS.name}</NavLink>
        </p>
        <nav aria-label="Main navigation">
          <ul className="ssga-nav">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <p className="ssga-header-call">
          <a href={BUSINESS.phoneHref}>
            <Phone01 aria-hidden="true" width={16} height={16} /> Call{' '}
            {BUSINESS.phoneDisplay}
          </a>
        </p>
      </header>

      <main id="main" className="ssga-main">
        <Outlet />
      </main>

      <footer className="ssga-footer">
        <p>{BUSINESS.name}</p>
        <address>
          {BUSINESS.address.line1}, {BUSINESS.address.city},{' '}
          {BUSINESS.address.state} {BUSINESS.address.zip}
        </address>
        <p>
          <a href={BUSINESS.phoneHref}>
            <Phone01 aria-hidden="true" width={16} height={16} />{' '}
            {BUSINESS.phoneDisplay}
          </a>
        </p>
        <p>
          <a
            href={BUSINESS.directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MarkerPin01 aria-hidden="true" width={16} height={16} /> Get
            directions
          </a>
        </p>
        <p>Hours: {PLACEHOLDERS.hours}</p>
        <p className="ssga-build-sha">Build {__COMMIT_SHA__}</p>
      </footer>
    </div>
  );
}
