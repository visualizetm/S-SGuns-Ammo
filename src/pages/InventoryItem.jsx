// Public item page: photos, specs, price with sale display, stock status,
// description. Two CTAs only: Call the Shop and Ask About This Item (which
// prefills the contact form). Display catalog for a licensed dealer:
// customers transact in the store. No purchase language anywhere.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Phone01 from '@untitled-ui/icons-react/build/esm/Phone01';
import Mail01 from '@untitled-ui/icons-react/build/esm/Mail01';
import ArrowLeft from '@untitled-ui/icons-react/build/esm/ArrowLeft';
import { BUSINESS, LOGO_ASSETS } from '../content/siteFacts.js';
import { publicGetItem } from '../lib/apiClient.js';
import { badgesFor } from '../lib/catalogView.js';
import { usePageMeta } from '../lib/usePageMeta.js';

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function NotFoundState() {
  usePageMeta('Item not found');
  return (
    <section className="itm-missing section" aria-labelledby="itm-missing-heading">
      <div className="wrap">
        <h1 id="itm-missing-heading" className="display itm-missing-title">
          That item is not listed
        </h1>
        <p className="itm-missing-body">
          It may have sold or come off the list. The online inventory is only
          part of what is in the case, so call the shop and ask.
        </p>
        <div className="itm-missing-ctas">
          <Link to="/inventory" className="btn btn-primary">
            <ArrowLeft aria-hidden="true" width={18} height={18} />
            Back to Inventory
          </Link>
          <a href={BUSINESS.phoneHref} className="btn btn-secondary">
            <Phone01 aria-hidden="true" width={18} height={18} />
            Call the Shop
          </a>
        </div>
      </div>
      <style>{`
        .itm-missing-title { font-size: 2rem; margin: 0 0 0.5rem; }
        .itm-missing-body { color: var(--text-secondary); max-width: 32rem; margin: 0 0 1.5rem; }
        .itm-missing-ctas { display: flex; gap: 0.85rem; flex-wrap: wrap; }
      `}</style>
    </section>
  );
}

