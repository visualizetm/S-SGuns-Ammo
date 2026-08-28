// The public maintenance page. Rendered for every public route while
// maintenance mode is on (see src/config/maintenance.js). It is deliberately
// standalone: no public navbar, no footer, no links into the storefront,
// because those pages are down.
//
// Customers who land here may still need the shop, so the page keeps a
// minimal contact fallback: shop name, a tel: link, and the address. The
// phone link is the only interactive element on the page.

import Phone01 from '@untitled-ui/icons-react/build/esm/Phone01';
import { BUSINESS } from '../content/siteFacts.js';
import {
  SICK_COMPUTER_SVG,
  MAINTENANCE_HEADLINE,
  MAINTENANCE_SUBLINE,
  MAINTENANCE_CONTACT_LEAD,
} from '../../shared/maintenanceArt.js';
import { usePageMeta } from '../lib/usePageMeta.js';

export function Maintenance() {
  usePageMeta('Website Down for Maintenance');

  return (
    <div className="mt-page">
      <main className="mt-inner">
        {/* Our own static SVG constant, shared with the edge middleware so
            both renderings stay identical. */}
        <div
          className="mt-art"
          dangerouslySetInnerHTML={{ __html: SICK_COMPUTER_SVG }}
        />

        <h1 className="mt-headline">{MAINTENANCE_HEADLINE}</h1>
        <p className="mt-sub">{MAINTENANCE_SUBLINE}</p>

        <div className="mt-contact">
          <p className="mt-contact-lead">{MAINTENANCE_CONTACT_LEAD}</p>
          <p className="mt-shop">{BUSINESS.name}</p>
          <a className="mt-phone" href={BUSINESS.phoneHref}>
            <Phone01 aria-hidden="true" width={20} height={20} />
            {BUSINESS.phoneDisplay}
          </a>
          <address className="mt-address">
            {BUSINESS.address.line1}
            <br />
            {BUSINESS.address.city}, {BUSINESS.address.state}{' '}
            {BUSINESS.address.zip}
          </address>
        </div>
      </main>

      <style>{`
        .mt-page {
          min-height: 100vh;
          background: #10110f;
          color: #f2ebdd;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 3rem 1.25rem;
        }
        .mt-inner {
          width: 100%;
          max-width: 34rem;
          text-align: center;
        }
        .mt-art { margin: 0 auto 2.25rem; max-width: 16rem; }
        .mt-art svg { width: 100%; height: auto; display: block; }
        .mt-headline {
          font-family: var(--font-display);
          font-weight: 700;
          text-transform: uppercase;
          line-height: 0.98;
          letter-spacing: 0.015em;
          font-size: clamp(2rem, 1.3rem + 3.4vw, 3.1rem);
          color: #f2ebdd;
          margin: 0 0 1rem;
        }
        .mt-sub {
          font-family: var(--font-body);
          font-size: 1.05rem;
          line-height: 1.6;
          color: #cfc9b9;
          margin: 0 auto 2.75rem;
          max-width: 26rem;
        }
        .mt-contact {
          border-top: 1px solid rgba(242, 235, 221, 0.18);
          padding-top: 1.75rem;
        }
        .mt-contact-lead {
          font-family: var(--font-body);
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: #a9a492;
          margin: 0 0 0.9rem;
        }
        .mt-shop {
          font-family: var(--font-display);
          font-weight: 700;
          text-transform: uppercase;
          font-size: 1.25rem;
          letter-spacing: 0.02em;
          margin: 0 0 0.5rem;
          color: #f2ebdd;
        }
        .mt-phone {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.55rem;
          min-height: 48px;
          padding: 0 0.5rem;
          font-family: var(--font-display);
          font-weight: 700;
          font-size: clamp(1.75rem, 1.2rem + 2.2vw, 2.35rem);
          letter-spacing: 0.01em;
          color: #f2ebdd;
          text-decoration: none;
          margin-bottom: 0.65rem;
        }
        .mt-phone:hover { color: #c9b58e; text-decoration: underline; }
        .mt-phone svg { flex-shrink: 0; color: #a45c38; }
        .mt-address {
          font-style: normal;
          font-family: var(--font-body);
          font-size: 0.95rem;
          line-height: 1.65;
          color: #a9a492;
          margin: 0;
        }
        @media (max-width: 480px) {
          .mt-page { padding: 2.25rem 1rem; }
          .mt-art { max-width: 12.5rem; margin-bottom: 1.75rem; }
        }
      `}</style>
    </div>
  );
}
