import { useLeadForm, FORM_STATUS } from './useLeadForm.js';
import { FormField, HoneypotField } from './FormField.jsx';
import { BUSINESS } from '../../data/business.js';

const INITIAL = { name: '', email: '', phone: '', message: '', company: '' };

export function ContactForm() {
  const form = useLeadForm('contact', INITIAL, 'contact');

  if (form.status === FORM_STATUS.SUCCESS) {
    return (
      <div role="status" className="ssga-form-success">
        <p>Thank you. Your message has been sent and we will get back to you.</p>
        <p>
          Need an answer sooner? Call{' '}
          <a href={BUSINESS.phoneHref}>{BUSINESS.phoneDisplay}</a>.
        </p>
        <button type="button" onClick={form.reset}>
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit} noValidate aria-label="Contact form">
      <FormField form={form} name="name" label="Name" required autoComplete="name" />
      <FormField form={form} name="email" label="Email" type="email" required autoComplete="email" />
      <FormField form={form} name="phone" label="Phone" type="tel" autoComplete="tel" />
      <FormField form={form} name="message" label="Message" as="textarea" required rows={6} />
      <HoneypotField form={form} />
      {form.status === FORM_STATUS.FAILED ? (
        <p role="alert" className="ssga-form-failure">
          {form.failureMessage}
        </p>
      ) : null}
      <button
        type="submit"
        className="btn btn-primary"
        disabled={form.status === FORM_STATUS.SUBMITTING}
      >
        {form.status === FORM_STATUS.SUBMITTING ? 'Sending...' : 'Send message'}
      </button>
    </form>
  );
}
