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
- **subscribers/** — Event handlers (~31) for order lifecycle, prescriptions, shipments, loyalty, notifications, cache invalidation
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
- **SMS OTP**: BulkSMSPlans.com (primary) + MSG91 (fallback). DLT entity: SUPRACYN PRIVATE LIMITED (1501684950000036033). Sender IDs: Suprra, Ssupra, suppra.
- **BulkSMS**: API ID `BULKSMS_API_ID`, password `BULKSMS_API_PASSWORD`, sender `BULKSMS_SENDER_ID`. DLT template IDs as `BULKSMS_DLT_*` env vars.
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
- **Vite SSR env vars**: In TanStack Start server handlers (sitemap, API routes), use `import.meta.env.VITE_*` not `process.env.VITE_*`. Vite doesn't expose process.env for VITE_ prefixed vars at SSR runtime.
- **Database URLs**: Medusa Cloud Neon URLs are read-only externally. Use Supabase for local dev.
- **ICacheService.invalidate() supports globs**: `invalidate("store:products:*")` works because `@medusajs/cache-redis` uses Redis SCAN + MATCH internally. Don't assume it only takes exact keys.
- **Cache key injection**: Never interpolate raw user input into cache keys. Use `createHash("sha256").update(JSON.stringify(params)).digest("hex").slice(0,16)` to hash query params. Raw input with `:` colons can collide with key namespace delimiters.
- **Cache key namespace**: Medusa prefixes all cache keys with `medusa:` via `getCacheKey()`. When debugging Redis directly, keys appear as `medusa:store:products:pharma:handle`.
- **OTP login must set SDK token**: After OTP verify returns a JWT, call `sdk.client.setToken(token)` to store it in `medusa_auth_token` (localStorage). Without this, `sdk.store.customer.retrieve()` fails with 401 and account pages redirect to login. The custom `_suprameds_otp_jwt` key alone is not enough.
- **Admin widgets must use `sdk.client.fetch()`**: Never use raw `fetch()` with `credentials: "include"` in admin dashboard extensions. The admin uses JWT auth (not session cookies), so raw fetch gets 401. Import `sdk` from `../lib/client` and use `sdk.client.fetch()` which automatically adds the Bearer token.
- **medusa-config.ts Redis modules**: When `REDIS_URL` is set, register BOTH `Modules.CACHE` (cache-redis) AND `Modules.EVENT_BUS` (event-bus-redis). Without event-bus-redis, subscribers (like password-reset) silently fail because events don't reach them. The log will show "Local Event Bus installed" as a warning.
- **Modules.LOCKING has no Redis variant in Medusa v2.13**: Do NOT register `@medusajs/medusa/locking-redis` — it doesn't exist and crashes the server on startup with "No service found in module Locking". The in-memory locking provider is the only option.
- **Shipment crash with manage_inventory=false**: Medusa's `createOrderShipmentWorkflow` crashes with "Cannot read properties of undefined (reading 'required_quantity')" when fulfillment items have `inventory_item_id: null` (which happens when `manage_inventory=false`). Fixed via runtime patch `scripts/patch-shipment-workflow.mjs`.
- **STOREFRONT_URL env var**: Must be set on Railway backend (`https://store.supracynpharma.com`). Used by password-reset subscriber to build reset links. Without it, reset emails contain `http://localhost:5173` URLs. Code has a fallback for `NODE_ENV=production` but the env var is more reliable.
- **Runtime patches in Dockerfile.backend**: Two patches must run after `pnpm install`: (1) `patch-promotion-query.mjs` fixes MikroORM raw() quoting, (2) `patch-shipment-workflow.mjs` fixes null guard for manage_inventory=false. Both must be applied to BOTH `apps/backend/node_modules` (build stage) and `/app/pruned/node_modules` (production stage).
- **TanStack Router route tree**: Adding new route files (e.g., `$countryCode/$.tsx`) requires the route tree to regenerate. This happens automatically on `pnpm dev` or `pnpm build`, NOT via tsc. Use `@ts-expect-error` for new route path strings until the route tree regenerates.
- **Homepage resilience**: `useBulkPharma()` can fail (503) when the pharma API is down. The homepage must show products even when pharma metadata is unavailable. Check `isError` and fall back to showing all products instead of filtering to OTC-only.

## Design System
- Colors: `--suprameds-navy` (#1E2D5A), `--suprameds-green` (#27AE60), `--suprameds-amber` (#F39C12), `--suprameds-cream` (#FAFAF8), `--suprameds-charcoal` (#2C3E50)
- Fonts: Instrument Serif (headings) + DM Sans (body)
- Tailwind usage: `bg-[var(--suprameds-navy)]` pattern with CSS custom properties

## Product Naming Convention

All product titles MUST follow this standard format:

**Format:** `Brand Name Strength` in Title Case — NO dosage form in title

### Rules
1. **Title Case** for brand names: `ATORCYN` → `Atorcyn`, `ATOSKY GOLD` → `Atosky Gold`
2. **Space** between brand and strength (no hyphens before numbers): `ATORCYN-10` → `Atorcyn 10`
3. **Keep hyphens** that are part of brand identity (variant suffixes): `-S`, `-T`, `-P`, `-D`, `-H`, `-AM`, `-AT`, `-CD`, `-MV`, `-DSR`, `-LSR`, `-F`, `-DP`, `-VG`, `-VGM`, `-TG`
4. **NO dosage form in title** — stored in `drug_product.dosage_form`, displayed as separate tag/badge on frontend
5. **Keep** SR/MR/ER/CR/DR/OD designators as part of brand
6. **Keep** combo notation: `20/75`, `10/12.5`, `10/100/1000`
7. **Remove** redundant `TAB`, `Tab`, `SYP`, `Tablet`, `Capsule`, `Syrup` from titles
8. **FORTE** is a brand modifier in Title Case: `Glidax M 0.5 Forte`
9. **Handle** (URL slug) = lowercase hyphenated version of title

### Examples
```
ATORCYN-10          → Atorcyn 10
ATOSKY GOLD-10      → Atosky Gold 10
ACEPRA-S            → Acepra-S
ARICDOM-DSR         → Aricdom-DSR
MAXFORMIN SR-500    → Maxformin SR 500
DAXAGEST 200 SR     → Daxagest 200 SR
ACEWOK-P SYP        → Acewok-P
GLIDAX M 0.5 FORTE  → Glidax M 0.5 Forte
DAPADAX-M 10/1000   → Dapadax-M 10/1000
```

### Composition Format
Salt compositions use parenthetical strengths: `Atorvastatin (10mg) + Aspirin (75mg)`
- Source of truth: Supracyn Pharma Product Brochure 2025
- Generic name = salt names without strengths: `Atorvastatin + Aspirin`

### Manufacturers (our brands only)
- **Supracyn Pharma** (via Betamax Remedies): GLIMCYN, ATORCYN, ROZUCYN, SUPAN, SUPRATEL, PARACYN, METCYN, AMICYN, etc.
- **Daxia Healthcare**: DAXABAY, DAXAFLOW, DAXTOR, DAXIL, DAXYBILE, DAXYMER, DAPADAX, CILIDAX, SIGADAX, etc.
- **Do NOT add** Elder Pharmaceuticals or third-party products

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`

## CI/CD

- **Always run tests locally before pushing**: `cd apps/storefront && pnpm test` (Vitest, 92 tests) and `cd apps/backend && npx jest --testMatch="**/*.unit.spec.ts"` (Jest, 635 tests)
- **Always run lint before pushing**: `cd apps/storefront && npx eslint src/ --max-warnings 0`
- **Always type-check before pushing**: `cd apps/backend && npx tsc --noEmit` and `cd apps/storefront && npx tsc --noEmit`
- CI pipeline runs: TypeScript check, ESLint (zero warnings), Vitest/Jest, Storefront build, Backend build, Docker image build, E2E Playwright, Accessibility audit, Security audit
- **pnpm v10 split lockfiles**: Each workspace app (`apps/backend/`, `apps/storefront/`) has its own `pnpm-lock.yaml`. The root lockfile only covers root devDependencies. Docker COPY steps must include workspace lockfiles.
- **Backend Docker uses `--no-frozen-lockfile`**: `--frozen-lockfile` fails because the root lockfile has no workspace importers. Storefront Dockerfile also uses `--no-frozen-lockfile`.
- **After adding any dependency**: Run `pnpm install` in the workspace where you added it AND commit both the workspace lockfile and root lockfile. If deploy fails with "specifiers don't match", delete lockfiles, remove `node_modules`, and `pnpm install` from root.

