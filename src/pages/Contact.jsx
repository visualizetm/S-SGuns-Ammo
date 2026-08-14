import { BUSINESS, PLACEHOLDERS } from '../data/business.js';
import { ContactForm } from '../components/forms/ContactForm.jsx';

// Placeholder page. Click-to-call and directions are real anchors that work
// on mobile.
export function Contact() {
  return (
    <>
      <section aria-labelledby="contact-heading">
        <h1 id="contact-heading">Contact</h1>
        <address>
          {BUSINESS.name}
          <br />
          {BUSINESS.address.line1}
          <br />
          {BUSINESS.address.city}, {BUSINESS.address.state}{' '}
          {BUSINESS.address.zip}
        </address>
        <p>
          <a href={BUSINESS.phoneHref}>Call {BUSINESS.phoneDisplay}</a>
        </p>
        <p>
          <a
            href={BUSINESS.directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Get directions
          </a>
        </p>
        <p>Email: {PLACEHOLDERS.email}</p>
        <p>Hours: {PLACEHOLDERS.hours}</p>
      </section>

      <section aria-labelledby="contact-form-heading">
        <h2 id="contact-form-heading">Send us a message</h2>
        <ContactForm />
      </section>
    </>
  );
}
