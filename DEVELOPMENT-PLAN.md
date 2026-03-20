# Suprameds — Development Plan: Working Storefront Prototype

This plan is derived from **suprameds-master-prompt-V10-FINAL.md** and **STATUS-vs-MASTER-PLAN.md**. Goal: **get a working storefront prototype** where browse → cart → checkout → account flows work correctly, then systematically fulfill the remaining phases.

---

## 1. What We Have (Current State)

| Area | Status | Notes |
|------|--------|--------|
| **Backend** | Medusa v2, Supabase PG, Docker Redis, migrations, admin user | pharma, prescription, inventoryBatch modules; Schedule X block; Rx checkout hook |
| **Storefront** | TanStack Start (Vite + React) | Routes: `/in/store`, cart, checkout, PDP, categories, account (login/register/profile/orders/addresses), order confirmation; compliance pages |
| **Design** | Clinical-Clean Precision | theme.css, navbar, footer, country-prefixed routes |
| **Compliance** | Partial | Schedule X/H/H1 enforced; no Rx promos; prescription flow; static grievance/privacy/terms |

**Rough completion vs full master plan:** ~15–20%. Repo is a working Bloom-style base ready for the next phases.

---

## 2. Prototype Goal: “Storefront Works Correctly”

**Definition of done for the prototype:**

1. **Backend + storefront run** from repo root with clear env and one-command dev.
2. **Browse:** Home → Store → Categories → Product detail (with pharma metadata when available).
3. **Cart:** Add to cart (OTC); Schedule X blocked; cart drawer and `/in/cart` show correct items and totals.
4. **Checkout:** Address → Shipping → Payment → Complete; order confirmation page and email (if configured).
5. **Account:** Login, register, profile, orders list, addresses; redirect-after-login works.
6. **Compliance:** Mandatory pages (licenses, prescription-policy, grievance, privacy, terms, returns) load and render.
7. **No critical runtime errors** on happy path (console/network clean for core flows).

Everything beyond this (guest checkout, COD, pincode/delivery estimate, Rx gate on PDP, pharmacist/warehouse portals, full RBAC, etc.) is **Phase 2+** of this plan.

---

## 3. Phase Overview (Storefront-First, Then Backend Phases)

| Phase | Focus | Outcome |
|-------|--------|---------|
| **P0 — Prototype hardening** | Fix gaps so storefront works E2E | Run dev, browse, cart, checkout, account, compliance pages all work |
| **P1 — Foundation** | RBAC, middleware, audit, FTS, BullMQ | Backend ready for stricter compliance and scale |
| **P2 — Clinical + payment** | Prescription workspace, dispense, Razorpay/COD, webhooks | Rx and payments production-ready |
| **P3 — Orders + inventory** | State machine, guest/CS orders, COD module, FEFO ledger | Full order and stock traceability |
| **P4–P10** | Warehouse, fulfillment, compliance, growth, admin, infra | Per master plan Parts 45–47 |

This document details **P0** and gives a concise checklist for P1–P3 so you can “start developing and fulfilling the phases” with a working prototype first.

---

## 4. P0 — Prototype Hardening (Storefront Works Correctly)

### 4.1 Environment and Run

- [ ] **Backend:** `DATABASE_URL`, `POSTGRES_URL` (Supabase), `REDIS_URL` (e.g. `redis://localhost:6379`). Run migrations: `cd apps/backend && npx medusa db:migrate`. Create admin + **Publishable API Key** in Admin (Settings → Publishable API Keys).
- [ ] **Storefront:** Copy `apps/storefront/.env.example` to `apps/storefront/.env`. Set:
  - `VITE_MEDUSA_BACKEND_URL` (e.g. `http://localhost:9000`)
  - `VITE_MEDUSA_PUBLISHABLE_KEY` = key from Admin.
- [ ] **Run:** From root: `npm run dev` (runs backend + storefront via Turbo). Backend: 9000; Storefront: 5173 or 5176 (if `VITE_PORT` set in `.env`).

**Subagent use:** Use **shell** or **generalPurpose** to run `npm run dev`, then verify backend and storefront URLs respond.

### 4.2 Storefront Gaps to Verify/Fix

| # | Task | How |
|---|------|-----|
| 1 | **Default country when none stored** | Ensure root `/` and `/store`, `/cart`, `/checkout` redirect to `/in/...` when no stored country (e.g. `in`). |
| 2 | **Promotions API** | Storefront uses `POST/DELETE /store/carts/:id/promotions`. Confirm Medusa v2 exposes this or add a thin custom route. |
| 3 | **Pharma PDP** | PDP calls `GET /store/products/pharma?handle=...` with `x-publishable-api-key`. Ensure backend is up and key is valid; handle 404/empty gracefully. |
| 4 | **Supabase** | Optional. If any component uses Supabase without checking `VITE_SUPABASE_URL`, guard or stub so missing env doesn’t break. |
| 5 | **Address component** | Confirm `@/components/address` (or path used in order/account) exists; fix imports if not. |
| 6 | **Cart/checkout data layer** | Ensure `lib/data` for addresses, shipping, payment, complete use correct Medusa store APIs and error handling so checkout completes without silent failures. |

**Subagent use:** Use **explore** to “Find all usages of getStoredCountryCode and default country redirect logic in storefront” and “Find Address component and all imports of address in storefront”. Use **generalPurpose** to implement default country and fix any missing component.

### 4.3 Backend Gaps for Prototype

| # | Task | How |
|---|------|-----|
| 1 | **CORS** | Ensure `STORE_CORS` / `AUTH_CORS` include storefront origin (e.g. `http://localhost:5173`, `http://localhost:5176`). |
| 2 | **Store cart/checkout** | No custom route needed for basic cart/complete; ensure Medusa core store routes are mounted and respond. |
| 3 | **Schedule X block** | Already in place (middleware + workflow); verify add-to-cart of a Schedule X product returns clear error on storefront. |

