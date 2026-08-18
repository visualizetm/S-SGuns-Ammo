// Transfers and FAQ content.
//
// LEGAL REVIEW REQUIRED before publish
// Every entry in this file concerns transfers, background checks, or store
// policy for a regulated business. All copy is intentionally neutral, states
// no fees and no legal claims, and must be reviewed by the owner and counsel
// before publish. Flagged in NEEDS-CONFIRMATION.md.

export const TRANSFERS_INTRO = {
  // LEGAL REVIEW REQUIRED before publish
  heading: 'Firearm Transfers',
  body: 'If you purchased a firearm online or from out of state, it can be shipped to a licensed dealer for transfer. Call the shop for current transfer details, or send an inquiry below and we will follow up.',
};

// LEGAL REVIEW REQUIRED before publish
// Neutral outline of the transfer flow. No fees, no timelines, no legal
// claims; every step points back to the shop for specifics.
export const TRANSFER_STEPS = [
  {
    id: 'contact',
    title: 'Get in touch first',
    body: 'Call the shop or send an inquiry so we know a transfer is headed our way and can walk you through the details.',
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
// Intentionally minimal. Only the confirmed-safe item is listed; everything
// else defers to a phone call so no requirement is stated incorrectly.
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
    answer:
      'Call the shop at (610) 467-0284 for current transfer pricing and details.',
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
