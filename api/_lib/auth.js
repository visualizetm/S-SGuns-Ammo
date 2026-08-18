// Server-side admin auth. The password NEVER appears in a VITE_ variable or
// in the client bundle; it lives only here and (optionally) in environment
// variables.
//
// Scheme: login exchanges the admin password for an expiring bearer token,
// signed with HMAC-SHA256. Token format: "<expiryMs>.<signature>". Nothing
// is stored server-side, so it works on stateless serverless instances.
//
// Env vars (see PRODUCTION-SETUP.md):
//   ADMIN_PASSWORD        the real admin password
//   ADMIN_SESSION_SECRET  random signing secret (rotating it logs everyone out)
// DEMO MODE: if unset, a documented demo password and a secret derived from
// it are used so the demo runs with zero configuration.

import { createHmac, timingSafeEqual } from 'node:crypto';

const DEMO_PASSWORD = 'oxford-demo';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function adminPassword() {
  return process.env.ADMIN_PASSWORD || DEMO_PASSWORD;
}

function sessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || `ssga-demo-secret:${adminPassword()}`;
}

function sign(payload) {
  return createHmac('sha256', sessionSecret()).update(payload).digest('hex');
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function issueToken(now = Date.now()) {
  const expiry = String(now + SESSION_TTL_MS);
  return `${expiry}.${sign(expiry)}`;
}

export function verifyToken(token, now = Date.now()) {
  if (typeof token !== 'string') return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const expiry = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!/^\d+$/.test(expiry)) return false;
  if (Number(expiry) < now) return false;
  return safeEqual(signature, sign(expiry));
}

// Returns a bearer token if the password is correct, else null.
export function login(password) {
  if (typeof password !== 'string' || password.length === 0) return null;
  if (!safeEqual(password, adminPassword())) return null;
  return issueToken();
}

// Checks the Authorization header of an incoming request.
export function isAuthorized(req) {
  const header = req.headers?.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;
  return verifyToken(match[1]);
}
