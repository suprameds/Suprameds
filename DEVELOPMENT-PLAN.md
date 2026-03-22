# Suprameds — Development Plan

Updated: **March 21, 2026**

---

## 1. Current State

| Area | Status | Health |
|------|--------|--------|
| **Backend** | Medusa v2, 15 custom modules, 48+ API routes, 26 subscribers, 17 jobs | Production-capable |
| **Storefront** | TanStack Start, full checkout, 3 auth methods, branded UI | Needs polish |
| **Payments** | Razorpay + COD | Both working |
| **Prescriptions** | Upload, attach, admin review, dispense workflow | Base64 (needs S3) |
| **Notifications** | Email (Resend) + SMS (MSG91) + Push (FCM) + WhatsApp | All working |
| **Admin** | 13 pages + 7 widgets covering all domains | Functional |
| **Compliance** | Schedule X/H/H1, GST invoices, H1 register, batch tracking | RBAC missing |
| **Deployment** | Medusa Cloud | Builds passing |

**Completion vs master plan: ~60–65%**

---

## 2. Next Sprint: Production Blockers

These must be done before any real customer traffic.

### Sprint A: Security & Auth (CRITICAL)

| # | Task | Why | Effort |
|---|------|-----|--------|
| 1 | **RBAC: Seed 25 roles + permissions** | Admin panel is unprotected | 2h |
| 2 | **RBAC: `checkPermission()` service method** | Need to verify user can perform action | 1h |
| 3 | **RBAC: `authorize()` middleware** | Gate every admin route by permission | 2h |
| 4 | **RBAC: 8 SSD constraints** | Rx submitter ≠ approver, GRN creator ≠ approver, etc. | 2h |
| 5 | **RBAC: Admin UI for role management** | Assign/revoke roles from admin | 2h |
| 6 | **Email verification on registration** | Prevent fake accounts from ordering | 1h |
| 7 | **Customer merge (phone + email dedup)** | Same person shouldn't have 2 accounts | 2h |
| 8 | **Remove fallback secrets from medusa-config** | `"supersecret"` fallback = security hole | 15m |
| 9 | **TOTP 2FA for admin/clinical roles** | Required by CDSCO and LegitScript | 3h |

### Sprint B: Performance & Reliability

| # | Task | Why | Effort |
|---|------|-----|--------|
| 1 | **S3 presigned upload for prescriptions** | Replace base64 DB storage | 1 day |
| 2 | **CI/CD: GitHub Actions (tsc + build + lint)** | Catch errors before deploy | 2h |
| 3 | **Delete orphan workflow files** | Dead code confusion | 15m |
| 4 | **Typed module augmentation** | Eliminate `as any` casts | 1h |

---

## 3. Phase Roadmap (Updated)

### DONE — Phases Completed
- [x] **P0: Working Prototype** — Full e2e flow: browse → cart → checkout → pay → order
- [x] **P1 Partial: Hardening** — Loading states, error handling, resilience, rate limiting, fallbacks
- [x] **P2: Clinical Backbone** — Prescription flow, dispense decisions, H1 register, pre-dispatch sign-off
- [x] **P3: Orders + Inventory + COD** — COD confirmation, guest checkout, FEFO, batch tracking, PO/GRN
- [x] **P4: Warehouse** — GRN workflow, pick/pack task board, returns inspection, batch recall
- [x] **P5 Partial: Fulfillment** — AfterShip, delivery estimates, shipment creation, NDR
- [x] **P7 Partial: Growth** — Abandoned cart reminders, chronic reorder detection, loyalty, WhatsApp, push notifications
- [x] **P8 Partial: Admin Extensions** — Analytics, compliance, dispense, warehouse, GRN, loyalty dashboards

### IN PROGRESS
- [ ] **P1: Security Hardening** — RBAC, email verification, S3 upload, CI/CD

### REMAINING

#### Sprint C: Compliance Certification
- [ ] LegitScript pre-certification (20-item checklist)
- [ ] LegitScript seal in footer (dynamic CDN)
- [ ] Full DPDP consent management (data download, deletion, granular consent)
- [ ] Override engine (14 types + emergency + dual auth + audit)
- [ ] Google Ads OTC feed generator
- [ ] PHI encryption at rest (AES-256)
- [ ] 12h/7d support availability (currently 9am-9pm 6 days)

#### Sprint D: Payment & Finance
- [ ] Stripe integration (international)
- [ ] Full refund workflows (Rx rejection, returns, COD non-delivery)
- [ ] Payment links for failed payments
- [ ] COD surcharge as line item
- [ ] Finance reconciliation dashboard

#### Sprint E: Storefront Polish
- [ ] Pharmacist portal (/pharmacy routes)
- [ ] Warehouse portal (/warehouse routes)
- [ ] Mobile pharmacist view
- [ ] Wishlist + price alerts
- [ ] Reviews / Q&A
- [ ] Blog CMS
- [ ] OTP-based delivery for Rx orders
- [ ] JSON-LD structured data (MedicalWebPage, Drug)
- [ ] Progressive enhancement / offline support

