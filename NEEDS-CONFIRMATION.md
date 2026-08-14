# NEEDS-CONFIRMATION

Nothing below may be published as fact until the owner confirms it. Each
item renders as a labeled placeholder (or intentionally neutral copy) in the
build. Confirmed facts already hardcoded: business name (S&S Guns & Ammo),
address (10 S. 3rd Street, Unit 5, Oxford, PA 19363), phone ((610) 368-6984).

## Placeholders currently rendered on the site

| Item | Where it renders | Placeholder |
| --- | --- | --- |
| Business hours | Home, Contact, footer | `[[HOURS - confirm with owner]]` |
| Shop email address | Contact | `[[EMAIL ADDRESS - confirm with owner]]` |
| Owner names | About | `[[OWNER NAMES - confirm with owner]]` |
| Founding year | About | `[[FOUNDING YEAR - confirm with owner]]` |
| Family story | About | `[[FAMILY STORY - confirm with owner]]` |
| Service list | Services | `[[SERVICE LIST - confirm each service with owner before publish]]` |

## Unconfirmed facts (do not fabricate)

- Business hours, including holiday hours
- Owner name(s) and family story details
- Shop email address
- Founding year (no "EST. 19xx" anywhere until confirmed)
- Exact list of services offered (current list in `src/data/services.js` is
  a neutral draft to be confirmed line by line)
- Transfer fee amounts and transfer process specifics (site says only
  "Call the shop for current transfer details")
- Whether appointments are needed for transfers or walk-ins are fine
- FFL status and how it may be described publicly
- DBA / legal entity name
- Any reviews, ratings, or testimonials (NONE are included; never fabricate)
- Social media accounts, if any

## Legal review required before publish

All copy about transfers, background checks, or store policy lives in data
files and carries a `// LEGAL REVIEW REQUIRED before publish` comment:

- `src/data/transfersFaq.js` (entire file: transfer intro and all FAQ items)
- `src/data/services.js` (the FFL Transfers entry)

No fee numbers and no legal claims appear anywhere; regulated questions are
answered with "Call the shop" language pending owner and counsel review.

## Demo-mode items to revisit at production

- Leads are stored in-memory (serverless) or localStorage (browser demo)
  behind the data adapter in `api/_lib/adapter.js`; swap in a real database
  adapter before launch.
- Admin gate uses a documented demo password (see README); set
  `ADMIN_PASSWORD` in Vercel and promote to real session auth before launch.
- Form submissions send no email notification yet; wire the owner's
  confirmed email into a notification step at production.
