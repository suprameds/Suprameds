# Suprameds — Status vs Master Plan (V10)

Updated: **March 22, 2026**

---

## Tech stack vs plan

| Plan (doc) | Current repo |
|------------|--------------|
| Medusa Bloom (Next.js 14) | **TanStack Start** (Vite + React) — functionally equivalent |
| Medusa Cloud (PostgreSQL + Redis + S3) | **Supabase** (dev PostgreSQL) + **Medusa Cloud Neon** (prod) + **Docker** (Redis) |
| AWS S3, Mumbai | Medusa Cloud R2 (auto-provisioned) |
| pnpm monorepo | **pnpm@10.8.0** workspaces monorepo + turbo |
| SendGrid + SES email | **Resend** (transactional emails from support@supracynpharma.com) |
| Twilio / Gupshup WhatsApp | **Meta Cloud API** (WhatsApp Business) |
| MeiliSearch | **PostgreSQL FTS** (tsvector + GIN — ₹0/month) |

---

## Completion Summary

| Category | Master Plan Items | Done | Partial | Not Started |
|----------|:-:|:-:|:-:|:-:|
| **Infrastructure** | 12 | 9 | 2 | 1 |
| **Custom Modules** | 15 | 15 | — | — |
| **API Routes** | ~50 | ~50 | — | — |
| **Workflows** | 15 | 14 | 1 | — |
| **Subscribers** | 26 | 26 | — | — |
| **Scheduled Jobs** | 17 | 17 | — | — |
| **Admin UI** | 10 sidebar pages + sub-routes + 7 widgets | 10 + 7 | — | — |
| **Storefront** | ~25 routes/features | ~24 | 1 | — |
| **Compliance** | 20 LegitScript items | 17 | 2 | 1 |
| **RBAC** | 25 roles + 8 SSD | 25 roles + 8 SSD + middleware + admin UI | — | MFA |

**Overall estimate: ~75–80% of master plan** (up from ~60–65% at last update)

---

## Recent Changes (this session)

### Admin Sidebar Consolidation
- **Removed** standalone "Rx Queue" page — Dispense already has Rx Queue as its first tab
- **Merged** "Overrides" into Compliance as a 4th tab ("Override Requests")
- **Merged** "Goods Receipt (GRN)" into Purchases → renamed to "Procurement" with two tabs
- **Net result**: 3 fewer sidebar items, cleaner admin navigation

### Previous Session Work
- Conditional shipping: free above ₹300, ₹50 below (custom fulfillment provider)
- Homepage redesign: hero + search, Shop by Category, trust signals, FAQ
- Refill Reminders: backend API + customer "My Reminders" page
- Error handling: connection/auth/generic error categories, retry logic
- Post-login redirects: proper `redirectTo` handling across login/register flows
- Delivery estimate fix: proper pincode serviceability check
- Hydration fix: SSR-safe announcement bar
- Post-order redirect fix: race condition resolved
- RBAC: full implementation (service + seeds + middleware + admin UI)
- Invoice downloads on storefront
- Pincode import with chunked progress
- MRP/discount percentage display on product cards

---

## DONE — Fully Implemented

### Infrastructure & Deployment
- [x] Medusa v2 backend + pnpm workspaces monorepo + turbo
- [x] PostgreSQL via Supabase (local dev) + Medusa Cloud Neon (production)
- [x] Redis via Docker Compose
- [x] Medusa Cloud deployment pipeline — builds passing
- [x] 12+ migration scripts (India region, shipping, Razorpay, INR, FTS, taxonomy, COD, conditional shipping)
- [x] Environment variable management (.env.example for both apps)
- [x] Sentry error tracking (storefront)
- [x] Google Analytics 4 integration
- [x] Firebase Cloud Messaging (push notifications)

### Custom Modules (15/15 — all functional)
- [x] **pharma** — drug metadata, schedule classification, GST, form, strength, composition, MRP
- [x] **prescription** — upload, status flow, approval, attachment to cart/order
- [x] **inventoryBatch** — lot/expiry tracking, FEFO allocation, batch deductions
- [x] **cod** — COD orders, confirmation workflow, customer scoring, RTO handling
- [x] **orders** — order extensions (GST, prescription links, metadata)
- [x] **warehouse** — GRN, tasks, pick lists, zones, returns inspection
- [x] **shipment** — shipment creation, AWB, carrier, AfterShip integration
- [x] **compliance** — override requests, PHI audit, DPDP consents, pharmacy licenses
- [x] **dispense** — pharmacist decisions, pre-dispatch sign-off, H1 register
- [x] **loyalty** — accounts, transactions, tiers, points award/expire
- [x] **crm** — chronic reorder patterns, customer lifecycle, abandoned cart, refill reminders
- [x] **analytics** — dashboard, revenue, products, customers
- [x] **notification** — internal notifications, templates
- [x] **payment** — Razorpay, COD provider
- [x] **rbac** — 25 roles, ~65 permissions, 8 SSD rules, service + seeds + admin UI

