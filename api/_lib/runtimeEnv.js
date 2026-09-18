// Runtime environment detection shared by the serverless adapters.
//
// Production (Vercel sets VERCEL=1 on every deployment) must NEVER fall back
// to the in-memory dev store: on a serverless filesystem those writes vanish
// when the function instance ends, which makes Publish "succeed" and then
// silently lose everything. When the database is not configured in
// production, the API fails LOUD with this exact error instead.

export function isProductionRuntime() {
  return (
    process.env.VERCEL === '1' ||
    process.env.VERCEL === 'true' ||
    process.env.NODE_ENV === 'production'
  );
}

export const DB_NOT_CONFIGURED_MESSAGE =
  'Database not configured. Set DATABASE_MONGODB_URI.';

export function dbNotConfiguredError() {
  const error = new Error(DB_NOT_CONFIGURED_MESSAGE);
  error.code = 'DB_NOT_CONFIGURED';
  return error;
}

// MongoDB Atlas connection string. Vercel's project settings name this
// variable DATABASE_MONGODB_URI (fixed, cannot be renamed there), so that
// name is checked first; MONGODB_URI is kept as a fallback for local dev
// and any other environment that still sets the shorter name. Read only at
// request time (never at build time) so a production build never requires
// this secret to exist.
export function mongoUri() {
  return process.env.DATABASE_MONGODB_URI || process.env.MONGODB_URI || '';
}

export function mongoDbName() {
  return process.env.MONGODB_DB || 'ssguns';
}
