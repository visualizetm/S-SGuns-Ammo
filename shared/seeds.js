// Seeded demo leads so the admin dashboard is never empty in demo mode.
// These are demo records only (source: "seed"). They are not real customers
// and are labeled as demo data in the admin UI.

export const SEED_LEADS = [
  {
    id: 'seed-001',
    type: 'contact',
    createdAt: '2026-08-10T14:32:00.000Z',
    read: true,
    source: 'seed',
    data: {
      name: 'Mark Reilly',
      email: 'mark.reilly.demo@example.com',
      phone: '(484) 555-0142',
      message:
        'Do you carry 12 gauge target loads? Planning to stop by this weekend and wanted to check before making the drive.',
    },
  },
  {
    id: 'seed-002',
    type: 'transfer',
    createdAt: '2026-08-11T16:05:00.000Z',
    read: false,
    source: 'seed',
    data: {
      name: 'Dana Whitfield',
      email: 'dana.whitfield.demo@example.com',
      phone: '(610) 555-0187',
      itemDescription: 'Bolt-action rifle purchased online from an out-of-state retailer.',
      message:
        'The seller needs your FFL information to ship. What is the best way to get that started?',
    },
  },
  {
    id: 'seed-003',
    type: 'email_signup',
    createdAt: '2026-08-12T09:18:00.000Z',
    read: false,
    source: 'seed',
    data: {
      name: 'Luis Herrera',
      email: 'luis.herrera.demo@example.com',
    },
  },
  {
    id: 'seed-004',
    type: 'contact',
    createdAt: '2026-08-12T19:47:00.000Z',
    read: false,
    source: 'seed',
    data: {
      name: 'Karen Boyd',
      email: 'karen.boyd.demo@example.com',
      phone: '',
      message:
        'Hi, my father passed recently and left several hunting rifles. Do you offer appraisals or consignment? Thank you.',
    },
  },
  {
    id: 'seed-005',
    type: 'transfer',
    createdAt: '2026-08-13T11:02:00.000Z',
    read: false,
    source: 'seed',
    data: {
      name: 'Tom Gallagher',
      email: 'tom.gallagher.demo@example.com',
      phone: '(717) 555-0116',
      itemDescription: 'Handgun from a private seller in Maryland.',
      message: 'Is an appointment needed or can I walk in during business hours?',
    },
  },
  {
    id: 'seed-006',
    type: 'email_signup',
    createdAt: '2026-08-13T20:26:00.000Z',
    read: true,
    source: 'seed',
    data: {
      name: 'Alicia Grant',
      email: 'alicia.grant.demo@example.com',
    },
  },
];
