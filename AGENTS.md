# SUPRAMEDS - Project Agent Instructions

## Project Overview
SUPRAMEDS (suprameds.in) — Production-ready Indian pharmaceutical eCommerce platform.
- Licensed online pharmacy in India, 3 years old
- ~350 orders/month at launch, designed for 10,000+/month
- Single owned ambient warehouse (tablets, capsules, syrups, strips — NO cold chain, NO narcotics)

## Tech Stack
- **Backend**: Medusa.js v2 (`apps/backend/`)
- **Storefront**: TanStack Start (React) (`apps/storefront/`) — NOT Next.js
- **Package Manager**: pnpm monorepo

## Design System — "Clinical-Clean Precision"
- **Colors** (theme.css): `--suprameds-navy` (#1E2D5A), `--suprameds-green` (#27AE60), `--suprameds-amber` (#F39C12), `--suprameds-cream` (#FAFAF8), `--suprameds-charcoal` (#2C3E50)
- **Fonts**: Instrument Serif (headings) + DM Sans (body) via Google Fonts
- **Rule**: NO lifestyle/people images on product cards per Drugs & Magic Remedies Act, 1954
- **Tailwind classes**: use CSS vars via `bg-[var(--suprameds-navy)]` pattern

## Directory Structure (Key Paths)
```
apps/storefront/src/
  routes/           # TanStack Router file-based routes ($param syntax)
  components/       # React components
  components/ui/    # Primitive UI components
  lib/hooks/        # React Query hooks
  lib/utils/        # Utility functions (sdk.ts = Medusa SDK instance)
  lib/data/         # Server-side data fetchers
  styles/           # app.css + theme.css (design tokens)

apps/backend/src/
  modules/          # Custom Medusa modules
  workflows/        # Custom workflows
  api/              # Custom API routes
  links/            # Module links (cross-module associations)
  subscribers/      # Event subscribers
  jobs/             # Scheduled jobs
  admin/            # Admin dashboard extensions
```

## Routing Convention (Storefront)
- Country-prefixed routes: `/$countryCode/` (e.g., `/in/products/paracetamol`)
- India is the primary region (ISO code: `in`)
- Compliance pages are top-level (no country prefix): `/pharmacy/licenses`, `/prescription-policy`, `/grievance`, `/privacy`, `/terms`, `/returns`

## Completed Work (Phases 1-2)
- India region + INR currency configured
- Design system: theme.css, navbar, footer (Clinical-Clean Precision aesthetic)
- Homepage: hero, categories, features, trust signals
- Compliance pages: `/pharmacy/licenses`, `/prescription-policy`, `/grievance`, `/privacy`, `/terms`, `/returns`
- 3 seed products with pharma metadata
- CSS syntax fix in theme.css

## Custom Modules (Phase 3+)
### pharma
- Drug metadata: schedule classification (H, H1, X, OTC), GST slab, form, strength, composition
- Critical: Schedule X drugs CANNOT be sold online — enforced in `src/api/middlewares.ts` (store cart line-items POST) and `src/workflows/hooks/schedule-x-block-add-to-cart.ts` (addToCartWorkflow.validate)
- Critical: Schedule H/H1 require valid prescription (enforced in checkout workflow hook)

### prescription
- Customer prescription uploads (S3 presigned URLs)
- Status: pending_review → approved → rejected → expired
- Traceability: every Rx line item must reference a prescription_id
- Approval requires registered pharmacist actor_id

### inventoryBatch
- Lot tracking with expiry dates
- FEFO allocation (First Expiry First Out)
- Batch deductions linked to order line items

## Compliance Rules (HARD — Never Override)
1. Schedule X drugs: absolute prohibition on sale (NDPS Act, 1985)
2. Schedule H/H1 drugs: require approved prescription for purchase
3. No promotions/discounts on Rx drugs (enforced in completeCartWorkflow validate hook)
4. No lifestyle/model images on products (Drugs & Magic Remedies Act, 1954)
5. Pharmacist sign-off required before carrier booking for Rx orders
6. DLT-registered SMS templates only (MSG91)
7. Cash/credit memo required for every order (Draft E-Pharmacy Rules, 2018)

## API Route Conventions
- Storefront: `/store/` prefix with `MedusaStoreRequest`
- Admin: `/admin/` prefix (auto-authenticated)
- Custom customer auth: `/v1/` prefix with CORS + `authenticate("customer", ["bearer", "session"])`
- HTTP methods: GET (reads), POST (creates + updates), DELETE only — NO PUT/PATCH

## Environment Variables (Key)
- `DATABASE_URL` — PostgreSQL
- `JWT_SECRET`, `COOKIE_SECRET`
- `S3_BUCKET`, `S3_REGION`, `S3_FILE_URL` — Prescription file storage
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` — Primary payment gateway
- `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID_OTP` — SMS OTP (DLT registered)

## Known Gotchas
- TanStack Start uses `$param` file naming (not `[param]` like Next.js)
- Backend builds with `pnpm build` (not `npx tsc`) to catch all errors
- Medusa stores money amounts in whole units (₹10 = amount: 10, NOT 1000)
- INR has 2 decimal places but paise are rarely used; display as ₹XX
- `MedusaService` returns single object when passed single object (not array)
- Module names in `Module()` must NOT contain hyphens — use camelCase
