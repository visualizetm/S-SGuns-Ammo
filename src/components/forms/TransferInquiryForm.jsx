// Ask About a Transfer inquiry form. Plain inquiry only: no regulated
// logic, no fees, no e-commerce. The shop follows up directly.

import { useLeadForm, FORM_STATUS } from './useLeadForm.js';
import { FormField, FormErrorSummary, HoneypotField } from './FormField.jsx';
import { BUSINESS } from '../../data/business.js';

const INITIAL = {
  name: '',
  phone: '',
  email: '',
  itemDescription: '',
  message: '',
  company: '',
};

const LABELS = {
  name: 'Name',
  phone: 'Phone',
  email: 'Email',
  itemDescription: 'What are you transferring?',
  message: 'Anything else we should know?',
};

export function TransferInquiryForm() {
  const form = useLeadForm('transfer', INITIAL, 'transfer');

  if (form.status === FORM_STATUS.SUCCESS) {
    return (
      <div role="status" className="ssga-form-success">
        <p className="stamp">Received</p>
        <p>
          Your inquiry is logged. We will follow up with next steps.
        </p>
        <p>
          Prefer to talk it through? Call{' '}
          <a href={BUSINESS.phoneHref}>{BUSINESS.phoneDisplay}</a>.
        </p>
        <button type="button" onClick={form.reset}>
          Send another inquiry
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit} noValidate aria-label="Transfer inquiry form">
      <FormErrorSummary form={form} labels={LABELS} />
      <FormField form={form} name="name" label="Name" required autoComplete="name" />
      <FormField form={form} name="phone" label="Phone" type="tel" required autoComplete="tel" />
      <FormField form={form} name="email" label="Email" type="email" required autoComplete="email" />
      <FormField
        form={form}
        name="itemDescription"
        label="What are you transferring?"
        as="textarea"
        required
        rows={3}
        hint="Make and model is plenty. Not sure? Say so and we will sort it out together."
      />
      <FormField form={form} name="message" label="Anything else we should know?" as="textarea" rows={4} />
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
        {form.status === FORM_STATUS.SUBMITTING ? 'Sending...' : 'Send inquiry'}
      </button>
    </form>
  );
}
