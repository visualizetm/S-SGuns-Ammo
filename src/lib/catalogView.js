// Pure view logic for the public catalog: filtering, ordering, badges, and
// the ask-about prefill. Kept free of React and the DOM so the smoke test
// exercises exactly what the pages render with.

// Featured items first, then newest. Input arrives newest-first from the
// API; the sort is stable so that order holds within each group.
export function orderProducts(items) {
  return [...items].sort(
    (a, b) => (b.featured === true) - (a.featured === true)
  );
}

// Client-side filtering of the fetched snapshot. "In stock only" hides
// Sold items; Low Stock still counts as in stock. Hidden never arrives.
export function filterProducts(
  items,
  { collectionId = '', q = '', condition = '', inStockOnly = false } = {}
) {
  const needle = q.trim().toLowerCase();
  return items.filter((item) => {
    if (collectionId && !(item.collectionIds || []).includes(collectionId)) {
      return false;
    }
    if (condition && item.condition !== condition) return false;
    if (inStockOnly && item.stockStatus === 'Sold') return false;
    if (needle) {
      const hay = [item.name, item.manufacturer, item.model, item.caliber]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

// Badge model for a product card. Sale badge text prefers the saleLabel.
// In Stock is the default state and gets no badge.
export function badgesFor(item) {
  return {
    sale: item.onSale ? item.saleLabel || 'Sale' : null,
    stock:
      item.stockStatus === 'Low Stock'
        ? 'Low Stock'
        : item.stockStatus === 'Sold'
          ? 'Sold'
          : null,
    dimmed: item.stockStatus === 'Sold',
  };
}

// Featured strip on Home: renders only when featured published items exist.
export function featuredItems(items, limit = 4) {
  return items.filter((item) => item.featured === true).slice(0, limit);
}

// Prefill for the contact form when arriving from an item page.
export function askAboutMessage(itemName) {
  const name = String(itemName || '').trim();
  if (!name) return '';
  return `I am asking about: ${name}.\n\n`;
}