### RBAC — Fully Implemented
- [x] 25 roles across 5 tiers (super_admin, pharmacist, warehouse_manager, etc.)
- [x] ~65 granular permissions (`resource:action` format)
- [x] Service: `assignRole()`, `revokeRole()`, `checkPermission()`, `validateSsd()`, `seedRolesAndPermissions()`
- [x] 8 SSD constraints (Rx submitter ≠ approver, GRN creator ≠ inspector, etc.)
- [x] `authorize(resource, action)` middleware on 15+ admin routes
- [x] `enforceSsd(rule, getRelatedUserId)` middleware on 3 critical routes
- [x] Admin UI: Roles page with 4 tabs (Roles Overview, Invite User, User Roles, Audit Log)
- [x] Seed endpoint: `POST /admin/rbac/seed`
- [x] Invite flow with role pre-assignment
- [x] Default role assignment on invite accept
- [x] Role audit logging
- [ ] **Missing: MFA enforcement** (TOTP for clinical roles, FIDO2 for super_admin)

### API Routes (~50 endpoints)

**Admin (32+)**
- [x] Analytics: dashboard, revenue trends, product performance, customer analytics
- [x] Prescriptions: list, detail, approve/reject
- [x] Pharma: drug products, batches, low-stock, recall, import/export
- [x] Purchases: PO CRUD, line items, receive/GRN
- [x] Invoices: GST invoice data, PDF generation
- [x] Shipments: create, detail, AfterShip
- [x] Dispense: decisions, pre-dispatch sign-off, H1 register export
- [x] Warehouse: GRN, pick lists
- [x] Loyalty: dashboard, per-customer data
- [x] Compliance: override requests, PHI logs, DPDP consents, pharmacy licenses
- [x] Reports: sales tax
- [x] Orders: CS-place, returns
- [x] RBAC: seed, roles, assign/revoke, invite with role
- [x] Pincodes: import (chunked), check, list

**Store (20+)**
- [x] Prescriptions: CRUD, attach/detach from cart
- [x] Products: search (FTS), pharma metadata, batch lookup, interactions, substitutes
- [x] Delivery estimate + pincode serviceability check
- [x] Orders: COD confirm, guest sessions, GSTIN
- [x] OTP: send (SMS + Email), verify (SMS + Email)
- [x] Push: register, unregister
- [x] Shipments: tracking
- [x] Invoices: customer PDF download
- [x] Reminders: list, create, update, delete (refill reminders)

**Webhooks (5)**
- [x] Razorpay (HMAC-verified)
- [x] AfterShip (HMAC-verified)
- [x] WhatsApp (Meta verification)
- [x] MSG91 (delivery reports)
- [x] Stripe (placeholder)

### Workflows (14 implemented)
- [x] Prescription: upload-rx, review-rx
- [x] Checkout: complete-cart (with Rx compliance hooks)
- [x] Order: confirm-cod
- [x] Fulfillment: create-shipment, fefo-allocation
- [x] Inventory: recall-batch
- [x] Dispense: pharmacist-decision, pre-dispatch-check
- [x] Warehouse: approve-grn, inspect-return
- [x] Loyalty: award-points
- [x] Customer: merge-guest-cart
- [x] Compliance: request-override

**Workflow Hooks (3)**
- [x] Schedule X + cold chain + drug interaction block (addToCart.validate)
- [x] Rx compliance check (completeCart.validate)
- [x] FEFO + MRP check on fulfillment

### Subscribers (26)
- [x] Order lifecycle: placed, updated, canceled, delivered, dispatched, payment-captured, payment-failed
- [x] Prescription: uploaded, fully-approved, partially-approved, rejected, expired
- [x] COD: unconfirmed-timeout
- [x] Warehouse: GRN approved, return requested, return received
- [x] Inventory: low stock, batch MRP conflict
- [x] Loyalty: points earned, points redeemed
- [x] Dispense: decision made, H1 register updated
- [x] Customer: created, password reset
- [x] Shipment: NDR reported, RTO initiated
- [x] WhatsApp: unified order/Rx updates

