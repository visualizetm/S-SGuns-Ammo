// Pure statistics for the admin Overview page: stock mix, listed inventory
// value, sales windows, revenue, and the trailing daily chart buckets. Kept
// free of React and the DOM so the smoke test exercises the exact math the
// Overview renders, with a fixed `now` for determinism.

export function saleTotal(sale) {
  return (Number(sale?.priceAtSale) || 0) * (Number(sale?.quantity) || 0);
}

// Start of a named window relative to `now`. 'today' is local midnight; '7d'
// and '30d' are rolling N-day windows; 'all' reaches the epoch.
export function rangeStart(id, now = new Date()) {
  if (id === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (id === '7d') return new Date(now.getTime() - 7 * 86400000);
  if (id === '30d') return new Date(now.getTime() - 30 * 86400000);
  return new Date(0);
}

export function salesInWindow(sales, rangeId, now = new Date()) {
  const start = rangeStart(rangeId, now).getTime();
  return sales.filter((s) => {
    const t = new Date(s.soldAt).getTime();
    return !Number.isNaN(t) && t >= start;
  });
}

export function sumRevenue(sales) {
  return sales.reduce((sum, s) => sum + saleTotal(s), 0);
}

// Stock counts by status plus the listed value (In Stock + Low Stock at the
// listed price, the items publicly available to buy).
export function stockSummary(products) {
  const counts = { 'In Stock': 0, 'Low Stock': 0, Sold: 0, Hidden: 0 };
  let listedValue = 0;
  for (const p of products) {
    if (counts[p.stockStatus] !== undefined) counts[p.stockStatus] += 1;
    if (p.stockStatus === 'In Stock' || p.stockStatus === 'Low Stock') {
      listedValue += Number(p.price) || 0;
    }
  }
  return { counts, listedValue };
}

function dayKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Trailing per-day revenue buckets ending today, oldest first.
export function dailyBuckets(sales, days = 14, now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const list = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today.getTime() - i * 86400000);
    list.push({ key: dayKey(d), date: d, total: 0 });
  }
  const index = new Map(list.map((b) => [b.key, b]));
  for (const sale of sales) {
    const d = new Date(sale.soldAt);
    if (Number.isNaN(d.getTime())) continue;
    const bucket = index.get(dayKey(d));
    if (bucket) bucket.total += saleTotal(sale);
  }
  return list;
}
