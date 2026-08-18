# NEEDS-CONFIRMATION

Nothing below may be published as fact until the owner confirms it. Each
item renders as a labeled placeholder (or intentionally neutral copy) in the
build. Confirmed facts already hardcoded: business name (S&S Guns & Ammo),
address (10 S. 3rd Street, Unit 5, Oxford, PA 19363), phone ((610) 368-6984).

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

## Inventory system (added with the inventory phase)

- All seeded inventory is fictional and prefixed "DEMO:". No real
  products, prices, calibers, or stock levels exist anywhere in the
  build. The owner enters real items through /admin.
- Category list (`INVENTORY_CATEGORIES` in
  `shared/inventoryValidation.js`: Handguns, Rifles, Shotguns,
  Ammunition, Optics & Accessories, Other) is a draft. Confirm with the
  owner before the public catalog phase.
- Whether prices may be shown on the PUBLIC site at all is UNCONFIRMED
  and needs owner plus compliance review before the public catalog
  phase. Prompt 1 barred public firearm price listings; inventory prices
  currently render only inside the authenticated admin.
- Condition values (New, Used) and stock statuses (In Stock, Low Stock,
  Sold, Hidden) are drafts to confirm with the owner.

## Demo-mode items to revisit at production

- Leads are stored in-memory (serverless) or localStorage (browser demo)
  behind the data adapter in `api/_lib/adapter.js`; swap in a real database
  adapter before launch.
- Admin gate uses a documented demo password (see README); set
  `ADMIN_PASSWORD` in Vercel and promote to real session auth before launch.
- Form submissions send no email notification yet; wire the owner's
  confirmed email into a notification step at production.
