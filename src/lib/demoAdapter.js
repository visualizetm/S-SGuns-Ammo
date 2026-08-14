// In-browser DEMO adapter.
//
// Used only when the serverless API is unreachable (e.g. `vite dev` or
// `vite preview` without Vercel functions). It mirrors the server exactly:
// same shared validation, same seeded leads, same response shapes, so the
// whole site is fully interactive with no database and no env vars.
// Persistence is localStorage, so demo submissions survive reloads.
//
// The demo admin gate here is cosmetic by design: anything shipped to the
// browser can be inspected, so this path must never guard real data. Real
// deployments authenticate in api/_lib/auth.js on the server.

import { validateLead, isSpam, LEAD_TYPES } from '../../shared/validation.js';
import { SEED_LEADS } from '../../shared/seeds.js';

const STORE_KEY = 'ssga-demo-leads';
const DEMO_PASSWORD = 'oxford-demo';
const DEMO_TOKEN = 'demo-local-token';

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through to reseed
  }
  const seeded = SEED_LEADS.map((lead) => ({ ...lead }));
  saveStore(seeded);
  return seeded;
}

function saveStore(leads) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(leads));
  } catch {
    // storage unavailable; demo continues in-memory for this page load
  }
}

function delay(ms = 350) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeId() {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const demoAdapter = {
  async submitLead(type, input) {
    await delay();
    if (!LEAD_TYPES.includes(type)) {
      return { status: 404, body: { ok: false, error: 'Unknown lead type.' } };
    }
    if (isSpam(input)) {
      return { status: 200, body: { ok: true } };
    }
    const result = validateLead(type, input);
    if (!result.ok) {
      return {
        status: 422,
        body: {
          ok: false,
          error: 'Please correct the highlighted fields.',
          errors: result.errors,
        },
      };
    }
    const leads = loadStore();
    const lead = {
      id: makeId(),
      type,
      createdAt: new Date().toISOString(),
      read: false,
      source: 'form',
      data: result.data,
    };
    leads.push(lead);
    saveStore(leads);
    return { status: 201, body: { ok: true, id: lead.id } };
  },

  async login(password) {
    await delay(200);
    if (password === DEMO_PASSWORD) {
      return { status: 200, body: { ok: true, token: DEMO_TOKEN } };
    }
    return { status: 401, body: { ok: false, error: 'Incorrect password.' } };
  },

  async listLeads(token, type) {
    await delay(200);
    if (token !== DEMO_TOKEN) {
      return { status: 401, body: { ok: false, error: 'Not authorized.' } };
    }
    let leads = loadStore();
    if (type) leads = leads.filter((l) => l.type === type);
    leads = [...leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { status: 200, body: { ok: true, leads } };
  },

  async setLeadRead(token, id, read) {
    await delay(150);
    if (token !== DEMO_TOKEN) {
      return { status: 401, body: { ok: false, error: 'Not authorized.' } };
    }
    const leads = loadStore();
    const lead = leads.find((l) => l.id === id);
    if (!lead) {
      return { status: 404, body: { ok: false, error: 'Lead not found.' } };
    }
    lead.read = Boolean(read);
    saveStore(leads);
    return { status: 200, body: { ok: true, lead } };
  },
};
