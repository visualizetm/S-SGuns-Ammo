// About: family story, shop values, Oxford community connection. Family
// story, owner names, and founding year are UNCONFIRMED; labeled placeholders
// render until the owner confirms them. No invented history, no EST. year.
// (A storefront/owner photo will be added later; no photo placeholder for now.)

import Phone01 from '@untitled-ui/icons-react/build/esm/Phone01';
import MarkerPin01 from '@untitled-ui/icons-react/build/esm/MarkerPin01';
import {
  BUSINESS,
  SHOP_VALUES,
  LOGO_ASSETS,
  ABOUT_COPY,
  PAGE_META,
} from '../content/siteFacts.js';
import { Slot } from '../components/Slot.jsx';
import { usePageMeta } from '../lib/usePageMeta.js';

export function About() {
  usePageMeta(PAGE_META.about.title, PAGE_META.about.description);

  return (
    <>
      {/* Page header */}
      <section className="ab-head" aria-labelledby="about-heading">
        <div className="wrap reveal">
          <p className="eyebrow">Family owned in Oxford, PA</p>
          <h1 id="about-heading" className="display ab-title">
            About {BUSINESS.name}
          </h1>
          <p className="ab-lede">{ABOUT_COPY.lede}</p>
        </div>
        <style>{`
          .ab-head {
            border-bottom: 1px solid var(--border);
            padding: 3.5rem 0 3rem;
          }
          .ab-title {
            font-size: clamp(2.3rem, 1.5rem + 3.6vw, 4rem);
            margin: 0 0 0.75rem;
          }
          .ab-lede {
            font-size: 1.1rem;
            color: var(--text-secondary);
            max-width: 36rem;
            margin: 0;
          }
        `}</style>
      </section>

      {/* Family story */}
      <section className="ab-story section" aria-labelledby="ab-story-heading">
        <div className="wrap ab-story-grid">
          <div className="reveal-left">
            <p className="eyebrow">Our story</p>
            <h2 id="ab-story-heading" className="display section-title">
              The family behind the counter
            </h2>
            <p className="ab-story-body">{ABOUT_COPY.story}</p>
            <dl className="ab-facts">
              <div className="ab-fact">
                <dt>Run by</dt>
                <dd>{ABOUT_COPY.runBy}</dd>
              </div>
              <div className="ab-fact">
                <dt>Local and family-run</dt>
                <dd>Oxford, PA</dd>
              </div>
            </dl>
          </div>
        </div>
        <style>{`
          .ab-story-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 3rem;
            align-items: start;
          }
          .ab-story-body {
            max-width: 40rem;
            line-height: 1.8;
          }
          .ab-facts {
            display: flex;
            gap: 2.5rem;
            flex-wrap: wrap;
            margin-top: 1.75rem;
          }
          .ab-fact dt {
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: var(--track-label);
            color: var(--text-muted);
            margin-bottom: 0.3rem;
          }
          .ab-fact dd { margin: 0; }
          @media (max-width: 899.98px) {
            .ab-story-grid { gap: 2rem; }
          }
        `}</style>
      </section>

      {/* Values */}
      <section
        className="ab-values band-dark grain section"
        aria-labelledby="ab-values-heading"
      >
        <div className="wrap">
          <div className="reveal">
            <p className="eyebrow">How we run the shop</p>
            <h2 id="ab-values-heading" className="display section-title">
              What you can count on
            </h2>
          </div>
          <div className="ab-values-grid stagger">
            {SHOP_VALUES.map((value) => (
              <div key={value.id} className="ab-value">
                <h3 className="ab-value-title">{value.title}</h3>
                <p className="ab-value-body">{value.body}</p>
              </div>
            ))}
          </div>
        </div>
        <style>{`
          .ab-values-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1.25rem;
          }
          .ab-value {
            border: 1px solid color-mix(in srgb, var(--ivory) 18%, transparent);
            border-radius: var(--radius-lg);
            padding: 1.5rem;
            background: var(--surface-dark-2);
            transition: transform var(--duration) var(--ease),
              border-color var(--duration) var(--ease);
          }
          .ab-value:hover {
            transform: translateY(-3px);
            border-color: color-mix(in srgb, var(--tan) 55%, transparent);
          }
          .ab-value-title {
            font-size: 1.4rem;
            margin: 0 0 0.4rem;
            padding-top: 0.85rem;
            border-top: 2px solid color-mix(in srgb, var(--tan) 55%, transparent);
          }
          .ab-value-body {
            margin: 0;
            font-size: 0.95rem;
            color: var(--text-on-dark-secondary);
          }
          @media (max-width: 899.98px) {
            .ab-values-grid { grid-template-columns: 1fr; }
          }
        `}</style>
      </section>

      {/* Oxford community + seal feature graphic */}
      <section className="ab-town section" aria-labelledby="ab-town-heading">
        <div className="wrap ab-town-grid">
          <div className="ab-town-media reveal-left">
            {/* Large feature graphic: the one place (with Home) where the
                detailed rifle-seal art may appear. Never at icon scale. */}
            <div className="ab-town-frame">
              <Slot
                src={LOGO_ASSETS.featureAbout}
                alt={BUSINESS.name}
                label={BUSINESS.name}
                ratio="1 / 1"
                fit="contain"
              />
            </div>
          </div>
          <div className="reveal-right">
            <p className="eyebrow">Part of Oxford</p>
            <h2 id="ab-town-heading" className="display section-title">
              A local shop, on purpose
            </h2>
            <p>{ABOUT_COPY.community}</p>
            <div className="ab-town-ctas">
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
        </div>
        <style>{`
          .ab-town-grid {
            display: grid;
            grid-template-columns: 1fr 1.3fr;
            gap: 3rem;
            align-items: center;
          }
          .ab-town-frame {
            border: 2px solid var(--border-strong);
            border-radius: var(--radius-lg);
            padding: 0.65rem;
            max-width: 22rem;
          }
          .ab-town-ctas {
            display: flex;
            gap: 0.85rem;
            flex-wrap: wrap;
            margin-top: 1.5rem;
          }
          @media (max-width: 899.98px) {
            .ab-town-grid { grid-template-columns: 1fr; gap: 2rem; }
            .ab-town-media { order: 2; }
            .ab-town-frame { max-width: 18rem; }
          }
        `}</style>
      </section>
    </>
  );
}
