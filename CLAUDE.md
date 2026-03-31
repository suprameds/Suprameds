# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Suprameds — Indian pharmaceutical eCommerce platform. Licensed online pharmacy selling generic medicines at 50-80% off MRP. Built on Medusa.js v2 backend with TanStack Start (React) storefront. Monorepo managed by pnpm workspaces + Turborepo.

## Commands

### Development
```bash
pnpm dev                    # Run both backend + storefront
pnpm backend:dev            # Backend only (Medusa develop) — http://localhost:9000
pnpm storefront:dev         # Storefront only (Vite) — http://localhost:5173
docker compose up -d        # Start Redis (required for jobs/cache in prod, optional locally)
```

### Build & Type-check
```bash
pnpm build                              # Build all apps via Turborepo
cd apps/backend && npx tsc --noEmit     # Type-check backend (run before pushing)
cd apps/storefront && pnpm build        # Vite build + service worker build
cd apps/backend && medusa build         # Medusa Cloud production build
```

### Database
```bash
cd apps/backend
npx medusa db:migrate                          # Run pending migrations
npx medusa exec ./src/scripts/run-migrations.ts  # Run custom seed/migration scripts
pnpm db:setup                                   # Migrate + seed (local)
pnpm db:setup:prod                              # Migrate + seed minus product data (prod)
```

### Tests
```bash
# Backend (Jest, from apps/backend/)
pnpm test:unit                        # Unit tests
npx jest --testMatch="**/*.unit.spec.ts"  # Windows-safe alternative
pnpm test:integration:http            # HTTP integration tests
pnpm test:integration:modules         # Module integration tests

# Storefront (Vitest, from apps/storefront/)
pnpm test                             # Run all tests
pnpm test:watch                       # Watch mode
vitest run src/path/to/file.test.ts   # Single test file
```

### Other
```bash
cd apps/backend && pnpm seed                    # Seed demo data
cd apps/backend && pnpm import:products         # Import product catalog
cd apps/backend && pnpm email:dev               # Preview email templates on :9004
```

## Architecture

### Monorepo Layout
- `apps/backend/` — Medusa.js v2 server (API, admin dashboard, 15 custom pharma modules)
- `apps/storefront/` — TanStack Start (Vite + React 19) customer-facing app
- Root uses Turborepo for orchestration, pnpm for package management

