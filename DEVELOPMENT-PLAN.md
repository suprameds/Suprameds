# Suprameds — Development Plan

Updated: March 20, 2026

---

## 1. Current State

| Area | Status | Health |
|------|--------|--------|
| **Backend** | Medusa v2, Supabase PG, Docker Redis, pnpm monorepo | Deploying on Medusa Cloud |
| **Storefront** | TanStack Start (Vite + React) | Full checkout flow working |
| **Payments** | Razorpay + COD | Both working |
| **Prescriptions** | Upload, attach to cart, admin review | Base64 upload (needs S3) |
| **Search** | PostgreSQL FTS | Working with prefix matching |
| **Deployment** | Medusa Cloud | Backend builds passing |

**Completion vs master plan:** ~25–30%

---

## 2. Immediate Priorities (Cleanup Sprint)

Before building new features, address the tech debt from rapid prototyping.

### 2.1 Critical Fixes

| # | Task | Why | Effort |
|---|------|-----|--------|
| 1 | **Replace base64 Rx uploads with S3 presigned URLs** | DB bloat, timeout risk, 33% payload overhead | 1 day |
| 2 | **Remove fallback secrets** from `medusa-config.ts` | `"supersecret"` fallback = security risk in prod | 15 min |
| 3 | **Delete orphan workflow files** (`create-prescription.ts`, `review-prescription.ts`) | Dead code causing confusion | 15 min |
| 4 | **Add try/catch to prescription subscribers** | Unhandled errors can crash event processing | 30 min |
| 5 | **Fix silent error swallowing** in checkout address/delivery steps | Users get no feedback when something fails | 30 min |

### 2.2 Code Quality

| # | Task | Why | Effort |
|---|------|-----|--------|
| 1 | **Create typed module augmentation** (`src/types/module-types.d.ts`) | Eliminate 20+ `as any` casts on `container.resolve()` | 1 hour |
| 2 | **Add loading states** to checkout address and delivery steps | Poor UX without visual feedback | 30 min |
| 3 | **Centralize Schedule X check** into shared utility | Same logic in 3 files | 30 min |
| 4 | **Make pharmacist email configurable** via env var | Hardcoded `pharmacist@suprameds.in` | 15 min |
| 5 | **Add `.env.example`** validation on startup | Catch missing required env vars early | 30 min |

---

## 3. Next Phase: P1 — Production Hardening

### 3.1 CI/CD Pipeline (GitHub Actions)

```yaml
# Proposed: .github/workflows/ci.yml
# On PR: pnpm install → tsc --noEmit → pnpm build → (future: test)
```

| Step | Tool | Purpose |
|------|------|---------|
| Type check | `tsc --noEmit` | Catch TS errors before merge |
| Build | `pnpm build` | Verify Medusa Cloud build works |
| Lint | ESLint | Code quality gates |
| Test (future) | Jest/Vitest | Integration tests for critical paths |

### 3.2 S3 Prescription Upload

Replace the base64 data URL approach:

1. **Backend**: New route `POST /store/prescriptions/upload-url` → returns S3 presigned PUT URL
2. **Storefront**: Upload file directly to S3 from browser
3. **Backend**: Store only the S3 key in prescription record
4. **Admin**: Generate presigned GET URL for pharmacist to view

### 3.3 Testing Strategy

| Level | What to test | Tool |
|-------|-------------|------|
| Unit | Schedule X check, Rx compliance, price formatting | Vitest |
| Integration | Cart → checkout → order flow (OTC + Rx) | Medusa test utils |
| E2E | Full browser flow (browse → order → confirm) | Playwright |
| Compliance | Schedule X blocked, H/H1 requires Rx, no Rx promos | Custom test suite |

---

## 4. Phase Roadmap

