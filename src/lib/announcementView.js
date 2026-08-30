// Pure logic for the announcement bar, kept free of React and the DOM so the
// smoke suite exercises exactly what the component decides.

// The bar renders only when it is enabled in siteFacts, carries real text,
// and the visitor has not dismissed it this visit.
export function shouldShowAnnouncement(config, dismissed) {
  if (dismissed) return false;
  if (!config || config.enabled !== true) return false;
  return typeof config.text === 'string' && config.text.trim().length > 0;
}
