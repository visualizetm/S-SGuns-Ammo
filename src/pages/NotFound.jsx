// 404 page.

import { Link } from 'react-router-dom';
import Phone01 from '@untitled-ui/icons-react/build/esm/Phone01';
import { BUSINESS } from '../content/siteFacts.js';
import { usePageMeta } from '../lib/usePageMeta.js';

export function NotFound() {
  usePageMeta('Page not found');

  return (
    <section className="nf-section section" aria-labelledby="notfound-heading">
      <div className="wrap nf-inner">
        <p className="nf-code display" aria-hidden="true">
          404
        </p>
        <h1 id="notfound-heading" className="display nf-title">
          Page not found
        </h1>
        <p className="nf-body">
          The page you are looking for does not exist. Head back to the home
          page, or call the shop and ask a person instead.
        </p>
        <div className="nf-ctas">
          <Link to="/" className="btn btn-primary">
            Back to Home
          </Link>
          <a href={BUSINESS.phoneHref} className="btn btn-secondary">
            <Phone01 aria-hidden="true" width={18} height={18} />
            Call the Shop
          </a>
        </div>
      </div>
      <style>{`
        .nf-inner {
          max-width: 34rem;
          text-align: center;
          margin: 0 auto;
          padding: 2rem 0;
        }
        .nf-code {
          font-size: clamp(4.5rem, 3rem + 8vw, 8rem);
          color: color-mix(in srgb, var(--brand) 35%, var(--bg));
          margin: 0 0 0.25rem;
        }
        .nf-title { font-size: 2rem; margin: 0 0 0.75rem; }
        .nf-body { color: var(--text-secondary); margin: 0 0 1.75rem; }
        .nf-ctas {
          display: flex;
          gap: 0.85rem;
          justify-content: center;
          flex-wrap: wrap;
        }
      `}</style>
    </section>
  );
}
