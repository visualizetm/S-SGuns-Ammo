// Home: hero, trust strip, services preview, transfers teaser, visit block,
// and the email updates band. Heritage shop-sign composition on an ivory
// ground. Photos and logo art are Rob-supplied; slots render labeled
// placeholders until the real files exist.

import { Link } from 'react-router-dom';
import Phone01 from '@untitled-ui/icons-react/build/esm/Phone01';
import MarkerPin01 from '@untitled-ui/icons-react/build/esm/MarkerPin01';
import MarkerPin02 from '@untitled-ui/icons-react/build/esm/MarkerPin02';
import Users01 from '@untitled-ui/icons-react/build/esm/Users01';
import MessageChatCircle from '@untitled-ui/icons-react/build/esm/MessageChatCircle';
import ArrowRight from '@untitled-ui/icons-react/build/esm/ArrowRight';
import Clock from '@untitled-ui/icons-react/build/esm/Clock';
import { BUSINESS, PLACEHOLDERS, TRUST_POINTS } from '../data/business.js';
import { CONFIRMED_SERVICES } from '../data/services.js';
import { EmailSignupForm } from '../components/forms/EmailSignupForm.jsx';
import { Slot } from '../components/Slot.jsx';
import { usePageMeta } from '../lib/usePageMeta.js';

const TRUST_ICONS = {
  users: Users01,
  pin: MarkerPin02,
  chat: MessageChatCircle,
};

