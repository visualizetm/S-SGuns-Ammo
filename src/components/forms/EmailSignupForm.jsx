// Email capture (name + email) for future shop updates. No marketing claims.

import { useLeadForm, FORM_STATUS } from './useLeadForm.js';
import { FormField, HoneypotField } from './FormField.jsx';

const INITIAL = { name: '', email: '', company: '' };

export function EmailSignupForm() {
  const form = useLeadForm('email_signup', INITIAL, 'signup');

  if (form.status === FORM_STATUS.SUCCESS) {
    return (
      <div role="status" className="ssga-form-success">
        <p>Thank you. You are on the list for shop updates.</p>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit} noValidate aria-label="Email updates signup form">
      <FormField form={form} name="name" label="Name" required autoComplete="name" />
      <FormField form={form} name="email" label="Email" type="email" required autoComplete="email" />
      <HoneypotField form={form} />
      {form.status === FORM_STATUS.FAILED ? (
        <p role="alert" className="ssga-form-failure">
          {form.failureMessage}
        </p>
      ) : null}
      <button type="submit" disabled={form.status === FORM_STATUS.SUBMITTING}>
        {form.status === FORM_STATUS.SUBMITTING ? 'Signing up...' : 'Sign up for updates'}
      </button>
    </form>
  );
}
