// Shared server-side validation. This module is imported by the Vercel
// serverless functions (the source of truth) and also reused by the client
// for inline errors and by the in-browser demo adapter. Never trust the
// client: every endpoint re-runs these checks on the server.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function asString(value) {
  return typeof value === 'string' ? value : '';
}

// Trim, strip control characters (keeps tab, LF, CR), cap length.
function clean(value, maxLen) {
  return asString(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function digitsOf(value) {
  return asString(value).replace(/\D/g, '');
}

export function validateName(raw) {
  const name = clean(raw, 100);
  if (!name) return { error: 'Name is required.' };
  if (name.length < 2) return { error: 'Name must be at least 2 characters.' };
  return { value: name };
}

export function validateEmail(raw, { required = true } = {}) {
  const email = clean(raw, 200).toLowerCase();
  if (!email) {
    return required ? { error: 'Email address is required.' } : { value: '' };
  }
  if (!EMAIL_RE.test(email)) {
    return { error: 'Enter a valid email address.' };
  }
  return { value: email };
}

export function validatePhone(raw, { required = true } = {}) {
  const phone = clean(raw, 30);
  if (!phone) {
    return required ? { error: 'Phone number is required.' } : { value: '' };
  }
  const digits = digitsOf(phone);
  if (digits.length < 10 || digits.length > 15) {
    return { error: 'Enter a valid phone number with area code.' };
  }
  return { value: phone };
}

export function validateMessage(raw, { required = true, maxLen = 4000 } = {}) {
  const message = clean(raw, maxLen);
  if (!message) {
    return required ? { error: 'Message is required.' } : { value: '' };
  }
  if (message.length < 10) {
    return { error: 'Message must be at least 10 characters.' };
  }
  return { value: message };
}

function collect(checks) {
  const errors = {};
  const data = {};
  for (const [field, result] of Object.entries(checks)) {
    if (result.error) errors[field] = result.error;
    else data[field] = result.value;
  }
  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, data };
}

// Contact form: name, email, phone (optional), message.
export function validateContactLead(input = {}) {
  return collect({
    name: validateName(input.name),
    email: validateEmail(input.email),
    phone: validatePhone(input.phone, { required: false }),
    message: validateMessage(input.message),
  });
}

// Transfer inquiry form: name, phone, email, free-text item description,
// message. This is a plain inquiry with no regulated logic; the shop follows
// up by phone.
export function validateTransferLead(input = {}) {
  return collect({
    name: validateName(input.name),
    phone: validatePhone(input.phone, { required: true }),
    email: validateEmail(input.email),
    itemDescription: validateMessage(input.itemDescription, {
      required: true,
      maxLen: 500,
    }),
    message: validateMessage(input.message, { required: false }),
  });
}

// Email capture: name + email only.
export function validateEmailSignupLead(input = {}) {
  return collect({
    name: validateName(input.name),
    email: validateEmail(input.email),
  });
}

export const LEAD_TYPES = ['contact', 'transfer', 'email_signup'];

export function validateLead(type, input) {
  switch (type) {
    case 'contact':
      return validateContactLead(input);
    case 'transfer':
      return validateTransferLead(input);
    case 'email_signup':
      return validateEmailSignupLead(input);
    default:
      return { ok: false, errors: { type: 'Unknown lead type.' } };
  }
}

// Honeypot: a hidden "company" field real users never fill. If it has a
// value, the submission is treated as spam. We still return success so bots
// get no signal, but the lead is not stored.
export function isSpam(input = {}) {
  return clean(input.company, 100).length > 0;
}