export function Home() {
  usePageMeta(
    null,
    'S&S Guns & Ammo is a family-owned firearms and ammunition shop at 10 S. 3rd Street, Unit 5, Oxford, PA 19363. Call (610) 368-6984.'
  );

  return (
    <>
      {/* Hero */}
      <section className="hero-section" aria-labelledby="home-heading">
        <div className="wrap hero-grid">
          <div className="hero-copy reveal-left">
            {/* Signature seal: confirmed facts only, typographic, weapon-free.
                The one rotated element on the site. */}
            <p className="stamp stamp--seal hero-seal">
              <span>Family Owned</span>
              <span className="hero-seal-loc">Oxford, Penna.</span>
            </p>
            <h1 id="home-heading" className="display hero-headline">
              Local knowledge.
              <br />
              Straight answers.
            </h1>
            {/* Supporting line is SERVICE-DEPENDENT: adjust after the owner
                confirms the exact service list. See NEEDS-CONFIRMATION.md. */}
            <p className="hero-sub">
              Family-owned in Oxford, Pennsylvania. Straightforward service for
              local firearm owners, transfer customers and sporting
              enthusiasts.
            </p>
            <div className="hero-ctas">
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
          </div>
          <div className="hero-art reveal-right">
            {/* Large feature graphic slot: the one place (with About) where
                the detailed rifle-seal art may appear. Never at icon scale. */}
            <div className="hero-art-frame">
              <Slot
                label="Rifle-seal art slot. Rob supplies the final feature graphic."
                ratio="1 / 1"
                eager
              />
            </div>
          </div>
        </div>
        <style>{`
          .hero-section {
            border-bottom: 1px solid var(--border);
            padding: 4.5rem 0;
          }
          .hero-grid {
            display: grid;
            grid-template-columns: 1.25fr 1fr;
            gap: 3.5rem;
            align-items: center;
          }
          .hero-seal {
            margin: 0 0 1.5rem;
          }
          .hero-seal-loc {
            font-size: 0.8em;
            color: var(--text-muted);
          }
          .hero-headline {
            font-size: clamp(2.6rem, 1.6rem + 5vw, 4.9rem);
            margin: 0 0 1.25rem;
          }
          .hero-sub {
            font-size: 1.1rem;
            color: var(--text-secondary);
            max-width: 32rem;
            margin: 0 0 1.75rem;
          }
          .hero-ctas {
            display: flex;
            gap: 0.85rem;
            flex-wrap: wrap;
          }
          .hero-art-frame {
            border: 2px solid var(--border-strong);
            border-radius: var(--radius-lg);
            padding: 0.65rem;
            max-width: 26rem;
            margin-left: auto;
          }
          @media (max-width: 899.98px) {
            .hero-section { padding: 3rem 0; }
            .hero-grid { grid-template-columns: 1fr; gap: 2.5rem; }
            .hero-art-frame { margin: 0 auto; max-width: 20rem; }
          }
        `}</style>
      </section>

      {/* Trust strip: confirmed facts only, no invented stats */}
      <section className="hm-trust band-deep" aria-label="Why S&S">
        <div className="wrap hm-trust-grid stagger">
          {TRUST_POINTS.map((point) => {
            const Icon = TRUST_ICONS[point.icon] || Users01;
            return (
              <div key={point.id} className="hm-trust-item">
                <span className="hm-trust-icon" aria-hidden="true">
                  <Icon width={22} height={22} />
                </span>
                <div>
                  <h2 className="hm-trust-title">{point.title}</h2>
                  <p className="hm-trust-body">{point.body}</p>
                </div>
              </div>
            );
          })}
        </div>
        <style>{`
          .hm-trust { padding: 2.25rem 0; }
          .hm-trust-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 2rem;
          }
          .hm-trust-item {
            display: flex;
            gap: 0.9rem;
            align-items: flex-start;
          }
          .hm-trust-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 44px;
            height: 44px;
            flex-shrink: 0;
            border: 1.5px solid var(--border-brand);
            border-radius: var(--radius);
            color: var(--brand);
            background: color-mix(in srgb, var(--brand) 8%, transparent);
          }
          .hm-trust-title {
            font-size: 1.2rem;
            margin: 0 0 0.2rem;
          }
          .hm-trust-body {
            margin: 0;
            font-size: 0.95rem;
            color: var(--text-secondary);
          }
          @media (max-width: 899.98px) {
            .hm-trust-grid { grid-template-columns: 1fr; gap: 1.5rem; }
          }
        `}</style>
      </section>

      {/* Services preview: confirmed services only */}
      <section className="hm-svc section" aria-labelledby="hm-svc-heading">
        <div className="wrap">
          <div className="reveal">
            <p className="eyebrow">At the counter</p>
            <h2 id="hm-svc-heading" className="display section-title">
              What we do
            </h2>
            <p className="section-sub">
              Straightforward help for buyers, owners and transfer customers.
              Call the shop with any question about what is in stock.
            </p>
          </div>
          {/* Ledger rows: the services list is not a sequence, so no
              numbering. Each row reads like a line in the counter book. */}
          <ul className="ledger hm-svc-ledger stagger">
            {CONFIRMED_SERVICES.slice(0, 5).map((service) => (
              <li key={service.id}>
                <Link to="/services" className="ledger-row hm-svc-row">
                  <span className="ledger-row-title">{service.title}</span>
                  <span className="ledger-row-desc">{service.description}</span>
                  <span className="hm-svc-go" aria-hidden="true">
                    <ArrowRight width={18} height={18} className="btn-arrow" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <style>{`
          .hm-svc-row {
            text-decoration: none;
            transition: background-color var(--duration-fast) var(--ease);
          }
          .hm-svc-row:hover {
            background: color-mix(in srgb, var(--brand) 6%, transparent);
          }
          .hm-svc-row .ledger-row-title {
            transition: color var(--duration-fast) var(--ease);
          }
          .hm-svc-row:hover .ledger-row-title { color: var(--brand-dark); }
          .hm-svc-go {
            color: var(--brand);
            display: inline-flex;
            align-self: center;
          }
          .hm-svc-row:hover .btn-arrow { transform: translateX(3px); }
          @media (max-width: 767.98px) {
            .hm-svc-go { display: none; }
          }
        `}</style>
      </section>

      {/* Transfers teaser */}
      <section
        className="hm-xfer band-dark grain section"
        aria-labelledby="hm-xfer-heading"
      >
        <div className="wrap hm-xfer-inner reveal">
          <div>
            <p className="eyebrow">Bought online or out of state?</p>
            <h2 id="hm-xfer-heading" className="display section-title">
              We handle firearm transfers
            </h2>
            <p className="hm-xfer-body">
              Have your purchase shipped to the shop and complete the paperwork
              at the counter. Send an inquiry and we will walk you through it.
            </p>
          </div>
          <div className="hm-xfer-ctas">
            <Link to="/transfers#inquiry" className="btn hm-xfer-cta">
              Ask About a Transfer
              <ArrowRight
                aria-hidden="true"
                width={18}
                height={18}
                className="btn-arrow"
              />
            </Link>
            <Link to="/transfers" className="btn btn-secondary">
              How transfers work
            </Link>
          </div>
        </div>
        <style>{`
          .hm-xfer-inner {
            display: grid;
            grid-template-columns: 1.4fr 1fr;
            gap: 2.5rem;
            align-items: center;
          }
          .hm-xfer-body {
            max-width: 30rem;
            margin: 0;
          }
          .hm-xfer-ctas {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 0.85rem;
          }
          .hm-xfer-cta {
            background: var(--ivory);
            color: var(--ink);
          }
          .hm-xfer-cta:hover {
            background: var(--tan);
            color: var(--ink);
          }
          @media (max-width: 899.98px) {
            .hm-xfer-inner { grid-template-columns: 1fr; }
            .hm-xfer-ctas { max-width: 22rem; }
          }
        `}</style>
      </section>

      {/* Visit block */}
      <section className="hm-visit section" aria-labelledby="hm-visit-heading">
        <div className="wrap hm-visit-grid">
          <div className="reveal-left">
            <p className="eyebrow">Visit the Shop</p>
            <h2 id="hm-visit-heading" className="display section-title">
              Stop in and talk it through
            </h2>
            <address className="hm-visit-address">
              {BUSINESS.address.line1}
              <br />
              {BUSINESS.address.city}, {BUSINESS.address.state}{' '}
              {BUSINESS.address.zip}
            </address>
            <p className="hm-visit-hours">
              <Clock aria-hidden="true" width={18} height={18} />
              <span>
                Hours: <span className="ph">{PLACEHOLDERS.hours}</span>
              </span>
            </p>
            <div className="hm-visit-ctas">
              <a
                href={BUSINESS.directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                <MarkerPin01 aria-hidden="true" width={18} height={18} />
                Get Directions
              </a>
              <a href={BUSINESS.phoneHref} className="btn btn-secondary">
                <Phone01 aria-hidden="true" width={18} height={18} />
                {BUSINESS.phoneDisplay}
              </a>
            </div>
          </div>
          <div className="reveal-right">
            <Slot
              label="Map slot. Static map image or embed to be added."
              ratio="4 / 3"
            />
          </div>
        </div>
        <style>{`
          .hm-visit-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 3rem;
            align-items: center;
          }
          .hm-visit-address {
            font-style: normal;
            font-size: 1.1rem;
            line-height: 1.7;
            margin: 0 0 0.75rem;
          }
          .hm-visit-hours {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: var(--text-secondary);
            margin: 0 0 1.5rem;
          }
          .hm-visit-hours svg { flex-shrink: 0; color: var(--brand); }
          .hm-visit-ctas {
            display: flex;
            gap: 0.85rem;
            flex-wrap: wrap;
          }
          @media (max-width: 899.98px) {
            .hm-visit-grid { grid-template-columns: 1fr; gap: 2rem; }
          }
        `}</style>
      </section>

      {/* Email updates */}
      <section
        className="hm-updates band-deep"
        aria-labelledby="hm-updates-heading"
      >
        <div className="wrap hm-updates-inner reveal">
          <div>
            <h2 id="hm-updates-heading" className="display hm-updates-title">
              Get shop updates
            </h2>
            <p className="hm-updates-sub">
              Sign up and we will keep you posted on shop news.
            </p>
          </div>
          <EmailSignupForm />
        </div>
        <style>{`
          .hm-updates { padding: 3rem 0; }
          .hm-updates-inner {
            display: grid;
            grid-template-columns: 1fr 1.2fr;
            gap: 2.5rem;
            align-items: start;
          }
          .hm-updates-title { font-size: 1.9rem; margin: 0 0 0.4rem; }
          .hm-updates-sub { color: var(--text-secondary); margin: 0; }
          @media (max-width: 899.98px) {
            .hm-updates-inner { grid-template-columns: 1fr; gap: 1.5rem; }
          }
        `}</style>
      </section>
    </>
  );
}
