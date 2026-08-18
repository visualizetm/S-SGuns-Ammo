import { useLeadForm, FORM_STATUS } from './useLeadForm.js';
import { FormField, FormErrorSummary, HoneypotField } from './FormField.jsx';
import { BUSINESS } from '../../content/siteFacts.js';

const BLANK = { name: '', email: '', phone: '', message: '', company: '' };

const LABELS = {
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  message: 'Message',
};

export function ContactForm({ initialMessage = '' }) {
  // The item pages link here with ?about=<name>; the prefill lands in the
  // message field so the shop knows what the customer is asking about.
  const form = useLeadForm(
    'contact',
    { ...BLANK, message: initialMessage },
    'contact'
  );

  if (form.status === FORM_STATUS.SUCCESS) {
    return (
      <div role="status" className="ssga-form-success">
        <p className="stamp">Received</p>
        <p>Your message is in. We will get back to you.</p>
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
      <FormErrorSummary form={form} labels={LABELS} />
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
