// API client used by all forms and the admin dashboard.
//
// It calls the real serverless endpoints first. If the API is unreachable
// (plain `vite dev` / `vite preview` with no functions runtime), it falls
// back to the in-browser demo adapter so everything stays fully interactive.
// Both paths return the same shape: { status, body }.

import { demoAdapter } from './demoAdapter.js';

const LEAD_PATHS = {
  contact: '/api/leads/contact',
  transfer: '/api/leads/transfer',
  email_signup: '/api/leads/email-signup',
};

async function callApi(path, options) {
  const res = await fetch(path, options);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    // Vite's SPA fallback answers unknown paths with index.html; treat any
    // non-JSON response as "no API available" so we switch to demo mode.
    throw new Error('api-unavailable');
  }
  return { status: res.status, body: await res.json() };
}

export async function submitLead(type, input) {
  try {
    return await callApi(LEAD_PATHS[type], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    return demoAdapter.submitLead(type, input);
  }
}

export async function adminLogin(password) {
  try {
    return await callApi('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
  } catch {
    return demoAdapter.login(password);
  }
}

export async function adminListLeads(token, type) {
  const query = type ? `?type=${encodeURIComponent(type)}` : '';
  try {
    return await callApi(`/api/admin/leads${query}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return demoAdapter.listLeads(token, type);
  }
}

export async function adminSetLeadRead(token, id, read) {
  try {
    return await callApi('/api/admin/leads', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id, read }),
    });
  } catch {
    return demoAdapter.setLeadRead(token, id, read);
  }
}
