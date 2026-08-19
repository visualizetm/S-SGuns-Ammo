// SINGLE SOURCE OF TRUTH for every business fact and swappable copy block
// the site renders. The production content swap is an edit to THIS FILE
// plus copy review; no fact is hardcoded in a component.
//
// CONFIRMED values are real. Everything unconfirmed keeps a clearly
// labeled [[PLACEHOLDER]] and a matching entry in NEEDS-CONFIRMATION.md.
// Never replace a placeholder with a guess.

// ---------- Deployment ----------

// Swapped to the custom domain at launch. Used by the sitemap, robots,
// and JSON-LD generation.
export const BASE_URL = 'https://ssgunsammo.visualizeclients.com';

// ---------- Confirmed facts ----------

export const BUSINESS = {
  name: 'S&S Guns & Ammo',
  address: {
    line1: '10 S. 3rd Street, Unit 5',
    city: 'Oxford',
    state: 'PA',
    zip: '19363',
  },
  phoneDisplay: '(610) 467-0284',
  phoneHref: 'tel:+16104670284',
  directionsUrl:
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent('10 S. 3rd Street, Unit 5, Oxford, PA 19363'),
};

// Confirmed owner email, kept on file for internal reference. The public
// site takes calls, not messages: there are no contact forms and no email
// is displayed unless the owner asks for one (see PLACEHOLDERS.email).
export const OWNER_EMAIL = 'sandsammozone@gmail.com';

// ---------- Unconfirmed facts: labeled placeholders only ----------

export const PLACEHOLDERS = {
  hours: '[[HOURS - confirm with owner]]',
  email: '[[EMAIL ADDRESS - confirm with owner]]',
  ownerNames: '[[OWNER NAMES - confirm with owner]]',
  foundingYear: '[[FOUNDING YEAR - confirm with owner]]',
  aboutStory: '[[FAMILY STORY - confirm with owner]]',
  parking: '[[PARKING DETAILS - confirm with owner]]',
};

// Social links are UNCONFIRMED. Empty means no social UI renders anywhere.
export const SOCIAL_LINKS = [];

// ---------- Brand assets (Rob-supplied; see public/brand/) ----------

export const LOGO_ASSETS = {
  wordmark: '/brand/wordmark.web.webp',
  wordmarkWithSubmark: '/brand/wordmark-with-submark.web.webp',
  submark: '/brand/submark.web.webp', // weapon-free; the only icon-scale mark
  seal: '/brand/seal-crossed-rifles.web.webp', // large feature graphic only
  sealAlt: '/brand/seal-rifle-badge.web.webp', // large feature graphic only
  pattern: '/brand/pattern-rifles.web.webp', // large backgrounds only
};

// ---------- Store photography (Rob-supplied; see public/photos/) ----------
//
// CURRENTLY OFF AT THE OWNER'S REQUEST. No store photo renders anywhere on
// the site right now: the home-page gallery and the About storefront photo
// were removed until further notice. These definitions and the naming plan
// are kept so photos can be switched back on with a small edit (re-wire
// SHOP_GALLERY into src/pages/Home.jsx and PHOTOS.storefront into
// src/pages/About.jsx).
//
// Real photos of the shop, kept apart from the logo marks above. Drop the
// files into public/photos/ using EXACTLY these names and they appear on the
// site automatically. Until a file exists, its slot shows a labeled
// placeholder (see components/Slot.jsx), never a broken image.
//
// Naming: all 44 photos are named shop-01.jpg .. shop-44.jpg (lowercase,
// hyphen, zero-padded so they sort in order). Formats: .jpg, landscape
// where possible, at least ~1600px on the long edge.
//
// How the site used them (when on):
//   - shop-01.jpg  -> the storefront / exterior shot, shown on the About page.
//   - shop-02..09  -> the 8 featured interior shots in the home-page gallery.
//   - shop-10..44  -> stored in the folder, available to feature later.

export const PHOTOS = {
  // Exterior / storefront, used on the About page. Make this your best
  // outside shot of the shop.
  storefront: '/photos/shop-01.jpg',
};

// "Inside the Shop" gallery on the home page: the 8 featured interior
// photos (shop-02.jpg .. shop-09.jpg). Put your 8 strongest interior shots
// in these slots. `alt` is the accessible description; `label` is the
// placeholder shown until the file exists. To feature different photos,
// change the numbers here.
export const SHOP_GALLERY = Array.from({ length: 8 }, (_, i) => {
  const n = String(i + 2).padStart(2, '0');
  return {
    src: `/photos/shop-${n}.jpg`,
    alt: `Inside ${BUSINESS.name} in ${BUSINESS.address.city}, ${BUSINESS.address.state}`,
    label: `Drop shop-${n}.jpg in public/photos/`,
  };
});

// ---------- Page titles, descriptions, and ledes ----------

const CALL = `Call ${BUSINESS.phoneDisplay}`;

