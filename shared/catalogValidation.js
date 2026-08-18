// Shared validation for the product catalog: products, collections, and
// bundles. Used verbatim on the server (source of truth) and on the client
// for instant inline errors. Everything here is display data only: no cart,
// no checkout, no purchase flow anywhere.

export const CONDITIONS = ['New', 'Used'];

export const STOCK_STATUSES = ['In Stock', 'Low Stock', 'Sold', 'Hidden'];

const MAX_PHOTOS = 6;
const MAX_PHOTO_URL_LENGTH = 2_000_000;

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toNumber(value) {
  return typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
}

function validatePhotos(input, errors, field = 'photos') {
  if (input === undefined) return [];
  if (!Array.isArray(input)) {
    errors[field] = 'Photos must be a list.';
    return [];
  }
  if (input.length > MAX_PHOTOS) {
    errors[field] = `No more than ${MAX_PHOTOS} photos.`;
    return [];
  }
  const photos = [];
  for (const photo of input) {
    const url = cleanString(photo?.url ?? photo);
    if (!url) continue;
    if (url.length > MAX_PHOTO_URL_LENGTH) {
      errors[field] = 'A photo is too large. Use a smaller image.';
      return [];
    }
    if (!/^(data:image\/(jpeg|png|webp);base64,|https?:\/\/|\/)/.test(url)) {
      errors[field] = 'Photos must be uploaded images or image links.';
      return [];
    }
    photos.push({ url });
  }
  return photos;
}

function validatePrice(value, errors, field, { required }) {
  const price = toNumber(value);
  if (price === undefined || price === null || price === '') {
    if (required) errors[field] = 'Price must be a positive number.';
    return undefined;
  }
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    errors[field] = 'Price must be a positive number.';
    return undefined;
  }
  if (price > 1_000_000) {
    errors[field] = 'Price looks too high. Check the number.';
    return undefined;
  }
  return Math.round(price * 100) / 100;
}

// ---------- Products ----------

// Validates a full product (create) or a partial patch (update). Returns
// { ok: true, data } with cleaned known fields, or { ok: false, errors }.
// onSale is computed here, never trusted from input.
export function validateProduct(input, { partial = false } = {}) {
  const errors = {};
  const data = {};
  const src = input && typeof input === 'object' ? input : {};
  const has = (field) => src[field] !== undefined;
  const require = (field) => !partial || has(field);

  if (require('name')) {
    const name = cleanString(src.name);
    if (!name) errors.name = 'Name is required.';
    else if (name.length > 120) errors.name = 'Keep the name under 120 characters.';
    else data.name = name;
  }

  if (has('collectionIds') || !partial) {
    const ids = src.collectionIds;
    if (ids === undefined) {
      data.collectionIds = [];
    } else if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !id)) {
      errors.collectionIds = 'Collections must be a list of collection ids.';
    } else {
      data.collectionIds = [...new Set(ids)];
    }
  }

  if (require('manufacturer')) {
    const manufacturer = cleanString(src.manufacturer);
    if (!manufacturer) errors.manufacturer = 'Manufacturer is required.';
    else if (manufacturer.length > 80) errors.manufacturer = 'Keep the manufacturer under 80 characters.';
    else data.manufacturer = manufacturer;
  }

  if (require('model')) {
    const model = cleanString(src.model);
    if (!model) errors.model = 'Model is required.';
    else if (model.length > 80) errors.model = 'Keep the model under 80 characters.';
    else data.model = model;
  }

  if (has('caliber') || !partial) {
    const caliber = cleanString(src.caliber);
    if (caliber.length > 40) errors.caliber = 'Keep the caliber under 40 characters.';
    else data.caliber = caliber;
  }

  if (require('condition')) {
    const condition = cleanString(src.condition);
    if (!CONDITIONS.includes(condition)) errors.condition = 'Condition must be New or Used.';
    else data.condition = condition;
  }

  if (require('price')) {
    const price = validatePrice(src.price, errors, 'price', { required: true });
    if (price !== undefined) data.price = price;
  }

  // Optional compare-at price: when present it must exceed the price, and
  // it marks the product on sale for the future public page.
  if (has('compareAtPrice') || !partial) {
    const raw = src.compareAtPrice;
    if (raw === undefined || raw === null || raw === '') {
      data.compareAtPrice = null;
    } else {
      const compareAt = validatePrice(raw, errors, 'compareAtPrice', { required: false });
      if (compareAt !== undefined) data.compareAtPrice = compareAt;
    }
  }

  if (has('saleLabel') || !partial) {
    const saleLabel = cleanString(src.saleLabel);
    if (saleLabel.length > 40) errors.saleLabel = 'Keep the sale label under 40 characters.';
    else data.saleLabel = saleLabel;
  }

  if (require('stockStatus')) {
    const stockStatus = cleanString(src.stockStatus);
    if (!STOCK_STATUSES.includes(stockStatus)) errors.stockStatus = 'Pick a stock status from the list.';
    else data.stockStatus = stockStatus;
  }

  if (has('description') || !partial) {
    const description = cleanString(src.description);
    if (description.length > 800) errors.description = 'Keep the description under 800 characters.';
    else data.description = description;
  }

  if (has('photos') || !partial) {
    const photos = validatePhotos(src.photos, errors);
    if (!errors.photos) data.photos = photos;
  }

  if (has('featured') || !partial) {
    data.featured = Boolean(src.featured);
  }

  // Cross-field: compare-at must beat the price to mean anything.
  const price = data.price;
  const compareAt = data.compareAtPrice;
  if (
    !errors.price &&
    !errors.compareAtPrice &&
    typeof compareAt === 'number' &&
    typeof price === 'number' &&
    compareAt <= price
  ) {
    errors.compareAtPrice = 'Compare-at price must be higher than the price.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  // Computed sale flag (full validations only; patches recompute in the
  // adapter once merged with the existing draft).
  if (!partial) {
    data.onSale = typeof data.compareAtPrice === 'number';
  }
  return { ok: true, data };
}

