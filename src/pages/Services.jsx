import { Link } from 'react-router-dom';
import { BUSINESS } from '../data/business.js';
import { SERVICES, SERVICES_CONFIRMATION_NOTE } from '../data/services.js';

// Placeholder page. Informational only: no prices, no e-commerce.
export function Services() {
  return (
    <section aria-labelledby="services-heading">
      <h1 id="services-heading">Services</h1>
      <p>{SERVICES_CONFIRMATION_NOTE}</p>
      <ul>
        {SERVICES.map((service) => (
          <li key={service.id}>
            <h2>{service.title}</h2>
            <p>{service.description}</p>
          </li>
        ))}
      </ul>
      <p>
        Questions about any of these? Call{' '}
        <a href={BUSINESS.phoneHref}>{BUSINESS.phoneDisplay}</a> or{' '}
        <Link to="/contact">send us a message</Link>.
      </p>
    </section>
  );
}
