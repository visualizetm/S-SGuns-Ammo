// Home: hero, trust strip, services preview, transfers teaser, visit block,
// and the email updates band. Heritage shop-sign composition on an ivory
// ground. Photos and logo art are Rob-supplied; slots render labeled
// placeholders until the real files exist.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Phone01 from '@untitled-ui/icons-react/build/esm/Phone01';
import MarkerPin01 from '@untitled-ui/icons-react/build/esm/MarkerPin01';
import MarkerPin02 from '@untitled-ui/icons-react/build/esm/MarkerPin02';
import Users01 from '@untitled-ui/icons-react/build/esm/Users01';
import MessageChatCircle from '@untitled-ui/icons-react/build/esm/MessageChatCircle';
import ArrowRight from '@untitled-ui/icons-react/build/esm/ArrowRight';
import Clock from '@untitled-ui/icons-react/build/esm/Clock';
import { publicGetCatalog } from '../lib/apiClient.js';
import { HOME_COPY, PAGE_META } from '../content/siteFacts.js';
import { featuredItems } from '../lib/catalogView.js';
import { ProductCard, ProductCardStyles } from '../components/ProductCard.jsx';
import { Slot } from '../components/Slot.jsx';
import { usePageMeta } from '../lib/usePageMeta.js';
import {
  BUSINESS,
  PLACEHOLDERS,
  TRUST_POINTS,
  LOGO_ASSETS,
  CONFIRMED_SERVICES,
} from '../content/siteFacts.js';

const TRUST_ICONS = {
  users: Users01,
  pin: MarkerPin02,
  chat: MessageChatCircle,
};


// "In the Case Right Now": renders only when published items are marked
// featured; otherwise Home is unchanged. Up to four cards, linking into
// the Inventory section.
function FeaturedStrip() {
  const [featured, setFeatured] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { body } = await publicGetCatalog();
      if (alive && body?.ok) setFeatured(featuredItems(body.items));
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (featured.length === 0) return null;

  return (
    <section className="hm-feat section" aria-labelledby="hm-feat-heading">
      <div className="wrap">
        <div className="reveal">
          <p className="eyebrow">From the inventory</p>
          <h2 id="hm-feat-heading" className="display section-title">
            In the Case Right Now
          </h2>
        </div>
        <div className="hm-feat-grid stagger">
          {featured.map((item) => (
            <ProductCard key={item.id} item={item} />
          ))}
        </div>
        <p className="hm-feat-more">
          <Link to="/inventory" className="btn btn-secondary">
            See the full inventory
          </Link>
        </p>
      </div>
      <ProductCardStyles />
      <style>{`
        .hm-feat { border-top: 1px solid var(--border); }
        .hm-feat-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.25rem;
        }
        .hm-feat-more { margin: 1.75rem 0 0; }
        @media (max-width: 1199.98px) {
          .hm-feat-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 599.98px) {
          .hm-feat-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  );
}

export function Home() {
  usePageMeta(PAGE_META.home.title, PAGE_META.home.description);

  return (
    <>
      {/* Hero */}
      <section className="hero-section" aria-labelledby="home-heading">
        <div className="wrap hero-grid">
          <div className="hero-copy reveal-left">
            {/* Signature seal: confirmed facts only, typographic, weapon-free.
                The one rotated element on the site. */}
            <p className="stamp stamp--seal hero-seal">
              <span>{HOME_COPY.sealLine1}</span>
              <span className="hero-seal-loc">{HOME_COPY.sealLine2}</span>
            </p>
            <h1 id="home-heading" className="display hero-headline">
              {HOME_COPY.headline[0]}
              <br />
              {HOME_COPY.headline[1]}
            </h1>
            {/* Hero sub is SERVICE-DEPENDENT; the copy lives in siteFacts. */}
            <p className="hero-sub">{HOME_COPY.heroSub}</p>
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
            {/* Large feature graphic: the one place (with About) where the
                detailed rifle-seal art may appear. Never at icon scale. */}
            <div className="hero-art-frame">
              <Slot
                src={LOGO_ASSETS.seal}
                alt={`${BUSINESS.name} crossed-rifles seal, Oxford, PA`}
                ratio="1 / 1"
                fit="contain"
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

      <FeaturedStrip />

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
              at the counter. Call the shop and we will walk you through it.
            </p>
          </div>
          <div className="hm-xfer-ctas">
            <a href={BUSINESS.phoneHref} className="btn hm-xfer-cta">
              <Phone01 aria-hidden="true" width={18} height={18} />
              Call the Shop
            </a>
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
    </>
  );
}