// Recomputes onSale after a partial patch has been merged onto a draft.
export function withComputedSale(product) {
  return {
    ...product,
    onSale:
      typeof product.compareAtPrice === 'number' &&
      typeof product.price === 'number' &&
      product.compareAtPrice > product.price,
  };
}

// ---------- Collections ----------

export function validateCollection(input, { partial = false } = {}) {
  const errors = {};
  const data = {};
  const src = input && typeof input === 'object' ? input : {};
  const has = (field) => src[field] !== undefined;

  if (!partial || has('name')) {
    const name = cleanString(src.name);
    if (!name) errors.name = 'Name is required.';
    else if (name.length > 60) errors.name = 'Keep the name under 60 characters.';
    else data.name = name;
  }

  if (has('description') || !partial) {
    const description = cleanString(src.description);
    if (description.length > 300) errors.description = 'Keep the description under 300 characters.';
    else data.description = description;
  }

  if (has('coverPhoto') || !partial) {
    const photos = validatePhotos(
      src.coverPhoto ? [src.coverPhoto] : [],
      errors,
      'coverPhoto'
    );
    if (!errors.coverPhoto) data.coverPhoto = photos[0]?.url || '';
  }

  if (has('sortOrder')) {
    const sortOrder = toNumber(src.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      errors.sortOrder = 'Sort order must be a whole number.';
    } else data.sortOrder = sortOrder;
  }

  if (has('visible') || !partial) {
    data.visible = src.visible === undefined ? true : Boolean(src.visible);
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data };
}

// ---------- Bundles ----------

export function validateBundle(input, { partial = false } = {}) {
  const errors = {};
  const data = {};
  const src = input && typeof input === 'object' ? input : {};
  const has = (field) => src[field] !== undefined;

  if (!partial || has('name')) {
    const name = cleanString(src.name);
    if (!name) errors.name = 'Name is required.';
    else if (name.length > 120) errors.name = 'Keep the name under 120 characters.';
    else data.name = name;
  }

  if (has('description') || !partial) {
    const description = cleanString(src.description);
    if (description.length > 800) errors.description = 'Keep the description under 800 characters.';
    else data.description = description;
  }

  if (has('photo') || !partial) {
    const photos = validatePhotos(src.photo ? [src.photo] : [], errors, 'photo');
    if (!errors.photo) data.photo = photos[0]?.url || '';
  }

  if (!partial || has('memberProductIds')) {
    const ids = src.memberProductIds;
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !id)) {
      errors.memberProductIds = 'Pick the products that belong to this bundle.';
    } else {
      const unique = [...new Set(ids)];
      if (unique.length < 2) {
        errors.memberProductIds = 'A bundle needs at least two products.';
      } else if (unique.length > 12) {
        errors.memberProductIds = 'Keep bundles to 12 products or fewer.';
      } else {
        data.memberProductIds = unique;
      }
    }
  }

  if (!partial || has('price')) {
    const price = validatePrice(src.price, errors, 'price', { required: true });
    if (price !== undefined) data.price = price;
  }

  if (has('compareAtPrice') || !partial) {
    const raw = src.compareAtPrice;
    if (raw === undefined || raw === null || raw === '') {
      data.compareAtPrice = null;
    } else {
      const compareAt = validatePrice(raw, errors, 'compareAtPrice', { required: false });
      if (compareAt !== undefined) data.compareAtPrice = compareAt;
    }
  }

  if (has('visible') || !partial) {
    data.visible = src.visible === undefined ? true : Boolean(src.visible);
  }

  if (
    !errors.price &&
    !errors.compareAtPrice &&
    typeof data.compareAtPrice === 'number' &&
    typeof data.price === 'number' &&
    data.compareAtPrice <= data.price
  ) {
    errors.compareAtPrice = 'Compare-at price must be higher than the bundle price.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (!partial) {
    data.onSale = typeof data.compareAtPrice === 'number';
  }
  return { ok: true, data };
}
