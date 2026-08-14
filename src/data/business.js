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
  parking: '[[PARKING DETAILS - confirm with owner]]',
};

// Logo art is Rob-supplied. Drop the real files into public/brand/ and set
// the paths here; every slot then renders the image instead of its label.
// Do not generate or substitute logo art. The rifle-seal art may be used
// only as a large feature graphic on Home and About, never at icon scale.
export const LOGO_ASSETS = {
  wordmark: null, // horizontal wordmark, header. e.g. '/brand/wordmark.svg'
  submark: null, // weapon-free submark, favicon and og:image source
  seal: null, // detailed rifle-seal art, large feature graphic only
};

// Social links are UNCONFIRMED. Leave empty until the owner confirms real
// accounts; empty means no social UI renders anywhere.
export const SOCIAL_LINKS = [];

// Trust strip: confirmed, factual, no invented stats.
export const TRUST_POINTS = [
  {
    id: 'family',
    icon: 'users',
    title: 'Family owned',
    body: 'A family-run shop, not a chain counter.',
  },
  {
    id: 'local',
    icon: 'pin',
    title: 'Local to Oxford',
    body: 'On S. 3rd Street in downtown Oxford, Pennsylvania.',
  },
  {
    id: 'straight',
    icon: 'chat',
    title: 'Straightforward service',
    body: 'Plain answers to your questions, in person or on the phone.',
  },
];

// Shop values for the About page. Brand copy, not factual claims.
export const SHOP_VALUES = [
  {
    id: 'straight-answers',
    title: 'Straight answers',
    body: 'Ask anything. You get a plain answer, not a pitch.',
  },
  {
    id: 'fair-dealing',
    title: 'Fair dealing',
    body: 'Every customer gets the same honest treatment at the counter.',
  },
  {
    id: 'local-first',
    title: 'Local first',
    body: 'Built to serve Oxford and the surrounding area for the long haul.',
  },
];