### Pre-Push Checklist (run ALL before `git push`)
```bash
# 1. Type-check both apps
cd apps/backend && npx tsc --noEmit
cd apps/storefront && npx tsc --noEmit

# 2. Run tests
cd apps/storefront && pnpm test          # 92 Vitest tests
cd apps/backend && npx jest --testMatch="**/*.unit.spec.ts"  # 635 Jest tests

# 3. Lint storefront
cd apps/storefront && npx eslint src/ --max-warnings 0

# 4. If you added/changed dependencies: ensure lockfiles are committed
git diff --name-only | grep -E "package.json|pnpm-lock"
# If lockfile changed, commit it. If workspace lockfiles are missing, run:
# pnpm install   (from the workspace where dep was added)

# 5. If you added new route files: route tree will regenerate on build (OK to have @ts-expect-error)

# 6. Verify Dockerfile copies any new scripts
grep "COPY.*scripts" Dockerfile.backend   # must include all patch scripts
```

### Deployment (Railway)
- **Branch strategy**: Push to `development` for staging deploy, merge to `main` for production
- **Auto-deploy**: Railway watches both branches; each push triggers a build
- `SKIP_MIGRATIONS=true` is set on Railway backend — skips db:migrate on deploy (saves ~3 min). Unset when pushing schema changes.
- **Test Docker builds locally first**: `bash scripts/test-deploy.sh` (requires `.env.storefront` — copy from `.env.storefront.example`)
- **Build-time env vars**: Storefront `VITE_*` vars must be set as Railway service variables. Railway injects them as Docker build args automatically if matching `ARG` declarations exist in the Dockerfile.
- **Service config**: `dockerfilePath` and `healthcheckPath` are per-service in Railway dashboard (not in `railway.toml`) since they differ between backend and storefront