### P1 — Production Hardening (Next)
- [ ] Cleanup sprint (Section 2 above)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] S3 presigned upload for prescriptions
- [ ] Remove TODO stubs or implement critical ones
- [ ] Rate limiting on public store routes
- [ ] Storefront error boundaries for all checkout steps

### P2 — Clinical Backbone
- [ ] Full prescription drug-line extraction workspace
- [ ] Dispense decisions per line item
- [ ] H1 register (transactional, Drugs and Cosmetics Act)
- [ ] Pre-dispatch pharmacist sign-off workflow
- [ ] Refund/cancellation flows for rejected prescriptions

### P3 — Orders + Inventory + COD
- [ ] Order state machine (placed → confirmed → packed → shipped → delivered)
- [ ] Guest checkout (no account required)
- [ ] COD confirmation workflow (IVR/SMS)
- [ ] COD customer scoring
- [ ] FEFO allocation on order completion
- [ ] Stock movement ledger

### P4 — Warehouse
- [ ] Warehouse zones/bins model
- [ ] GRN (Goods Received Note) workflow
- [ ] Pick/pack task assignment
- [ ] Pre-dispatch QC with pharmacist sign-off
- [ ] Returns inspection workflow

### P5 — Fulfillment
- [ ] Shipping provider integration (India Post / EZ Shipment)
- [ ] Pincode serviceability check
- [ ] Delivery estimate on PDP and cart
- [ ] OTP-based delivery for Rx orders
- [ ] NDR (Non-Delivery Report) handling

### P6 — Compliance
- [ ] LegitScript certification module
- [ ] Full DPDP consent management
- [ ] Override engine (emergency overrides with audit trail)
- [ ] Google Ads feed (OTC products only)

### P7 — Growth
- [ ] CRM: customer 360, lifecycle stages
- [ ] Abandoned cart recovery (OTC only)
- [ ] Chronic reorder reminders
- [ ] SMS DLT templates (MSG91)
- [ ] WhatsApp WABA integration

### P8 — Admin Extensions
- [ ] COD dashboard + reconciliation
- [ ] Warehouse task board
- [ ] Finance/GST export
- [ ] Compliance inspection panel

### P9 — Storefront Polish
- [ ] Drug information display on PDP
- [ ] Mobile-optimized pharmacist view
- [ ] Progressive enhancement (offline support)
- [ ] Performance optimization (code splitting, lazy loading)

### P10 — Infrastructure
- [ ] Production Docker setup (Nginx + PgBouncer)
- [ ] Monitoring (health checks, error tracking)
- [ ] Playwright E2E test suite
- [ ] Load testing for 10K orders/month target
- [ ] Security audit (OWASP ZAP)

---

## 5. Quick Reference

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start backend (9000) + storefront (5173) via Turbo |
| `pnpm build` | Build all packages |
| `pnpm build --filter=backend` | Build backend only (what Medusa Cloud runs) |
| `pnpm add <pkg> --filter=backend` | Add dependency to backend |
| `pnpm add <pkg> --filter=storefront` | Add dependency to storefront |
| `docker compose up -d` | Start Redis |

---

## 6. Known Technical Debt

| Item | Location | Priority |
|------|----------|----------|
| Base64 Rx uploads | `checkout-prescription-step.tsx`, `use-prescriptions.ts` | P1 — replace with S3 |
| 50+ TODO stubs | Jobs, subscribers, modules, admin routes | P1 — audit and remove/implement |
| `as any` type casts | 30+ files across backend and storefront | P1 — typed module augmentation |
| No automated tests | Entire codebase | P1 — start with critical paths |
| No CI/CD | GitHub repo | P1 — GitHub Actions |
| Orphan workflows | `create-prescription.ts`, `review-prescription.ts` | P1 — delete |
| Fallback secrets | `medusa-config.ts` | P1 — remove immediately |
| Hardcoded pharmacist email | `prescription-uploaded.ts` | P1 — env var |
| Silent checkout errors | Address + delivery steps | P1 — surface to user |
