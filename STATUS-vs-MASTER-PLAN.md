# Suprameds — Status vs Master Plan (V10)

This document maps what’s **done** in the repo vs the **suprameds-master-prompt-V10-FINAL.md** plan and what’s **left** to do.

---

## Tech stack vs plan

| Plan (doc) | Current repo |
|------------|--------------|
| Medusa Bloom (Next.js 14) | **TanStack Start** (Vite + React) — Bloom-derived, different stack |
| Medusa Cloud (PostgreSQL + Redis + S3) | **Supabase** (PostgreSQL) + **Docker Compose** (Redis) |
| AWS S3, Mumbai | S3/R2 config in medusa-config (optional) |

---

## DONE (implemented)

### Infrastructure & setup
- [x] Medusa v2 backend + monorepo (npm workspaces, turbo)
- [x] PostgreSQL via **Supabase** (connection pooler, no SSL timeout)
- [x] Redis via **Docker Compose** (`docker-compose.yml`)
- [x] Backend env: CORS (storefront 5173/5176), AUTH_CORS, REDIS_URL, DATABASE_URL
- [x] Storefront env: VITE_MEDUSA_BACKEND_URL, VITE_MEDUSA_PUBLISHABLE_KEY, VITE_PORT=5173
- [x] Database migrations run (Medusa + custom modules)
- [x] First admin user creatable via `npx medusa user -e ... -p ...`

### Backend — custom modules (Phase 3 style)
- [x] **pharma** — drug metadata (schedule H/H1/X/OTC), GST, form, strength, composition; Schedule X block in workflow
- [x] **prescription** — models, service, migrations; prescription uploads (S3 presigned); status flow
- [x] **inventoryBatch** — lot/expiry, FEFO, batch deductions
- [x] Links: product–drug, order–prescription, customer–prescription
- [x] Workflows: create-prescription, review-prescription; cart validate hook (Rx compliance)
- [x] API: store prescriptions, admin prescriptions (list + by id)
- [x] Email template: order-confirmation

### Storefront — compliance & layout (Plan Part 27 / Phase 9 Session 1)
- [x] Design system: theme.css (Clinical-Clean Precision), navbar, footer
- [x] India region + country-prefixed routes (e.g. `/in/...`)
- [x] Compliance pages (no country prefix): `/pharmacy/licenses`, `/prescription-policy`, `/grievance`, `/privacy`, `/terms`, `/returns`
- [x] Homepage: hero, categories, features, trust signals

### Storefront — catalog & account (Phase 9 Sessions 2–3, 5)
- [x] Product listing: `/$countryCode/store`, categories `/$countryCode/categories/$handle`
- [x] PDP: `/$countryCode/products/$handle`
- [x] Cart: `/$countryCode/cart`
- [x] Checkout: `/$countryCode/checkout`
- [x] Order confirmation: `/$countryCode/order/$orderId/confirmed`
- [x] **Auth**: login, register, forgot-password, reset-password; Bearer token fix for register (no more 401)
- [x] **Account**: profile, orders, addresses, logout; “Sign in” label in navbar; redirect after login (`?redirectTo=`)
- [x] 3 seed products with pharma metadata (from initial-seed migration)

### Compliance rules (from plan, partially enforced)
- [x] Schedule X: no online sale (workflow/cart validation)
- [x] Schedule H/H1: prescription required (checkout hook)
- [x] No Rx promotions (completeCart validate hook)
- [x] No lifestyle images on products (AGENTS.md rule)
- [x] Pharmacist sign-off / prescription approval flow (workflows + modules)

---

## NOT DONE / LEFT TO DO (from master plan)

### Phase 1 — Foundation (plan items 1–5)
- [ ] **RBAC**: 25 roles, permissions, SSD constraints (plan Part 14, 24)
- [ ] **Middleware stack**: authenticate, mfa-verified, authorize, ssd-check, phi-access, session-expiry, rx-gate, **schedule-x-block** (dedicated middleware)
- [ ] **Audit**: phi_audit_log, audit_logs, order_state_history
- [ ] **Catalog**: molecule, substitution_mappings, stock_alert tables (beyond current pharma/drug-product)
- [ ] **PgBouncer** in Docker (plan Part 23); currently direct DB connection

