import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout.jsx';
import { Home } from './pages/Home.jsx';
import { About } from './pages/About.jsx';
import { Services } from './pages/Services.jsx';
import { Inventory } from './pages/Inventory.jsx';
import { InventoryItem } from './pages/InventoryItem.jsx';
import { TransfersFaq } from './pages/TransfersFaq.jsx';
import { Contact } from './pages/Contact.jsx';
import { Admin } from './pages/Admin.jsx';
import { NotFound } from './pages/NotFound.jsx';
import { Maintenance } from './pages/Maintenance.jsx';
import { MAINTENANCE_MODE } from './config/maintenance.js';
import { isDashboardHost, publicSiteUrl } from './config/hosts.js';

// Any path requested on the Owner's Dashboard host other than the dashboard
// itself (mounted at "/") sends the visitor to the same path on the public
// site, so the dashboard host never renders public storefront content.
function DashboardHostRedirect() {
  const location = useLocation();
  useEffect(() => {
    window.location.replace(publicSiteUrl(location.pathname, location.search));
  }, [location]);
  return null;
}

export function App() {
  // Same Vercel project and deployment serve both hosts; which app renders
  // is decided entirely by the hostname (see src/config/hosts.js). The
  // dashboard is never covered by MAINTENANCE_MODE on either host.
  const dashboardHost = isDashboardHost();

  return (
    <BrowserRouter>
      {dashboardHost ? (
        <Routes>
          {/* dashboard.<public host>: the Owner's Dashboard lives at the
              root path and nothing else renders here. */}
          <Route path="/" element={<Admin />} />
          <Route path="*" element={<DashboardHostRedirect />} />
        </Routes>
      ) : (
        <Routes>
          {/* Everywhere else (the public host, localhost, and any preview
              deployment): path-based /admin keeps working, which is what
              local dev and preview testing rely on. On the real public
              host, old /admin links get a true 301 to the dashboard host
              at the edge (vercel.json) before this code even runs; this
              route is the local-dev / preview fallback for that path. */}
          <Route path="admin" element={<Admin />} />

          {MAINTENANCE_MODE ? (
            /* Public site off: every public route, including unknown ones,
               renders the maintenance page with no storefront chrome.
               Flip VITE_MAINTENANCE_MODE back to false to restore the site
               exactly as it was (see src/config/maintenance.js). */
            <Route path="*" element={<Maintenance />} />
          ) : (
            /* Public marketing site. */
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="about" element={<About />} />
              <Route path="services" element={<Services />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="inventory/:id" element={<InventoryItem />} />
              <Route path="transfers" element={<TransfersFaq />} />
              <Route path="contact" element={<Contact />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          )}
        </Routes>
      )}
    </BrowserRouter>
  );
}
