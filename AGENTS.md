# SUPRAMEDS - Project Agent Instructions

## Project Overview
SUPRAMEDS (suprameds.in) — Production-ready Indian pharmaceutical eCommerce platform.
- Licensed online pharmacy in India, 3 years old
- ~350 orders/month at launch, designed for 10,000+/month
- Single owned ambient warehouse (tablets, capsules, syrups, strips — NO cold chain, NO narcotics)
- Generic medicines with 50-80% off MRP, free delivery above ₹300

## Tech Stack
- **Backend**: Medusa.js v2 (`apps/backend/`)
- **Storefront**: TanStack Start (React) (`apps/storefront/`) — NOT Next.js
- **Package Manager**: npm workspaces monorepo (pnpm for Medusa Cloud deployment)
- **Database**: PostgreSQL (Supabase for local dev, Neon via Medusa Cloud for prod)
- **Payments**: Razorpay (online) + Cash on Delivery (COD)
- **Email**: Resend (transactional emails from support@supracynpharma.com)
- **SMS OTP**: MSG91 (DLT-registered templates)
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **Shipment Tracking**: AfterShip API
- **Error Monitoring**: Sentry (storefront)
- **Analytics**: Google Analytics 4 (GA4)

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
  modules/          # Custom Medusa modules (16 pharma modules)
  providers/        # Custom module providers (payment-razorpay, notification-resend)
  workflows/        # Custom workflows + hooks
  api/              # Custom API routes (store/, admin/, v1/)
  links/            # Module links (cross-module associations)
  subscribers/      # Event subscribers
  jobs/             # Scheduled jobs (COD cancel, session cleanup, FEFO, AfterShip sync)
  admin/            # Admin dashboard extensions (routes + widgets)
```

## Routing Convention (Storefront)
- Country-prefixed routes: `/$countryCode/` (e.g., `/in/products/paracetamol`)
- India is the primary region (ISO code: `in`)
- Compliance pages are top-level (no country prefix): `/pharmacy/licenses`, `/prescription-policy`, `/grievance`, `/privacy`, `/terms`, `/returns`

## Custom Modules (all in apps/backend/src/modules/)
| Module Key         | Module Name          | Purpose |
|--------------------|----------------------|---------|
| pharmaCore         | pharma               | Drug metadata (schedule, GST, form, strength, composition) |
| pharmaPrescription | prescription         | Customer Rx uploads, approval workflow |
| pharmaInventoryBatch | inventoryBatch     | Lot tracking, FEFO allocation, expiry management |
| pharmaRbac         | rbac                 | 25 roles, ~65 permissions, SSD enforcement |
| pharmaDispense     | dispense             | Pharmacist pre-dispatch sign-off |
| pharmaOrder        | orders               | Order extensions (COD tracking, progress) |
| pharmaCod          | cod                  | COD-specific logic |
| pharmaWarehouse    | warehouse            | Warehouse management |
| pharmaShipment     | shipment             | Shipment tracking with AfterShip |
| pharmaPayment      | payment              | Payment extensions |
| pharmaCompliance   | compliance           | GST invoices, H1 register, compliance reports |
| pharmaCrm          | crm                  | Customer relationship management |
| pharmaAnalytics    | analytics            | Business analytics |
| pharmaLoyalty      | loyalty              | Loyalty/rewards program |
| pharmaNotification | notification         | Internal notification module (NOT the Medusa provider) |

## Module Providers (apps/backend/src/providers/)
### notification-resend
- **Structure**: `index.ts` = `ModuleProvider()` wrapper, `service.ts` = service class
- Registered in `medusa-config.ts` under `notification` module with `channels: ["email"]`

### payment-razorpay
- Re-exports from `medusa-plugin-razorpay-v2` community plugin
- Registered in `medusa-config.ts` under `payment` module

## RBAC System
- 25 predefined roles (super_admin, pharmacist, warehouse_manager, etc.)
- ~65 granular permissions (`resource:action` format, e.g. `prescription:approve`)
- `authorize(resource, action)` middleware for API route protection
- `enforceSsd(rule, getRelatedUserId)` middleware for Static Separation of Duties (8 SSD rules)
- Admin UI page at `/app/roles` for role management, user assignment, and audit log
- Seed script: `POST /admin/rbac/seed` to initialize roles/permissions

## Compliance Rules (HARD — Never Override)
1. Schedule X drugs: absolute prohibition on sale (NDPS Act, 1985)
2. Schedule H/H1 drugs: require approved prescription for purchase
3. No promotions/discounts on Rx drugs (enforced in completeCartWorkflow validate hook)
4. No lifestyle/model images on products (Drugs & Magic Remedies Act, 1954)
5. Pharmacist sign-off required before carrier booking for Rx orders
6. DLT-registered SMS templates only (MSG91)
7. Cash/credit memo required for every order (Draft E-Pharmacy Rules, 2018)
8. MRP compliance: never sell above printed MRP; use HIGHEST MRP across dispatched batches

## API Route Conventions
- Storefront: `/store/` prefix with `MedusaStoreRequest`
- Admin: `/admin/` prefix (auto-authenticated) — now with RBAC `authorize()` middleware
- Custom customer auth: `/v1/` prefix with CORS + `authenticate("customer", ["bearer", "session"])`
- HTTP methods: GET (reads), POST (creates + updates), DELETE only — NO PUT/PATCH

## Environment Variables (Key)
- `DATABASE_URL` — PostgreSQL (Supabase local, Neon prod)
- `REDIS_URL` — Optional; comment out for local dev if Redis isn't running
- `JWT_SECRET`, `COOKIE_SECRET` — Auth secrets
- `RAZORPAY_TEST_KEY_ID`, `RAZORPAY_TEST_KEY_SECRET` — Test payment gateway
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` — Live payment gateway
- `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID_OTP` — SMS OTP (DLT registered)
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — Transactional email
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — FCM push
- `AFTERSHIP_API_KEY` — Shipment tracking
- `WAREHOUSE_STATE`, `PHARMACY_GSTIN`, `PHARMACY_DL_NUMBER` — GST invoice generation

