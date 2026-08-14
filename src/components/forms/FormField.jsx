// Minimal accessible form field: label, input or textarea, inline error
// wired up with aria-describedby / aria-invalid. Styling comes in Phase 2.

export function FormField({
  form,
  name,
  label,
  type = 'text',
  as = 'input',
  required = false,
  autoComplete,
  rows = 4,
}) {
  const id = `${form.idPrefix}-${name}`;
  const errorId = `${id}-error`;
  const error = form.errors[name];
  const shared = {
    id,
    name,
    value: form.values[name] ?? '',
    onChange: (e) => form.setField(name, e.target.value),
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': error ? errorId : undefined,
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
      {error ? (
        <span id={errorId} role="alert" className="ssga-field-error">
          {error}
        </span>
      ) : null}
    </p>
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
