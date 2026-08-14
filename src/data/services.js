// Services content. The exact service list is UNCONFIRMED with the owner;
// each entry is written neutrally and the whole list is flagged in
// NEEDS-CONFIRMATION.md. Informational only: no prices, no e-commerce.
//
// `confirmed` gates rendering: only confirmed entries appear on the site.
// The entries below marked true are the neutral draft list approved for the
// draft build; final line-by-line owner confirmation is still tracked in
// NEEDS-CONFIRMATION.md. Anything false stays hidden everywhere.

export const SERVICES_CONFIRMATION_NOTE =
  '[[SERVICE LIST - confirm each service with owner before publish]]';

export const SERVICES = [
  {
    id: 'firearms',
    title: 'Firearms',
    confirmed: true,
    description:
      'In-store selection of firearms for hunting and sport shooting. Visit the shop or call for current availability.',
  },
  {
    id: 'ammunition',
    title: 'Ammunition',
    confirmed: true,
    description:
      'Ammunition for common calibers and gauges. Call ahead to check stock.',
  },
  {
    id: 'transfers',
    title: 'FFL Transfers',
    confirmed: true,
    // LEGAL REVIEW REQUIRED before publish
    description:
      'Transfer service for firearms purchased online or from out of state. Call the shop for current transfer details.',
  },
  {
    id: 'special-orders',
    title: 'Special Orders',
    confirmed: true,
    description:
      'Ask about ordering an item the shop does not have on the shelf.',
  },
  {
    id: 'gunsmithing',
    title: 'Gunsmithing',
    confirmed: false, // UNCONFIRMED: hidden until the owner confirms it
    description:
      'Repair and maintenance work. Call the shop to ask what is offered.',
  },
];

export const CONFIRMED_SERVICES = SERVICES.filter((s) => s.confirmed);
