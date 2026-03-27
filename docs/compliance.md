# Compliance Guide

Suprameds implements Indian pharmaceutical regulatory compliance at every layer of the stack.

## Drug Schedule Enforcement

### Schedule Classification (Drugs & Cosmetics Act, 1940)

| Schedule | Description | Enforcement |
|----------|-------------|-------------|
| **OTC** | Over-the-counter (paracetamol, antacids) | No restrictions |
| **Schedule H** | Prescription-only (antihistamines, corticosteroids) | Cart blocks checkout without valid Rx |
| **Schedule H1** | High-risk prescription (fluoroquinolones, cephalosporins) | Rx required + H1 register entry mandatory |
| **Schedule X** | Narcotic/psychotropic (morphine, codeine) | Absolute block at middleware level (NDPS Act 1985) |

### Where Enforcement Happens

1. **Add to Cart** (`hooks/schedule-x-block-add-to-cart.ts`):
   - Blocks Schedule X and narcotic products
   - Blocks cold-chain products without refrigeration capability
   - Checks for drug interactions and attaches warnings

2. **Cart Validation** (`hooks/validate-cart-rx-compliance.ts`):
   - Validates prescription attachment for H/H1 drugs
   - Checks Rx status (rejects expired/rejected prescriptions)
   - Validates 90-day Rx validity window

3. **API Middleware** (`middlewares.ts`):
   - HTTP-layer Schedule X block on product endpoints

## H1 Register (CDSCO Mandate)

Every Schedule H1 drug dispense creates an immutable H1 register entry:

**Captured fields:**
- Entry date
- Patient details (name, age, address — PHI encrypted)
- Prescriber (name, registration number)
- Drug details (name, brand, batch number, quantity)
- Dispensing pharmacist (name, registration number)
- Order reference

**Automation:** When a pharmacist approves an H1 drug line via the `PharmacistDecisionWorkflow`, the H1 register entry is auto-created with pharmacist credentials pulled from `StaffCredential`.

**Access:** Admin route at `/admin/dispense/h1-register/export` for regulatory inspection.

## MRP Compliance (DPCO)

The Drug Price Control Order mandates products cannot be sold above their Maximum Retail Price.

**Enforcement:**
- `mrp-validation.ts` — Validates selling price <= batch MRP
- `fefo-allocation.ts` — FEFO allocation checks MRP ceiling before dispatch
- `fulfillment-mrp-check.ts` — Pre-fulfillment MRP validation hook
- Batch-level MRP tracking (stored in paise: ₹1 = 100 paise)
- MRP conflict detection at PO receipt time

## FEFO Inventory (First Expiry, First Out)

**Implementation:** `workflows/fulfillment/fefo-allocation.ts`

1. Sorts available batches by `expiry_date ASC`
2. Allocates from nearest-expiry batch first
3. Creates `BatchDeduction` records for traceability
4. Compensation step rolls back quantities on failure
5. Blocks expired batches from allocation

**Monitoring:**
- `jobs/flag-near-expiry-batches.ts` — Daily job flags batches expiring within 30 days
- `admin/warehouse/inventory` — Expiry badges (red < 30 days, amber < 90 days)

## PHI Protection (DPDP Act 2023)

### Encryption at Rest

`lib/phi-crypto.ts` provides AES-256-GCM encryption for:
- Patient names
- Doctor names and registration numbers
- Guest phone numbers
- Pharmacist notes
- H1 register patient details

**Key management:** 64-character hex key via `PHI_ENCRYPTION_KEY` environment variable.

### Audit Logging

`compliance/models/phi-audit-log.ts`:
- Immutable log of every PHI access (read/write/update/export/print)
- Captures: user, role, action, entity, IP address, user agent
- Monthly partitioning for CDSCO inspections
- Retention enforced via `clear-phi-audit-logs.ts` scheduled job

### Consent Management

`compliance/models/dpdp-consent.ts`:
- Granular consent tracking (essential, functional, analytics, marketing)
- Consent withdrawal capability
- Storefront consent banner component

## GST Compliance

- HSN code classification per drug category
- CGST/SGST/IGST calculation based on warehouse state (Telangana)
- Invoice generation with pharmacy GSTIN and DL number
- Monthly sales tax report via `jobs/generate-sales-tax-report.ts`
- `utils/gst-invoice.ts` — Full GST invoice PDF generation

## RBAC & Separation of Duty

### SSD Constraints

| ID | Rule | Enforcement |
|----|------|-------------|
| SSD-01 | Prescription approver ≠ uploader | `getPrescriptionUploader()` |
| SSD-02 | GRN approver ≠ receiver | `getGrnCreator()` |
| SSD-03 | PO approver ≠ creator | `getPoRaiser()` |
| SSD-04 | Refund approver ≠ raiser | `getRefundRaiser()` |

All helpers in `api/rbac-ssd-helpers.ts`.

### Override Requests

For exceptional circumstances, the compliance override system provides:
- Dual-authorization approval for high-risk overrides
- Justification requirement (minimum 50 characters)
- Risk assessment and patient impact documentation
- Time-limited authorization (default 24 hours)
- Full audit trail

## Batch Recall Workflow

`workflows/inventory/recall-batch.ts`:
1. Marks batch status as `recalled`
2. Records recall reason and date
3. Identifies affected orders
4. Triggers customer notifications
5. Initiates proactive return process

## Pharmacy License Tracking

`compliance/models/pharmacy-license.ts`:
- License number, type, validity dates
- Upload proof of license
- Admin verification workflow
- Dashboard shows license status and expiry warnings
