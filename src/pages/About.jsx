// About: family story slot, owner intro slot, shop values, Oxford community
// connection. Family story, owner names, and founding year are UNCONFIRMED;
// labeled placeholders render until the owner confirms them. No invented
// history, no EST. year.

import Phone01 from '@untitled-ui/icons-react/build/esm/Phone01';
import MarkerPin01 from '@untitled-ui/icons-react/build/esm/MarkerPin01';
import { BUSINESS, PLACEHOLDERS, SHOP_VALUES } from '../data/business.js';
import { Slot } from '../components/Slot.jsx';
import { usePageMeta } from '../lib/usePageMeta.js';

export function About() {
  usePageMeta(
    'About',
    'S&S Guns & Ammo is a family-owned firearms and ammunition shop in Oxford, Pennsylvania.'
  );

  return (
    <>
      {/* Page header */}
      <section className="ab-head grain" aria-labelledby="about-heading">
        <div className="wrap reveal">
          <p className="eyebrow">Family owned in Oxford, PA</p>
          <h1 id="about-heading" className="display ab-title">
            About {BUSINESS.name}
          </h1>
          <p className="ab-lede">
            A family-owned shop on S. 3rd Street in Oxford, Pennsylvania,
            serving local firearm owners, transfer customers and sporting
            enthusiasts.
          </p>
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
            {/* UNCONFIRMED: real family story replaces this placeholder.
                Do not fabricate history or a founding year. */}
            <p className="ab-story-ph">
              <span className="ph">{PLACEHOLDERS.aboutStory}</span>
            </p>
            <dl className="ab-facts">
              <div className="ab-fact">
                <dt>Owners</dt>
                <dd>
                  <span className="ph">{PLACEHOLDERS.ownerNames}</span>
                </dd>
              </div>
              <div className="ab-fact">
                <dt>Serving Oxford since</dt>
                <dd>
                  <span className="ph">{PLACEHOLDERS.foundingYear}</span>
                </dd>
              </div>
            </dl>
          </div>
          <div className="ab-story-media reveal-right">
            <Slot
              label="Owner or storefront photo slot. Rob supplies photography."
              ratio="4 / 5"
            />
          </div>
        </div>
        <style>{`
          .ab-story-grid {
            display: grid;
            grid-template-columns: 1.3fr 1fr;
            gap: 3rem;
            align-items: start;
          }
          .ab-story-ph {
            max-width: 34rem;
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
          .ab-story-media { max-width: 24rem; }
          @media (max-width: 899.98px) {
            .ab-story-grid { grid-template-columns: 1fr; gap: 2rem; }
            .ab-story-media { max-width: 20rem; }
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
            {SHOP_VALUES.map((value, index) => (
              <div key={value.id} className="ab-value">
                <span className="ab-value-num" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
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
          .ab-value-num {
            display: block;
            font-family: var(--font-display);
            font-size: 0.95rem;
            font-weight: 600;
            letter-spacing: var(--track-label);
            color: var(--tan);
            margin-bottom: 1rem;
          }
          .ab-value-title { font-size: 1.4rem; margin: 0 0 0.4rem; }
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
            {/* Large feature graphic slot: the one place (with Home) where
                the detailed rifle-seal art may appear. Never at icon scale. */}
            <div className="ab-town-frame">
              <Slot
                label="Rifle-seal art slot. Rob supplies the final feature graphic."
                ratio="1 / 1"
              />
            </div>
          </div>
          <div className="reveal-right">
            <p className="eyebrow">Part of Oxford</p>
            <h2 id="ab-town-heading" className="display section-title">
              A local shop, on purpose
            </h2>
            <p>
              The shop sits at {BUSINESS.address.line1} in Oxford,
              Pennsylvania. If you live or hunt in the area, you are the
              customer this place was built for. Stop in, call, or send a
              message and talk to the people who run it.
            </p>
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
