// Services content. The exact service list is UNCONFIRMED with the owner;
// each entry is written neutrally and the whole list is flagged in
// NEEDS-CONFIRMATION.md. Informational only: no prices, no e-commerce.

export const SERVICES_CONFIRMATION_NOTE =
  '[[SERVICE LIST - confirm each service with owner before publish]]';

export const SERVICES = [
  {
    id: 'firearms',
    title: 'Firearms',
    description:
      'In-store selection of firearms for hunting and sport shooting. Visit the shop or call for current availability.',
  },
  {
    id: 'ammunition',
    title: 'Ammunition',
    description:
      'Ammunition for common calibers and gauges. Call ahead to check stock.',
  },
  {
    id: 'transfers',
    title: 'FFL Transfers',
    // LEGAL REVIEW REQUIRED before publish
    description:
      'Transfer service for firearms purchased online or from out of state. Call the shop for current transfer details.',
  },
  {
    id: 'special-orders',
    title: 'Special Orders',
    description:
      'Ask about ordering an item the shop does not have on the shelf.',
  },
];
