import { Link } from 'react-router-dom';
import { BUSINESS, PLACEHOLDERS } from '../data/business.js';
import { EmailSignupForm } from '../components/forms/EmailSignupForm.jsx';

// Placeholder page. Content structure only; all visual design comes in Phase 2.
export function Home() {
  return (
    <>
      <section aria-labelledby="home-heading">
        <h1 id="home-heading">{BUSINESS.name}</h1>
        <p>
          Family-owned firearms and ammunition shop in Oxford, Pennsylvania.
        </p>
        <p>
          Visit us at {BUSINESS.address.line1}, {BUSINESS.address.city},{' '}
          {BUSINESS.address.state} {BUSINESS.address.zip}, or call{' '}
          <a href={BUSINESS.phoneHref}>{BUSINESS.phoneDisplay}</a>.
        </p>
        <p>Hours: {PLACEHOLDERS.hours}</p>
        <p>
          <Link to="/services">See what we offer</Link> or{' '}
          <Link to="/transfers">ask about a transfer</Link>.
        </p>
      </section>
      <section aria-labelledby="signup-heading">
        <h2 id="signup-heading">Get shop updates</h2>
        <p>Sign up and we will keep you posted on shop news.</p>
        <EmailSignupForm />
      </section>
    </>
  );
}
