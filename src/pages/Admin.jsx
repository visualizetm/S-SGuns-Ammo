// Protected /admin route: lists captured leads (contact, transfer inquiries,
// email signups) with timestamp, type, and contents. Filter by type, mark as
// read. Auth is checked server-side on every request (api/_lib/auth.js);
// the token held here is only a credential, never the gate itself.

import { useCallback, useEffect, useState } from 'react';
import Inbox01 from '@untitled-ui/icons-react/build/esm/Inbox01';
import {
  adminLogin,
  adminListLeads,
  adminSetLeadRead,
} from '../lib/apiClient.js';

const TOKEN_KEY = 'ssga-admin-token';

const TYPE_LABELS = {
  contact: 'Contact',
  transfer: 'Transfer inquiry',
  email_signup: 'Email signup',
};

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'contact', label: 'Contact' },
  { value: 'transfer', label: 'Transfer inquiries' },
  { value: 'email_signup', label: 'Email signups' },
];

function formatTimestamp(iso) {
  try {
    return new Date(iso).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function LoginGate({ onToken }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    const { body } = await adminLogin(password);
    setSubmitting(false);
    if (body?.ok && body.token) {
      onToken(body.token);
    } else {
      setError(body?.error || 'Login failed. Try again.');
    }
  }

  return (
    <section aria-labelledby="admin-login-heading">
      <h1 id="admin-login-heading">Admin login</h1>
      <form onSubmit={handleSubmit} noValidate aria-label="Admin login form">
        <p className="ssga-field">
          <label htmlFor="admin-password">Password (required)</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={submitting}
          />
          {error ? (
            <span role="alert" className="ssga-field-error">
              {error}
            </span>
          ) : null}
        </p>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </section>
  );
}

function LeadCard({ lead, onToggleRead, busy }) {
  return (
    <li className="ssga-lead" data-read={lead.read ? 'true' : 'false'}>
      <p>
        <strong>{TYPE_LABELS[lead.type] || lead.type}</strong>{' '}
        {lead.read ? '(read)' : '(unread)'}
        {lead.source === 'seed' ? ' [demo data]' : ''}
      </p>
      <p>{formatTimestamp(lead.createdAt)}</p>
      <dl>
        {Object.entries(lead.data).map(([field, value]) =>
          value ? (
            <div key={field}>
              <dt>{field}</dt>
              <dd>{value}</dd>
            </div>
          ) : null
        )}
      </dl>
      <button
        type="button"
        onClick={() => onToggleRead(lead)}
        disabled={busy}
      >
        {lead.read ? 'Mark as unread' : 'Mark as read'}
      </button>
    </li>
  );
}

export function Admin() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem(TOKEN_KEY) || ''
  );
  const [filter, setFilter] = useState('');
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const handleToken = useCallback((next) => {
    sessionStorage.setItem(TOKEN_KEY, next);
    setToken(next);
  }, []);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken('');
    setLeads([]);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    const { status, body } = await adminListLeads(token, filter || undefined);
    setLoading(false);
    if (status === 401) {
      handleLogout();
      return;
    }
    if (body?.ok) {
      setLeads(body.leads);
    } else {
      setError(body?.error || 'Could not load leads.');
    }
  }, [token, filter, handleLogout]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function toggleRead(lead) {
    setBusyId(lead.id);
    const { status, body } = await adminSetLeadRead(token, lead.id, !lead.read);
    setBusyId('');
    if (status === 401) {
      handleLogout();
      return;
    }
    if (body?.ok) {
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, read: !lead.read } : l))
      );
    } else {
      setError(body?.error || 'Could not update lead.');
    }
  }

  if (!token) {
    return <LoginGate onToken={handleToken} />;
  }

  const unreadCount = leads.filter((l) => !l.read).length;

  return (
    <section aria-labelledby="admin-heading">
      <h1 id="admin-heading">
        <Inbox01 aria-hidden="true" width={20} height={20} /> Leads
      </h1>
      <p>
        {leads.length} shown, {unreadCount} unread.{' '}
        <button type="button" onClick={refresh} disabled={loading}>
          Refresh
        </button>{' '}
        <button type="button" onClick={handleLogout}>
          Log out
        </button>
      </p>

      <fieldset>
        <legend>Filter by type</legend>
        {FILTERS.map((f) => (
          <label key={f.value} className="ssga-filter">
            <input
              type="radio"
              name="lead-filter"
              value={f.value}
              checked={filter === f.value}
              onChange={() => setFilter(f.value)}
            />{' '}
            {f.label}
          </label>
        ))}
      </fieldset>

      {error ? <p role="alert">{error}</p> : null}
      {loading ? <p role="status">Loading leads...</p> : null}
      {!loading && leads.length === 0 ? <p>No leads for this filter.</p> : null}

      <ul className="ssga-leads">
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onToggleRead={toggleRead}
            busy={busyId === lead.id}
          />
        ))}
      </ul>
    </section>
  );
}