## Analytics & Tracking

- **GA4**: Measurement ID `G-RDYLD3PM8D`, loaded in `__root.tsx`, events in `lib/utils/analytics.ts`
- **GTM**: Container `GTM-5T86ZHZF`, env var `VITE_GTM_ID`
- **Meta Pixel**: Slot ready via `VITE_META_PIXEL_ID` env var (not yet active)
- **Google Search Console**: Via `VITE_GSC_VERIFICATION` env var
- All e-commerce events fire to GA4 + Meta Pixel + GTM dataLayer simultaneously
- AdScale plugs into GTM as a custom HTML tag (no code changes needed)

## Payment Flow

- **COD (pp_system_default)**: Default selection on payment step. No external API call needed.
- **Razorpay (pp_razorpay_razorpay)**: Creates Razorpay order via their API during session initiation. If Razorpay API fails (500), frontend auto-falls back to COD with toast notification.
- Payment sessions are created on the cart's `payment_collection`. Medusa replaces the session when switching providers.
- `getActivePaymentSession(cart, providerId?)` matches sessions by provider — not just first pending.

## Prescription Linking

- Customer attaches prescription during checkout via `POST /store/carts/:id/prescription` → sets `cart.metadata.prescription_id`
- `completeCartWorkflow.hooks.orderCreated` hook reads `cart_id` from hook data, resolves cart via `cartService.retrieveCart(cartId)`, reads `cart.metadata.prescription_id`, creates order↔prescription link
- Backup: `order-placed` subscriber also attempts linking with cart metadata fallback
- Link table: `order_order_pharmaprescription_prescription` (columns: `order_id`, `prescription_id`)

## Caching

### Backend (Redis via Medusa ICacheService)
- `@medusajs/cache-redis` registered in `medusa-config.ts`, conditional on `REDIS_URL`
- Resolve via `req.scope.resolve(Modules.CACHE)` in routes, jobs, subscribers
- API: `cacheService.get<T>(key)`, `cacheService.set(key, data, ttlSeconds)`, `cacheService.invalidate(pattern)`
- `invalidate()` supports glob patterns (`store:products:*`) via Redis SCAN internally

