// One global IntersectionObserver for the reveal-on-scroll system. Watches
// .reveal, .reveal-left, .reveal-right and .stagger, adds .is-visible once,
// then unobserves. Re-attaches after every route change on a small timeout
// so newly mounted nodes get observed. CSS keeps everything visible under
// prefers-reduced-motion, and if IntersectionObserver is unavailable we
// mark everything visible immediately.

import { useEffect } from 'react';

const SELECTOR = '.reveal, .reveal-left, .reveal-right, .stagger';

export function useReveal(pathname) {
  useEffect(() => {
    let observer;

    const timer = setTimeout(() => {
      const nodes = document.querySelectorAll(SELECTOR);
      if (typeof IntersectionObserver === 'undefined') {
        nodes.forEach((node) => node.classList.add('is-visible'));
        return;
      }
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
      );
      nodes.forEach((node) => {
        if (node.classList.contains('is-visible')) return;
        observer.observe(node);
      });
    }, 60);

    return () => {
      clearTimeout(timer);
      if (observer) observer.disconnect();
    };
  }, [pathname]);
}