### Scheduled Jobs (17)
- [x] cancel-unconfirmed-cod (15-min)
- [x] check-low-stock (6-hourly)
- [x] flag-near-expiry-batches (daily)
- [x] remind-abandoned-carts (2-hourly, Rx-compliant)
- [x] identify-chronic-reorders (daily)
- [x] send-chronic-refill-reminders (6-hourly)
- [x] expire-loyalty-points (daily)
- [x] purge-expired-prescriptions (daily)
- [x] generate-h1-report (daily)
- [x] generate-sales-tax-report (monthly)
- [x] verify-dlt-templates (daily)
- [x] sync-aftership-status (hourly)
- [x] release-expired-guest-sessions (hourly)
- [x] auto-allocate-fefo (hourly)
- [x] sync-inventory-to-storefront (hourly)
- [x] update-delivery-days (weekly)
- [x] clear-phi-audit-logs (monthly — archive, not delete)

### Admin UI (10 sidebar pages + sub-routes + 7 widgets)

**Sidebar Pages (consolidated):**
- [x] Analytics dashboard (KPIs, revenue trend, status distribution)
- [x] Dispense (Rx queue + decisions log + pre-dispatch sign-offs — 3 tabs)
- [x] Prescriptions detail (`/prescriptions/:id` — approve/reject individual Rx)
- [x] Products → Create Medicine (pharma-specific form)
- [x] Procurement (Purchase Orders tab + Goods Receipt/GRN tab — 2 tabs)
- [x] H1 Register (filterable, exportable)
- [x] Warehouse (overview, tasks, pick lists)
- [x] Loyalty (dashboard, tier distribution, accounts)
- [x] Compliance (PHI logs + DPDP consents + licenses + Override Requests — 4 tabs)
- [x] Roles (Roles overview + Invite user + User roles + Audit log — 4 tabs)
- [x] Pincodes (import/export, serviceability management)

**Widgets (7):**
- [x] Product pharma info (on product detail)
- [x] Order Rx review (on order detail)
- [x] COD verification status (on order detail)
- [x] Customer loyalty (on customer detail)
- [x] Batch selector (on inventory)
- [x] Prescription upload (on order detail)
- [x] Pharmacist adjustment (on product detail)

### Storefront (~24 routes/features)
- [x] Design system: theme.css, navbar, footer, branding overhaul ("Clinical-Clean Precision")
- [x] India region + country-prefixed routes
- [x] Homepage: hero with search, Shop by Category, trust signals, discount messaging, FAQ
- [x] Product listing + product detail page (MRP, discount %, Rx badge, substitutes)
- [x] Cart: drug interaction warnings, delivery estimates, free delivery badge, conditional shipping
- [x] Checkout: address (saved address selector) → delivery → prescription → payment → review
- [x] Payment: Razorpay + COD with proper session handling
- [x] Order confirmation: COD confirm banner, invoice download, GSTIN input, order tracker
- [x] Auth: login (email/password + phone OTP + email OTP), register, proper redirectTo handling
- [x] Account: profile, orders, addresses, refill reminders
- [x] Search: PostgreSQL FTS with debounced as-you-type
- [x] Prescription upload: standalone page + checkout integration
- [x] Compliance pages: /pharmacy/licenses, /prescription-policy, /grievance, /privacy, /terms, /returns
- [x] DPDP consent banner
- [x] Product cards: % off badge, Rx badge
- [x] Shipment tracking (timeline + carrier info)
- [x] Therapeutic substitutes on PDP
- [x] Error boundaries: connection/auth/generic error categories + retry logic + loading states
- [x] Sentry + GA4 + Firebase push
- [x] Invoice download on orders
- [x] Delivery estimate with pincode serviceability
- [x] Conditional shipping display (FREE badge when ≥₹300)

### Payment
- [x] Razorpay: UPI, cards, netbanking, EMI via medusa-plugin-razorpay-v2
- [x] Cash on Delivery: unrestricted, confirmation workflow, admin dashboard
- [x] Webhook handlers with HMAC verification
- [x] Payment session duplicate detection

