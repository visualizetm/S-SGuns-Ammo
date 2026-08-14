// Business facts. CONFIRMED items are safe to render as-is. Everything else
// renders a clearly labeled placeholder and is tracked in NEEDS-CONFIRMATION.md.

// CONFIRMED
export const BUSINESS = {
  name: 'S&S Guns & Ammo',
  address: {
    line1: '10 S. 3rd Street, Unit 5',
    city: 'Oxford',
    state: 'PA',
    zip: '19363',
  },
  phoneDisplay: '(610) 368-6984',
  phoneHref: 'tel:+16103686984',
  directionsUrl:
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent('10 S. 3rd Street, Unit 5, Oxford, PA 19363'),
};

// UNCONFIRMED: render as labeled placeholders only. Do not replace with
// guessed values. See NEEDS-CONFIRMATION.md.
export const PLACEHOLDERS = {
  hours: '[[HOURS - confirm with owner]]',
  email: '[[EMAIL ADDRESS - confirm with owner]]',
  ownerNames: '[[OWNER NAMES - confirm with owner]]',
  foundingYear: '[[FOUNDING YEAR - confirm with owner]]',
  aboutStory: '[[FAMILY STORY - confirm with owner]]',
};
