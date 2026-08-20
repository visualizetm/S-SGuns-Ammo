// DEMO sales seeds, tied to the DEMO catalog products, so the Overview page
// is populated for review. Every snapshot name carries the product's "DEMO:"
// prefix, so DEMO sales are self-labeled. Production starts EMPTY; these seed
// the dev store and the in-browser demo only, and never promote.
//
// soldAt is computed relative to now (spread across today, this week, and this
// month) so the DEMO sales always land inside the Overview Today / 7-day /
// 30-day buckets no matter when the store is seeded.

function ago(days, hour = 12) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export function seedSalesStore() {
  const rows = [
    { id: 'demo-sale-1', productId: 'demo-handgun-compact', productNameSnapshot: 'DEMO: Example Compact Pistol', priceAtSale: 389.5, quantity: 1, soldAt: ago(0, 10) },
    { id: 'demo-sale-2', productId: 'demo-ammo-9mm', productNameSnapshot: 'DEMO: Example 9mm Range Ammo, 50 rounds', priceAtSale: 17.99, quantity: 2, soldAt: ago(0, 14) },
    { id: 'demo-sale-3', productId: 'demo-rifle-bolt', productNameSnapshot: 'DEMO: Example Bolt-Action Rifle', priceAtSale: 649.99, quantity: 1, soldAt: ago(2) },
    { id: 'demo-sale-4', productId: 'demo-shotgun-pump', productNameSnapshot: 'DEMO: Example Pump Shotgun', priceAtSale: 449, quantity: 1, soldAt: ago(10) },
    { id: 'demo-sale-5', productId: 'demo-ammo-308', productNameSnapshot: 'DEMO: Example .308 Hunting Ammo, 20 rounds', priceAtSale: 32.5, quantity: 3, soldAt: ago(20) },
  ];
  return rows.map((row) => ({
    ...row,
    createdAt: row.soldAt,
    note: '',
    markedSold: false,
    prevStockStatus: null,
  }));
}
