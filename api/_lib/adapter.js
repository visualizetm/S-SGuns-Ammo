// Data adapter interface for the leads store.
//
// Every endpoint talks to storage ONLY through this interface, so promoting
// from demo mode to a real database is a matter of writing a new adapter
// (e.g. Postgres, Vercel KV) that implements the same four methods and
// returning it from getLeadsAdapter(). No endpoint code changes.
//
// Interface:
//   createLead({ type, data })            -> Promise<Lead>
//   listLeads({ type? })                  -> Promise<Lead[]>  (newest first)
//   setLeadRead(id, read)                 -> Promise<Lead | null>
//   getLead(id)                           -> Promise<Lead | null>
//
// Lead shape:
//   { id, type, createdAt, read, source, data }

import { randomUUID } from 'node:crypto';
import { SEED_LEADS } from '../../shared/seeds.js';

// DEMO MODE: in-memory storage seeded with demo leads. State lives on
// globalThis so it survives module re-evaluation within a warm serverless
// instance. It resets on cold starts, which is acceptable for the demo and
// documented in the README.
function createMemoryAdapter() {
  if (!globalThis.__ssgaLeadsStore) {
    globalThis.__ssgaLeadsStore = SEED_LEADS.map((lead) => ({ ...lead }));
  }
  const store = globalThis.__ssgaLeadsStore;

  return {
    async createLead({ type, data }) {
      const lead = {
        id: randomUUID(),
        type,
        createdAt: new Date().toISOString(),
        read: false,
        source: 'form',
        data,
      };
      store.push(lead);
      return lead;
    },

    async listLeads({ type } = {}) {
      const leads = type ? store.filter((l) => l.type === type) : [...store];
      return leads.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async setLeadRead(id, read) {
      const lead = store.find((l) => l.id === id);
      if (!lead) return null;
      lead.read = Boolean(read);
      return lead;
    },

    async getLead(id) {
      return store.find((l) => l.id === id) || null;
    },
  };
}

let adapter = null;

export function getLeadsAdapter() {
  // Swap point for production: return a DB-backed adapter here based on
  // configuration (e.g. if (process.env.DATABASE_URL) return createDbAdapter()).
  if (!adapter) adapter = createMemoryAdapter();
  return adapter;
}
