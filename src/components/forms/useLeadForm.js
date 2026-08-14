// Shared form state for all lead forms: client-side validation for inline
// errors, disabled-on-submit, success and failure states, and server error
// merging. Server-side validation remains the source of truth.

import { useState } from 'react';
import { validateLead } from '../../../shared/validation.js';
import { submitLead } from '../../lib/apiClient.js';

export const FORM_STATUS = {
  IDLE: 'idle',
  SUBMITTING: 'submitting',
  SUCCESS: 'success',
  FAILED: 'failed',
};

export function useLeadForm(type, initialValues, idPrefix) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(FORM_STATUS.IDLE);
  const [failureMessage, setFailureMessage] = useState('');

  function setField(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }));
    // Clear a field's error as soon as the user edits it again.
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (status === FORM_STATUS.SUBMITTING) return;

    // Client-side pass for instant inline errors.
    const clientResult = validateLead(type, values);
    if (!clientResult.ok) {
      setErrors(clientResult.errors);
      return;
    }

    setStatus(FORM_STATUS.SUBMITTING);
    setErrors({});
    setFailureMessage('');

    const { status: httpStatus, body } = await submitLead(type, values);

    if (body?.ok) {
      setStatus(FORM_STATUS.SUCCESS);
      return;
    }
    if (httpStatus === 422 && body?.errors) {
      setErrors(body.errors);
      setStatus(FORM_STATUS.IDLE);
      return;
    }
    setFailureMessage(
      body?.error ||
        'Something went wrong. Please try again or call the shop at (610) 368-6984.'
    );
    setStatus(FORM_STATUS.FAILED);
  }

  function reset() {
    setValues(initialValues);
    setErrors({});
    setStatus(FORM_STATUS.IDLE);
    setFailureMessage('');
  }

  return {
    values,
    errors,
    status,
    failureMessage,
    setField,
    handleSubmit,
    reset,
    idPrefix: idPrefix || type,
  };
}
