// Shared inventory validation, used verbatim on the server (source of
// truth) and on the client for instant inline errors. Inventory is display
// data only: no cart, no checkout, no purchase flow anywhere.

// Single editable constant for categories. Confirm the final list with the
// owner (tracked in NEEDS-CONFIRMATION.md).
export const INVENTORY_CATEGORIES = [
  'Handguns',
  'Rifles',
  'Shotguns',
  'Ammunition',
  'Optics & Accessories',
  'Other',
];

export const CONDITIONS = ['New', 'Used'];

export const STOCK_STATUSES = ['In Stock', 'Low Stock', 'Sold', 'Hidden'];

const MAX_PHOTOS = 6;
// Data-URL photos (dev storage) are capped after client-side downscaling.
const MAX_PHOTO_URL_LENGTH = 2_000_000;

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validatePhotos(input, errors) {
  if (input === undefined) return [];
  if (!Array.isArray(input)) {
    errors.photos = 'Photos must be a list.';
    return [];
  }
  if (input.length > MAX_PHOTOS) {
    errors.photos = `No more than ${MAX_PHOTOS} photos per item.`;
    return [];
  }
  const photos = [];
  for (const photo of input) {
    const url = cleanString(photo?.url ?? photo);
    if (!url) continue;
    if (url.length > MAX_PHOTO_URL_LENGTH) {
      errors.photos = 'A photo is too large. Use a smaller image.';
      return [];
    }
    if (!/^(data:image\/(jpeg|png|webp);base64,|https?:\/\/|\/)/.test(url)) {
      errors.photos = 'Photos must be uploaded images or image links.';
      return [];
    }
    photos.push({ url });
  }
  return photos;
}

// Validates a full item (create) or a partial patch (update). Returns
// { ok: true, data } with only known, cleaned fields, or { ok: false, errors }.
export function validateInventoryItem(input, { partial = false } = {}) {
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

  if (require('category')) {
    const category = cleanString(src.category);
    if (!INVENTORY_CATEGORIES.includes(category)) {
      errors.category = 'Pick a category from the list.';
    } else data.category = category;
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
    else data.caliber = caliber; // optional, may be empty
  }

  if (require('condition')) {
    const condition = cleanString(src.condition);
    if (!CONDITIONS.includes(condition)) {
      errors.condition = 'Condition must be New or Used.';
    } else data.condition = condition;
  }

  if (require('price')) {
    const price = typeof src.price === 'string' ? Number(src.price) : src.price;
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
      errors.price = 'Price must be a positive number.';
    } else if (price > 1_000_000) {
      errors.price = 'Price looks too high. Check the number.';
    } else data.price = Math.round(price * 100) / 100;
  }

  if (require('stockStatus')) {
    const stockStatus = cleanString(src.stockStatus);
    if (!STOCK_STATUSES.includes(stockStatus)) {
      errors.stockStatus = 'Pick a stock status from the list.';
    } else data.stockStatus = stockStatus;
  }

  if (has('description') || !partial) {
    const description = cleanString(src.description);
    if (description.length > 800) errors.description = 'Keep the description under 800 characters.';
    else data.description = description; // optional, may be empty
  }

  if (has('photos') || !partial) {
    data.photos = validatePhotos(src.photos, errors);
    if (errors.photos) delete data.photos;
  }

  if (has('featured') || !partial) {
    data.featured = Boolean(src.featured);
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data };
}
