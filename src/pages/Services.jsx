// Services: one clean card per confirmed service, data-driven. Informational
// only: no prices, no e-commerce, no Buy Now. Unconfirmed services stay
// hidden (see src/data/services.js).

import { Link } from 'react-router-dom';
import Phone01 from '@untitled-ui/icons-react/build/esm/Phone01';
import Mail01 from '@untitled-ui/icons-react/build/esm/Mail01';
import { BUSINESS } from '../data/business.js';
import {
  CONFIRMED_SERVICES,
  SERVICES_CONFIRMATION_NOTE,
} from '../data/services.js';
import { usePageMeta } from '../lib/usePageMeta.js';

export function Services() {
  usePageMeta(
    'Services',
    'What S&S Guns & Ammo offers at the shop in Oxford, PA. Call (610) 368-6984 with questions or to check stock.'
  );

  return (
    <>
      <section className="svc-head grain" aria-labelledby="services-heading">
        <div className="wrap reveal">
          <p className="eyebrow">At the shop</p>
          <h1 id="services-heading" className="display svc-title">
            Services
          </h1>
          <p className="svc-lede">
            What we do at the counter, in plain terms. Call the shop for
            current stock and details on any of it.
          </p>
          {/* Whole list pending owner confirmation; visible flag on the
              draft build so nothing unconfirmed slips into a publish. */}
          <p className="flag-note">{SERVICES_CONFIRMATION_NOTE}</p>
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
        <div className="wrap svc-grid stagger">
          {CONFIRMED_SERVICES.map((service, index) => (
            <article key={service.id} className="card svc-card">
              <span className="svc-num" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h2 className="svc-card-title">{service.title}</h2>
              <p className="svc-card-desc">{service.description}</p>
            </article>
          ))}
        </div>
        <style>{`
          .svc-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
            gap: 1.25rem;
          }
          .svc-card { padding: 1.75rem; }
          .svc-num {
            display: block;
            font-family: var(--font-display);
            font-size: 0.95rem;
            font-weight: 600;
            letter-spacing: var(--track-label);
            color: var(--text-muted);
            margin-bottom: 1.1rem;
          }
          .svc-card-title { font-size: 1.6rem; margin: 0 0 0.5rem; }
          .svc-card-desc {
            margin: 0;
            color: var(--text-secondary);
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
              If you do not see what you need, call the shop or send a message
              and we will point you in the right direction.
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
