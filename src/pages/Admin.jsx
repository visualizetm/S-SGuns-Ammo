// Protected /admin route: lists captured leads (contact, transfer inquiries,
// email signups) with timestamp, type, and contents. Filter by type, mark as
// read. Auth is checked server-side on every request (api/_lib/auth.js);
// the token held here is only a credential, never the gate itself.

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Inbox01 from '@untitled-ui/icons-react/build/esm/Inbox01';
import Package from '@untitled-ui/icons-react/build/esm/Package';
import { InventoryPanel } from '../components/admin/InventoryPanel.jsx';
import {
  adminLogin,
  adminListLeads,
  adminSetLeadRead,
} from '../lib/apiClient.js';
import { usePageMeta } from '../lib/usePageMeta.js';

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
    <section className="wrap section" aria-labelledby="admin-login-heading">
      <h1 id="admin-login-heading" className="display">
        Admin login
      </h1>
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
        <button type="submit" className="btn btn-primary" disabled={submitting}>
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

// Leads panel: the original dashboard list, unchanged in behavior.
function LeadsPanel({ token, onAuthFail }) {
  const [filter, setFilter] = useState('');
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    const { status, body } = await adminListLeads(token, filter || undefined);
    setLoading(false);
    if (status === 401) {
      onAuthFail();
      return;
    }
    if (body?.ok) {
      setLeads(body.leads);
    } else {
      setError(body?.error || 'Could not load leads.');
    }
  }, [token, filter, onAuthFail]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function toggleRead(lead) {
    setBusyId(lead.id);
    const { status, body } = await adminSetLeadRead(token, lead.id, !lead.read);
    setBusyId('');
    if (status === 401) {
      onAuthFail();
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

  const unreadCount = leads.filter((l) => !l.read).length;

  return (
    <div>
      <p>
        {leads.length} shown, {unreadCount} unread.{' '}
        <button type="button" onClick={refresh} disabled={loading}>
          Refresh
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
    </div>
  );
}

const TABS = [
  { id: 'leads', label: 'Leads', icon: Inbox01 },
  { id: 'inventory', label: 'Inventory', icon: Package },
];

export function Admin() {
  usePageMeta('Admin');
  const [token, setToken] = useState(
    () => sessionStorage.getItem(TOKEN_KEY) || ''
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'inventory' ? 'inventory' : 'leads';

  const handleToken = useCallback((next) => {
    sessionStorage.setItem(TOKEN_KEY, next);
    setToken(next);
  }, []);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken('');
  }, []);

  if (!token) {
    return <LoginGate onToken={handleToken} />;
  }

  return (
    <section className="wrap section" aria-labelledby="admin-heading">
      <div className="adm-top">
        <h1 id="admin-heading" className="display adm-title">
          Shop admin
        </h1>
        <button type="button" onClick={handleLogout}>
          Log out
        </button>
      </div>

      <nav aria-label="Admin sections" className="adm-tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className="adm-tab"
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setSearchParams(id === 'leads' ? {} : { tab: id })}
          >
            <Icon aria-hidden="true" width={18} height={18} />
            {label}
          </button>
        ))}
      </nav>

      {tab === 'leads' ? (
        <LeadsPanel token={token} onAuthFail={handleLogout} />
      ) : (
        <InventoryPanel token={token} onAuthFail={handleLogout} />
      )}

      <style>{`
        .adm-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .adm-title { margin: 0; }
        .adm-tabs {
          display: flex;
          gap: 0.5rem;
          margin: 1.25rem 0 1.5rem;
          border-bottom: 2px solid var(--border-strong);
          padding-bottom: 0;
        }
        .adm-tabs .adm-tab {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          min-height: 48px;
          padding: 0 1.1rem;
          background: transparent;
          border: none;
          border-bottom: 3px solid transparent;
          border-radius: 0;
          font-family: var(--font-display);
          font-size: 1.15rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          cursor: pointer;
          transition: color var(--duration-fast) var(--ease),
            border-color var(--duration-fast) var(--ease);
        }
        .adm-tabs .adm-tab:hover { color: var(--brand-dark); }
        .adm-tabs .adm-tab[aria-current='page'] {
          color: var(--text);
          border-bottom-color: var(--brand);
        }
      `}</style>
    </section>
  );
}