### Notifications (4 channels)
- [x] **Email** (Resend): order confirmation, Rx updates — branded templates
- [x] **Push** (Firebase FCM): order shipped, delivered, cancelled, payment failed, Rx approved/rejected, abandoned cart, loyalty
- [x] **WhatsApp** (Meta Cloud API): order placed/shipped/delivered, Rx approved/rejected
- [x] **SMS** (MSG91): OTP delivery

### External Service Resilience
- [x] MSG91: graceful 502/503 with "use email OTP" fallback
- [x] Firebase: all FCM calls wrapped in try/catch, never blocks orders
- [x] Resend: subscribers catch errors, orders proceed
- [x] AfterShip: returns null/[], shipment created regardless
- [x] WhatsApp: safeSend wrapper, never blocks flows
- [x] Rate limiting on OTP, prescription, and push endpoints

### Compliance Rules Enforced
- [x] Schedule X: absolute block (workflow + middleware + cart validation)
- [x] NDPS: absolute block
- [x] Schedule H/H1: prescription required (allows pending_review for "order first, verify later")
- [x] No Rx promotions (completeCart validate hook)
- [x] No lifestyle images (AGENTS.md rule)
- [x] Pharmacist sign-off flow (dispense decisions + pre-dispatch)
- [x] H1 register (transactional entries for H1 dispenses)
- [x] GST invoice generation (PDF, INR, HSN, CGST/SGST/IGST)
- [x] Drug interaction checker (24 common pairs)
- [x] Near-expiry batch flagging
- [x] Batch recall workflow
- [x] Pincode serviceability check
- [x] DLT template verification job
- [x] MRP compliance: never sell above printed MRP; highest MRP across dispatched batches
- [x] RBAC: 25 roles, 65 permissions, 8 SSD constraints enforced via middleware
- [x] Conditional shipping: ₹50 below ₹300, free above

---

## PARTIAL — Started But Needs More Work

### MFA for Admin/Clinical Roles
**Status:** RBAC roles have `requires_mfa: true` flag stored. No actual TOTP/FIDO2 enforcement.
**Missing:**
- [ ] TOTP enrollment flow (QR code generation, secret storage)
- [ ] TOTP verification middleware for clinical roles
- [ ] FIDO2/WebAuthn for super_admin (optional, high-value)

### Signup / Registration
**Status:** Storefront has email+password registration. Phone OTP and Email OTP create accounts automatically on first login.
**Missing:**
- [ ] Email verification step (user can register with any email — account is immediately active)
- [ ] Phone verification during registration (only at login currently)
- [ ] Customer merge logic (email registration + phone OTP = two separate accounts)

### S3 Presigned Upload for Prescriptions
**Status:** Prescriptions currently uploaded as base64 data URLs stored in DB.
**Missing:**
- [ ] S3 presigned PUT URL generation
- [ ] Direct browser-to-S3 upload
- [ ] Store only S3 key in prescription record
- [ ] Admin: presigned GET URL for pharmacist viewing

### CI/CD Pipeline
**Status:** No automated pipeline. Builds verified manually with `npx tsc --noEmit`.
**Missing:**
- [ ] GitHub Actions: tsc, build, lint on every PR
- [ ] Deploy pipeline on merge to main
- [ ] Compliance cron (weekly checks)

---

## NOT STARTED — Remaining from Master Plan

### High Priority (should do before production launch)

| # | Item | Plan Ref | Why | Effort |
|---|------|----------|-----|--------|
| 1 | **Email verification on registration** | Part 11 | Prevent fake accounts | S |
| 2 | **S3 presigned upload for Rx** | Part 3 | Base64 images cause DB bloat | M |
| 3 | **CI/CD (GitHub Actions)** | Part 31 | Manual builds are error-prone | M |
| 4 | **TOTP 2FA for admin/clinical** | Part 24, 28 | Required by compliance | M |
| 5 | **PHI encryption at rest** | Part 28 | AES-256 for Rx images, DOB, H1 register | M |

### Medium Priority (needed for scaling / compliance certification)

| # | Item | Plan Reference |
|---|------|----------------|
| 6 | Full DPDP consent management (data download, deletion, granular consent) | Part 7 |
| 7 | LegitScript pre-certification (20-item checklist, seal in footer) | Part 26 |
| 8 | Google Ads OTC feed generator | Part 26 |
| 9 | Supplier portal (PO status, CoA upload) | Part 24 Tier 5 |
| 10 | Full order state machine with transitions | Part 9 |
| 11 | Refund workflows (Rx rejection, returns, COD non-delivery) | Part 6 |
| 12 | Payment links for failed payments | Part 8 |
| 13 | OTP-based delivery for Rx orders | Part 19 |

