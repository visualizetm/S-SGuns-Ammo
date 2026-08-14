import { Link } from 'react-router-dom';
import { BUSINESS } from '../data/business.js';

export function NotFound() {
  return (
    <section aria-labelledby="notfound-heading">
      <h1 id="notfound-heading">Page not found</h1>
      <p>The page you are looking for does not exist.</p>
      <p>
        <Link to="/">Back to the home page</Link> or call{' '}
        <a href={BUSINESS.phoneHref}>{BUSINESS.phoneDisplay}</a>.
      </p>
    </section>
  );
}