### Cached Routes & TTLs
| Route | Cache Key Pattern | TTL |
|-------|------------------|-----|
| `GET /store/products/pharma?handle=` | `store:products:pharma:{handle}` | 15 min |
| `GET /store/products/search` | `store:products:search:{sha256hash}` | 2 min |
| `GET /store/products/pharma/bulk` | `store:products:pharma:bulk:{sha256hash}` | 15 min |

### Cache Invalidation
- `subscribers/cache-invalidation.ts` listens to `product.updated`, `product.created`, `product.deleted`
- Invalidates `store:products:*`, `store:categories:*`, `store:regions:*` on any product event
- All cache operations wrapped in try/catch (non-fatal on Redis failure, falls back to DB)

### Frontend (React Query staleTime)
| Hook | staleTime | Rationale |
|------|-----------|-----------|
| `useCategories()` | 30 min | Categories change ~weekly |
| `useRegions()` / `useRegion()` | 30 min | Regions almost never change |
| `useProducts()` / `useRelatedProducts()` | 5 min | Already set, keep |
| `useLatestProducts()` | 5 min | Match other product hooks |
| `useCart()` | 30 sec | Mutations invalidate; 30s prevents mount-spam |
| `useCustomerOrders()` | 2 min | Reduces tab-switch refetches |
| `useOrder()` | 1 min | Single order tolerates brief staleness |
| `useCustomer()` | 15 min | Was Infinity; now refreshes after profile changes |
| `useSearch()` | 2 min | Already set, keep |

### Pharma Cache Constraints (non-negotiable)
- **MRP**: Product price cache MUST invalidate on `product.updated` (selling above MRP is illegal)
- **Prescription status**: Never cache. Cart validation for Rx products must check live approval status.
- **Schedule X/H/H1 drug list**: Cached 30 min via Schedule X middleware (in-memory, pre-existing)

## Deploy Configuration (configured by /setup-deploy)
- Platform: Railway
- Project: Suprameds_Medusa (production environment)
- Production URL: https://storefront-production-3f20.up.railway.app
- Backend URL: https://backend-production-9d3a.up.railway.app
- Custom domains: store.supracynpharma.com (storefront), api.supracynpharma.com (backend)
- Deploy workflow: Auto-deploy on push to main (Railway watches GitHub repo)
- Deploy status command: HTTP health check
- Merge method: squash
- Project type: web app (Medusa.js v2 backend + TanStack Start SSR storefront)

### Services
| Service | Port | Health Check | Dockerfile |
|---------|------|-------------|------------|
| Backend (Medusa) | 9000 | GET /health | Dockerfile.backend |
| Storefront (TanStack Start) | 3000 | GET / | Dockerfile.storefront |
| Redis | 6379 | — | redis:7-alpine |

### Required Railway Environment Variables
| Variable | Service | Value |
|----------|---------|-------|
| `PAYTM_MERCHANT_ID` | Backend | `TGyHMI87629179310548` |
| `PAYTM_MERCHANT_KEY` | Backend | (secret — set in Railway) |
| `PAYTM_WEBSITE_NAME` | Backend | `DEFAULT` |
| `PAYTM_CALLBACK_URL` | Backend | `https://backend-production-9d3a.up.railway.app/webhooks/paytm` |
| `VITE_PAYTM_MERCHANT_ID` | Storefront | `TGyHMI87629179310548` |

### Go-Live Checklist
- [ ] **Paytm callback URL**: When switching to custom domain (`api.suprameds.in`), update `PAYTM_CALLBACK_URL` on Railway backend to `https://api.suprameds.in/webhooks/paytm` — otherwise Paytm payment callbacks will fail
- [ ] **Paytm webhook in dashboard**: Log into Paytm Business dashboard → Settings → Webhook URL → set to the same callback URL above
- [ ] **DNS**: Verify `api.suprameds.in` CNAME points to Railway backend before changing callback URL
- [ ] **Test payment**: Place a test order with Paytm after any callback URL change to confirm end-to-end flow

### Custom deploy hooks
- Pre-merge: CI runs TypeScript check, ESLint, tests, and Docker build
- Deploy trigger: automatic on push to main (Railway auto-deploy)
- Deploy status: poll health endpoints after push
- Health check: curl -sf https://backend-production-9d3a.up.railway.app/health && curl -sf https://storefront-production-3f20.up.railway.app

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
