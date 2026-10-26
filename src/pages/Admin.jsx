// The admin is a standalone product-management app (see AdminLayout). This
// page owns auth and which section is active; AdminLayout provides the app
// shell (sidebar, top bar, persistent Publish control) and the panels do the
// catalog work. Every edit is a draft until published. Auth is enforced
// server-side on every request (api/_lib/auth.js); the token here is only a
// credential, never the gate itself.

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminLogin } from '../lib/apiClient.js';
import { usePageMeta } from '../lib/usePageMeta.js';
import { AdminLayout, AdminLogin, ADMIN_SECTIONS } from '../components/admin/AdminLayout.jsx';
import { OverviewPage } from '../components/admin/OverviewPage.jsx';
import { ProductsPage } from '../components/admin/ProductsPage.jsx';
import { QuickSalePage } from '../components/admin/QuickSalePage.jsx';
import { PublishHistoryPage } from '../components/admin/PublishHistoryPage.jsx';
import { HoursPage } from '../components/admin/HoursPage.jsx';

const TOKEN_KEY = 'ssga-admin-token';

export function Admin() {
  usePageMeta("Owner's Dashboard");

  // The Owner's Dashboard (only) opts in to viewport-fit=cover so
  // env(safe-area-inset-*) reports the iPhone's real safe areas and the
  // bottom tab bar can pad for the home indicator. Scoped to this page
  // instead of index.html so the public site's layout on notched phones in
  // landscape is not changed; restored when the dashboard unmounts.
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return undefined;
    const original = meta.getAttribute('content') || '';
    if (!/viewport-fit=/.test(original)) {
      meta.setAttribute('content', `${original}, viewport-fit=cover`);
    }
    return () => meta.setAttribute('content', original);
  }, []);
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '');
  const [loginError, setLoginError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const requested = searchParams.get('tab');
  const activeTab = ADMIN_SECTIONS.some((s) => s.id === requested)
    ? requested
    : 'overview';
  const productsSection = searchParams.get('section') || 'items';

  // Bumped after every draft write so the Publish control and the open panel
  // stay in sync; bumped again after publish/discard so lists refresh.
  const [version, setVersion] = useState(0);
  const notifyChange = useCallback(() => setVersion((v) => v + 1), []);

  const handleLogin = useCallback(async (password) => {
    setSubmitting(true);
    setLoginError('');
    const { body } = await adminLogin(password);
    setSubmitting(false);
    if (body?.ok && body.token) {
      sessionStorage.setItem(TOKEN_KEY, body.token);
      setToken(body.token);
    } else {
      setLoginError(body?.error || 'Login failed. Try again.');
    }
  }, []);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken('');
  }, []);

  const selectTab = useCallback(
    (id) => setSearchParams(id === 'overview' ? {} : { tab: id }),
    [setSearchParams]
  );

  const selectProductsSection = useCallback(
    (id) => setSearchParams(id === 'items' ? { tab: 'products' } : { tab: 'products', section: id }),
    [setSearchParams]
  );

  if (!token) {
    return (
      <AdminLogin onSubmit={handleLogin} error={loginError} submitting={submitting} />
    );
  }

  const panelProps = { token, version, onAuthFail: handleLogout, notifyChange };

  return (
    <AdminLayout
      activeTab={activeTab}
      onSelectTab={selectTab}
      token={token}
      version={version}
      notifyChange={notifyChange}
      onLogout={handleLogout}
    >
      {activeTab === 'overview' ? <OverviewPage {...panelProps} /> : null}
      {activeTab === 'products' ? (
        <ProductsPage
          section={productsSection}
          onSelectSection={selectProductsSection}
          panelProps={panelProps}
        />
      ) : null}
      {activeTab === 'sales' ? <QuickSalePage {...panelProps} /> : null}
      {activeTab === 'hours' ? <HoursPage {...panelProps} /> : null}
      {activeTab === 'history' ? <PublishHistoryPage {...panelProps} /> : null}
    </AdminLayout>
  );
}
