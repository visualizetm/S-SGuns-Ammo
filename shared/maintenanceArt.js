// The maintenance page illustration and copy, kept as plain strings so the
// React page and the edge middleware render the SAME artwork from one source
// (no drift between the in-app page and the 503 response body).
//
// A custom line-art monitor with a sick face: X eyes, a thermometer in its
// mouth, a bandage across the top corner, one sweat drop. Vintage Ivory
// (#F2EBDD) linework on Range Black (#10110F) with a single warm accent
// (#A45C38) on the thermometer bulb and the bandage hatching. Not an emoji,
// not clip art: drawn here as SVG paths.

export const SICK_COMPUTER_SVG = `<svg viewBox="0 0 260 210" width="260" height="210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A computer monitor with a sick face, a thermometer and a bandage">
  <g fill="none" stroke="#F2EBDD" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <rect x="30" y="26" width="200" height="134" rx="8"/>
    <rect x="42" y="38" width="176" height="110" rx="4" stroke-width="2" opacity="0.5"/>
    <path d="M118 160 L114 183"/>
    <path d="M142 160 L146 183"/>
    <path d="M96 185 H164"/>
    <path d="M92 72 L108 88 M108 72 L92 88"/>
    <path d="M152 72 L168 88 M168 72 L152 88"/>
    <ellipse cx="130" cy="116" rx="12" ry="8"/>
    <path d="M140 119 L182 133" stroke-width="4"/>
    <path d="M198 62 c6 9 8 13 0 15 c-8 -2 -6 -6 0 -15 Z" stroke-width="2"/>
  </g>
  <circle cx="187" cy="135" r="6" fill="#A45C38"/>
  <g transform="rotate(45 222 34)">
    <rect x="196" y="24" width="52" height="20" rx="10" fill="#10110F" stroke="#F2EBDD" stroke-width="3"/>
    <path d="M214 30 v8 M222 29 v10 M230 30 v8" stroke="#A45C38" stroke-width="2.5" stroke-linecap="round"/>
  </g>
</svg>`;

export const MAINTENANCE_HEADLINE = 'Website is down until further notice';
export const MAINTENANCE_SUBLINE =
  'We are working on it. Thanks for your patience.';
export const MAINTENANCE_CONTACT_LEAD =
  'The shop is still here. Give us a call:';
