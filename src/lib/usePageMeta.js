// Per-route document title and meta description for an SPA.

import { useEffect } from 'react';

const SITE = 'S&S Guns & Ammo';

export function usePageMeta(title, description) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE}` : `${SITE} | Oxford, PA`;
    if (description) {
      const tag = document.querySelector('meta[name="description"]');
      if (tag) tag.setAttribute('content', description);
    }
  }, [title, description]);
}
