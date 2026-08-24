// Pure view logic for the reviews section, kept free of React and the DOM so
// the smoke test exercises exactly what the component decides.

// The "Leave us a review" button links to the shop's Google review URL. Until
// the owner provides it, GOOGLE_REVIEW_URL stays a [[...]] placeholder; the
// button must never render a broken link, so it only shows for a real http(s)
// URL. Returns true only when the value is a usable web link.
export function hasReviewLink(url) {
  return typeof url === 'string' && /^https?:\/\/\S+/i.test(url.trim());
}

// Clamp a rating to a whole number of filled stars in the 0..5 range.
export function starCount(rating, max = 5) {
  const n = Math.round(Number(rating) || 0);
  return Math.max(0, Math.min(max, n));
}
