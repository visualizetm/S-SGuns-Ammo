// Services: one clean card per confirmed service, data-driven. Informational
// only: no prices, no e-commerce, no Buy Now. Unconfirmed services stay
// hidden (see src/data/services.js).

import { Link } from 'react-router-dom';
import Phone01 from '@untitled-ui/icons-react/build/esm/Phone01';
import Mail01 from '@untitled-ui/icons-react/build/esm/Mail01';
import { usePageMeta } from '../lib/usePageMeta.js';
import {
  BUSINESS,
  CONFIRMED_SERVICES,
  PAGE_META,
} from '../content/siteFacts.js';

export function Services() {
  usePageMeta(PAGE_META.services.title, PAGE_META.services.description);

  return (
    <>
      <section className="svc-head" aria-labelledby="services-heading">
        <div className="wrap reveal">
          <p className="eyebrow">At the shop</p>
          <h1 id="services-heading" className="display svc-title">
            Services
          </h1>
          <p className="svc-lede">
            What we do at the counter, in plain terms. Call the shop for
            current stock and details on any of it.
          </p>
        </div>
        <style>{`
          .svc-head {
            border-bottom: 1px solid var(--border);
            padding: 3.5rem 0 3rem;
          }
          .svc-title {
            font-size: clamp(2.3rem, 1.5rem + 3.6vw, 4rem);
            margin: 0 0 0.75rem;
          }
          .svc-lede {
            font-size: 1.1rem;
            color: var(--text-secondary);
            max-width: 36rem;
            margin: 0 0 1.25rem;
          }
        `}</style>
      </section>

      <section className="svc-list section" aria-label="Service list">
        <div className="wrap">
          {/* The counter book: each confirmed service is a ruled ledger row.
              No numbering; the list is not a sequence. */}
          <ul className="ledger svc-ledger stagger">
            {CONFIRMED_SERVICES.map((service) => (
              <li key={service.id} className="ledger-row svc-row">
                <h2 className="ledger-row-title svc-row-title">
                  {service.title}
                </h2>
                <p className="ledger-row-desc">{service.description}</p>
                <p className="svc-row-note">
                  <a href={BUSINESS.phoneHref}>Call to ask</a>
                </p>
              </li>
            ))}
          </ul>
        </div>
        <style>{`
          .svc-ledger { max-width: 62rem; }
          .svc-row-title { font-size: 1.7rem; }
          .svc-row-note {
            margin: 0;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            white-space: nowrap;
          }
          .svc-row-note a { text-decoration-thickness: 1.5px; }
          @media (max-width: 767.98px) {
            .svc-row-note { display: none; }
          }
        `}</style>
      </section>

      <section
        className="svc-cta band-dark grain section"
        aria-labelledby="svc-cta-heading"
      >
        <div className="wrap svc-cta-inner reveal">
          <div>
            <h2 id="svc-cta-heading" className="display section-title">
              Not sure? Just ask.
            </h2>
            <p className="svc-cta-body">
              If you do not see what you need, call the shop or stop in and we
              will point you in the right direction.
            </p>
          </div>
          <div className="svc-cta-btns">
            <a href={BUSINESS.phoneHref} className="btn svc-cta-call">
              <Phone01 aria-hidden="true" width={18} height={18} />
              Call the Shop
            </a>
            <Link to="/contact" className="btn btn-secondary">
              <Mail01 aria-hidden="true" width={18} height={18} />
              Contact S&S
            </Link>
          </div>
        </div>
        <style>{`
          .svc-cta-inner {
            display: grid;
            grid-template-columns: 1.4fr 1fr;
            gap: 2.5rem;
            align-items: center;
          }
          .svc-cta-body { max-width: 30rem; margin: 0; }
          .svc-cta-btns {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 0.85rem;
          }
          .svc-cta-call {
            background: var(--ivory);
            color: var(--ink);
          }
          .svc-cta-call:hover {
            background: var(--tan);
            color: var(--ink);
          }
          @media (max-width: 899.98px) {
            .svc-cta-inner { grid-template-columns: 1fr; }
            .svc-cta-btns { max-width: 22rem; }
          }
        `}</style>
      </section>
    </>
  );
}
