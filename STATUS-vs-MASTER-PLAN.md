# Suprameds — Status vs Master Plan (V10)

This document maps what's **done** in the repo vs the **suprameds-master-prompt-V10-FINAL.md** plan and what's **left** to do.

---

## Tech stack vs plan

| Plan (doc) | Current repo |
|------------|--------------|
| Medusa Bloom (Next.js 14) | **TanStack Start** (Vite + React) — Bloom-derived, different stack |
| Medusa Cloud (PostgreSQL + Redis + S3) | **Supabase** (PostgreSQL) + **Docker Compose** (Redis) + **Medusa Cloud** (deployment) |
| AWS S3, Mumbai | S3/R2 config in medusa-config (optional) |
| pnpm monorepo | **pnpm@10.8.0** workspaces monorepo (reverted from npm) |

---

## DONE (implemented)

### Infrastructure & setup
- [x] Medusa v2 backend + monorepo (pnpm workspaces, turbo)
- [x] PostgreSQL via **Supabase** (connection pooler, no SSL timeout)
- [x] Redis via **Docker Compose** (`docker-compose.yml`)
- [x] Backend env: CORS (storefront 5173/5176), AUTH_CORS, REDIS_URL, DATABASE_URL
- [x] Storefront env: VITE_MEDUSA_BACKEND_URL, VITE_MEDUSA_PUBLISHABLE_KEY, VITE_PORT=5173
- [x] Database migrations run (Medusa + custom modules)
- [x] First admin user creatable via `npx medusa user -e ... -p ...`
- [x] **Medusa Cloud deployment pipeline** — builds passing (pnpm + turbo prune)
- [x] **Migration scripts**: India shipping options, Razorpay region providers, INR store currency, FTS search vector, pharmacy taxonomy catalog, COD region provider

### Backend — custom modules (Phase 3 style)
- [x] **pharma** — drug metadata (schedule H/H1/X/OTC), GST, form, strength, composition; Schedule X block in workflow + middleware
- [x] **prescription** — models, service, migrations; prescription uploads (base64 → stored as data URL); status flow (pending_review → approved/rejected/expired)
- [x] **inventoryBatch** — lot/expiry, FEFO, batch deductions
- [x] Links: product–drug, order–prescription, customer–prescription
- [x] Workflows: upload-rx, review-rx; cart validate hooks (Rx compliance + Schedule X block)
- [x] API: store prescriptions (CRUD), admin prescriptions (list + detail + approve/reject), cart prescription attach/detach, pharma batch lookup, product search (FTS)
- [x] Email template: order-confirmation
- [x] Subscribers: order-placed, order-payment-captured, order-delivered, prescription-uploaded, prescription-fully-approved, prescription-rejected

### Storefront — compliance & layout
- [x] Design system: theme.css (Clinical-Clean Precision), navbar, footer
- [x] India region + country-prefixed routes (e.g. `/in/...`)
- [x] Compliance pages (no country prefix): `/pharmacy/licenses`, `/prescription-policy`, `/grievance`, `/privacy`, `/terms`, `/returns`
- [x] Homepage: hero, categories, features, trust signals
- [x] DPDP consent banner (basic)

### Storefront — catalog & account
- [x] Product listing: `/$countryCode/store`, categories `/$countryCode/categories/$handle`
- [x] PDP: `/$countryCode/products/$handle` with Rx gate (Schedule X blocked, H/H1 shows prescription notice)
- [x] Cart: `/$countryCode/cart`
- [x] Checkout: `/$countryCode/checkout` — address → delivery → prescription (conditional) → payment → review
- [x] Order confirmation: `/$countryCode/order/$orderId/confirmed`
- [x] **Auth**: login, register; Bearer token fix; redirect after login (`?redirectTo=`)
- [x] **Account**: profile, orders, addresses, logout
- [x] **Search**: PostgreSQL FTS with debounced as-you-type, prefix matching, ranked results
- [x] **Prescription upload page**: standalone `/in/upload-rx` route

### Payment
- [x] **Razorpay**: integration via `medusa-plugin-razorpay-v2`, webhook handler with HMAC verification
- [x] **Cash on Delivery (COD)**: `pp_system_default` added to all regions, no restrictions, COD-specific UX in checkout
- [x] Payment session creation with duplicate detection

