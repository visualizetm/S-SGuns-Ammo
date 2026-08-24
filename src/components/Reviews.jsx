// Reviews: a branded testimonials band built from real, owner-approved Google
// review quotes in siteFacts (REVIEWS, REVIEWS_SUMMARY, GOOGLE_REVIEW_URL).
// This is a plain testimonials section: no Google logo, no "live" or "synced"
// claims, no API. Reusable so it can drop onto Home and About alike.
//
// A single "Leave us a review" button links to the shop's Google review URL.
// While that URL is still the owner-pending placeholder, the button is hidden
// so the site never ships a broken link.

import Star01 from '@untitled-ui/icons-react/build/esm/Star01';
import { REVIEWS, REVIEWS_SUMMARY, GOOGLE_REVIEW_URL } from '../content/siteFacts.js';
import { hasReviewLink, starCount } from '../lib/reviewsView.js';

// A row of filled stars with a single accessible label ("5 out of 5 stars").
function StarRow({ rating, max = 5 }) {
  const filled = starCount(rating, max);
  return (
    <span className="rv-stars" role="img" aria-label={`${filled} out of ${max} stars`}>
      {Array.from({ length: filled }, (_, i) => (
        <Star01 key={i} aria-hidden="true" width={18} height={18} fill="currentColor" />
      ))}
    </span>
  );
}

export function Reviews({ id = 'reviews', variant = 'band' }) {
  if (!Array.isArray(REVIEWS) || REVIEWS.length === 0) return null;

  const summary = REVIEWS_SUMMARY || {};
  const hasSummary = Boolean(summary.ratingText && summary.countText);
  const showButton = hasReviewLink(GOOGLE_REVIEW_URL);
  const sectionClass = variant === 'band' ? 'rv section band-deep' : 'rv section';

  return (
    <section className={sectionClass} aria-labelledby="reviews-heading" id={id}>
      <div className="wrap">
        <div className="reveal">
          <p className="eyebrow">What customers say</p>
          <h2 id="reviews-heading" className="display section-title">
            Reviews from the community
          </h2>
          {hasSummary ? (
            <p className="rv-aggregate">
              <StarRow rating={Number(summary.ratingText)} />
              <span className="rv-aggregate-text">
                {summary.ratingText} stars from {summary.countText} reviews
              </span>
            </p>
          ) : null}
        </div>

        <ul className="rv-grid stagger">
          {REVIEWS.map((review, index) => (
            <li key={`${review.author}-${index}`} className="rv-card">
              <StarRow rating={review.rating} />
              <blockquote className="rv-quote">{review.quote}</blockquote>
              <p className="rv-author">{review.author}</p>
            </li>
          ))}
        </ul>

        {showButton ? (
          <div className="rv-cta">
            <a
              className="btn btn-primary"
              href={GOOGLE_REVIEW_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Star01 aria-hidden="true" width={18} height={18} fill="currentColor" />
              Leave us a review
            </a>
          </div>
        ) : null}
      </div>

      <style>{`
        .rv-aggregate {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-wrap: wrap;
          margin: 0 0 2.25rem;
          font-weight: 600;
          color: var(--text-secondary);
        }
        .rv-aggregate-text { font-size: 1.05rem; }
        .rv-stars {
          display: inline-flex;
          align-items: center;
          gap: 0.15rem;
          color: var(--wood);
          line-height: 0;
        }
        .rv-stars svg { flex-shrink: 0; }
        .rv-grid {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.1rem;
        }
        .rv-card {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 1.5rem;
        }
        .rv-quote {
          margin: 0;
          font-size: 1.02rem;
          line-height: 1.65;
          color: var(--text);
        }
        .rv-author {
          margin: 0;
          margin-top: auto;
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--text-muted);
        }
        .rv-cta { margin-top: 2rem; }
        @media (min-width: 768px) {
          .rv-grid { grid-template-columns: repeat(2, 1fr); gap: 1.25rem; }
        }
        @media (min-width: 1200px) {
          .rv-grid { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>
    </section>
  );
}