function ItemView({ item }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const badges = badgesFor(item);
  const photos = item.photos || [];
  const mainPhoto = photos[photoIndex]?.url;

  usePageMeta(
    item.name,
    `${item.name}: ${item.condition} ${item.manufacturer} ${item.model}` +
      `${item.caliber ? `, ${item.caliber}` : ''}, ${USD.format(item.price)} at ${BUSINESS.name} in ${BUSINESS.address.city}, ${BUSINESS.address.state}. Call ${BUSINESS.phoneDisplay}.`,
    {
      title: `${item.name} | ${BUSINESS.name}`,
      image: photos[0]?.url || undefined,
    }
  );

  return (
    <section className="itm-main section" aria-labelledby="itm-heading">
      <div className="wrap">
        <p className="itm-back">
          <Link to="/inventory">
            <ArrowLeft aria-hidden="true" width={16} height={16} /> All
            inventory
          </Link>
        </p>

        <div className="itm-grid">
          <div className="itm-media reveal-left">
            <div className="itm-photo">
              {mainPhoto ? (
                <img src={mainPhoto} alt={`${item.name}, ${item.condition}`} />
              ) : (
                <span className="itm-photo-empty">
                  <img src={LOGO_ASSETS.submark} alt="" />
                  <span>Photo coming. Call to ask about this item.</span>
                </span>
              )}
              {badges.sale ? <span className="itm-badge itm-badge--sale">{badges.sale}</span> : null}
              {badges.stock ? <span className="itm-badge itm-badge--stock">{badges.stock}</span> : null}
            </div>
            {photos.length > 1 ? (
              <div className="itm-thumbs" role="group" aria-label="More photos">
                {photos.map((photo, index) => (
                  <button
                    key={index}
                    type="button"
                    className="itm-thumb"
                    aria-label={`Photo ${index + 1}`}
                    aria-current={index === photoIndex ? 'true' : undefined}
                    onClick={() => setPhotoIndex(index)}
                  >
                    <img src={photo.url} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="itm-info reveal-right">
            <h1 id="itm-heading" className="display itm-name">
              {item.name}
            </h1>

            <p className="itm-price">
              {item.onSale && item.compareAtPrice ? (
                <>
                  <s className="itm-compare">{USD.format(item.compareAtPrice)}</s>{' '}
                  <span className="itm-price-now">{USD.format(item.price)}</span>
                  <span className="itm-sale-label">{badges.sale}</span>
                </>
              ) : (
                <span className="itm-price-now">{USD.format(item.price)}</span>
              )}
            </p>
            <p className="itm-stock" data-stock={item.stockStatus}>
              {item.stockStatus === 'Sold'
                ? 'Sold. Call the shop; similar items come through often.'
                : item.stockStatus === 'Low Stock'
                  ? 'Low stock. Call before making the drive.'
                  : 'In stock at the shop.'}
            </p>

            <dl className="itm-specs">
              <div className="itm-spec">
                <dt>Manufacturer</dt>
                <dd>{item.manufacturer}</dd>
              </div>
              <div className="itm-spec">
                <dt>Model</dt>
                <dd>{item.model}</dd>
              </div>
              {item.caliber ? (
                <div className="itm-spec">
                  <dt>Caliber</dt>
                  <dd>{item.caliber}</dd>
                </div>
              ) : null}
              <div className="itm-spec">
                <dt>Condition</dt>
                <dd>{item.condition}</dd>
              </div>
            </dl>

            {item.description ? (
              <p className="itm-desc">{item.description}</p>
            ) : null}

            <div className="itm-ctas">
              <a href={BUSINESS.phoneHref} className="btn btn-primary">
                <Phone01 aria-hidden="true" width={18} height={18} />
                Call the Shop
              </a>
              <Link
                to={`/contact?about=${encodeURIComponent(item.name)}`}
                className="btn btn-secondary"
              >
                <Mail01 aria-hidden="true" width={18} height={18} />
                Ask About This Item
              </Link>
            </div>
            <p className="itm-note">
              Sales happen in person at the shop, with all required paperwork
              completed at the counter.
            </p>
          </div>
        </div>
      </div>
      <style>{`
        .itm-back { margin: 0 0 1.5rem; }
        .itm-back a {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          min-height: 44px;
          text-decoration: none;
          font-size: 0.85rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .itm-back a:hover { text-decoration: underline; }
        .itm-grid {
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: 3rem;
          align-items: start;
        }
        .itm-photo {
          position: relative;
          aspect-ratio: 4 / 3;
          background: var(--bg-field);
          border: 1px solid var(--border-strong);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }
        .itm-photo > img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .itm-photo-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          width: 100%;
          height: 100%;
          padding: 1.5rem;
          text-align: center;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: var(--track-label);
          color: var(--text-muted);
        }
        .itm-photo-empty img { width: 4rem; height: 4rem; opacity: 0.35; }
        .itm-badge {
          position: absolute;
          top: 0.75rem;
          font-family: var(--font-display);
          font-size: 0.95rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 0.25rem 0.7rem;
          border-radius: var(--radius-sm);
        }
        .itm-badge--sale {
          left: 0.75rem;
          background: var(--brand);
          color: var(--ivory);
          box-shadow: inset 0 0 0 2px var(--brand),
            inset 0 0 0 3px color-mix(in srgb, var(--ivory) 55%, transparent);
        }
        .itm-badge--stock {
          right: 0.75rem;
          background: var(--bg);
          border: 1.5px solid var(--border-strong);
          color: var(--text-secondary);
        }
        .itm-thumbs {
          display: flex;
          gap: 0.6rem;
          flex-wrap: wrap;
          margin-top: 0.75rem;
        }
        .itm-thumb {
          width: 4.5rem;
          height: 4.5rem;
          padding: 0;
          border: 1.5px solid var(--border-strong);
          border-radius: var(--radius-sm);
          overflow: hidden;
          background: var(--bg-field);
          cursor: pointer;
        }
        .itm-thumb[aria-current='true'] { border-color: var(--brand); }
        .itm-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .itm-name {
          font-size: clamp(1.9rem, 1.4rem + 2.2vw, 2.8rem);
          margin: 0 0 0.75rem;
        }
        .itm-price {
          display: flex;
          align-items: baseline;
          gap: 0.6rem;
          flex-wrap: wrap;
          font-family: var(--font-display);
          font-size: 2rem;
          font-weight: 700;
          margin: 0 0 0.35rem;
        }
        .itm-compare { font-size: 1.2rem; font-weight: 500; color: var(--text-muted); }
        .itm-price-now { color: var(--brand-dark); }
        .itm-sale-label {
          font-size: 0.85rem;
          letter-spacing: 0.08em;
          background: var(--brand);
          color: var(--ivory);
          border-radius: var(--radius-sm);
          padding: 0.2rem 0.6rem;
          align-self: center;
        }
        .itm-stock {
          margin: 0 0 1.5rem;
          font-weight: 500;
          color: var(--text-secondary);
        }
        .itm-stock[data-stock='Low Stock'] { color: var(--accent-fall); }
        .itm-specs {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.9rem 1.5rem;
          border-top: 2px solid var(--border-strong);
          padding-top: 1.1rem;
          margin: 0 0 1.25rem;
        }
        .itm-spec dt {
          font-size: 0.72rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: var(--track-label);
          color: var(--text-muted);
          margin-bottom: 0.2rem;
        }
        .itm-spec dd { margin: 0; font-weight: 500; }
        .itm-desc {
          color: var(--text-secondary);
          max-width: 34rem;
          margin: 0 0 1.5rem;
        }
        .itm-ctas { display: flex; gap: 0.85rem; flex-wrap: wrap; margin: 0 0 0.9rem; }
        .itm-note { margin: 0; font-size: 0.85rem; color: var(--text-muted); max-width: 30rem; }
        @media (max-width: 899.98px) {
          .itm-grid { grid-template-columns: 1fr; gap: 1.75rem; }
        }
      `}</style>
    </section>
  );
}

export function InventoryItem() {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true, item: null });

  useEffect(() => {
    let alive = true;
    setState({ loading: true, item: null });
    (async () => {
      const { body } = await publicGetItem(id);
      if (!alive) return;
      setState({ loading: false, item: body?.ok ? body.item : null });
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (state.loading) {
    return (
      <section className="section" aria-label="Loading">
        <div className="wrap" role="status">
          <span className="sr-only">Loading the item</span>
          <div className="itm-skel" aria-hidden="true">
            <span className="sk sk--photo" />
            <span className="itm-skel-info">
              <span className="sk sk--line itm-skel-name" />
              <span className="sk sk--line itm-skel-price" />
              <span className="sk sk--line itm-skel-spec" />
              <span className="sk sk--line itm-skel-spec" />
            </span>
          </div>
        </div>
        <style>{`
          .itm-skel {
            display: grid;
            grid-template-columns: 1.1fr 1fr;
            gap: 3rem;
            align-items: start;
          }
          .itm-skel-info {
            display: flex;
            flex-direction: column;
            gap: 0.9rem;
          }
          .itm-skel-name { width: 70%; height: 2.4rem; }
          .itm-skel-price { width: 35%; height: 1.6rem; }
          .itm-skel-spec { width: 55%; }
          @media (max-width: 899.98px) {
            .itm-skel { grid-template-columns: 1fr; gap: 1.75rem; }
          }
        `}</style>
      </section>
    );
  }
  if (!state.item) return <NotFoundState />;
  return <ItemView item={state.item} />;
}
