// Global reveal-on-scroll system. An IntersectionObserver adds .is-visible to
// .reveal / .reveal-left / .reveal-right / .stagger as they enter the viewport
// (once, then unobserved). A MutationObserver re-scans as the DOM changes so
// content that mounts AFTER the initial paint - the inventory grid and the
// home featured strip load their data asynchronously - is always observed and
// revealed. Without this, async-mounted cards keep their hidden pre-reveal
// state (opacity 0) and never appear until a reload. CSS keeps everything
// visible under prefers-reduced-motion; if IntersectionObserver is missing we
// mark everything visible immediately (and keep doing so for new nodes).

import { useEffect } from 'react';

const SELECTOR = '.reveal, .reveal-left, .reveal-right, .stagger';

export function useReveal(pathname) {
  useEffect(() => {
    // No IntersectionObserver: reveal everything now and as nodes are added.
    if (typeof IntersectionObserver === 'undefined') {
      const showAll = () =>
        document
          .querySelectorAll(SELECTOR)
          .forEach((node) => node.classList.add('is-visible'));
      showAll();
      if (typeof MutationObserver === 'undefined') return undefined;
      const mo = new MutationObserver(showAll);
      mo.observe(document.body, { childList: true, subtree: true });
      return () => mo.disconnect();
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    const seen = new WeakSet();
    const scan = () => {
      document.querySelectorAll(SELECTOR).forEach((node) => {
        if (node.classList.contains('is-visible') || seen.has(node)) return;
        seen.add(node);
        io.observe(node);
      });
    };

    // Initial scan after first paint, then keep scanning for async content.
    const timer = setTimeout(scan, 60);
    let raf = 0;
    let mo;
    if (typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver(() => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          scan();
        });
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
      if (mo) mo.disconnect();
      io.disconnect();
    };
  }, [pathname]);
}
