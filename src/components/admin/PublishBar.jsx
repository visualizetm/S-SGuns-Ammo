// Persistent publish bar: shows how many entities have unpublished changes
// and offers Publish (promote all drafts atomically) and Discard changes
// (revert drafts to the last published state), each behind a confirm step.
// This is the ONLY control that changes what the public site serves.

import { useCallback, useEffect, useState } from 'react';
import UploadCloud01 from '@untitled-ui/icons-react/build/esm/UploadCloud01';
import { adminPublishSummary, adminPublishAction } from '../../lib/apiClient.js';

export function PublishBar({ token, version, onAuthFail, onPublished }) {
  const [summary, setSummary] = useState(null);
  const [confirming, setConfirming] = useState(''); // '' | 'publish' | 'discard'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const refresh = useCallback(async () => {
    const { status, body } = await adminPublishSummary(token);
    if (status === 401) {
      onAuthFail();
      return;
    }
    if (body?.ok) setSummary(body.summary);
  }, [token, onAuthFail]);

  useEffect(() => {
    refresh();
  }, [refresh, version]);

  async function run(action) {
    setBusy(true);
    setError('');
    const { status, body } = await adminPublishAction(token, action);
    setBusy(false);
    setConfirming('');
    if (status === 401) {
      onAuthFail();
      return;
    }
    if (body?.ok) {
      setSummary(body.summary);
      setFlash(action === 'publish' ? 'Published. The site is up to date.' : 'Changes discarded.');
      setTimeout(() => setFlash(''), 4000);
      onPublished();
    } else {
      setError(body?.error || 'That did not go through. Try again.');
    }
  }

  const count = summary?.total ?? 0;

  return (
    <div className="pub-bar" role="region" aria-label="Publish status">
      <p className="pub-status" role="status">
        {flash ? (
          <strong>{flash}</strong>
        ) : count === 0 ? (
          'Everything on the site is up to date.'
        ) : (
          <strong>
            {count} unpublished change{count === 1 ? '' : 's'}
          </strong>
        )}
      </p>

      {error ? (
        <p role="alert" className="pub-error">
          {error}
        </p>
      ) : null}

      {confirming ? (
        <span className="pub-confirm" role="alert">
          <span>
            {confirming === 'publish'
              ? 'Put these changes on the public site?'
              : 'Throw away all unpublished changes?'}
          </span>
          <button type="button" className="btn btn-primary pub-btn" onClick={() => run(confirming)} disabled={busy}>
            {busy ? 'Working...' : confirming === 'publish' ? 'Yes, publish' : 'Yes, discard'}
          </button>
          <button type="button" className="btn btn-secondary pub-btn" onClick={() => setConfirming('')} disabled={busy}>
            Cancel
          </button>
        </span>
      ) : (
        <span className="pub-actions">
          <button
            type="button"
            className="btn btn-primary pub-btn"
            onClick={() => setConfirming('publish')}
            disabled={busy || count === 0}
          >
            <UploadCloud01 aria-hidden="true" width={18} height={18} />
            Publish
          </button>
          <button
            type="button"
            className="btn btn-secondary pub-btn"
            onClick={() => setConfirming('discard')}
            disabled={busy || count === 0}
          >
            Discard changes
          </button>
        </span>
      )}

      <style>{`
        .pub-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          background: var(--bg-deep);
          border: 1px solid var(--border-strong);
          border-left: 3px solid var(--brand);
          border-radius: var(--radius);
          padding: 0.75rem 1rem;
          margin: 0 0 1.5rem;
        }
        .pub-status { margin: 0; }
        .pub-error { margin: 0; color: var(--danger); font-weight: 500; }
        .pub-actions, .pub-confirm {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-wrap: wrap;
        }
        .pub-btn { min-height: 44px; font-size: 1rem; }
        @media (max-width: 599.98px) {
          .pub-bar { align-items: stretch; flex-direction: column; }
          .pub-actions, .pub-confirm { flex-direction: column; align-items: stretch; }
        }
      `}</style>
    </div>
  );
}
