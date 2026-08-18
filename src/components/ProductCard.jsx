// Public product card, shared by the Inventory grid and the Home featured
// strip so they can never drift apart. Display data only: the card links
// to the item page; nothing is for sale online.

import { Link } from 'react-router-dom';
import { LOGO_ASSETS } from '../content/siteFacts.js';
import { badgesFor } from '../lib/catalogView.js';

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function ProductCard({ item }) {
  const badges = badgesFor(item);
  const photo = item.photos?.[0]?.url;

  return (
    <Link to={`/inventory/${item.id}`} className="pc-card" data-dimmed={badges.dimmed || undefined}>
      <span className="pc-photo">
        {photo ? (
          <img src={photo} alt={item.name} loading="lazy" />
        ) : (
          <span className="pc-photo-empty">
            <img src={LOGO_ASSETS.submark} alt="" loading="lazy" />
            <span>Photo coming</span>
          </span>
        )}
        {badges.sale ? <span className="pc-badge pc-badge--sale">{badges.sale}</span> : null}
        {badges.stock ? (
          <span className="pc-badge pc-badge--stock" data-stock={item.stockStatus}>
            {badges.stock}
          </span>
        ) : null}
      </span>
      <span className="pc-body">
        <span className="pc-name">{item.name}</span>
        <span className="pc-meta">
          {item.manufacturer} {item.model}
          {item.caliber ? ` | ${item.caliber}` : ''}
        </span>
        <span className="pc-bottom">
          <span className="pc-price">
            {item.onSale && item.compareAtPrice ? (
              <>
                <s className="pc-compare">{USD.format(item.compareAtPrice)}</s>{' '}
                <span className="pc-price-now">{USD.format(item.price)}</span>
              </>
            ) : (
              <span className="pc-price-now">{USD.format(item.price)}</span>
            )}
          </span>
          <span className="pc-condition">{item.condition}</span>
        </span>
      </span>
    </Link>
  );
}

// Parents render <ProductCardStyles /> once per grid, not once per card.

export function ProductCardStyles() {
  return (
    <style>{`
      .pc-card {
        display: flex;
        flex-direction: column;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        overflow: hidden;
        text-decoration: none;
        color: var(--text);
        transition: transform var(--duration) var(--ease),
          border-color var(--duration) var(--ease);
      }
      .pc-card:hover {
        transform: translateY(-3px);
        border-color: var(--border-brand);
        color: var(--text);
      }
      .pc-card:active { transform: translateY(-1px); }
      .pc-card[data-dimmed] .pc-photo,
      .pc-card[data-dimmed] .pc-name,
      .pc-card[data-dimmed] .pc-meta { opacity: 0.55; }
      .pc-photo {
        position: relative;
        display: block;
        aspect-ratio: 4 / 3;
        background: var(--bg-field);
        border-bottom: 1px solid var(--border);
      }
      .pc-photo > img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .pc-photo-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        width: 100%;
        height: 100%;
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: var(--track-label);
        color: var(--text-muted);
      }
      .pc-photo-empty img {
        width: 3rem;
        height: 3rem;
        opacity: 0.35;
      }
      .pc-badge {
        position: absolute;
        top: 0.6rem;
        font-family: var(--font-display);
        font-size: 0.85rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding: 0.2rem 0.6rem;
        border-radius: var(--radius-sm);
      }
      .pc-badge--sale {
        left: 0.6rem;
        background: var(--brand);
        color: var(--ivory);
        border: 1.5px solid var(--brand);
        box-shadow: inset 0 0 0 2px var(--brand),
          inset 0 0 0 3px color-mix(in srgb, var(--ivory) 55%, transparent);
      }
      .pc-badge--stock {
        right: 0.6rem;
        background: var(--bg);
        border: 1.5px solid var(--border-strong);
        color: var(--text-secondary);
      }
      .pc-badge--stock[data-stock='Low Stock'] {
        border-color: color-mix(in srgb, var(--accent-fall) 60%, transparent);
        color: var(--accent-fall);
      }
      .pc-badge--stock[data-stock='Sold'] {
        border-color: var(--border-strong);
        color: var(--text-secondary);
        opacity: 1;
      }
      .pc-body {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        padding: 0.9rem 1rem 1rem;
        flex: 1;
      }
      .pc-name {
        font-family: var(--font-display);
        font-size: 1.25rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        line-height: 1.05;
      }
      .pc-meta {
        font-size: 0.85rem;
        color: var(--text-muted);
      }
      .pc-bottom {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 0.75rem;
        margin-top: auto;
        padding-top: 0.5rem;
      }
      .pc-price {
        font-family: var(--font-display);
        font-weight: 700;
        font-size: 1.4rem;
        letter-spacing: 0.02em;
      }
      .pc-compare {
        font-size: 0.95rem;
        font-weight: 500;
        color: var(--text-muted);
      }
      .pc-price-now { color: var(--brand-dark); }
      .pc-condition {
        font-size: 0.72rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: var(--track-label);
        color: var(--text-muted);
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-sm);
        padding: 0.15rem 0.45rem;
        white-space: nowrap;
      }
    `}</style>
  );
}