### Lower Priority (growth / polish)

| # | Item | Plan Reference |
|---|------|----------------|
| 14 | Pharmacist portal (standalone /pharmacy routes) | Session 5 |
| 15 | Warehouse portal (standalone /warehouse routes) | Session 5 |
| 16 | Customer family profiles | Part 4 |
| 17 | Wishlist + price alerts | Part 27 |
| 18 | Reviews / Q&A (pharmacist answers) | Part 27 |
| 19 | Blog CMS | Part 27 |
| 20 | In-app notifications (Redis pub/sub) | Part 7 |
| 21 | PgBouncer | Part 29 |
| 22 | Playwright E2E tests | Part 31 |
| 23 | Load testing (10K orders/month) | Part 29 |
| 24 | OWASP ZAP security audit | Part 31 |
| 25 | Production Docker (Nginx + PgBouncer) | Part 29 |
| 26 | COD surcharge line item | Part 8 |
| 27 | Google Shopping structured data (JSON-LD) | Session 3 |
| 28 | Mobile pharmacist view | Session 5 |

---

## Production Readiness Assessment

### Can Launch Now (with caveats)
The platform is **functionally complete for a soft launch** at ~350 orders/month:

**What works end-to-end:**
- Customer browsing, search, product pages with MRP/discount
- Cart with drug interaction warnings + conditional shipping
- Full checkout flow (address → delivery → Rx upload → payment → confirmation)
- Razorpay + COD payments
- Prescription upload and pharmacist review workflow
- Order tracking with AfterShip
- Customer account (orders, addresses, reminders)
- Admin: full pharmacy operations (dispense, compliance, procurement, warehouse)
- RBAC with 25 roles and SSD enforcement
- 4-channel notifications (email, SMS, push, WhatsApp)
- Indian compliance: Schedule X block, H/H1 Rx requirement, H1 register, GST invoices

### Blockers for Full Production (must-fix before scaling)

| Blocker | Risk if skipped | Effort |
|---------|----------------|--------|
| **Email verification** | Fake accounts, spam orders | 1–2 days |
| **S3 Rx uploads** | DB bloat — base64 images in PostgreSQL | 2–3 days |
| **CI/CD** | Manual builds, risk of deploying broken code | 1–2 days |
| **MFA for clinical roles** | Compliance audit failure | 2–3 days |
| **PHI encryption** | Data breach liability | 2–3 days |

### Recommendation

**For soft launch (≤500 orders/month):** Ready to go. The compliance framework (Schedule X/H/H1 blocks, RBAC, H1 register, pharmacist sign-off) is in place. The main operational flows work.

**For production scaling (1000+ orders/month):** Complete the 5 high-priority items above (~8–12 dev days). Then address medium-priority items (refund workflows, order state machine, LegitScript) as volume grows.

---

## Summary Comparison

| Area | Master Plan (V10) | Implemented | Gap |
|------|:--:|:--:|:--:|
| **Custom modules** | 15 | 15 | — |
| **API endpoints** | ~50 | ~50 | — |
| **Workflows** | 15 | 14 | Override engine |
| **Admin pages** | ~13 (now 10 consolidated) | 10 | — |
| **Subscribers** | ~26 | 26 | — |
| **Jobs** | ~17 | 17 | — |
| **Storefront features** | ~25 | ~24 | Pharmacist/warehouse portals |
| **Payment gateways** | 2 (Razorpay + COD) | 2 | Stripe (international, future) |
| **Notification channels** | 4 | 4 | — |
| **Compliance rules** | 20 LegitScript items | 17 | MFA, PHI encryption, LegitScript seal |
| **RBAC** | 25 roles, 8 SSD | 25 roles, 8 SSD, middleware, admin UI | MFA enforcement |
| **CI/CD** | 3 pipelines | 0 | All needed |
| **Testing** | Unit + Integration + E2E | 0 | All needed |

**Rough completion: ~75–80% of master plan**

The biggest jump since last update: RBAC went from "models only" to fully implemented (service, seeds, middleware, admin UI). Admin pages consolidated for better UX. Storefront gained reminders, better error handling, conditional shipping, and homepage redesign.