### 4.4 Known Issue (Fix in P0)

- **SSR render error:** On first load, storefront may throw: `Objects are not valid as a React child (found: object with keys {$$typeof, type, key, props, _owner, _store})`. This usually means a React element is passed where a primitive/array is expected (e.g. in root layout or a route that renders `children` incorrectly). Locate the component that receives `children` and ensure it renders `{children}` (or the correct slot), not a raw component reference.

### 4.5 Quick Verification Checklist (P0 Done)

- [ ] From repo root: `npm run dev` (PowerShell: use `;` not `&&`). Backend: 9000, Storefront: 5173 (or `VITE_PORT` from `.env`).
- [ ] `npm run dev` starts backend and storefront without errors (after fixing SSR child error if present).
- [ ] Open storefront → Home, then Store; see product list.
- [ ] Open a product → PDP loads; pharma block shows if backend returns it.
- [ ] Add OTC product to cart → cart updates; open cart drawer and `/in/cart`.
- [ ] Add Schedule X product (if you have one) → blocked with clear message.
- [ ] Checkout: fill address, choose shipping, pay (test mode) → order confirmation page.
- [ ] Login / Register → redirect works; Profile and Orders load.
- [ ] Compliance: `/pharmacy/licenses`, `/prescription-policy`, `/grievance`, `/privacy`, `/terms`, `/returns` load.

---

## 5. P1 — Foundation (After Prototype)

From master plan Part 45, Phase 1:

- RBAC: 25 roles, permissions, SSD constraints, seeds.
- Middleware: authenticate, mfa-verified, authorize, ssd-check, phi-access, session-expiry, rx-gate, **schedule-x-block**, rate-limit, webhook-signature.
- Core audit: phi_audit_log, audit_logs, order_state_history, webhook_logs, product_edit_log, price_history.
- Core entities: molecules, substitution_mappings, stock_alerts, recently_viewed, family_profiles.
- PostgreSQL FTS: search_vector + GIN index + trigger on products.
- BullMQ: queue definitions + workers (e.g. `src/lib/queue.ts`).

**Subagent use:** **explore** for “Where are RBAC and middleware defined in backend”; **generalPurpose** for implementing one middleware or one audit table at a time.

---

## 6. P2 — Clinical + Payment Backbone

- Prescription: drug-line extraction workspace, full flow to dispense.
- Dispense: per-line decisions, H1 register (transactional), pre-dispatch sign-off.
- Payment: Razorpay (auth/capture/release, payment links, COD) + Stripe; webhooks (razorpay, stripe).

**Subagent use:** **explore** for “prescription and dispense workflows and APIs”; **generalPurpose** for “Razorpay auth and capture in complete cart workflow”.

---

## 7. P3 — Orders + Inventory + COD

- Orders: state machine, guest orders, CS-placed orders, duplicate-order-check workflow.
- COD: cod_orders, confirmation workflow, customer scoring.
- Inventory: FEFO allocation, stock_movements, back-order; order_item_batch_allocations, prescription_line_consumptions.

**Subagent use:** **explore** for “order state machine and COD confirmation”; **generalPurpose** for “FEFO allocation on order completion”.

---

## 8. Skills and Subagents to Use

- **Vercel React best practices (skill):** When changing storefront components or data fetching (e.g. cart, checkout, PDP), use for async/parallel fetching, bundle size, and client/server data patterns. See `vercel-react-best-practices` skill.
- **Explore subagent:** “List storefront routes and backend store API routes”; “Find default country and redirect logic”; “Find Address component and checkout data layer”.
- **GeneralPurpose subagent:** “Implement default country redirect to /in when no stored country”; “Add a store API route for cart promotions if missing”; “Fix Address import in order/account”.
- **Shell subagent:** “Run npm run dev and curl backend health”; “Run migrations and create publishable key steps”.

---

## 9. Run the Prototype (Quick Reference)

- **From repo root:** `npm run dev` (runs both backend and storefront via Turbo).
- **Backend:** http://localhost:9000 (API + Admin at `/app`).
- **Storefront:** http://localhost:5173 (or port in `apps/storefront/.env` as `VITE_PORT`).
- **Env:** Backend needs `DATABASE_URL`, `POSTGRES_URL`, `REDIS_URL`. Storefront needs `VITE_MEDUSA_BACKEND_URL`, `VITE_MEDUSA_PUBLISHABLE_KEY` (from Admin → Settings → Publishable API Keys). Copy `apps/storefront/.env.example` to `apps/storefront/.env`.

## 10. Suggested Next Steps (Immediate)

1. **Run and verify:** From repo root run `npm run dev`; open storefront and backend; confirm backend has a Publishable API Key and storefront `.env` has it.
2. **P0 tasks:** Work through Section 4 (env, default country, promotions, pharma PDP, Supabase guard, Address, cart/checkout). Re-run the P0 checklist until all items pass.
3. **Document:** Update README or a one-page “Run the prototype” with exact env vars and commands (and optional “Run backend only” / “Run storefront only”).
4. **Then:** Start P1 (RBAC + middleware + audit + FTS + BullMQ) in small steps, using explore/generalPurpose for each chunk.

---

## 11. References

- **Master plan:** `suprameds-master-prompt-V10-FINAL.md` (full regulatory and feature spec).
- **Status vs plan:** `STATUS-vs-MASTER-PLAN.md` (done vs not done).
- **Agent instructions:** `AGENTS.md` (tech stack, design system, compliance rules, paths).
- **Run/setup:** `README.md` (prerequisites, Supabase, Redis, migrations, scripts).
