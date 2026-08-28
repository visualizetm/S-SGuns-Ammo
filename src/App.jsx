import { BrowserRouter, Routes, Route } from 'react-router-dom';
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

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Admin is its own application: no public navbar or footer. It stays
            fully reachable in maintenance mode so the owner can keep working
            while the storefront is down. */}
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
    </BrowserRouter>
  );
}
