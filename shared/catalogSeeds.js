// DEMO catalog seeds in draft/publish record form. Every fictional item is
// prefixed "DEMO:". The starter collections migrate the Phase 1 category
// constant into owner-editable collections (their names are generic retail
// structure, not product facts). Production starts empty; these seed the
// dev store and the in-browser demo only.
//
// Seed states demonstrate the publish flow out of the box:
//   - most records: live (draft equals published)
//   - one product: never published ("Not on site yet" badge)
//   - one product: draft edits pending ("Unpublished changes" badge)

function ts(offsetDays) {
  return new Date(Date.UTC(2026, 6, 1) - offsetDays * 86400000).toISOString();
}

function live(offsetDays, id, fields) {
  return {
    id,
    createdAt: ts(offsetDays),
    updatedAt: ts(offsetDays),
    draft: { ...fields },
    published: { ...fields },
  };
}

const COLLECTION_DEFS = [
  ['col-handguns', 'Handguns'],
  ['col-rifles', 'Rifles'],
  ['col-shotguns', 'Shotguns'],
  ['col-ammunition', 'Ammunition'],
  ['col-optics', 'Optics & Accessories'],
  ['col-other', 'Other'],
];

export const SEED_COLLECTIONS = COLLECTION_DEFS.map(([id, name], index) =>
  live(20 - index, id, {
    name,
    description: 'Starter collection.',
    coverPhoto: '',
    sortOrder: index,
    visible: true,
  })
);

function product(fields) {
  return {
    caliber: '',
    compareAtPrice: null,
    saleLabel: '',
    onSale: false,
    description: '',
    photos: [],
    featured: false,
    ...fields,
  };
}

export const SEED_PRODUCTS = [
  live(1, 'demo-rifle-bolt', product({
    name: 'DEMO: Example Bolt-Action Rifle',
    collectionIds: ['col-rifles'],
    manufacturer: 'Example Arms Co.',
    model: 'Model 100',
    caliber: '.308 Win',
    condition: 'New',
    price: 649.99,
    stockStatus: 'In Stock',
    description: 'Demo listing to show how a rifle entry looks. Not a real item.',
    featured: true,
  })),
  live(2, 'demo-rifle-lever', product({
    name: 'DEMO: Example Lever-Action Rifle',
    collectionIds: ['col-rifles'],
    manufacturer: 'Example Arms Co.',
    model: 'Heritage 94',
    caliber: '.30-30 Win',
    condition: 'Used',
    price: 425.0,
    stockStatus: 'Low Stock',
    description: 'Demo listing for a used lever gun. Not a real item.',
  })),
  live(3, 'demo-handgun-compact', product({
    name: 'DEMO: Example Compact Pistol',
    collectionIds: ['col-handguns'],
    manufacturer: 'Sample Firearms',
    model: 'C-9',
    caliber: '9mm',
    condition: 'New',
    price: 389.5,
    compareAtPrice: 449.5,
    saleLabel: 'DEMO Sale',
    onSale: true,
    stockStatus: 'In Stock',
    description: 'Demo listing showing sale pricing. Not a real item.',
    featured: true,
  })),
  live(5, 'demo-shotgun-pump', product({
    name: 'DEMO: Example Pump Shotgun',
    collectionIds: ['col-shotguns'],
    manufacturer: 'Example Arms Co.',
    model: 'Field 12',
    caliber: '12 GA',
    condition: 'New',
    price: 449.0,
    stockStatus: 'In Stock',
    description: 'Demo listing to show how a shotgun entry looks. Not a real item.',
  })),
  live(6, 'demo-shotgun-ou', product({
    name: 'DEMO: Example Over-Under Shotgun',
    collectionIds: ['col-shotguns'],
    manufacturer: 'Sample Firearms',
    model: 'Clays 20',
    caliber: '20 GA',
    condition: 'Used',
    price: 780.0,
    stockStatus: 'Hidden',
    description: 'Demo listing marked Hidden. It never appears in public reads.',
  })),
  live(7, 'demo-ammo-9mm', product({
    name: 'DEMO: Example 9mm Range Ammo, 50 rounds',
    collectionIds: ['col-ammunition'],
    manufacturer: 'Sample Munitions',
    model: 'Range Pack',
    caliber: '9mm',
    condition: 'New',
    price: 17.99,
    stockStatus: 'In Stock',
    description: 'Demo listing to show how an ammunition entry looks.',
  })),
  live(8, 'demo-ammo-308', product({
    name: 'DEMO: Example .308 Hunting Ammo, 20 rounds',
    collectionIds: ['col-ammunition'],
    manufacturer: 'Sample Munitions',
    model: 'Field Pack',
    caliber: '.308 Win',
    condition: 'New',
    price: 32.5,
    stockStatus: 'Low Stock',
    description: 'Demo listing to show a low stock badge.',
  })),
  live(9, 'demo-optic-scope', product({
    name: 'DEMO: Example 3-9x40 Rifle Scope',
    collectionIds: ['col-optics'],
    manufacturer: 'Sample Optics',
    model: 'Clearview 3940',
    condition: 'New',
    price: 159.0,
    stockStatus: 'In Stock',
    description: 'Demo listing to show how an optics entry looks.',
  })),
];

// One product with pending draft edits: price drop staged but not live.
const revolverFields = product({
  name: 'DEMO: Example Revolver',
  collectionIds: ['col-handguns'],
  manufacturer: 'Sample Firearms',
  model: 'R-38',
  caliber: '.38 Special',
  condition: 'Used',
  price: 299.0,
  stockStatus: 'In Stock',
  description: 'Demo listing with staged edits to show the publish bar.',
});
SEED_PRODUCTS.push({
  id: 'demo-handgun-revolver',
  createdAt: ts(4),
  updatedAt: ts(0.5),
  draft: { ...revolverFields, price: 279.0 },
  published: { ...revolverFields },
});

// One never-published product: shows the "Not on site yet" badge.
SEED_PRODUCTS.push({
  id: 'demo-other-case',
  createdAt: ts(0.2),
  updatedAt: ts(0.2),
  draft: product({
    name: 'DEMO: Example Hard Rifle Case',
    collectionIds: ['col-other'],
    manufacturer: 'Sample Gear',
    model: 'Guard 48',
    condition: 'New',
    price: 54.99,
    stockStatus: 'In Stock',
    description: 'Demo draft that has never been published.',
  }),
  published: null,
});

export const SEED_BUNDLES = [
  live(2.5, 'demo-bundle-range', {
    name: 'DEMO: Range Starter Package',
    description:
      'Demo package deal pairing the demo pistol with demo range ammo. Call the shop.',
    photo: '',
    memberProductIds: ['demo-handgun-compact', 'demo-ammo-9mm'],
    price: 399.0,
    compareAtPrice: 407.49,
    onSale: true,
    visible: true,
  }),
];

export function seedCatalogStore() {
  return {
    products: SEED_PRODUCTS.map((r) => JSON.parse(JSON.stringify(r))),
    collections: SEED_COLLECTIONS.map((r) => JSON.parse(JSON.stringify(r))),
    bundles: SEED_BUNDLES.map((r) => JSON.parse(JSON.stringify(r))),
  };
}
