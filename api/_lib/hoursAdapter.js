// Shop hours and temporary closures adapter: one settings document
// (collection "settings", _id "hours"), same dev-file / MongoDB /
// loud-failure pattern as every other adapter (see historyAdapter.js).
//
//   getSettings()                 -> { timezone, weekly, closures, updatedAt }
//                                    (weekly is null until the owner saves once)
//   saveWeekly(weekly)            -> the saved settings doc
//   addClosure(closure)           -> the created closure (id/createdAt assigned)
//   updateClosure(id, fields)     -> the updated closure, or null if not found
//   deleteClosure(id)             -> true if removed, false if not found
//   reopenClosure(id)             -> the cancelled closure, or null if not found
//
// Hours and closures write through immediately (no draft/publish), the
// same operational-write exception Quick Sale already makes: a snow day
// has to go live in seconds.

import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { isProductionRuntime, dbNotConfiguredError, mongoUri } from './runtimeEnv.js';
import { getCollection } from './mongoClient.js';
import { SHOP_TIMEZONE, pruneClosures } from '../../shared/hours.js';

const DEV_STORE_PATH = join(process.cwd(), '.data', 'hours-dev.json');

function defaultSettings() {
  return { timezone: SHOP_TIMEZONE, weekly: null, closures: [], updatedAt: null };
}

function newClosure(fields) {
  return {
    id: randomUUID(),
    startDate: fields.startDate,
    endDate: fields.endDate ?? null,
    reason: fields.reason,
    label: fields.label || '',
    message: fields.message,
    note: fields.note || '',
    noticeDays: fields.noticeDays,
    createdAt: new Date().toISOString(),
    cancelledAt: null,
  };
}

// ---------- Dev store: JSON file ----------

function createDevHoursAdapter() {
  let canPersist = true;

  function load() {
    if (globalThis.__ssgaHoursStore) return globalThis.__ssgaHoursStore;
    let store;
    try {
      store = JSON.parse(readFileSync(DEV_STORE_PATH, 'utf8'));
    } catch {
      store = defaultSettings();
    }
    globalThis.__ssgaHoursStore = store;
    return store;
  }

  function persist(store) {
    if (!canPersist) return;
    try {
      mkdirSync(dirname(DEV_STORE_PATH), { recursive: true });
      writeFileSync(DEV_STORE_PATH, JSON.stringify(store, null, 2));
    } catch {
      canPersist = false;
    }
  }

  return {
    mode: 'dev-file',
    async getSettings() {
      return load();
    },
    async saveWeekly(weekly) {
      const store = load();
      store.weekly = weekly;
      store.timezone = SHOP_TIMEZONE;
      store.updatedAt = new Date().toISOString();
      persist(store);
      return store;
    },
    async addClosure(fields) {
      const store = load();
      const closure = newClosure(fields);
      store.closures = pruneClosures([...(store.closures || []), closure]);
      store.updatedAt = new Date().toISOString();
      persist(store);
      return closure;
    },
    async updateClosure(id, fields) {
      const store = load();
      const idx = (store.closures || []).findIndex((c) => c.id === id);
      if (idx < 0) return null;
      store.closures[idx] = {
        ...store.closures[idx],
        startDate: fields.startDate,
        endDate: fields.endDate ?? null,
        reason: fields.reason,
        label: fields.label || '',
        message: fields.message,
        note: fields.note || '',
        noticeDays: fields.noticeDays,
      };
      store.updatedAt = new Date().toISOString();
      persist(store);
      return store.closures[idx];
    },
    async deleteClosure(id) {
      const store = load();
      const before = (store.closures || []).length;
      store.closures = (store.closures || []).filter((c) => c.id !== id);
      if (store.closures.length === before) return false;
      store.updatedAt = new Date().toISOString();
      persist(store);
      return true;
    },
    async reopenClosure(id) {
      const store = load();
      const closure = (store.closures || []).find((c) => c.id === id);
      if (!closure) return null;
      closure.cancelledAt = new Date().toISOString();
      store.updatedAt = new Date().toISOString();
      persist(store);
      return closure;
    },
  };
}

// ---------- Production store: MongoDB Atlas ----------

