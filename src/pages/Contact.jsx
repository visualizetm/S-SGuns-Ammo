// Contact & Visit: phone-first. The shop takes calls, not web messages, so
// the primary action everywhere is Call the Shop. Address, confirmed weekly
// hours, email, directions, and a map slot. Click-to-call, email, and
// directions are real anchors that work on mobile. Social slots render only
// if confirmed accounts exist (none yet).

import Phone01 from '@untitled-ui/icons-react/build/esm/Phone01';
import MarkerPin01 from '@untitled-ui/icons-react/build/esm/MarkerPin01';
import Mail01 from '@untitled-ui/icons-react/build/esm/Mail01';
import {
  BUSINESS,
  HOURS,
  SOCIAL_LINKS,
  PAGE_META,
} from '../content/siteFacts.js';
import { MapEmbed } from '../components/MapEmbed.jsx';
import { usePageMeta } from '../lib/usePageMeta.js';

export function Contact() {
  usePageMeta(PAGE_META.contact.title, PAGE_META.contact.description);

  return (
    <>
      <section className="ct-head" aria-labelledby="contact-heading">
        <div className="wrap reveal">
          <p className="eyebrow">Talk to the shop</p>
          <h1 id="contact-heading" className="display ct-title">
            Contact &amp; Visit
          </h1>
          <p className="ct-lede">
            The fastest way to reach us is a phone call. You will talk to the
            people who run the shop, not a call center.
          </p>
        </div>
        <style>{`
          .ct-head {
            border-bottom: 1px solid var(--border);
            padding: 3.5rem 0 3rem;
          }
          .ct-title {
            font-size: clamp(2.3rem, 1.5rem + 3.6vw, 4rem);
            margin: 0 0 0.75rem;
          }
          .ct-lede {
            font-size: 1.1rem;
            color: var(--text-secondary);
            max-width: 36rem;
            margin: 0;
          }
        `}</style>
      </section>

      <section className="ct-main section" aria-label="Contact details">
        <div className="wrap ct-grid">
          {/* Call panel: the primary channel */}
          <div className="ct-call reveal-left">
            <h2 className="display ct-info-title">Call the Shop</h2>
            <a className="ct-phone" href={BUSINESS.phoneHref}>
              {BUSINESS.phoneDisplay}
            </a>
            <p className="ct-call-sub">
              Questions about inventory, transfers, or anything else, give us a
              call and we will help you out.
            </p>
            <div className="ct-ctas">
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
            <p className="ct-google">
              <a
                href={BUSINESS.googleBusinessUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                See S&amp;S Guns &amp; Ammo on Google
              </a>
            </p>

            {SOCIAL_LINKS.length > 0 ? (
              <ul className="ct-social">
                {SOCIAL_LINKS.map((link) => (
                  <li key={link.url}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* Visit panel */}
          <div className="ct-info reveal-right">
            <h2 className="display ct-info-title">Visit the Shop</h2>
            <address className="ct-address">
              {BUSINESS.name}
              <br />
              {BUSINESS.address.line1}
              <br />
              {BUSINESS.address.city}, {BUSINESS.address.state}{' '}
              {BUSINESS.address.zip}
            </address>

            <p className="ct-line">
              <Mail01 aria-hidden="true" width={18} height={18} />
              <a href={BUSINESS.emailHref}>{BUSINESS.emailDisplay}</a>
            </p>

            <div className="ct-hours">
              <h3 className="ct-hours-title">Hours</h3>
              <dl className="ct-hours-list">
                {HOURS.map((row) => (
                  <div
                    key={row.day}
                    className="ct-hours-row"
                    data-closed={row.opens ? undefined : 'true'}
                  >
                    <dt>{row.day}</dt>
                    <dd>{row.label}</dd>
                  </div>
                ))}
              </dl>
              <p className="ct-hours-note">Holiday hours: to be determined.</p>
            </div>

            <div className="ct-map">
              <MapEmbed />
            </div>
          </div>
        </div>
        <style>{`
          .ct-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 3.5rem;
            align-items: start;
          }
          .ct-info-title { font-size: 1.8rem; margin: 0 0 1rem; }
          .ct-phone {
            display: inline-block;
            font-family: var(--font-display);
            font-weight: 700;
            font-size: clamp(2rem, 1.4rem + 2.6vw, 2.8rem);
            letter-spacing: 0.01em;
            color: var(--brand-dark);
            text-decoration: none;
            margin: 0 0 0.75rem;
          }
          .ct-phone:hover { text-decoration: underline; }
          .ct-call-sub {
            color: var(--text-secondary);
            max-width: 30rem;
            margin: 0 0 1.5rem;
          }
          .ct-address {
            font-style: normal;
            font-size: 1.05rem;
            line-height: 1.7;
            margin: 0 0 1.25rem;
          }
          .ct-line {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            color: var(--text-secondary);
            margin: 0 0 1.25rem;
          }
          .ct-line svg {
            flex-shrink: 0;
            color: var(--brand);
          }
          .ct-hours { margin: 0 0 1.5rem; }
          .ct-hours-title {
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: var(--track-label);
            color: var(--text-muted);
            margin: 0 0 0.5rem;
          }
          .ct-hours-list {
            margin: 0;
            max-width: 20rem;
            border-top: 1px solid var(--border);
          }
          .ct-hours-row {
            display: flex;
            justify-content: space-between;
            gap: 1rem;
            padding: 0.35rem 0;
            border-bottom: 1px solid var(--border);
          }
          .ct-hours-row dt { font-weight: 600; color: var(--text); }
          .ct-hours-row dd { margin: 0; color: var(--text-secondary); }
          .ct-hours-row[data-closed] dt,
          .ct-hours-row[data-closed] dd { color: var(--text-muted); }
          .ct-hours-note {
            max-width: 20rem;
            margin: 0.6rem 0 0;
            font-size: 0.85rem;
            color: var(--text-muted);
          }
          .ct-ctas {
            display: flex;
            gap: 0.85rem;
            flex-wrap: wrap;
            margin-bottom: 0.85rem;
          }
          .ct-google { margin: 0 0 1.75rem; font-size: 0.9rem; }
          .ct-social {
            list-style: none;
            margin: 0;
            padding: 0;
            display: flex;
            gap: 1rem;
          }
          @media (max-width: 899.98px) {
            .ct-grid { grid-template-columns: 1fr; gap: 2.5rem; }
          }
        `}</style>
      </section>
    </>
  );
}
