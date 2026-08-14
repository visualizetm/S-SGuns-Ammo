// Transfers & FAQ: how transfers work, what to bring, FAQ accordion, and the
// transfer inquiry form. All transfer and FAQ copy renders from
// src/data/transfersFaq.js, which is flagged LEGAL REVIEW REQUIRED. No fees,
// no legal claims; regulated specifics defer to a phone call.

import { useState } from 'react';
import Phone01 from '@untitled-ui/icons-react/build/esm/Phone01';
import CheckCircle from '@untitled-ui/icons-react/build/esm/CheckCircle';
import ChevronDown from '@untitled-ui/icons-react/build/esm/ChevronDown';
import ArrowRight from '@untitled-ui/icons-react/build/esm/ArrowRight';
import { BUSINESS } from '../data/business.js';
import {
  TRANSFERS_INTRO,
  TRANSFER_STEPS,
  WHAT_TO_BRING,
  FAQ_ITEMS,
} from '../data/transfersFaq.js';
import { TransferInquiryForm } from '../components/forms/TransferInquiryForm.jsx';
import { usePageMeta } from '../lib/usePageMeta.js';

// Accessible disclosure accordion: real buttons with aria-expanded, panels
// hidden with the hidden attribute. More consistent across browsers than
// details/summary and keyboard-complete by construction.
function FaqAccordion() {
  const [openIds, setOpenIds] = useState(() => new Set());

  function toggle(id) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="xfer-faq-list reveal">
      {FAQ_ITEMS.map((item) => {
        const open = openIds.has(item.id);
        return (
          <div key={item.id} className="xfer-faq-item">
            <h3 className="xfer-faq-h">
              <button
                type="button"
                id={`faq-btn-${item.id}`}
                className="xfer-faq-q"
                aria-expanded={open}
                aria-controls={`faq-panel-${item.id}`}
                onClick={() => toggle(item.id)}
              >
                <span>{item.question}</span>
                <ChevronDown
                  aria-hidden="true"
                  width={20}
                  height={20}
                  className={`xfer-faq-chev${open ? ' xfer-faq-chev--open' : ''}`}
                />
              </button>
            </h3>
            <div
              id={`faq-panel-${item.id}`}
              role="region"
              aria-labelledby={`faq-btn-${item.id}`}
              hidden={!open}
            >
              <p className="xfer-faq-a">{item.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TransfersFaq() {
  usePageMeta(
    'Transfers & FAQ',
    'How firearm transfers work at S&S Guns & Ammo in Oxford, PA. Call (610) 368-6984 for current transfer details.'
  );

  return (
    <>
      {/* Intro */}
      <section className="xfer-head grain" aria-labelledby="transfers-heading">
        <div className="wrap reveal">
          <p className="eyebrow">Bought online or out of state?</p>
          <h1 id="transfers-heading" className="display xfer-title">
            {TRANSFERS_INTRO.heading}
          </h1>
          <p className="xfer-lede">{TRANSFERS_INTRO.body}</p>
          <div className="xfer-head-ctas">
            <a href="#inquiry" className="btn btn-primary">
              Ask About a Transfer
              <ArrowRight
                aria-hidden="true"
                width={18}
                height={18}
                className="btn-arrow"
              />
            </a>
            <a href={BUSINESS.phoneHref} className="btn btn-secondary">
              <Phone01 aria-hidden="true" width={18} height={18} />
              {BUSINESS.phoneDisplay}
            </a>
          </div>
        </div>
        <style>{`
          .xfer-head {
            border-bottom: 1px solid var(--border);
            padding: 3.5rem 0 3rem;
          }
          .xfer-title {
            font-size: clamp(2.3rem, 1.5rem + 3.6vw, 4rem);
            margin: 0 0 0.75rem;
          }
          .xfer-lede {
            font-size: 1.1rem;
            color: var(--text-secondary);
            max-width: 38rem;
            margin: 0 0 1.5rem;
          }
          .xfer-head-ctas {
            display: flex;
            gap: 0.85rem;
            flex-wrap: wrap;
          }
        `}</style>
      </section>

      {/* How it works */}
      <section className="xfer-how section" aria-labelledby="xfer-how-heading">
        <div className="wrap">
          <div className="reveal">
            <p className="eyebrow">The short version</p>
            <h2 id="xfer-how-heading" className="display section-title">
              How a transfer works
            </h2>
            <p className="section-sub">
              Three steps, and we help with every one of them. Specifics
              depend on your situation, so call the shop for current details.
            </p>
          </div>
          <ol className="xfer-steps stagger">
            {TRANSFER_STEPS.map((step, index) => (
              <li key={step.id} className="card xfer-step">
                <span className="xfer-step-num" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="xfer-step-title">{step.title}</h3>
                <p className="xfer-step-body">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
        <style>{`
          .xfer-steps {
            list-style: none;
            margin: 0;
            padding: 0;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1.25rem;
            counter-reset: step;
          }
          .xfer-step { padding: 1.75rem; }
          .xfer-step-num {
            display: block;
            font-family: var(--font-display);
            font-size: 2.2rem;
            font-weight: 700;
            line-height: 1;
            color: color-mix(in srgb, var(--brand) 55%, var(--bg-card));
            margin-bottom: 0.9rem;
          }
          .xfer-step-title { font-size: 1.4rem; margin: 0 0 0.4rem; }
          .xfer-step-body {
            margin: 0;
            font-size: 0.95rem;
            color: var(--text-secondary);
          }
          @media (max-width: 899.98px) {
            .xfer-steps { grid-template-columns: 1fr; }
          }
        `}</style>
      </section>

      {/* What to bring */}
      <section
        className="xfer-bring band-deep section"
        aria-labelledby="xfer-bring-heading"
      >
        <div className="wrap xfer-bring-inner reveal">
          <div>
            <p className="eyebrow">Pickup day</p>
            <h2 id="xfer-bring-heading" className="display section-title">
              What to bring
            </h2>
          </div>
          <ul className="xfer-bring-list">
            {WHAT_TO_BRING.map((item) => (
              <li key={item} className="xfer-bring-item">
                <CheckCircle
                  aria-hidden="true"
                  width={20}
                  height={20}
                  className="xfer-bring-icon"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <style>{`
          .xfer-bring { padding-top: 3.5rem; padding-bottom: 3.5rem; }
          .xfer-bring-inner {
            display: grid;
            grid-template-columns: 1fr 1.4fr;
            gap: 2.5rem;
            align-items: start;
          }
          .xfer-bring-list {
            list-style: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }
          .xfer-bring-item {
            display: flex;
            gap: 0.75rem;
            align-items: flex-start;
          }
          .xfer-bring-icon {
            flex-shrink: 0;
            color: var(--brand);
            margin-top: 0.15rem;
          }
          @media (max-width: 899.98px) {
            .xfer-bring-inner { grid-template-columns: 1fr; gap: 1.5rem; }
          }
        `}</style>
      </section>

      {/* FAQ accordion */}
      <section className="xfer-faq section" aria-labelledby="faq-heading">
        <div className="wrap xfer-faq-wrap">
          <div className="reveal">
            <p className="eyebrow">Common questions</p>
            <h2 id="faq-heading" className="display section-title">
              Transfer FAQ
            </h2>
            <p className="section-sub">
              Short answers, no fine print. For anything specific to your
              situation, call the shop.
            </p>
          </div>
          <FaqAccordion />
        </div>
        <style>{`
          .xfer-faq-wrap { max-width: 46rem; }
          .xfer-faq-list {
            border-top: 1px solid var(--border-strong);
          }
          .xfer-faq-item {
            border-bottom: 1px solid var(--border-strong);
          }
          .xfer-faq-h { margin: 0; }
          button.xfer-faq-q {
            display: flex;
            width: 100%;
            align-items: center;
            justify-content: space-between;
            text-align: left;
            gap: 1rem;
            min-height: 44px;
            padding: 0.9rem 0.25rem;
            background: transparent;
            border: none;
            border-radius: 0;
            color: var(--text);
            font-family: var(--font-display);
            font-size: 1.25rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            cursor: pointer;
          }
          button.xfer-faq-q:hover { color: var(--brand-dark); }
          .xfer-faq-chev {
            flex-shrink: 0;
            color: var(--brand);
            transition: transform var(--duration) var(--ease);
          }
          .xfer-faq-chev--open { transform: rotate(180deg); }
          .xfer-faq-a {
            margin: 0;
            padding: 0 0.25rem 1.1rem;
            color: var(--text-secondary);
            max-width: 40rem;
          }
        `}</style>
      </section>

      {/* Inquiry form */}
      <section
        id="inquiry"
        className="xfer-form band-deep section"
        aria-labelledby="transfer-form-heading"
      >
        <div className="wrap xfer-form-inner">
          <div className="reveal-left">
            <p className="eyebrow">No obligation</p>
            <h2 id="transfer-form-heading" className="display section-title">
              Ask about a transfer
            </h2>
            <p className="section-sub">
              Send the details and we will follow up. This is an inquiry only,
              not an order.
            </p>
            <p className="xfer-form-alt">
              Prefer the phone?{' '}
              <a href={BUSINESS.phoneHref}>Call {BUSINESS.phoneDisplay}</a>.
            </p>
          </div>
          <div className="reveal-right">
            <TransferInquiryForm />
          </div>
        </div>
        <style>{`
          .xfer-form-inner {
            display: grid;
            grid-template-columns: 1fr 1.3fr;
            gap: 3rem;
            align-items: start;
          }
          .xfer-form-alt { color: var(--text-secondary); }
          @media (max-width: 899.98px) {
            .xfer-form-inner { grid-template-columns: 1fr; gap: 1.5rem; }
          }
        `}</style>
      </section>
    </>
  );
}
