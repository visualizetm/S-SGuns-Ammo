# NEEDS-CONFIRMATION

Nothing below may be published as fact until the owner confirms it. Each
item renders as a labeled placeholder (or intentionally neutral copy) in the
build. Confirmed facts already hardcoded: business name (S&S Guns & Ammo),
address (10 S. 3rd Street, Unit 5, Oxford, PA 19363), phone ((610) 467-0284), owner email for form delivery (sandsammozone@gmail.com).

## Placeholders currently rendered on the site

| Item | Where it renders | Placeholder |
| --- | --- | --- |
| Business hours | Home visit block, Contact, footer | `[[HOURS - confirm with owner]]` |
| Shop email address | Contact | `[[EMAIL ADDRESS - confirm with owner]]` |
| Owner names | About | `[[OWNER NAMES - confirm with owner]]` |
| Founding year | About | `[[FOUNDING YEAR - confirm with owner]]` |
| Family story | About | `[[FAMILY STORY - confirm with owner]]` |
| Parking details | Contact | `[[PARKING DETAILS - confirm with owner]]` |
| Service list | Services page header | `[[SERVICE LIST - confirm each service with owner before publish]]` |

## Copy marked service-dependent

- Home hero supporting line ("Family-owned in Oxford, Pennsylvania.
  Straightforward service for local firearm owners, transfer customers and
  sporting enthusiasts.") assumes the confirmed service mix. Adjust after
  the owner confirms the exact service list (`src/pages/Home.jsx`).

## Brand assets: SUPPLIED (source PNGs in public/brand/)

Wordmark, submark, both rifle seals, the wide lockup, and the brand
pattern are in `public/brand/` and wired into the site. Site-ready
`.web.webp` versions, the favicon, apple-touch-icon, and og:image are
derived with `node scripts/optimize-brand-assets.mjs` (rerun after
replacing any source PNG). Per guardrails: rifle art renders only as the
large feature graphics on Home and About; favicon/og use the weapon-free
submark. SVG versions were not supplied; PNG sources are fine, SVGs can
be swapped in later for extra sharpness if Rob ever has them.

## Assets Rob must still supply (labeled slots render until then)

- Photography: owner or storefront photo (About), map image or embed
  (Home visit block, Contact).

## Unconfirmed facts (do not fabricate)

- Business hours, including holiday hours
- Owner name(s) and family story details
- Shop email address
- Founding year (no "EST. 19xx" anywhere until confirmed)
- Exact list of services offered (entries in `src/data/services.js` marked
  `confirmed: true` are the neutral draft to be confirmed line by line;
  entries marked `confirmed: false`, currently Gunsmithing, stay hidden
  everywhere until confirmed)
- Transfer fee amounts and transfer process specifics (site says only
  "Call the shop for current transfer details")
- Whether appointments are needed for transfers or walk-ins are fine
- FFL status and how it may be described publicly
- DBA / legal entity name
- Parking situation at 10 S. 3rd Street
- Any reviews, ratings, or testimonials (NONE are included; never fabricate)
- Social media accounts, if any (`SOCIAL_LINKS` is empty; no social UI
  renders until real accounts are confirmed)

## Legal review required before publish

All copy about transfers, background checks, or store policy lives in data
files and carries a `// LEGAL REVIEW REQUIRED before publish` comment:

- `src/data/transfersFaq.js` (entire file: transfer intro, transfer steps,
  what-to-bring list, and all FAQ items)
- `src/data/services.js` (the FFL Transfers entry)

No fee numbers and no legal claims appear anywhere; regulated questions are
answered with "Call the shop" language pending owner and counsel review.

## Product catalog (product studio phase)

- All seeded catalog data is fictional and prefixed "DEMO:". No real
  products, prices, calibers, or stock levels exist anywhere in the
  build. The owner enters real items through /admin. Production data
  starts empty.
- Public pricing approved by owner: prices (and sale pricing with
  compare-at values) may appear on the public site. The public catalog
  page itself is the next phase.
- Starter collections (Handguns, Rifles, Shotguns, Ammunition, Optics &
  Accessories, Other) migrated from the old category list; the owner can
  rename, reorder, hide, or delete them freely in the admin.
- Condition values (New, Used) and stock statuses (In Stock, Low Stock,
  Sold, Hidden) are drafts to confirm with the owner.

## Owner email for form delivery (CONFIRMED)

- Confirmed owner email: sandsammozone@gmail.com. This is the Web3Forms
  destination: create the access key with this address and set
  `WEB3FORMS_ACCESS_KEY` (see PRODUCTION-SETUP.md). Until the key is set,
  the forms show a "form is being set up" message and deliver nothing.
- Whether this address should also DISPLAY publicly on the Contact page
  is a separate choice; the public email line still renders the
  `[[EMAIL ADDRESS - confirm with owner]]` placeholder until the owner
  decides.

## Demo-mode items to revisit at production

- Catalog storage is a JSON file (dev) until `DATABASE_URL` is set; see
  PRODUCTION-SETUP.md for the Postgres and Vercel Blob promotion steps.
- Admin gate uses a documented demo password (see README); set
  `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` in Vercel before launch.
- Set `WEB3FORMS_ACCESS_KEY` so the public forms deliver to the owner's
  inbox instead of showing the setup message.
