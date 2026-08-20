// Server-side validation for a Quick Sale log entry. Owner-only tool; the
// endpoint checks productId against the catalog and snapshots the product
// name itself. NO buyer personal information is accepted here: a sale records
// only the item, amount, quantity, time, and a short non-personal note.
//
// LEGAL REVIEW REQUIRED: Quick Sale is a convenience business/inventory log,
// not the federal ATF or state Acquisition and Disposition record.

const NOTE_MAX = 200;

function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateSale(input = {}) {
  const errors = {};
  const data = {};
  const i = input && typeof input === 'object' ? input : {};

  const productId = str(i.productId);
  if (!productId) errors.productId = 'Pick a product to log the sale against.';
  else data.productId = productId;

  // priceAtSale: non-negative number (owner-editable for negotiated prices).
  const priceRaw =
    typeof i.priceAtSale === 'string' && i.priceAtSale.trim() !== ''
      ? Number(i.priceAtSale)
      : i.priceAtSale;
  if (typeof priceRaw !== 'number' || !Number.isFinite(priceRaw) || priceRaw < 0) {
    errors.priceAtSale = 'Sale price must be zero or more.';
  } else if (priceRaw > 1000000) {
    errors.priceAtSale = 'That price looks too high. Check the number.';
  } else {
    data.priceAtSale = Math.round(priceRaw * 100) / 100;
  }

  // quantity: positive integer, default 1.
  const qtyRaw =
    i.quantity === undefined || i.quantity === null || i.quantity === ''
      ? 1
      : typeof i.quantity === 'string'
        ? Number(i.quantity)
        : i.quantity;
  if (!Number.isInteger(qtyRaw) || qtyRaw < 1) {
    errors.quantity = 'Quantity must be a whole number, at least 1.';
  } else if (qtyRaw > 100000) {
    errors.quantity = 'That quantity looks too high.';
  } else {
    data.quantity = qtyRaw;
  }

  // soldAt: timestamp, default now.
  if (i.soldAt === undefined || i.soldAt === null || i.soldAt === '') {
    data.soldAt = new Date().toISOString();
  } else {
    const when = new Date(i.soldAt);
    if (Number.isNaN(when.getTime())) errors.soldAt = 'That date is not valid.';
    else data.soldAt = when.toISOString();
  }

  // note: optional, capped. Placeholder guides the owner to keep it free of
  // any customer information; there is nothing personal to validate here.
  const note = str(i.note);
  if (note.length > NOTE_MAX) errors.note = `Keep the note under ${NOTE_MAX} characters.`;
  else data.note = note;

  // markSold: optional. When true, the endpoint sets the item Sold live.
  data.markSold = i.markSold === true || i.markSold === 'true';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data };
}
