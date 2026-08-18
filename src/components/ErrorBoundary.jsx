// App-level error boundary: a runtime error shows a branded plain-language
// fallback with the shop phone, never a white screen. Reload gives the SPA
// a clean start.

import { Component } from 'react';
import { BUSINESS } from '../content/siteFacts.js';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="err-wrap">
        <div className="err-box">
          <p className="err-kicker">{BUSINESS.name}</p>
          <h1 className="err-title">Something went wrong on this page</h1>
          <p className="err-body">
            The site hit a snag, not the shop. Reload the page, or just call
            us; a person answers.
          </p>
          <div className="err-ctas">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              Reload the page
            </button>
            <a href={BUSINESS.phoneHref} className="btn btn-secondary">
              Call {BUSINESS.phoneDisplay}
            </a>
          </div>
        </div>
        <style>{`
          .err-wrap {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
            background: var(--bg, #f2ebdd);
            color: var(--text, #10110f);
          }
          .err-box { max-width: 30rem; text-align: center; }
          .err-kicker {
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.16em;
            color: var(--brand, #454a3d);
            margin: 0 0 0.75rem;
          }
          .err-title {
            font-family: var(--font-display, sans-serif);
            font-size: 1.9rem;
            text-transform: uppercase;
            line-height: 1;
            margin: 0 0 0.75rem;
          }
          .err-body { color: var(--text-secondary, #3a3b34); margin: 0 0 1.5rem; }
          .err-ctas {
            display: flex;
            gap: 0.85rem;
            justify-content: center;
            flex-wrap: wrap;
          }
        `}</style>
      </div>
    );
  }
}