### Prescription flow
- [x] Single prescription covers entire cart (not per-item)
- [x] Upload new or select from previously stored prescriptions during checkout
- [x] "Order first, verify later" — customers can place orders with `pending_review` prescriptions
- [x] Admin pharmacist queue: list + detail + approve/reject with form fields
- [x] Cart metadata (`prescription_id`) links prescription to cart

### Compliance rules (from plan, partially enforced)
- [x] Schedule X: no online sale (workflow/cart validation + middleware)
- [x] Schedule H/H1: prescription required (checkout hook — allows pending_review)
- [x] No Rx promotions (completeCart validate hook)
- [x] No lifestyle images on products (AGENTS.md rule)
- [x] Pharmacist sign-off / prescription approval flow (workflows + admin)

---

## CRITIQUE — What Needs Improvement

### Critical Issues

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 1 | **Base64 prescription uploads** — files converted to data URLs and stored in DB | HIGH | 10MB image → 13MB payload; DB bloat; timeouts; memory pressure. Must move to S3 presigned upload. |
| 2 | **Orphan workflow files** — `create-prescription.ts` and `review-prescription.ts` are unused duplicates of `prescription/upload-rx.ts` and `prescription/review-rx.ts` | MEDIUM | Confusion; maintenance burden; dead code deployed to production |
| 3 | **50+ TODO stubs** — jobs, subscribers, modules, admin routes with `// TODO: Implement` | LOW | Expected for phased development, but clutters the codebase and will fail silently if events fire |
| 4 | **Fallback secrets in medusa-config.ts** — `JWT_SECRET || "supersecret"` | HIGH | If env vars are missing in production, app runs with insecure defaults |
| 5 | **Hardcoded pharmacist email** — `pharmacist@suprameds.in` in subscriber | MEDIUM | Should be configurable via env var |

### Code Quality Issues

| # | Issue | Files affected |
|---|-------|----------------|
| 1 | **Pervasive `as any` type casts** (~20+ backend files, 12+ storefront files) | Workflows, API routes, subscribers, migration scripts, components |
| 2 | **Silent error swallowing** in checkout address/delivery steps | `checkout-address-step.tsx`, `checkout-delivery-step.tsx` |
| 3 | **Missing try/catch** in prescription subscribers | `prescription-uploaded.ts`, `prescription-fully-approved.ts`, `prescription-rejected.ts` |
| 4 | **Schedule X logic duplicated in 3 places** | `middlewares.ts`, `schedule-x-block-add-to-cart.ts`, `validate-cart-rx-compliance.ts` |
| 5 | **Missing loading states** for checkout address and delivery steps | No spinner/skeleton while data loads |

### Architecture Concerns

| # | Concern | Recommendation |
|---|---------|----------------|
| 1 | Prescription images stored as base64 data URLs in DB | Implement S3 presigned upload flow; store only the S3 key |
| 2 | No proper TypeScript module augmentation for custom modules | Create `@types/medusa-modules.d.ts` so `container.resolve()` returns typed services |
| 3 | No automated tests | Add at least integration tests for critical paths (Schedule X block, Rx compliance, payment) |
| 4 | No CI/CD pipeline | GitHub Actions for lint, type-check, build on every PR |
| 5 | No rate limiting on public API routes | Store routes are unprotected against abuse |

---

## NOT DONE / LEFT TO DO (from master plan)

### Phase 1 — Foundation (plan items 1–5)
- [ ] **RBAC**: 25 roles, permissions, SSD constraints (plan Part 14, 24)
- [ ] **Middleware stack**: mfa-verified, authorize, ssd-check, phi-access, session-expiry, rate-limit
- [ ] **Audit**: phi_audit_log, audit_logs, order_state_history
- [ ] **Catalog**: molecule, substitution_mappings, stock_alert tables
- [ ] **PgBouncer** in Docker (plan Part 23)

### Phase 2 — Clinical backbone (plan items 6–8)
- [ ] **Prescription**: full drug-line extraction workspace, dispense_decisions, H1 register (transactional)
- [ ] **S3 presigned upload** for prescriptions (replace base64)
- [ ] Pre-dispatch pharmacist sign-off (plan Part 16)

