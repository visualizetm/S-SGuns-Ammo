// Server-side admin auth. The password NEVER appears in a VITE_ variable or
// in the client bundle; it lives only here and (optionally) in the
// ADMIN_PASSWORD environment variable.
//
// DEMO MODE: if ADMIN_PASSWORD is not set, the documented demo password
// below is used. Set ADMIN_PASSWORD in Vercel project settings to override
// it for a real deployment. This simple stateless scheme (token derived
// from the password) is a demo gate; promote to real sessions (signed
// cookies + a user table) alongside the real database adapter.

import { createHash, timingSafeEqual } from 'node:crypto';

const DEMO_PASSWORD = 'oxford-demo';
const TOKEN_SALT = 'ssga-admin-v1';

function adminPassword() {
  return process.env.ADMIN_PASSWORD || DEMO_PASSWORD;
}

export function tokenForPassword(password) {
  return createHash('sha256')
    .update(`${TOKEN_SALT}:${password}`)
    .digest('hex');
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Returns a bearer token if the password is correct, else null.
export function login(password) {
  if (typeof password !== 'string' || password.length === 0) return null;
  if (!safeEqual(password, adminPassword())) return null;
  return tokenForPassword(adminPassword());
}

// Checks the Authorization header of an incoming request.
export function isAuthorized(req) {
  const header = req.headers?.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;
  return safeEqual(match[1], tokenForPassword(adminPassword()));
}
