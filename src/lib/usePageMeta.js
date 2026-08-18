// Per-route document title, meta description, and Open Graph tags for an
// SPA. og values fall back to the brand defaults from index.html when a
// page stops overriding them.

import { useEffect } from 'react';

const SITE = 'S&S Guns & Ammo';
const DEFAULT_OG_IMAGE = '/og-image.png';

function setMeta(selector, content) {
  const tag = document.querySelector(selector);
  if (tag) tag.setAttribute('content', content);
}

export function usePageMeta(title, description, og = null) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE}` : `${SITE} | Oxford, PA`;
    document.title = fullTitle;
    if (description) {
      setMeta('meta[name="description"]', description);
    }
    setMeta('meta[property="og:title"]', og?.title || fullTitle);
    setMeta(
      'meta[property="og:description"]',
      og?.description || description || ''
    );
    setMeta('meta[property="og:image"]', og?.image || DEFAULT_OG_IMAGE);
  }, [title, description, og?.title, og?.description, og?.image]);
}