### Backend (Medusa v2) — `apps/backend/src/`
- **modules/** — 15 custom domain modules registered in `medusa-config.ts` with camelCase keys (e.g., `pharmaCore`, `pharmaPrescription`). Each module has its own models, services, and migrations.
- **providers/** — `payment-razorpay`, `notification-resend`, `fulfillment-conditional`. Each follows the `ModuleProvider()` wrapper pattern (index.ts wrapper + service.ts class).
- **workflows/** — Multi-step business processes (checkout, prescription review, dispensing, fulfillment, inventory allocation, compliance)
- **workflows/hooks/** — Workflow hook handlers for validation (e.g., Schedule X blocking, Rx checks, promo blocking on controlled drugs)
- **api/** — REST routes: `store/` (storefront), `admin/` (dashboard + RBAC), `webhooks/` (Razorpay, AfterShip). No PUT/PATCH — only GET, POST, DELETE.
- **links/** — Cross-module associations (product↔drug, order↔prescription, order↔batch, customer↔prescription, variant↔batch)
- **subscribers/** — Event handlers (~30) for order lifecycle, prescriptions, shipments, loyalty, notifications
- **jobs/** — Scheduled background tasks (~17): FEFO allocation, COD cancellation, stock sync, expiry flagging, H1 reports, AfterShip sync
- **admin/** — Dashboard extensions: routes (analytics, compliance, dispensing, GRN, H1 register, loyalty, pincodes, prescriptions, products, purchases, roles, warehouse) + widgets
- **scripts/** — `seed.ts`, `run-migrations.ts`, `import-products.ts`, `cloud-start.mjs`

### Storefront (TanStack Start) — `apps/storefront/src/`
- **routes/** — File-based routing with `$param` syntax (not `[param]`). Country-prefixed under `$countryCode/` (India = `in`). Compliance pages at root level.
- **components/ui/** — Primitive UI components
- **lib/hooks/** — React Query hooks for data fetching
- **lib/data/** — Server-side data fetchers
- **lib/utils/sdk.ts** — Medusa JS SDK instance
- **styles/theme.css** — Design tokens as CSS custom properties

### Key Integrations
- **Payments**: Razorpay (online) + system default (COD)
- **Email**: Resend (transactional from support@supracynpharma.com)
- **SMS OTP**: MSG91 with DLT-registered templates
- **Push**: Firebase Cloud Messaging
- **Shipping**: AfterShip tracking API
- **File Storage**: Cloudflare R2 / S3 (prod), local filesystem (dev)

## Critical Constraints

### Indian Pharma Compliance (non-negotiable)
1. **Schedule X drugs**: absolute sale prohibition (NDPS Act 1985)
2. **Schedule H/H1 drugs**: require approved prescription before purchase
3. **No promotions/discounts on Rx drugs** (enforced in completeCartWorkflow validate hook)
4. **No lifestyle/model images on product cards** (Drugs & Magic Remedies Act 1954)
5. **Pharmacist sign-off** required before carrier booking for Rx orders
6. **MRP compliance**: never sell above printed MRP; use HIGHEST MRP across dispatched batches
7. **Cash/credit memo** required for every order

### API Route Conventions
- Storefront routes: `/store/` prefix
- Admin routes: `/admin/` prefix with RBAC `authorize(resource, action)` middleware
- Customer auth routes: `/v1/` prefix with CORS + bearer/session auth
- HTTP methods: GET (reads), POST (creates + updates), DELETE — never PUT/PATCH

### RBAC System
- 25 roles, ~65 permissions in `resource:action` format
- `authorize(resource, action)` middleware on admin routes
- `enforceSsd(rule, getRelatedUserId)` for separation of duties
- Seed via `POST /admin/rbac/seed`

## Gotchas

- **MedusaService.updateXxxs()**: Takes a single object with `id` included — `this.updateXxxs({ id: someId, field: value })`. NOT `(id, data)` as separate args.
- **MedusaService method pluralization**: Uses smart English plurals from the model registration key (not model name). `H1RegisterEntry` → `listH1RegisterEntries` (not `Entrys`). `SupplyMemo` → `createSupplyMemoes`. Import key determines name: `import Refund from "./models/refund"` → `createRefunds` (even though model is `PharmaRefund`).
- **model.json() fields**: Typed as `Record<string, unknown>`. Pass arrays with `as any` cast.
- **React Email Preview tag**: Use template literals for number interpolation: `` {`Your order #${display_id}`} `` not `Your order #{display_id}` (TS2322 — number not assignable to ReactNode & string).
- **Import extensions (node16)**: Dynamic imports in notification-resend service need `.js` extensions: `import("../../email-templates/foo.js")`. Cast with `as any` for module namespace type mismatch.
- **Windows test commands**: `TEST_TYPE=unit pnpm test` doesn't work on Windows. Use `npx jest --testMatch="**/*.unit.spec.ts"` directly.
- **Module provider pattern**: Must use `ModuleProvider()` wrapper in index.ts + separate service.ts. Exporting the service class directly causes `moduleProviderServices is not iterable`.
- **Stale `.medusa/` cache**: Medusa compiles to `.medusa/server/src/`. Delete stale compiled files when source changes aren't reflected at runtime.
- **Redis in local dev**: Comment out `REDIS_URL` in `.env` when Redis isn't running — otherwise endless ioredis errors. Medusa falls back to in-memory event bus.
- **Module naming**: `Module()` names must be camelCase, no hyphens. `Module("inventory-batch")` silently fails.
- **Workflow hooks**: Cannot define multiple handlers for the same hook — combine validations in a single handler.
- **Dynamic imports of transitive deps**: `ioredis`, `sharp`, etc. are available at runtime via Medusa but lack type declarations in the build. Use `// @ts-ignore` before `await import("ioredis")` to prevent `medusa build` failures on Medusa Cloud.
- **Money amounts**: Medusa stores in whole currency units (₹10 = `10`, not `1000`).
- **MedusaService.create()**: Returns single object for single input, array for array input.
- **routeTree.gen.ts**: Auto-generated by TanStack Router — never edit manually.
- **Database URLs**: Medusa Cloud Neon URLs are read-only externally. Use Supabase for local dev.

## Design System
- Colors: `--suprameds-navy` (#1E2D5A), `--suprameds-green` (#27AE60), `--suprameds-amber` (#F39C12), `--suprameds-cream` (#FAFAF8), `--suprameds-charcoal` (#2C3E50)
- Fonts: Instrument Serif (headings) + DM Sans (body)
- Tailwind usage: `bg-[var(--suprameds-navy)]` pattern with CSS custom properties

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`
