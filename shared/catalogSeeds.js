// Catalog seed data: EMPTY. The catalog starts with no products, no
// collections, and no bundles everywhere (dev store, in-browser demo, and
// production), ready for the owner's real inventory.
//
// The DEMO example listings that used to live here were removed before
// launch (see git history if a reference set is ever needed again). Keeping
// the exports and seedCatalogStore() in place, but empty, means every
// consumer keeps working without a special case.

export const SEED_COLLECTIONS = [];

export const SEED_PRODUCTS = [];

export const SEED_BUNDLES = [];

export function seedCatalogStore() {
  return {
    products: [],
    collections: [],
    bundles: [],
  };
}
