// Contact & Visit: phone-first. The shop takes calls, not web messages, so
// the primary action everywhere is Call the Shop. Address, hours, parking,
// directions, and a map slot. Click-to-call and directions are real anchors
// that work on mobile. Social slots render only if confirmed accounts exist
// (none yet).

import Phone01 from '@untitled-ui/icons-react/build/esm/Phone01';
import MarkerPin01 from '@untitled-ui/icons-react/build/esm/MarkerPin01';
import Clock from '@untitled-ui/icons-react/build/esm/Clock';
import Building02 from '@untitled-ui/icons-react/build/esm/Building02';
import {
  BUSINESS,
  PLACEHOLDERS,
  SOCIAL_LINKS,
  PAGE_META,
} from '../content/siteFacts.js';
import { Slot } from '../components/Slot.jsx';
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

            <ul className="ct-lines">
              <li className="ct-line">
                <Clock aria-hidden="true" width={18} height={18} />
                <span>
                  Hours: <span className="ph">{PLACEHOLDERS.hours}</span>
                </span>
              </li>
              <li className="ct-line">
                <Building02 aria-hidden="true" width={18} height={18} />
                <span>
                  Parking: <span className="ph">{PLACEHOLDERS.parking}</span>
                </span>
              </li>
            </ul>

            <div className="ct-map">
              <Slot
                label="Map slot. Static map image or embed to be added."
                ratio="4 / 3"
              />
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
          .ct-lines {
            list-style: none;
            margin: 0 0 1.5rem;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 0.6rem;
          }
          .ct-line {
            display: flex;
            align-items: flex-start;
            gap: 0.6rem;
            color: var(--text-secondary);
          }
          .ct-line svg {
            flex-shrink: 0;
            color: var(--brand);
            margin-top: 0.2rem;
          }
          .ct-ctas {
            display: flex;
            gap: 0.85rem;
            flex-wrap: wrap;
            margin-bottom: 1.75rem;
          }
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
