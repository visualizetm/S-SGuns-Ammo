import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout.jsx';
import { Home } from './pages/Home.jsx';
import { About } from './pages/About.jsx';
import { Services } from './pages/Services.jsx';
import { TransfersFaq } from './pages/TransfersFaq.jsx';
import { Contact } from './pages/Contact.jsx';
import { Admin } from './pages/Admin.jsx';
import { NotFound } from './pages/NotFound.jsx';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="about" element={<About />} />
          <Route path="services" element={<Services />} />
          <Route path="transfers" element={<TransfersFaq />} />
          <Route path="contact" element={<Contact />} />
          <Route path="admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