export const PAGE_META = {
  home: {
    title: null, // null = site default title
    description: `S&S Guns & Ammo is a family-owned firearms and ammunition shop at 10 S. 3rd Street, Unit 5, Oxford, PA 19363. ${CALL}.`,
  },
  about: {
    title: 'About',
    description:
      'S&S Guns & Ammo is a family-owned firearms and ammunition shop in Oxford, Pennsylvania.',
  },
  services: {
    title: 'Services',
    description: `What S&S Guns & Ammo offers at the shop in Oxford, PA. ${CALL} with questions or to check stock.`,
  },
  inventory: {
    title: 'Inventory',
    description: `Browse what S&S Guns & Ammo carries in Oxford, PA: firearms, ammunition, optics and package deals. ${CALL} to check availability.`,
  },
  transfers: {
    title: 'Transfers & FAQ',
    description: `How firearm transfers work at S&S Guns & Ammo in Oxford, PA. ${CALL} for current transfer details.`,
  },
  contact: {
    title: 'Contact & Visit',
    description: `Contact S&S Guns & Ammo: 10 S. 3rd Street, Unit 5, Oxford, PA 19363. ${CALL} or send a message.`,
  },
};

// Public routes for the sitemap and build-time head generation.
// Item pages are client-rendered with dynamic og handling (documented
// limitation; see PRODUCTION-SETUP.md).
export const PUBLIC_ROUTES = [
  { path: '/', meta: PAGE_META.home },
  { path: '/about', meta: PAGE_META.about },
  { path: '/services', meta: PAGE_META.services },
  { path: '/inventory', meta: PAGE_META.inventory },
  { path: '/transfers', meta: PAGE_META.transfers },
  { path: '/contact', meta: PAGE_META.contact },
];

// ---------- Home copy ----------

export const HOME_COPY = {
  sealLine1: 'Family Owned',
  sealLine2: 'Oxford, Penna.',
  headline: ['Local knowledge.', 'Straight answers.'],
  // SERVICE-DEPENDENT: adjust after the owner confirms the exact service
  // list. See NEEDS-CONFIRMATION.md.
  heroSub:
    'Family-owned in Oxford, Pennsylvania. Straightforward service for local firearm owners, transfer customers and sporting enthusiasts.',
};

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

// ---------- About copy ----------

export const ABOUT_COPY = {
  lede: 'A family-owned shop on S. 3rd Street in Oxford, Pennsylvania, serving local firearm owners, transfer customers and sporting enthusiasts.',
  community: `The shop sits at ${BUSINESS.address.line1} in Oxford, Pennsylvania. If you live or hunt in the area, you are the customer this place was built for. Stop in, call, or send a message and talk to the people who run it.`,
};

// Shop values: brand copy, not factual claims.
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

// ---------- Services copy ----------

// The exact service list is UNCONFIRMED; each entry is neutral and the
// whole list is flagged in NEEDS-CONFIRMATION.md. `confirmed` gates
// rendering: false stays hidden everywhere. Informational only.

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

// ---------- Transfers copy ----------
//
// LEGAL REVIEW REQUIRED before publish
// Everything below concerns transfers, background checks, or store policy
// for a regulated business. All copy is intentionally neutral, states no
// fees and no legal claims, and must be reviewed by the owner and counsel
// before publish. Flagged in NEEDS-CONFIRMATION.md.

export const TRANSFERS_INTRO = {
  // LEGAL REVIEW REQUIRED before publish
  heading: 'Firearm Transfers',
  body: 'If you purchased a firearm online or from out of state, it can be shipped to a licensed dealer for transfer. Call the shop and we will walk you through the current transfer details.',
};

// LEGAL REVIEW REQUIRED before publish
export const TRANSFER_STEPS = [
  {
    id: 'contact',
    title: 'Call the shop first',
    body: 'Call so we know a transfer is headed our way and can walk you through the details before anything ships.',
  },
  {
    id: 'ship',
    title: 'Your seller ships to the shop',
    body: 'We handle the dealer-to-dealer paperwork with your seller before the firearm ships.',
  },
  {
    id: 'pickup',
    title: 'Complete paperwork in person',
    body: 'When it arrives, you complete the required paperwork at the counter before pickup. Call the shop for current transfer details.',
  },
];

// LEGAL REVIEW REQUIRED before publish
export const WHAT_TO_BRING = [
  'A valid photo ID.',
  'Anything else depends on your situation. Call ahead and we will tell you exactly what to have with you.',
];

export const FAQ_ITEMS = [
  {
    id: 'how-transfers-work',
    // LEGAL REVIEW REQUIRED before publish
    question: 'How does a transfer work?',
    answer:
      'Your seller ships the firearm to the shop. When it arrives, you complete the required paperwork in person before pickup. Call the shop for current transfer details.',
  },
  {
    id: 'transfer-cost',
    // LEGAL REVIEW REQUIRED before publish
    question: 'What does a transfer cost?',
    answer: `Call the shop at ${BUSINESS.phoneDisplay} for current transfer pricing and details.`,
  },
  {
    id: 'how-to-reach',
    question: 'How do I reach the shop about a transfer?',
    answer: `Call ${BUSINESS.phoneDisplay} and talk to a person. There is no form to fill out; a quick call is the fastest way to get a transfer started.`,
  },
  {
    id: 'what-to-bring',
    // LEGAL REVIEW REQUIRED before publish
    question: 'What do I need to bring?',
    answer:
      'Bring a valid photo ID. Call ahead to confirm anything else required for your situation.',
  },
  {
    id: 'background-check',
    // LEGAL REVIEW REQUIRED before publish
    question: 'Is a background check required?',
    answer:
      'All transfers follow applicable federal and Pennsylvania requirements. Call the shop for details about your situation.',
  },
  {
    id: 'seller-info',
    // LEGAL REVIEW REQUIRED before publish
    question: 'What information does my seller need?',
    answer:
      'Sellers typically need the receiving dealer’s license information before shipping. Call the shop and we will handle that step with your seller.',
  },
];
