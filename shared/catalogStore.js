// Pure draft/publish store operations for the product catalog. No I/O:
// callers own persistence (server dev adapter: JSON file; browser demo
// adapter: localStorage; the Postgres adapter implements the same
// interface directly). Keeping the logic here means every implementation
// behaves identically.
//
// Store shape: { products: Record[], collections: Record[], bundles: Record[] }
// Record shape: {
//   id, createdAt, updatedAt,
//   draft:     {...fields} | null,   // null = pending removal on publish
//   published: {...fields} | null,   // null = never published
// }
// All admin edits touch draft only. Public reads see published only.

export const KINDS = ['products', 'collections', 'bundles'];

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function clone(value) {
  return value === null || value === undefined
    ? null
    : JSON.parse(JSON.stringify(value));
}

// live: draft equals published. changed: both exist and differ.
// new: never published. removing: draft deleted, removal pending publish.
export function statusOf(record) {
  if (record.draft === null) return 'removing';
  if (record.published === null) return 'new';
  return deepEqual(record.draft, record.published) ? 'live' : 'changed';
}

// Admin display fields: the draft when it exists, else the published copy
// (so pending-removal rows still render).
export function displayOf(record) {
  return record.draft ?? record.published;
}

function findRecord(store, kind, id) {
  return store[kind].find((r) => r.id === id) || null;
}

// ---------- Reads ----------

function productMatches(fields, { collectionId, q, includeHidden }) {
  if (!includeHidden && fields.stockStatus === 'Hidden') return false;
  if (collectionId && !(fields.collectionIds || []).includes(collectionId)) return false;
  if (q) {
    const needle = q.toLowerCase();
    const hay = [fields.name, fields.manufacturer, fields.model, fields.caliber, fields.description]
      .join(' ')
      .toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

// scope 'draft': admin view; includes pending-removal records, adds status.
// scope 'published': public view; published snapshot only, never drafts.
export function listProducts(store, { scope, collectionId, q, includeHidden = false } = {}) {
  const out = [];
  for (const record of store.products) {
    const fields = scope === 'published' ? record.published : displayOf(record);
    if (!fields) continue;
    if (!productMatches(fields, { collectionId, q, includeHidden })) continue;
    const item = { ...clone(fields), id: record.id, createdAt: record.createdAt, updatedAt: record.updatedAt };
    if (scope !== 'published') item.status = statusOf(record);
    out.push(item);
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listCollections(store, { scope, includeHiddenPublic = false } = {}) {
  const out = [];
  for (const record of store.collections) {
    const fields = scope === 'published' ? record.published : displayOf(record);
    if (!fields) continue;
    if (scope === 'published' && !includeHiddenPublic && fields.visible === false) continue;
    const item = { ...clone(fields), id: record.id, createdAt: record.createdAt, updatedAt: record.updatedAt };
    if (scope !== 'published') item.status = statusOf(record);
    out.push(item);
  }
  return out.sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
  );
}

export function listBundles(store, { scope } = {}) {
  const out = [];
  for (const record of store.bundles) {
    const fields = scope === 'published' ? record.published : displayOf(record);
    if (!fields) continue;
    if (scope === 'published' && fields.visible === false) continue;
    const item = { ...clone(fields), id: record.id, createdAt: record.createdAt, updatedAt: record.updatedAt };
    if (scope !== 'published') item.status = statusOf(record);
    out.push(item);
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getRecord(store, kind, id) {
  return findRecord(store, kind, id);
}

// Public single-product read: published snapshot only, Hidden never served.
export function getPublicProduct(store, id) {
  const record = findRecord(store, 'products', id);
  const fields = record?.published;
  if (!fields || fields.stockStatus === 'Hidden') return null;
  return {
    ...clone(fields),
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

// Public bundles: published, visible, and only when at least two member
// products are live (published and not Hidden). Members resolve to
// { id, name } for live products only; dead references are dropped.
export function listPublicBundles(store) {
  const live = new Map(
    listProducts(store, { scope: 'published' }).map((p) => [p.id, p])
  );
  return listBundles(store, { scope: 'published' })
    .map((bundle) => ({
      ...bundle,
      members: (bundle.memberProductIds || [])
        .filter((id) => live.has(id))
        .map((id) => ({ id, name: live.get(id).name })),
    }))
    .filter((bundle) => bundle.members.length >= 2);
}

// ---------- Draft writes (mutate the store in place) ----------

export function saveDraft(store, kind, id, fields, makeId) {
  const now = new Date().toISOString();
  if (id) {
    const record = findRecord(store, kind, id);
    if (!record) return null;
    record.draft = clone(fields);
    record.updatedAt = now;
    return record;
  }
  const record = {
    id: makeId(),
    createdAt: now,
    updatedAt: now,
    draft: clone(fields),
    published: null,
  };
  store[kind].push(record);
  return record;
}

export function deleteDraft(store, kind, id) {
  const record = findRecord(store, kind, id);
  if (!record || record.draft === null) return null;
  if (record.published === null) {
    // Never published: nothing to remove from the site; drop it entirely.
    store[kind] = store[kind].filter((r) => r.id !== id);
  } else {
    record.draft = null;
    record.updatedAt = new Date().toISOString();
  }
  // A deleted collection never deletes products; they just lose the tag.
  if (kind === 'collections') {
    for (const product of store.products) {
      if (product.draft?.collectionIds?.includes(id)) {
        product.draft.collectionIds = product.draft.collectionIds.filter(
          (cid) => cid !== id
        );
        product.updatedAt = new Date().toISOString();
      }
    }
  }
  return true;
}

export function restoreDraft(store, kind, id) {
  const record = findRecord(store, kind, id);
  if (!record || record.draft !== null || record.published === null) return null;
  record.draft = clone(record.published);
  record.updatedAt = new Date().toISOString();
  return record;
}

export function reorderCollections(store, orderedIds) {
  let position = 0;
  for (const id of orderedIds) {
    const record = findRecord(store, 'collections', id);
    if (record?.draft) {
      record.draft.sortOrder = position;
      record.updatedAt = new Date().toISOString();
      position++;
    }
  }
  return true;
}

// ---------- Publish flow ----------

export function changesSummary(store) {
  const summary = { products: 0, collections: 0, bundles: 0, total: 0 };
  for (const kind of KINDS) {
    for (const record of store[kind]) {
      if (statusOf(record) !== 'live') {
        summary[kind] += 1;
        summary.total += 1;
      }
    }
  }
  return summary;
}

// Promotes every draft to published in one pass. Callers persist the
// resulting store as a single write (file write or one DB transaction),
// which is what makes the operation atomic.
export function publishAll(store) {
  for (const kind of KINDS) {
    store[kind] = store[kind].filter((record) => record.draft !== null);
    for (const record of store[kind]) {
      record.published = clone(record.draft);
    }
  }
  return store;
}

export function discardAll(store) {
  for (const kind of KINDS) {
    store[kind] = store[kind].filter((record) => record.published !== null);
    for (const record of store[kind]) {
      record.draft = clone(record.published);
    }
  }
  return store;
}