### Phase 2 — Clinical backbone (plan items 6–8)
- [ ] **Prescription**: full drug-line extraction workspace, dispense_decisions, H1 register (transactional)
- [ ] **Payment**: Razorpay auth/capture/release, COD payment type, payment links
- [ ] Pre-dispatch pharmacist sign-off (plan Part 16)

### Phase 3 — Orders + inventory (plan items 9–13)
- [ ] **Orders**: full state machine, COD flow, guest order, CS-placed order
- [ ] **Inventory**: batch ledger, stock_movements, order_item_batch_allocations, prescription_line_consumptions
- [ ] **COD module**: confirmation, scoring, remittance reconciliation (plan Part 6)

### Phase 4 — Warehouse (plan items 14–18)
- [ ] Warehouse zones/bins, GRN, pick/pack, pre-dispatch sign-off, returns inspection

### Phase 5 — Fulfillment (plan items 19–24)
- [ ] Shipment: India Post Speed Post / EZ Shipment + AfterShip (plan: Shiprocket/Delhivery adapters)
- [ ] Pincode serviceability + delivery estimate
- [ ] OTP delivery for Rx, NDR, supply memo, batch recall

### Phase 6 — Compliance + overrides (plan items 25–28)
- [ ] LegitScript compliance module + 20-item checklist
- [ ] Override engine (14 types + emergency)
- [ ] DPDP consent banner + cookie management (plan Part 18)
- [ ] Google Ads feed (OTC only)

### Phase 7 — Growth + operations (plan items 29–37)
- [ ] CRM: customer 360, lifecycle, abandoned cart (OTC), chronic reorder
- [ ] Analytics, loyalty/referral (OTC), reviews, grievance ticketing
- [ ] SMS DLT (MSG91), WhatsApp WABA templates
- [ ] In-app notifications (Redis pub/sub)
- [ ] Drug information import (CDSCO/OpenFDA)
- [ ] Grievance **ticketing** (backend + SLA); currently static `/grievance` page

### Phase 8 — Admin extensions (plan items 38–46)
- [ ] Prescription review workspace (`/admin/prescriptions/:id`)
- [ ] Dispense decision ledger, warehouse task board, COD dashboard
- [ ] Finance/reconciliation, compliance inspection, override panel
- [ ] Internal notification center

### Phase 9 — Storefront (plan Sessions 1–5, partial)
- [x] Session 1: Compliance layout + mandatory pages — **done**
- [x] Session 2–3 (partial): Catalog, PDP, basic OOS handling — **done**
- [ ] Session 3 (full): Drug info on PDP, Rx gate on PDP
- [ ] Session 4 (full): Guest checkout, COD, pincode check, delivery estimate
- [x] Session 5 (partial): Account, profile, addresses, orders — **done**
- [ ] Session 5 (full): Pharmacist portal, warehouse portal, mobile pharmacist view

### Phase 10 — Infrastructure + validation (plan items 47–60)
- [ ] Docker + Nginx + PgBouncer (prod)
- [ ] GitHub Actions: ci.yml, deploy.yml, compliance-cron.yml
- [ ] AWS Mumbai: ECS, RDS, ElastiCache, S3, CloudFront
- [ ] Compliance checklist (20 items), SSD tests, Rx gate tests
- [ ] COD + guest checkout E2E, Playwright, Lighthouse, OWASP ZAP
- [ ] DLT + WABA templates registered; LegitScript application

### Other plan parts not started
- [ ] **Part 4**: Full DB schema (many tables only in doc: molecules, substitution_mappings, dispense_decisions, h1_register_entries, etc.)
- [ ] **Part 9**: Full notification template library (SMS/WhatsApp/Email)
- [ ] **Part 10**: OOS product page, back-order flow
- [ ] **Part 14**: Chronic reorder flow
- [ ] **Part 17**: Accounting / GST export (Vyappar)
- [ ] **Part 35–38**: Full event subscribers, webhooks, workflows, scheduled jobs
- [ ] **Part 39**: Full API route registry (many admin and store routes)

---

## Summary

| Category | Done | Left |
|----------|------|------|
| **Infra & setup** | Backend + storefront running, Supabase + Redis, migrations, admin user | PgBouncer, prod Docker/Nginx, AWS, CI/CD |
| **Backend modules** | pharma, prescription, inventoryBatch + links/workflows/APIs | RBAC, full prescription/dispense/H1, payments, COD, warehouse, fulfillment |
| **Storefront** | Compliance pages, homepage, catalog, cart, checkout, account/auth | Rx gate on PDP, guest/COD/delivery estimate, pharmacist/warehouse portals |
| **Compliance** | Schedule X/H/H1 rules, no Rx promos, prescription flow | DPDP banner, LegitScript checklist, full audit/override/SSD |
| **Plan phases** | Slivers of Phase 1, 3, 9 | Most of Phase 1–8, rest of 9, all of 10 |