## Known Gotchas & Lessons Learned

### Medusa v2 Module Provider Pattern (CRITICAL)
- Custom providers (notification, payment, file, etc.) **MUST** use the `ModuleProvider()` wrapper from `@medusajs/framework/utils`
- **Wrong**: `export default MyProviderService` in `index.ts` → causes `moduleProviderServices is not iterable` at runtime
- **Right**: Split into `index.ts` (wrapper) + `service.ts` (class):
  ```typescript
  // index.ts
  import { ModuleProvider, Modules } from "@medusajs/framework/utils"
  import MyService from "./service"
  export default ModuleProvider(Modules.NOTIFICATION, { services: [MyService] })
  ```
  ```typescript
  // service.ts
  class MyService extends AbstractNotificationProviderService { ... }
  export default MyService
  ```

### Stale `.medusa/` Build Cache
- Medusa compiles providers/modules to `.medusa/server/src/...` — if you change source files, the old compiled JS can persist
- **Fix**: Delete the stale cache before restarting: `rm -rf .medusa/server/src/providers/your-provider/`
- Always check `.medusa/server/` when you get runtime errors that don't match your source code

### Redis Configuration
- `REDIS_URL` set in `.env` when Redis isn't running causes **endless** `[ioredis] Unhandled error event: AggregateError` spam
- Medusa gracefully falls back to in-memory event bus when `REDIS_URL` is not set (or undefined)
- **Rule**: Comment out `REDIS_URL` in `.env` for local dev unless Redis is actually running

### Database URL — Read-Only vs Read-Write
- Medusa Cloud Neon DB URLs are **read-only** from outside Medusa Cloud → causes `cannot execute INSERT in a read-only transaction`
- Use Supabase URL for local development (full read-write)
- Medusa Cloud DB URL is only for querying/viewing data externally (e.g. via `psql`)

### Workflow Hook Handlers
- **Cannot define multiple hook handlers** for the same workflow validate hook
- If you need multiple validations (e.g., Schedule X block + Rx check + promo block), combine them in a **single** hook handler function
- Duplicate hook registrations cause: `Cannot define multiple hook handlers for the validate hook`

### Module Naming
- Module names in `Module()` definition must **NOT** contain hyphens — use camelCase
- **Wrong**: `Module("inventory-batch", { ... })` → silent registration failure
- **Right**: `Module("inventoryBatch", { ... })`

### Medusa Money Amounts
- Medusa stores money in **whole currency units** (₹10 = amount: `10`, NOT `1000`)
- INR has 2 decimal places but paise are rarely used in pharma; display as ₹XX (no decimals)

### MedusaService Behavior
- `MedusaService.create()` returns a **single object** when passed a single object (not an array)
- `MedusaService.create()` returns an **array** when passed an array
- Always check what you passed in to know what you'll get back

### Payment Session Idempotency
- `POST .../payment-sessions` can return 400: "Account holder with provider_id: pp_system_default, external_id: cus_xxx, already exists"
- The default payment provider creates an account holder per customer; must handle idempotently
- When switching payment methods (e.g., Razorpay → COD), cart may already have a payment collection → handle "Cart already has a payment collection" gracefully

### RBAC Middleware Argument Order
- `rbacService.validateSsd()` signature: `(rule, userId, relatedUserId)` — NOT `(userId, relatedUserId, rule)`
- `validateSsd()` returns `{ valid: boolean, rule?: string, message?: string }` — check `.valid`, not the return directly
- Always verify function signatures before calling custom service methods

### External Service Resilience
- All external services (MSG91, Resend, FCM, AfterShip, Razorpay) can fail — NEVER let failures block core flows
- OTP: Store OTP only AFTER confirmed delivery by external service, not before
- FCM: Wrap all Firebase Admin calls in try/catch, return error objects
- Pattern: Check if service is configured before calling; return helpful fallback suggestions in error responses

### TanStack Router
- Uses `$param` file naming (not `[param]` like Next.js)
- File-based routing: routes in `src/routes/` auto-generate `routeTree.gen.ts`
- Don't manually edit `routeTree.gen.ts` — it's auto-generated

### Build & Deploy
- Backend: `medusa build` for Medusa Cloud, `npx tsc --noEmit` for type-checking
- Storefront: `pnpm build` (Vite build)
- Medusa Cloud auto-runs `db:migrate` on deploy but does NOT run seed scripts
- Always run `npx tsc --noEmit` locally before pushing to catch type errors early
