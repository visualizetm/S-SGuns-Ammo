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
  'Database not configured. Set DATABASE_URL.';

export function dbNotConfiguredError() {
  const error = new Error(DB_NOT_CONFIGURED_MESSAGE);
  error.code = 'DB_NOT_CONFIGURED';
  return error;
}

export function databaseUrl() {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
}
