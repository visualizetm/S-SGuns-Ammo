// Accessible form field primitives: visible label, input or textarea,
// inline error wired up with aria-describedby / aria-invalid, plus a
// linked error summary that takes focus on multi-error submits.

import { useEffect, useRef } from 'react';

export function FormField({
  form,
  name,
  label,
  type = 'text',
  as = 'input',
  required = false,
  autoComplete,
  rows = 4,
  hint,
}) {
  const id = `${form.idPrefix}-${name}`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const error = form.errors[name];
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') ||
    undefined;
  const shared = {
    id,
    name,
    value: form.values[name] ?? '',
    onChange: (e) => form.setField(name, e.target.value),
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': describedBy,
    autoComplete,
    disabled: form.status === 'submitting',
  };

  return (
    <p className="ssga-field">
      <label htmlFor={id}>
        {label}
        {required ? ' (required)' : ''}
      </label>
      {as === 'textarea' ? (
        <textarea rows={rows} {...shared} />
      ) : (
        <input type={type} {...shared} />
      )}
      {hint ? (
        <span id={hintId} className="ssga-field-hint">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} role="alert" className="ssga-field-error">
          {error}
        </span>
      ) : null}
    </p>
  );
}

// Linked error summary, shown when a submit produces two or more field
// errors. Receives focus so keyboard and screen reader users land on it;
// each entry focuses its field. Inline errors stay next to the fields.
export function FormErrorSummary({ form, labels }) {
  const ref = useRef(null);
  const entries = Object.entries(form.errors);

  useEffect(() => {
    if (form.summaryNonce > 0 && entries.length >= 2) {
      ref.current?.focus();
    }
    // Refocus only when a new failing submit happens, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.summaryNonce]);

  if (form.summaryNonce === 0 || entries.length < 2) return null;

  function focusField(event, name) {
    event.preventDefault();
    document.getElementById(`${form.idPrefix}-${name}`)?.focus();
  }

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="ssga-error-summary"
      aria-label="Form errors"
    >
      <h3>Check {entries.length} fields</h3>
      <ul>
        {entries.map(([name, message]) => (
          <li key={name}>
            <a
              href={`#${form.idPrefix}-${name}`}
              onClick={(e) => focusField(e, name)}
            >
              {labels?.[name] || name}: {message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Hidden honeypot field. Real users never see or fill it; bots do. The
// server discards any submission where it has a value.
export function HoneypotField({ form }) {
  const id = `${form.idPrefix}-company`;
  return (
    <p className="ssga-honeypot" aria-hidden="true">
      <label htmlFor={id}>Company</label>
      <input
        id={id}
        name="company"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={form.values.company ?? ''}
        onChange={(e) => form.setField('company', e.target.value)}
      />
    </p>
  );
}