### Phase 3 — Orders + inventory (plan items 9–13)
- [ ] **Orders**: full state machine, guest order, CS-placed order
- [ ] **Inventory**: batch ledger, stock_movements, order_item_batch_allocations
- [ ] **COD module**: confirmation workflow, scoring, remittance reconciliation (plan Part 6)

### Phase 4 — Warehouse (plan items 14–18)
- [ ] Warehouse zones/bins, GRN, pick/pack, pre-dispatch sign-off, returns inspection

### Phase 5 — Fulfillment (plan items 19–24)
- [ ] Shipment: India Post Speed Post / EZ Shipment + AfterShip
- [ ] Pincode serviceability + delivery estimate
- [ ] OTP delivery for Rx, NDR, supply memo, batch recall

### Phase 6 — Compliance + overrides (plan items 25–28)
- [ ] LegitScript compliance module + 20-item checklist
- [ ] Override engine (14 types + emergency)
- [ ] Full DPDP consent management + cookie management
- [ ] Google Ads feed (OTC only)

### Phase 7 — Growth + operations (plan items 29–37)
- [ ] CRM: customer 360, lifecycle, abandoned cart (OTC), chronic reorder
- [ ] Analytics, loyalty/referral (OTC), reviews, grievance ticketing
- [ ] SMS DLT (MSG91), WhatsApp WABA templates
- [ ] In-app notifications (Redis pub/sub)

### Phase 8 — Admin extensions (plan items 38–46)
- [ ] Dispense decision ledger, warehouse task board, COD dashboard
- [ ] Finance/reconciliation, compliance inspection, override panel

### Phase 9 — Storefront (remaining)
- [ ] Session 3 (full): Drug info on PDP, Rx gate improvements
- [ ] Session 4: Guest checkout, pincode check, delivery estimate
- [ ] Session 5: Pharmacist portal, warehouse portal, mobile pharmacist view

### Phase 10 — Infrastructure + validation
- [ ] Docker + Nginx + PgBouncer (prod)
- [ ] GitHub Actions: ci.yml, deploy.yml, compliance-cron.yml
- [ ] Playwright E2E tests, Lighthouse, OWASP ZAP
- [ ] DLT + WABA templates registered; LegitScript application

---

## Summary

| Category | Done | Left |
|----------|------|------|
| **Infra & deployment** | Medusa Cloud deploying, Supabase + Redis, pnpm monorepo | PgBouncer, CI/CD, monitoring |
| **Backend modules** | pharma, prescription, inventoryBatch + links/workflows/APIs | RBAC, full dispense/H1, S3 upload, warehouse, fulfillment |
| **Storefront** | Full checkout flow, Rx/COD, search, account/auth | Guest checkout, delivery estimate, pharmacist/warehouse portals |
| **Payments** | Razorpay + COD working | Payment links, refund flows |
| **Compliance** | Schedule X/H/H1 rules, Rx flow, consent banner | DPDP full, LegitScript, audit/override/SSD |
| **Plan phases** | P0 complete, slivers of P1–P3 | Most of P1–P8, rest of P9, all of P10 |

**Rough completion vs full plan:** ~25–30% (working storefront prototype with payments, prescriptions, COD, search, and cloud deployment). The master plan is a full production/compliance build; the repo has a solid functional base ready for hardening and the next phases.

---

## Recent Work (March 20, 2026)

### Prescription Flow
- Single prescription per cart, upload or select from stored
- "Order first, verify later" — pending_review prescriptions allowed at checkout
- Admin pharmacist queue with approve/reject

### Payments
- Razorpay integration with webhook handler
- Cash on Delivery (COD) with no restrictions
- Payment session duplicate detection fix

### Deployment
- Migrated back from npm to pnpm (Medusa Cloud compatibility)
- Fixed all TypeScript build errors (TS18046, TS2345, TS2554, TS2353)
- Added react-router-dom for admin page resolution
- Backend + frontend compiling and deploying on Medusa Cloud

### Search
- PostgreSQL Full-Text Search with tsvector + GIN index
- Searches across product fields + drug_product metadata
- Debounced as-you-type storefront search