**Rough completion vs full plan:** ~15–20% (foundation + one slice of storefront and backend). The master plan is a full production/compliance build; the repo is a working Bloom-style base with India/compliance wiring and custom pharma/prescription/inventory modules, ready for the next phases above.

---

## Recent Fixes (March 2025 — pnpm → npm migration)

The project migrated from **pnpm** to **npm workspaces**. This introduced several regressions that have been resolved:

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| **SSR crash**: "Objects are not valid as a React child" | Dual React instances — backend had `react@18.3.1`, storefront had `react@19.1.1` (pnpm overrides were lost) | Added `overrides` in root `package.json` to force `react@19.1.1` across all workspaces; updated backend devDeps to React 19 |
| **Backend admin**: `react-router-dom` import error | `apps/backend/src/admin/routes/prescriptions/[id]/page.tsx` imported from `react-router-dom` (frontend lib) | Replaced with Medusa Admin SDK's `defineRouteConfig` |
| **CSS warning**: `@import must precede all other statements` | Google Fonts `@import` inside `theme.css` placed after Tailwind CSS rules after bundling | Moved font loading to `<link>` tags in `__root.tsx` `<head>` for correct ordering and better performance |
| **Backend admin**: `date-fns` resolution errors | `date-fns@3.6.0` has missing `.mjs` barrel files (`index.mjs`, `locale.mjs`) — known upstream packaging bug | Non-blocking for store API/storefront; admin dashboard dep-pre-bundle warnings only |
| **Redis**: `ioredis` connection errors | Redis not running locally (Docker Compose not started) | Non-blocking — Medusa falls back to in-memory event bus; start Redis via `docker compose up -d` when needed |

### Current working state
- **Backend** (port 9000): Store API responding 200 ✅, Admin UI at `/app` (date-fns warnings but functional)
- **Storefront** (port 5173): Full SSR rendering ✅, 49KB HTML payload with SEO meta tags
- **Package manager**: npm workspaces with React 19.1.1 unified across all packages
- **Design system**: Clinical-Clean Precision aesthetic with DM Sans + Fraunces fonts

## Recent P1 Implementation (March 20, 2026)

### Completed in this session

| Feature | Files | Description |
|---------|-------|-------------|
| **Razorpay payment working** | `storefront/.env` | Fixed `VITE_RAZORPAY_KEY_ID` env var naming for Vite exposure |
| **Order details live updates** | `pages/order-confirmation.tsx`, `routes/.../confirmed.tsx`, `hooks/use-orders.ts`, `components/order.tsx` | Order page uses `useOrder` hook with `staleTime: 0` + fulfillment status badges + tracking numbers |
| **Razorpay webhook handler** | `api/webhooks/razorpay/route.ts`, `api/middlewares.ts` | Full webhook with signature verification, forwards to Medusa payment module; raw body preserved for HMAC |
| **Order placed subscriber** | `subscribers/order-placed.ts` | Retrieves full order, sends email notification, creates OrderExtension + state history, internal pharmacy notification |
| **Payment captured subscriber** | `subscribers/order-payment-captured.ts` | Updates OrderExtension status, records state history, triggers FEFO allocation, sends payment confirmation |
| **PostgreSQL Full-Text Search** | `migration-scripts/20032026-fts-search-vector.ts`, `api/store/products/search/route.ts` | tsvector + GIN index on products; searches product fields + drug_product (generic_name, composition, strength); prefix matching; ranked results |
| **FTS storefront search** | `hooks/use-search.ts`, `pages/search.tsx`, `utils/query-keys.ts` | Debounced as-you-type search, FTS API integration, load more pagination |
| **COD label fix** | `lib/constants/payment-methods.tsx`, `components/payment-container.tsx` | `pp_system_default` now labeled "Cash on Delivery" with descriptions for all payment methods |
| **Rx gate on PDP** | `components/product-actions.tsx` | Schedule X products: blocked with NDPS Act message. Schedule H/H1: prescription required notice + Upload Rx button + secondary "Add to cart (Rx verification at checkout)" |