function createMongoHoursAdapter() {
  async function col() {
    return getCollection('settings');
  }

  return {
    mode: 'mongodb',
    async getSettings() {
      const c = await col();
      const doc = await c.findOne({ _id: 'hours' }, { projection: { _id: 0 } });
      return doc || defaultSettings();
    },
    async saveWeekly(weekly) {
      const c = await col();
      const updatedAt = new Date().toISOString();
      await c.updateOne(
        { _id: 'hours' },
        { $set: { weekly, timezone: SHOP_TIMEZONE, updatedAt }, $setOnInsert: { closures: [] } },
        { upsert: true }
      );
      return this.getSettings();
    },
    // $push is atomic: two quick closures never overwrite each other. The
    // cap/prune pass that follows is best-effort (a second read-modify-
    // write) rather than part of the same atomic operation: pruning is a
    // storage-size policy, not data the owner is actively racing to save,
    // so a rare lost prune (never a lost closure) is an acceptable
    // tradeoff for not needing a transaction here (documented per the
    // task, same spirit as mongoClient.js's withOptionalTransaction note).
    async addClosure(fields) {
      const c = await col();
      const closure = newClosure(fields);
      const updatedAt = new Date().toISOString();
      await c.updateOne(
        { _id: 'hours' },
        { $push: { closures: closure }, $set: { updatedAt }, $setOnInsert: { timezone: SHOP_TIMEZONE, weekly: null } },
        { upsert: true }
      );
      const doc = await c.findOne({ _id: 'hours' }, { projection: { _id: 0, closures: 1 } });
      const pruned = pruneClosures(doc?.closures || []);
      if (pruned.length !== (doc?.closures || []).length) {
        await c.updateOne({ _id: 'hours' }, { $set: { closures: pruned } });
      }
      return closure;
    },
    async updateClosure(id, fields) {
      const c = await col();
      const updatedAt = new Date().toISOString();
      const result = await c.updateOne(
        { _id: 'hours', 'closures.id': id },
        {
          $set: {
            'closures.$.startDate': fields.startDate,
            'closures.$.endDate': fields.endDate ?? null,
            'closures.$.reason': fields.reason,
            'closures.$.label': fields.label || '',
            'closures.$.message': fields.message,
            'closures.$.note': fields.note || '',
            'closures.$.noticeDays': fields.noticeDays,
            updatedAt,
          },
        }
      );
      if (result.matchedCount === 0) return null;
      const doc = await c.findOne({ _id: 'hours' }, { projection: { _id: 0, closures: 1 } });
      return (doc?.closures || []).find((cl) => cl.id === id) || null;
    },
    async deleteClosure(id) {
      const c = await col();
      const updatedAt = new Date().toISOString();
      const result = await c.updateOne(
        { _id: 'hours' },
        { $pull: { closures: { id } }, $set: { updatedAt } }
      );
      return result.modifiedCount > 0;
    },
    async reopenClosure(id) {
      const c = await col();
      const updatedAt = new Date().toISOString();
      const cancelledAt = updatedAt;
      const result = await c.updateOne(
        { _id: 'hours', 'closures.id': id },
        { $set: { 'closures.$.cancelledAt': cancelledAt, updatedAt } }
      );
      if (result.matchedCount === 0) return null;
      const doc = await c.findOne({ _id: 'hours' }, { projection: { _id: 0, closures: 1 } });
      return (doc?.closures || []).find((cl) => cl.id === id) || null;
    },
  };
}

// Production with no database fails LOUD (same rule as every adapter).
function createUnconfiguredHoursAdapter() {
  return new Proxy(
    { mode: 'unconfigured' },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (prop === 'then') return undefined;
        return async () => {
          throw dbNotConfiguredError();
        };
      },
    }
  );
}

let hoursAdapter = null;

export function getHoursAdapter() {
  if (!hoursAdapter) {
    const uri = mongoUri();
    if (uri) hoursAdapter = createMongoHoursAdapter();
    else if (isProductionRuntime()) hoursAdapter = createUnconfiguredHoursAdapter();
    else hoursAdapter = createDevHoursAdapter();
  }
  return hoursAdapter;
}
