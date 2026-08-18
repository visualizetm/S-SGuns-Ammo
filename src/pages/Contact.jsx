// Contact & Visit: contact form (existing endpoint), phone, address, map
// slot, directions, hours placeholder, parking placeholder. Click-to-call
// and directions are real anchors that work on mobile. Social slots render
// only if confirmed accounts exist (none yet).

import { useSearchParams } from 'react-router-dom';
import Phone01 from '@untitled-ui/icons-react/build/esm/Phone01';
import MarkerPin01 from '@untitled-ui/icons-react/build/esm/MarkerPin01';
import Mail01 from '@untitled-ui/icons-react/build/esm/Mail01';
import Clock from '@untitled-ui/icons-react/build/esm/Clock';
import Building02 from '@untitled-ui/icons-react/build/esm/Building02';
import {
  BUSINESS,
  PLACEHOLDERS,
  SOCIAL_LINKS,
  PAGE_META,
} from '../content/siteFacts.js';
import { ContactForm } from '../components/forms/ContactForm.jsx';
import { askAboutMessage } from '../lib/catalogView.js';
import { Slot } from '../components/Slot.jsx';
import { usePageMeta } from '../lib/usePageMeta.js';

export function Contact() {
  const [searchParams] = useSearchParams();
  const aboutItem = searchParams.get('about') || '';
  usePageMeta(PAGE_META.contact.title, PAGE_META.contact.description);

  return (
    <>
      <section className="ct-head" aria-labelledby="contact-heading">
        <div className="wrap reveal">
          <p className="eyebrow">Talk to the shop</p>
          <h1 id="contact-heading" className="display ct-title">
            Contact & Visit
          </h1>
          <p className="ct-lede">
            Call, stop in, or send a message. You will hear back from the
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

      <section className="ct-main section" aria-label="Contact details and form">
        <div className="wrap ct-grid">
          {/* Visit panel */}
          <div className="ct-info reveal-left">
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
              <li className="ct-line">
                <Mail01 aria-hidden="true" width={18} height={18} />
                <span>
                  Email: <span className="ph">{PLACEHOLDERS.email}</span>
                </span>
              </li>
            </ul>

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

            <div className="ct-map">
              <Slot
                label="Map slot. Static map image or embed to be added."
                ratio="4 / 3"
              />
            </div>
          </div>

          {/* Form panel */}
          <div className="ct-form reveal-right">
            <h2 className="display ct-info-title" id="contact-form-heading">
              Contact S&S
            </h2>
            <p className="ct-form-sub">
              Send a message and we will get back to you.
            </p>
            <ContactForm initialMessage={askAboutMessage(aboutItem)} />
          </div>
        </div>
        <style>{`
          .ct-grid {
            display: grid;
            grid-template-columns: 1fr 1.2fr;
            gap: 3.5rem;
            align-items: start;
          }
          .ct-info-title { font-size: 1.8rem; margin: 0 0 1rem; }
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
            margin: 0 0 1.75rem;
            padding: 0;
            display: flex;
            gap: 1rem;
          }
          .ct-form-sub {
            color: var(--text-secondary);
            margin: 0 0 1.5rem;
          }
          @media (max-width: 899.98px) {
            .ct-grid { grid-template-columns: 1fr; gap: 2.5rem; }
            .ct-form { order: -1; }
          }
        `}</style>
      </section>
    </>
  );
}
