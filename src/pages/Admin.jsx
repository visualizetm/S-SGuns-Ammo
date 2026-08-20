// The admin is a standalone product-management app (see AdminLayout). This
// page owns auth and which section is active; AdminLayout provides the app
// shell (sidebar, top bar, persistent Publish control) and the panels do the
// catalog work. Every edit is a draft until published. Auth is enforced
// server-side on every request (api/_lib/auth.js); the token here is only a
// credential, never the gate itself.

import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminLogin } from '../lib/apiClient.js';
import { usePageMeta } from '../lib/usePageMeta.js';
import { AdminLayout, AdminLogin, ADMIN_SECTIONS } from '../components/admin/AdminLayout.jsx';
import { OverviewPage } from '../components/admin/OverviewPage.jsx';
import { ProductsPage } from '../components/admin/ProductsPage.jsx';
import { QuickSalePage } from '../components/admin/QuickSalePage.jsx';

const TOKEN_KEY = 'ssga-admin-token';

export function Admin() {
  usePageMeta('Product Manager');
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
    </AdminLayout>
  );
}
