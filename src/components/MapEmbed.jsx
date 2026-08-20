// Responsive, accessible Google Maps embed for the storefront. Improves on a
// raw pasted iframe: fluid (no fixed 600x450), keeps a stable aspect ratio so
// layout never shifts while tiles load, carries a descriptive title for
// screen readers, sits in the brand frame (border + radius), and lazy-loads
// so it never blocks first paint. The embed URL lives in siteFacts.

import { BUSINESS, MAP_EMBED_URL } from '../content/siteFacts.js';

export function MapEmbed({ className = '' }) {
  const title = `Map to ${BUSINESS.name}, ${BUSINESS.address.line1}, ${BUSINESS.address.city}, ${BUSINESS.address.state} ${BUSINESS.address.zip}`;
  return (
    <div className={`map-embed ${className}`.trim()}>
      <iframe
        title={title}
        src={MAP_EMBED_URL}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
      <style>{`
        .map-embed {
          position: relative;
          aspect-ratio: 4 / 3;
          border: 1px solid var(--border-strong);
          border-radius: var(--radius-lg);
          overflow: hidden;
          background: var(--bg-field);
        }
        .map-embed iframe {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: 0;
          display: block;
        }
      `}</style>
    </div>
  );
}