#### Sprint F: Infrastructure & Testing
- [ ] Production Docker (Nginx + PgBouncer + Redis)
- [ ] Playwright E2E test suite
- [ ] Load testing (10K orders/month target)
- [ ] OWASP ZAP security audit
- [ ] Monitoring (health checks, alerting)
- [ ] 5-year data retention automation

---

## 4. RBAC Implementation Plan

### 4.1 The 25 Roles

**Tier 1 — Customer:** guest, customer, b2b_buyer, b2b_admin
**Tier 2 — Clinical:** pharmacy_technician, pharmacist, pharmacist_in_charge
**Tier 3 — Warehouse:** grn_staff, qc_staff, picker, packer, dispatch_staff, returns_staff, warehouse_manager
**Tier 4 — Business:** support_agent, support_supervisor, catalog_manager, content_moderator, marketing_admin, finance_admin, compliance_officer, platform_admin
**Tier 5 — Elevated:** super_admin, cdsco_inspector, supplier

### 4.2 Implementation Steps

1. **Seed script** — Create all 25 roles with their `is_clinical` and `requires_mfa` flags
2. **Permission matrix** — Define ~60 resource:action pairs (e.g., `prescription:approve`, `order:refund`, `batch:recall`)
3. **Role-permission mapping** — Assign permissions to roles
4. **Service methods** — `assignRole(userId, roleCode, assignedBy)`, `revokeRole()`, `checkPermission(userId, resource, action)`, `validateSsd(userId, action, targetEntityId)`
5. **Middleware** — `authorize(resource, action)` that resolves user → roles → permissions and rejects 403
6. **SSD validator** — 8 hard constraints checked at API level before allowing action
7. **Admin UI** — User role management page with role assignment form

### 4.3 SSD Constraints

| # | Rule | Enforcement Point |
|---|------|-------------------|
| SSD-01 | Rx submitter ≠ Rx approver | `/admin/prescriptions/:id` POST approve |
| SSD-02 | GRN creator ≠ GRN QC approver | `/admin/warehouse/grn` POST approve |
| SSD-03 | PO raiser ≠ PO approver | `/admin/pharma/purchases` POST approve |
| SSD-04 | Refund raiser ≠ refund approver | Refund workflow |
| SSD-05 | Content writer ≠ content approver | Product publish |
| SSD-06 | Recall initiator ≠ quarantine clearance | `/admin/pharma/batches/:id/recall` |
| SSD-07 | Compliance flag override requires super_admin | Override engine |
| SSD-08 | cdsco_inspector cannot coexist with internal role | Role assignment validation |

---

## 5. Signup Enhancement Plan

### Current Flow
```
Register: Name + Email + Password + Phone(optional) → Medusa auth → Customer created → Logged in
Phone OTP: Phone → OTP → Auto-create customer if new → JWT → Logged in  
Email OTP: Email → OTP → Auto-create customer if new → JWT → Logged in
```

### Target Flow
```
Register: Name + Email + Password + Phone(required)
  → Send email verification OTP
  → Verify email OTP → Account active
  → Optional: verify phone via SMS OTP

Phone OTP Login: Phone → OTP → If new: prompt for name + email → Create customer
Email OTP Login: Email → OTP → If new: prompt for name → Create customer

Account Merge: If customer logs in via phone AND has existing email account (or vice versa)
  → Prompt: "We found an account with this email. Link accounts?"
  → Verify ownership → Merge profiles
```

### Implementation Steps
1. Add `email_verified` flag to customer metadata
2. After registration, send verification OTP via Resend
3. Block first order until email is verified
4. On OTP login (new customer), redirect to "Complete Profile" page
5. Implement merge detection: check if phone/email exists on different customer records
6. Build merge confirmation UI with ownership verification

---

## 6. Quick Reference

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start backend (9000) + storefront (5173) via Turbo |
| `pnpm build` | Build all packages |
| `pnpm build --filter=backend` | Build backend only |
| `npx tsc --noEmit` | Type-check without building |
| `docker compose up -d` | Start Redis |

---

## 7. Known Technical Debt

| Item | Priority | Notes |
|------|----------|-------|
| Base64 Rx uploads → S3 | P1 | DB bloat risk |
| RBAC service is stub | P1 | Security gap |
| No email verification | P1 | Fake account risk |
| No CI/CD | P1 | Manual builds |
| `as any` type casts (~30+ files) | P2 | Needs typed module augmentation |
| Orphan workflow files | P2 | Dead code |
| No automated tests | P2 | Critical paths untested |
| Customer phone+email dedup | P2 | Can create duplicate accounts |
| Fallback secrets in medusa-config | P1 | Remove immediately |
