# SUPRAMEDS.IN — PHARMA ECOMMERCE PLATFORM
### Medusa.js v2 + Medusa Bloom | LegitScript + Google Ads + CDSCO Compliant | Production-Ready
### Search: PostgreSQL Full-Text Search (built into Medusa Cloud — ₹0/month. No MeiliSearch needed.)
### Shipping: India Post Speed Post Pro (EZ Shipment) + AfterShip tracking layer
### Infra: Medusa Cloud (PostgreSQL + Redis + S3 auto-provisioned)

---

> You are a senior full-stack architect and healthcare compliance engineer
> specializing in Medusa.js v2 and Indian pharmaceutical regulations.
>
> Build a PRODUCTION-READY pharmaceutical eCommerce platform for
> SUPRAMEDS (suprameds.in) — a 3-year-old licensed online pharmacy
> based in India with a live customer base and an owned warehouse.
> The platform upgrade must handle 350+ orders/month at launch and
> scale to 10,000+/month without architectural changes.
>
> Tech foundation: Medusa.js v2 backend + Medusa Bloom storefront.
> Architecture pattern: MODULAR MONOLITH — modules are clearly isolated
> for future microservice extraction but share one deployment now.
>
> Warehouse reality: Single owned ambient warehouse. No cold chain.
> No IoT sensors. Hard drugs (tablets, capsules, syrups, strips) only.
> No temperature-controlled products.
>
> This must pass: LegitScript Category B certification, Google Ads
> Healthcare policy approval, CDSCO Form 18AA inspection, and all
> applicable Indian pharma regulations on day one.

---

## TECH STACK

| Layer | Technology |
|---|---|
| Backend | Medusa.js v2 (Node.js + TypeScript strict mode) |
| Storefront | Medusa Bloom (Next.js 14 App Router + Tailwind CSS) |
| Database | PostgreSQL 15 (encrypted at rest, ap-south-1) + PgBouncer (connection pooling) |
| Cache / Queue | Redis 7 (persistent AOF) + BullMQ (job queue — runs on same Redis) |
| Search | PostgreSQL Full-Text Search — tsvector + GIN index (built into Medusa Cloud DB — ₹0/month) |
| Object Storage | AWS S3 (Mumbai ap-south-1) — SSE-S3, signed URLs only |
| Email | SendGrid (transactional) + AWS SES (bulk) |
| Payments | Razorpay (India: UPI/Cards/NetBanking/EMI/COD) + Stripe (international, 3DS2) |
| Auth | Medusa Auth Module + JWT + TOTP 2FA + FIDO2 (super_admin) |
| SMS | MSG91 (TRAI DLT-registered — mandatory for all bulk SMS in India) |
| WhatsApp | Twilio / Gupshup (WhatsApp Business API, WABA-approved) |
| Monitoring | Winston (structured logging) + Sentry (error tracking) + PostHog (self-hosted, non-PHI pages) |
| Reverse Proxy | Nginx (SSL termination, rate limiting, admin IP restriction) |
| Deployment | Docker + Docker Compose → AWS ECS Fargate (Mumbai ap-south-1) |
| CI/CD | GitHub Actions |
| Logistics | India Post Speed Post Pro (EZ Shipment) + AfterShip (tracking aggregator) |

---

## PART 1 — REGULATORY FRAMEWORK

Design every module to satisfy ALL of the following simultaneously.

### Indian Law Stack

**1. Drugs & Cosmetics Act, 1940 + D&C Rules, 1945**
- No sale of any drug without a valid retail drug license
- Schedule H, H1, X: sold only on valid prescription of a Registered Medical Practitioner (RMP)
- Schedule X: HARD BLOCK for online sale — no role override exists anywhere in the system
- All drugs must be of standard quality (not misbranded, adulterated, or spurious)

**2. Pharmacy Act, 1948**
- Only a Registered Pharmacist (RPh) can dispense medicine on prescription
- RPh license number on record and publicly visible on storefront at all times

**3. Drugs & Magic Remedies (Objectionable Advertisements) Act, 1954**
- ZERO drug advertising on any medium — internet, email, SMS, WhatsApp, print, TV
- No claims of "cure", "guaranteed treatment", "no side effects", "100% effective"
- Violation = criminal offence
- Enforce at: CMS lint firewall, Google Shopping feed generator (hard exclude all Rx),
  notification dispatcher (Rx SKU template validator), loyalty module (OTC-only block)

**4. NDPS Act, 1985**
- Absolute prohibition on online sale of narcotics and psychotropics
- Flag in DB: `ndps_scheduled: boolean`
- Hard block at product entity, cart, checkout API, and middleware — no code path for override

**5. Draft E-Pharmacy Rules, 2018 (CDSCO)**
- CDSCO Form 18AA registration (Central Licensing Authority)
- Cash/credit memo mandatory for every drug supply — retain 5 years minimum
- Minimum 12-hour/7-day customer support (Suprameds current: 9am–9pm 6 days — compliance gap, fix this)
- All compliance records accessible to CDSCO inspector on demand from admin dashboard

**6. Consumer Protection (E-Commerce) Rules, 2020**
- Display: seller legal name, registered address, customer care contact, grievance officer + contact
- Dedicated /grievance page with ticketing system, 48-hour SLA
- No hidden charges — COD fee must be shown before payment step
- No misleading ratings or unfair trade practices

**7. Digital Personal Data Protection (DPDP) Act, 2023**
- Explicit, purpose-specific consent before collecting any personal data
- Consent banner on first visit — server-rendered (not client-side only)
- Data Principal rights: access, correction, erasure, grievance
- Breach notification within 72 hours
- Consent stored with: category, timestamp, IP, privacy policy version shown

**8. Information Technology Act, 2000**
- Data localization: all sensitive personal data stored in ap-south-1 only
- Reasonable security practices aligned with IS/ISO 27001

### International Standards
- LegitScript Healthcare Merchant Certification (Category B)
- Google Healthcare & Medicines Advertising Policy
- Visa/Mastercard VIRP (Card-Not-Present compliance)
- PCI-DSS (Razorpay Checkout.js + Stripe Elements — no raw card data ever)

---

## PART 2 — MEDUSA CORE MODULES (medusa-config.ts)

1. **Product Module** — extended pharma schema, substitution mappings, molecule refs
2. **Cart Module** — Rx gate at API level, drug interaction check on add, NDPS hard block, pincode serviceability check, guest cart (Redis-backed, 7-day TTL)
3. **Order Module** — full lifecycle with partial approval, dispense_decision linkage, COD confirmation flow, partial shipment support
4. **Customer Module** — individual + family profiles, DPDP consents, Rx links, order history, guest → account merge
5. **Inventory Module** — batch/lot tracking, FEFO allocation engine, immutable stock ledger, out-of-stock alerts, back-order support
6. **Pricing Module** — MRP mandatory display, GST-inclusive pricing, B2B tiered pricing, COD surcharge line item
7. **Promotions Module** — OTC only; system-enforced hard block on all Rx drug promotions
8. **Payment Module** — Razorpay (UPI/Cards/NetBanking/EMI/COD) + Stripe (3DS2); authorize/capture split for partial Rx orders
9. **Fulfillment Module** — India Post Speed Post as sole carrier; AfterShip tracking registration; manual AWB entry by staff; delivery estimate by destination state (lookup table — no external API needed, India Post covers all pincodes); international block for Schedule H/H1/X
10. **Notification Module** — SendGrid + MSG91 (DLT-registered) + WhatsApp Business API; preference-enforced; full template library (see Part 9)
11. **Auth Module** — JWT, 25-role RBAC (Part 14), TOTP 2FA, FIDO2 for super_admin, OTP phone login, guest session management
12. **Tax Module** — GST by drug category (0%/5%/12%/18%), HSN per product, CGST+SGST+IGST split
13. **Region Module** — India-first; geo-block Rx fulfillment to licensed states only
14. **File Module** — S3 SSE-S3; signed URLs 1-hour TTL; all Rx and health documents encrypted at rest
15. **Search Module** — PostgreSQL Full-Text Search: `tsvector` column on products table with GIN index. Searches: brand name, generic name, salt/molecule, manufacturer, drug class. OOS-aware ranking (in-stock ranked higher). Prefix search for as-you-type. Filters: schedule_classification, requires_prescription, category, gst_rate. Zero external service — runs entirely inside Medusa Cloud PostgreSQL.
16. **Analytics Module** — PostHog events (non-PHI pages only); pg_cron materialized views for KPI dashboard (refresh every 15 minutes)

---

## PART 3 — THE TRACEABILITY CHAIN

Every Rx item must be traceable through this exact chain.
No step can be bypassed — enforced by DB foreign key constraints + middleware + workflow validation.

```
Customer uploads Rx PDF
  → prescription (document + metadata)
    → prescription_drug_lines (one row per drug, structured by pharmacist)
      → dispense_decisions (pharmacist clinical decision per line)
        → order_items (created from approved decisions only)
          → order_item_batch_allocations (FEFO assignment, split-batch supported)
            → stock_movements (immutable ledger entry)
              → shipment_items (with explicit batch proof)
                → delivery_otp_logs (Rx OTP delivery confirmation)
```

---

## PART 4 — COMPLETE DATABASE SCHEMA

### 4.1 Entity Groups

- **Identity & Roles:** users, roles, permissions, user_roles, pharmacist_profiles, customer_profiles, family_profiles, guest_sessions
- **Catalog:** products, variants, molecules, substitution_mappings, drug_information, stock_alerts, recently_viewed
- **Prescription Domain:** prescriptions, prescription_drug_lines, dispense_decisions, prescription_line_consumptions, pharmacist_notes, pharmacist_adjustment_logs
- **Order Domain:** orders, order_items, order_item_batch_allocations, order_state_history, partial_shipment_preferences, cancellation_reasons, cs_placed_orders
- **Inventory Domain:** inventory_batches, stock_movements, batch_recall_logs, damage_logs, purchase_orders, suppliers
- **Fulfillment Domain:** shipments, shipment_items, tracking_events, delivery_otp_logs, delivery_days_lookup
- **Payments & Finance:** payments, cod_orders, refunds, supply_memos, h1_register_entries
- **Warehouse:** warehouses, warehouse_zones, warehouse_bins, warehouse_tasks, pick_list_lines, grn_records, returns_inspections, pre_dispatch_sign_offs
- **Compliance & Audit:** pharmacy_licenses, compliance_records, phi_audit_logs, override_requests, override_audit_log, inspection_exports, cdsco_inspector_access_logs
- **CRM & Growth:** loyalty_accounts, loyalty_transactions, referrals, wishlists, reviews, grievances, chronic_reorder_patterns, notification_templates, dlt_template_registry
- **DPDP & Privacy:** dpdp_consents, data_deletion_requests, breach_incident_logs, cookie_consent_logs
- **Analytics:** crm_customer_360 (materialized), lifecycle_stage_history, analytics_events, abandoned_carts, internal_notifications

### 4.2 Key Table Definitions

#### CATALOG DOMAIN

```typescript
interface DrugProductExtension {
  // Drug identification
  generic_name:               string
  brand_name:                 string
  molecule_id:                string        // FK → molecules
  manufacturer:               string
  ndc_code:                   string        // CDSCO drug code
  hsn_code:                   string        // GST HSN code (e.g. 30049099)
  drug_class:                 string
  dosage_form:                string        // Tablet | Capsule | Syrup | Drops | etc.
  strength:                   string        // e.g. "500mg", "10mg/5ml"
  rxnorm_code:                string
  // Indian regulatory
  schedule_classification:    'OTC' | 'H' | 'H1' | 'X' | 'NDPS'
  ndps_scheduled:             boolean       // HARD BLOCK — no code path to override
  requires_prescription:      boolean
  // Indian pricing (mandatory display)
  mrp:                        number
  gst_rate:                   number        // 0 | 5 | 12 | 18
  // Warnings
  black_box_warning:          boolean
  black_box_text:             string
  // Storage (ambient only — no cold chain for Suprameds)
  storage_condition:          string        // e.g. "Store below 30°C in dry place"
  // Shipping restrictions
  no_international_ship:      boolean       // Auto-true for H/H1/X/NDPS
  // Ads & marketing
  google_ads_eligible:        boolean       // Auto-false for ALL Rx
  marketing_claims_reviewed:  boolean
  content_moderation_status:  'pending' | 'approved' | 'flagged'
  content_moderation_notes:   string
  regulatory_ref:             string        // CDSCO approval/registration number
  // Drug information (sourced from CDSCO DB + pharmacist review)
  drug_info_status:           'pending' | 'complete' | 'partial'
  indications:                string        // What it's used for
  dosage_info:                string        // Standard dosage guidance
  side_effects:               string        // Common side effects
  contraindications:          string        // When not to use
  drug_interactions_summary:  string        // Key interactions warning
  storage_instructions:       string        // Specific storage guidance
}

// TABLE: molecules
// Shared molecular entity across brand/generic for interaction checking
interface Molecule {
  id:           string
  name:         string        // INN (International Non-proprietary Name)
  drug_class:   string
}

// TABLE: substitution_mappings
// Pharmacist-approved generic ↔ brand substitutions
interface SubstitutionMapping {
  id:                     string
  original_variant_id:    string
  substitute_variant_id:  string
  equivalence_type:       'generic' | 'therapeutic' | 'brand'
  approved_by:            string        // FK → users (pharmacist_in_charge)
  is_active:              boolean
  notes:                  string
}

// TABLE: stock_alerts
// Customers notified when OOS product comes back in stock
interface StockAlert {
  id:             string
  customer_id:    string | null   // null for guest (use phone/email)
  guest_phone:    string | null
  guest_email:    string | null
  variant_id:     string
  notified:       boolean
  notified_at:    Date | null
  created_at:     Date
}

// TABLE: recently_viewed
// Per-customer Redis sorted set (variant_id, timestamp)
// Also stored in DB for logged-in customers (30-day history)
interface RecentlyViewed {
  id:           string
  customer_id:  string
  variant_id:   string
  viewed_at:    Date
}

// TABLE: family_profiles
interface FamilyProfile {
  id:             string
  customer_id:    string        // Account owner
  full_name:      string        // Encrypted (PHI)
  relationship:   'self' | 'spouse' | 'child' | 'parent' | 'other'
  dob:            Date          // Encrypted (PHI)
  gender:         string
  health_id:      string | null // ABHA ID (Ayushman Bharat Health Account)
  is_active:      boolean
}
```

#### PRESCRIPTION DOMAIN

```typescript
// TABLE: prescriptions
interface Prescription {
  id:                         string
  customer_id:                string
  family_member_id:           string | null // FK → family_profiles
  document_url:               string        // Encrypted S3 — signed URL (1h TTL)
  document_hash:              string        // SHA-256 for duplicate detection
  cross_platform_hash:        string        // hash(document_hash + prescriber_reg + date)
  prescriber_name:            string
  prescriber_registration_no: string        // MCI / State Medical Council reg no.
  hospital_name:              string
  hospital_address:           string
  prescription_date:          Date
  status:                     'pending' | 'under_review' | 'partially_approved' |
                              'fully_approved' | 'rejected' | 'expired'
  reviewed_by:                string | null
  reviewed_at:                Date | null
  valid_until:                Date          // H: 30 days | H1: 30 days | OTC Rx: 90 days
  is_duplicate_flagged:       boolean
  created_at:                 Date
  updated_at:                 Date
}

// TABLE: prescription_drug_lines
interface PrescriptionDrugLine {
  id:                   string
  prescription_id:      string
  line_number:          number
  drug_name_as_written: string        // Exactly as written by doctor
  mapped_variant_id:    string | null // Pharmacist maps this
  mapped_by:            string | null
  is_substitution:      boolean
  substitution_reason:  string | null
  original_variant_id:  string | null
  prescribed_quantity:  number
  prescribed_unit:      string
  dosage_instructions:  string
  duration_days:        number
  max_fills:            number        // 1 for H1
  fills_consumed:       number        // Computed from prescription_line_consumptions
  schedule_class:       'OTC' | 'H' | 'H1' | 'X' | 'NDPS'
  status:               'pending' | 'approved' | 'rejected' | 'substituted' | 'exhausted'
  created_at:           Date
  updated_at:           Date
}

// TABLE: dispense_decisions
// Pharmacist clinical decision per line — authorizes fulfillment
interface DispenseDecision {
  id:                           string
  prescription_drug_line_id:    string
  pharmacist_id:                string        // Must be pharmacist role — DB enforced
  decision:                     'approved' | 'rejected' | 'substituted' | 'quantity_modified'
  approved_variant_id:          string | null
  approved_quantity:            number
  dispensing_notes:             string | null
  rejection_reason:             'out_of_stock' | 'contraindication' | 'interaction_risk' |
                                'invalid_rx' | 'schedule_restriction' | 'other' | null
  h1_register_entry_id:         string | null  // Mandatory for Schedule H1
  decided_at:                   Date
  is_override:                  boolean
  override_reason:              string | null
}

// TABLE: prescription_line_consumptions
interface PrescriptionLineConsumption {
  id:                           string
  prescription_drug_line_id:    string
  order_item_id:                string
  dispense_decision_id:         string
  quantity_consumed:            number
  fill_number:                  number
  consumed_at:                  Date
}

// TABLE: pharmacist_adjustment_logs (IMMUTABLE)
interface PharmacistAdjustmentLog {
  id:               string
  order_item_id:    string
  pharmacist_id:    string
  adjustment_type:  'quantity_change' | 'substitution' | 'rejection' |
                    'schedule_override' | 'interaction_override' | 'pre_dispatch_approval'
  previous_value:   string    // JSON snapshot
  new_value:        string    // JSON snapshot
  reason:           string    // Mandatory, minimum 10 characters
  created_at:       Date
}

// TABLE: pharmacist_notes (PHI — encrypted at rest)
interface PharmacistNote {
  id:               string
  prescription_id:  string
  line_id:          string | null
  pharmacist_id:    string
  note_text:        string    // Encrypted
  created_at:       Date
}
```

#### ORDER DOMAIN

```typescript
// TABLE: orders
interface Order {
  id:                         string
  customer_id:                string | null  // null for guest orders
  guest_session_id:           string | null  // FK → guest_sessions
  email:                      string
  phone:                      string
  prescription_id:            string | null
  is_rx_order:                boolean
  is_guest_order:             boolean
  is_cs_placed:               boolean        // Order placed by CS agent on behalf of customer
  cs_agent_id:                string | null  // FK → users (support_agent)
  is_partial_approval:        boolean
  // Payment split for partial Rx orders
  payment_authorized_amount:  number
  payment_captured_amount:    number
  payment_released_amount:    number
  // COD specific
  is_cod:                     boolean
  cod_amount:                 number
  cod_confirmation_status:    'not_required' | 'pending' | 'confirmed' | 'auto_cancelled' | null
  cod_confirmed_at:           Date | null
  cod_confirmed_by:           string | null  // CS agent user_id
  cod_attempts:               number         // Call attempts for COD confirmation
  // Partial shipment
  partial_shipment_preference: 'all_or_nothing' | 'ship_available' | 'customer_choice'
  // Status
  status:                     OrderStatus
  cancellation_reason:        string | null
  created_at:                 Date
  updated_at:                 Date
}

type OrderStatus =
  'pending_cod_confirmation'  |  // COD order awaiting CS confirmation call
  'pending_rx_review'         |  // Rx order awaiting pharmacist review
  'partially_approved'        |  // Some lines approved, some rejected
  'fully_approved'            |  // All approved — ready for fulfillment
  'payment_captured'          |  // Payment captured for approved lines
  'allocation_pending'        |  // Awaiting FEFO batch allocation
  'pick_pending'              |  // Ready for warehouse picking
  'packing'                   |  // In packing stage
  'pending_dispatch_approval' |  // Rx order: awaiting pharmacist pre-dispatch sign-off
  'dispatched'                |  // Handed to carrier
  'delivered'                 |  // Confirmed delivered
  'partially_fulfilled'       |  // Split shipment: some shipped, some pending
  'cancelled'                 |
  'refunded'

// TABLE: order_items
interface OrderItem {
  id:                   string
  order_id:             string
  product_variant_id:   string
  dispense_decision_id: string | null // MANDATORY for Rx items — DB CHECK constraint
  quantity_ordered:     number
  quantity_approved:    number
  quantity_shipped:     number
  quantity_returned:    number
  unit_price:           number
  mrp:                  number
  gst_rate:             number
  hsn_code:             string
  cgst_amount:          number
  sgst_amount:          number
  igst_amount:          number
  line_total:           number
  status:               'pending' | 'approved' | 'rejected' | 'allocated' |
                        'picked' | 'packed' | 'pre_dispatch_approved' |
                        'shipped' | 'delivered' | 'returned'
  rejection_reason:     string | null
  is_rx_item:           boolean
  is_back_ordered:      boolean        // True if OOS, customer chose to wait
  back_order_eta:       Date | null
}

// TABLE: order_item_batch_allocations
// Split-batch FEFO allocation — one item can span multiple batches
interface OrderItemBatchAllocation {
  id:               string
  order_item_id:    string
  batch_id:         string
  quantity_allocated: number
  allocated_at:     Date
  allocated_by:     string        // 'system_fefo' or user_id for manual override
  override_reason:  string | null
  status:           'reserved' | 'picked' | 'deducted' | 'released' | 'recalled'
  released_at:      Date | null
}

// TABLE: order_state_history (IMMUTABLE)
interface OrderStateHistory {
  id:           string
  order_id:     string
  from_status:  string
  to_status:    string
  changed_by:   string          // user_id or 'system'
  reason:       string | null
  metadata:     object          // JSON snapshot at transition point
  changed_at:   Date
}

// TABLE: cs_placed_orders
// Audit record when CS agent places order on behalf of customer
interface CsPlacedOrder {
  id:               string
  order_id:         string
  agent_id:         string        // FK → users (support_agent)
  customer_id:      string | null
  customer_phone:   string
  channel:          'whatsapp' | 'phone' | 'email' | 'walk_in'
  payment_method:   'cod' | 'payment_link' | 'prepaid_existing'
  payment_link_id:  string | null // Razorpay payment link ID
  notes:            string | null
  created_at:       Date
}

// TABLE: guest_sessions
interface GuestSession {
  id:             string
  session_token:  string        // Stored in cookie
  phone:          string        // OTP-verified before Rx actions
  email:          string | null
  cart_id:        string | null
  created_at:     Date
  expires_at:     Date          // 7 days
  converted_to:   string | null // customer_id if guest created account
}

// TABLE: partial_shipment_preferences
// Stores customer's choice when system detects OOS items in order
interface PartialShipmentPreference {
  id:           string
  order_id:     string
  customer_id:  string
  choice:       'ship_available' | 'wait_for_all' | 'cancel_oos_item'
  oos_items:    string[]    // variant_ids that are OOS
  chosen_at:    Date
}
```

#### COD DOMAIN

```typescript
// TABLE: cod_orders
// Extended tracking for Cash on Delivery orders via India Post EZ Shipment
// NOTE: cod_remittances table deferred to Phase 2 — India Post remits monthly
//       Finance team manages remittance reconciliation outside platform for now
interface CodOrder {
  id:                     string
  order_id:               string
  cod_amount:             number
  surcharge_amount:       number        // COD fee shown transparently at checkout
  confirmation_required:  boolean       // True if order > ₹500
  confirmation_calls:     CodConfirmationCall[]
  // RTO tracking (no remittance tracking in Phase 1)
  status:                 'pending_confirmation' | 'confirmed' | 'dispatched' |
                          'delivered_collected' | 'rto' | 'cancelled'
}
```

#### INVENTORY DOMAIN

```typescript
// TABLE: inventory_batches
interface InventoryBatch {
  id:                   string
  variant_id:           string
  batch_number:         string
  // GS1 / CDSCO
  gtin:                 string
  gs1_serial_number:    string
  uic_code:             string        // CDSCO Unique Identification Code
  qr_code_data:         string        // GS1 AIs: (01)(10)(17)(21)(240)
  // Manufacturing
  manufacturer_name:    string
  manufacturer_license: string
  manufacture_date:     Date
  expiry_date:          Date
  // Quality
  qc_status:            'pending' | 'passed' | 'failed' | 'quarantine'
  qc_certificate_url:   string | null
  schedule_m_compliant: boolean
  // Location (ambient storage only)
  warehouse_id:         string
  zone_id:              string        // 'AMBIENT-MAIN' | 'QUARANTINE' | 'CONTROLLED'
  bin_id:               string | null // Set when bins are labeled in warehouse
  // Quantities (never update directly — only via stock_movements)
  quantity_available:   number
  quantity_reserved:    number
  quantity_deducted:    number
  quantity_returned:    number
  quantity_destroyed:   number
  // Status
  status:               'active' | 'quarantine' | 'recalled' | 'expired' | 'destroyed'
  // Recall
  recall_initiated_by:  string | null
  recall_reason:        string | null
  cdsco_recall_ref:     string | null
  recall_initiated_at:  Date | null
}

// TABLE: stock_movements (IMMUTABLE — no updates, no deletes)
interface StockMovement {
  id:               string
  batch_id:         string
  movement_type:    'grn_receipt' | 'qc_quarantine' | 'qc_release' |
                    'reservation' | 'reservation_release' |
                    'pick_deduction' | 'shipment_deduction' |
                    'return_receipt' | 'return_restock' |
                    'damage_write_off' | 'expiry_write_off' |
                    'recall_quarantine' | 'destruction' | 'audit_adjustment'
  quantity:         number        // Positive = in, Negative = out
  reference_type:   string        // 'order_item' | 'grn' | 'recall' | 'audit'
  reference_id:     string
  allocation_id:    string | null
  performed_by:     string        // user_id or 'system'
  notes:            string | null
  created_at:       Date          // IMMUTABLE
}
```

#### FULFILLMENT DOMAIN

```typescript
// TABLE: shipments
interface Shipment {
  id:                     string
  order_id:               string
  shipment_number:        string        // SHP-YYYY-XXXXXX (internal)
  // India Post specific
  carrier:                'india-post'  // Always India Post — no selection needed
  service_type:           'speed-post'  // Always Speed Post Pro
  awb_number:             string        // Speed Post article number — entered manually by staff
                                        // Format: EU/EE/CP + 8 digits + IN e.g. EU123456789IN
  aftership_tracking_id:  string | null // AfterShip tracking record ID (returned on registration)
  // Dispatch details
  warehouse_id:           string
  dispatched_at:          Date | null   // When staff entered AWB + marked dispatched
  dispatched_by:          string | null // FK → users (staff who entered AWB)
  // Delivery
  contains_rx_drug:       boolean       // Triggers OTP delivery requirement
  estimated_delivery:     Date          // From delivery_days_lookup table
  actual_delivery:        Date | null
  delivery_attempts:      number        // Max 3 before undelivered
  // OTP delivery (mandatory for Rx orders)
  delivery_otp:           string | null
  delivery_otp_verified:  boolean
  delivery_photo_url:     string | null
  delivered_to:           string | null
  // AfterShip normalized status
  status:                 ShipmentStatus
  last_location:          string | null // Last known scan location from India Post
  // NDR
  ndr_reason:             string | null
  ndr_action:             'reattempt' | 'rto' | null
  // COD
  is_cod:                 boolean
  cod_amount:             number
  cod_collected:          boolean
}

type ShipmentStatus =
  'label_created'         |  // AWB entered by staff, AfterShip registered
  'in_transit'            |  // India Post scanned at any sorting centre
  'out_for_delivery'      |  // At local post office / with postman
  'delivery_attempted'    |  // Postman tried, customer not available
  'delivered'             |  // Confirmed delivered
  'ndr'                   |  // Non-delivery report raised
  'rto_initiated'         |  // Being returned to Suprameds
  'rto_delivered'            // Returned parcel received at warehouse

// TABLE: delivery_days_lookup
// Simple lookup table for estimated delivery days by destination
// India Post delivers everywhere — this is for ETA display only
interface DeliveryDaysLookup {
  id:           string
  origin_state: string        // Your warehouse state (e.g. "Telangana")
  dest_state:   string        // Customer's state
  city_type:    'metro' | 'tier2' | 'tier3' | 'rural'
  min_days:     number        // e.g. 2
  max_days:     number        // e.g. 4
  display_text: string        // e.g. "2-4 business days"
}
// Populated once as seed data — never changes frequently
// Admin can update via /admin/settings/delivery-estimates

// TABLE: shipment_items (CDSCO batch traceability)
interface ShipmentItem {
  id:               string
  shipment_id:      string
  order_item_id:    string
  batch_id:         string       // Explicit batch proof — mandatory
  quantity_shipped: number
  batch_number:     string       // Denormalized for memo speed
  expiry_date:      Date         // Denormalized
}

// TABLE: delivery_otp_logs
interface DeliveryOtpLog {
  id:             string
  shipment_id:    string
  otp_code:       string        // Hashed — never stored plain
  sent_to_phone:  string        // Masked
  attempts:       number
  verified:       boolean
  verified_at:    Date | null
  failed_reason:  string | null
  created_at:     Date
}

// TABLE: pincode_serviceability_cache
// Cache Shiprocket serviceability results to reduce API calls
interface PincodeServiceabilityCache {
  id:                 string
  pincode:            string
  is_serviceable:     boolean
  available_carriers: string[]
  estimated_days:     number
  cached_at:          Date
  expires_at:         Date      // 24-hour TTL
}
```

#### FINANCE DOMAIN

```typescript
// TABLE: payments
interface Payment {
  id:                   string
  order_id:             string
  gateway:              'razorpay' | 'stripe' | 'cod'
  gateway_payment_id:   string | null   // null for COD
  payment_method:       'upi' | 'card' | 'netbanking' | 'emi' | 'cod' | 'payment_link'
  authorized_amount:    number
  captured_amount:      number
  released_amount:      number
  refunded_amount:      number
  status:               'authorized' | 'partially_captured' | 'fully_captured' |
                        'partially_refunded' | 'fully_refunded' | 'failed' | 'voided' | 'cod_pending'
  captured_at:          Date | null
  created_at:           Date
}

// TABLE: refunds (SSD enforced: support_agent raises, finance_admin approves)
interface Refund {
  id:               string
  payment_id:       string
  order_id:         string
  raised_by:        string        // FK → users (support_agent)
  approved_by:      string | null // FK → users (finance_admin)
  reason:           'rejected_rx_line' | 'cancelled_order' | 'return' |
                    'batch_recall' | 'payment_capture_error' | 'cod_non_delivery' | 'other'
  amount:           number
  status:           'pending_approval' | 'approved' | 'rejected' | 'processed'
  gateway_refund_id: string | null
  created_at:       Date
  processed_at:     Date | null
}

// TABLE: supply_memos (CDSCO mandatory — every drug supply)
interface SupplyMemo {
  memo_number:      string        // EPHM-YYYY-XXXXXX (sequential)
  order_id:         string
  shipment_id:      string | null // If partial shipment: one memo per shipment
  customer_name:    string
  customer_address: string
  prescription_ref: string | null
  pharmacist_name:  string
  pharmacist_reg:   string
  pharmacy_license: string
  items: {
    drug_name:      string
    batch_number:   string
    expiry_date:    Date
    quantity:       number
    mrp:            number
    selling_price:  number
    gst_rate:       number
    hsn_code:       string
    cgst_amount:    number
    sgst_amount:    number
    igst_amount:    number
    total:          number
  }[]
  total_mrp:        number
  total_discount:   number
  total_gst:        number
  total_payable:    number
  payment_mode:     string
  generated_at:     Date
}

// TABLE: h1_register_entries (CDSCO mandatory — every Schedule H1 dispense)
// Insert in SAME TRANSACTION as dispense_decision — if write fails, dispense rolls back
interface H1RegisterEntry {
  id:                     string
  entry_date:             Date
  patient_name:           string  // Encrypted PHI
  patient_address:        string  // Encrypted PHI
  patient_age:            number
  prescriber_name:        string
  prescriber_reg_no:      string
  drug_name:              string
  brand_name:             string
  batch_number:           string
  quantity_dispensed:     number
  dispensing_pharmacist:  string  // FK → users
  pharmacist_reg_no:      string
  order_item_id:          string
  dispense_decision_id:   string
  created_at:             Date
}
```

#### WAREHOUSE DOMAIN

```typescript
// TABLE: warehouses
interface Warehouse {
  id:               string
  name:             string        // "Suprameds Main Warehouse"
  code:             string        // "HYD-WH-01"
  address:          object
  drug_license_no:  string
  gst_registration: string
  manager_id:       string
  is_active:        boolean
}

// TABLE: warehouse_zones (ambient only — no cold chain)
interface WarehouseZone {
  id:           string
  warehouse_id: string
  zone_code:    string
  zone_type:    'ambient' | 'quarantine' | 'controlled_access' |
                'receiving' | 'dispatch' | 'returns'
  // controlled_access = Schedule H1 drugs (locked, dual-key access)
  access_level: 'open' | 'pharmacist_key' | 'dual_key'
}

// TABLE: warehouse_bins
interface WarehouseBin {
  id:             string
  zone_id:        string
  bin_code:       string        // ROW-A-SHELF-2-BIN-5
  bin_barcode:    string        // Printable label
  capacity_units: number
  current_units:  number
  is_active:      boolean
  last_audit_at:  Date
}

// TABLE: warehouse_tasks
interface WarehouseTask {
  id:               string
  task_type:        'receive' | 'inspect' | 'put_away' | 'pick' |
                    'pack' | 'pre_dispatch_check' | 'dispatch' |
                    'return_inspect' | 'cycle_count'
  reference_type:   string
  reference_id:     string
  assigned_to:      string | null
  warehouse_id:     string
  priority:         'low' | 'normal' | 'high' | 'urgent'
  status:           'pending' | 'assigned' | 'in_progress' | 'completed' | 'exception'
  started_at:       Date | null
  completed_at:     Date | null
  exception_notes:  string | null
  created_at:       Date
}

// TABLE: pick_list_lines
interface PickListLine {
  id:                 string
  task_id:            string
  order_item_id:      string
  allocation_id:      string
  batch_id:           string
  bin_id:             string
  quantity_to_pick:   number
  quantity_picked:    number
  status:             'pending' | 'picked' | 'short_pick' | 'exception'
  picked_by:          string | null
  picked_at:          Date | null
  exception_reason:   string | null
}

// TABLE: pre_dispatch_sign_offs
// Pharmacist verifies Rx orders before carrier booking
interface PreDispatchSignOff {
  id:                 string
  order_id:           string
  pharmacist_id:      string
  checks_performed:   {
    drug_name_correct:    boolean
    quantity_correct:     boolean
    batch_matches:        boolean
    expiry_adequate:      boolean  // ≥ 30 days remaining
    package_sealed:       boolean
    packing_slip_attached: boolean
  }
  approved:           boolean
  rejection_reason:   string | null
  signed_off_at:      Date
}

// TABLE: grn_records (Goods Receipt Note — CDSCO 5-year retention)
interface GrnRecord {
  id:               string
  grn_number:       string        // GRN-YYYY-XXXXXX
  supplier_id:      string
  supplier_invoice_no: string
  received_by:      string        // FK → warehouse staff
  qc_approved_by:   string | null // FK → qc_staff — SSD: different from received_by
  received_at:      Date
  qc_approved_at:   Date | null
  items: {
    variant_id:     string
    batch_number:   string
    expiry_date:    Date
    qty_received:   number
    mrp:            number
    purchase_price: number
    qc_result:      'passed' | 'failed' | 'quarantine'
    qc_notes:       string
  }[]
  status:           'pending_qc' | 'approved' | 'partially_rejected' | 'rejected'
}

// TABLE: returns_inspections
interface ReturnsInspection {
  id:               string
  order_item_id:    string
  batch_id:         string
  return_reason:    'wrong_product' | 'damaged' | 'recalled' | 'near_expiry' | 'other'
  result:           'saleable' | 'damaged' | 'opened' | 'near_expiry' | 'recalled' | 'doubtful'
  action_taken:     'restocked' | 'quarantined' | 'destroyed'
  approved_by:      string        // Pharmacist for Rx, warehouse_manager for OTC
  evidence_urls:    string[]
  inspected_at:     Date
}
```

#### COMPLIANCE DOMAIN

```typescript
// TABLE: phi_audit_log (IMMUTABLE — partitioned monthly)
interface PhiAuditLog {
  id:             string
  user_id:        string
  role:           string
  action:         'read' | 'write' | 'update' | 'export' | 'print'
  entity_type:    string
  entity_id:      string
  ip_address:     string
  user_agent:     string
  access_granted: boolean
  timestamp:      Date
}

// TABLE: override_requests
interface OverrideRequest {
  id:                       string
  override_type:            string        // From override type registry
  target_entity_type:       string
  target_entity_id:         string
  requested_by:             string
  requested_by_role:        string
  requested_at:             Date
  justification:            string        // Minimum 50 characters — enforced
  patient_impact:           string | null
  risk_assessment:          string
  supporting_doc_url:       string | null
  requires_dual_auth:       boolean
  primary_approver_id:      string | null
  primary_approved_at:      Date | null
  secondary_approver_id:    string | null
  secondary_approved_at:    Date | null
  status:                   'pending_primary' | 'pending_secondary' |
                            'approved' | 'rejected' | 'expired' | 'used'
  valid_for_hours:          number
  expires_at:               Date
  used_at:                  Date | null
  notified_cdsco:           boolean
  created_at:               Date
}

// TABLE: dpdp_consents
interface DpdpConsent {
  id:                   string
  customer_id:          string | null  // null for pre-login consent
  session_id:           string | null
  category:             'essential' | 'functional' | 'analytics' | 'marketing'
  consented:            boolean
  consent_given_at:     Date
  withdrawn_at:         Date | null
  ip_address:           string
  user_agent:           string
  privacy_policy_version: string
}

// TABLE: internal_notifications
// In-app notifications for admin/pharmacist/warehouse staff
interface InternalNotification {
  id:             string
  user_id:        string
  role_scope:     string | null  // If sent to all users of a role
  type:           'rx_pending' | 'rx_sla_breach' | 'stock_low' | 'batch_expiry' |
                  'cod_confirmation_due' | 'grievance_sla' | 'license_expiry' |
                  'compliance_failure' | 'dispatch_pending' | 'pre_dispatch_due'
  title:          string
  body:           string
  reference_type: string | null
  reference_id:   string | null
  read:           boolean
  read_at:        Date | null
  created_at:     Date
}
```

#### CRM & NOTIFICATIONS DOMAIN

```typescript
// TABLE: notification_templates + DLT registry
interface NotificationTemplate {
  id:               string
  template_code:    string        // e.g. 'T01_OTP', 'W03_DISPATCH'
  channel:          'sms' | 'whatsapp' | 'email'
  trigger_event:    string        // e.g. 'order.confirmed'
  dlt_template_id:  string | null // TRAI DLT ID — required for all SMS
  dlt_registered:   boolean
  dlt_registered_at: Date | null
  sender_id:        string | null // MSG91 sender ID
  template_text:    string        // With {#var#} placeholders
  variables:        string[]      // Variable names in template
  is_active:        boolean
  is_rx_allowed:    boolean       // false for all promotional templates
  updated_at:       Date
}

// TABLE: chronic_reorder_patterns
// Detected recurring purchase patterns for reorder reminders
interface ChronicReorderPattern {
  id:                 string
  customer_id:        string
  variant_id:         string
  average_days_between_orders: number  // Computed from order history
  last_purchased_at:  Date
  next_expected_at:   Date         // last_purchased_at + avg_days
  reminder_sent_at:   Date | null
  confidence_score:   number       // 0-100, based on consistency of pattern
  is_active:          boolean
  detected_at:        Date
}
```

### 4.3 Hard Database Constraints

```sql
-- No Rx order_item without pharmacist authorization
ALTER TABLE order_items
  ADD CONSTRAINT rx_item_requires_decision
  CHECK (is_rx_item = false OR dispense_decision_id IS NOT NULL);

-- No batch deduction without allocation record
ALTER TABLE stock_movements
  ADD CONSTRAINT deduction_requires_allocation
  CHECK (movement_type NOT IN ('pick_deduction','shipment_deduction')
         OR allocation_id IS NOT NULL);

-- No shipment_item without batch
ALTER TABLE shipment_items
  ADD CONSTRAINT shipment_item_requires_batch
  CHECK (batch_id IS NOT NULL);

-- COD surcharge must be transparent (never zero for COD orders)
ALTER TABLE cod_orders
  ADD CONSTRAINT cod_surcharge_required
  CHECK (surcharge_amount > 0);

-- No recall closure without CDSCO report
ALTER TABLE batch_recall_logs
  ADD CONSTRAINT recall_closure_requires_report
  CHECK (status != 'closed' OR cdsco_report_url IS NOT NULL);

-- Override justification minimum length
ALTER TABLE override_requests
  ADD CONSTRAINT justification_minimum_length
  CHECK (LENGTH(justification) >= 50);
```

### 4.4 Critical Indexes

```sql
-- FEFO query (most performance-critical index in the system)
CREATE INDEX idx_inventory_batches_fefo
  ON inventory_batches(variant_id, expiry_date ASC, status)
  WHERE status = 'active' AND qc_status = 'passed';

-- Prescription queue for pharmacist
CREATE INDEX idx_prescriptions_status_created
  ON prescriptions(status, created_at ASC)
  WHERE status IN ('pending', 'under_review');

-- PHI audit log queries for CDSCO inspection
CREATE INDEX idx_phi_audit_entity
  ON phi_audit_log(entity_type, entity_id, timestamp DESC);

-- Stock movements per batch (for batch ledger view)
CREATE INDEX idx_stock_movements_batch
  ON stock_movements(batch_id, created_at DESC);

-- COD orders awaiting confirmation
CREATE INDEX idx_cod_orders_pending
  ON cod_orders(status, created_at ASC)
  WHERE status = 'pending_confirmation';

-- Chronic reorder patterns (reorder reminder job)
CREATE INDEX idx_chronic_reorder_next_expected
  ON chronic_reorder_patterns(next_expected_at ASC, reminder_sent_at)
  WHERE is_active = true;

-- Recently viewed per customer
CREATE INDEX idx_recently_viewed_customer
  ON recently_viewed(customer_id, viewed_at DESC);

-- Pincode serviceability cache
CREATE INDEX idx_pincode_cache
  ON pincode_serviceability_cache(pincode, expires_at)
  WHERE expires_at > NOW();
```

---

## PART 5 — MODULE ARCHITECTURE

Architecture: Modular Monolith. Modules own their entities, services, routes, admin widgets, and workflows. Cross-module communication via domain events only — never direct service imports between modules.

### 5.1 Module Boundaries

| Module | Primary Responsibility | Cannot Own |
|---|---|---|
| `auth` | JWT, sessions, TOTP, FIDO2, OTP login, guest sessions | Clinical validation |
| `customers` | Profiles, family profiles, DPDP consents, preferences | Orders, prescriptions |
| `products` | Drug catalog, variants, molecules, substitutions, drug info | Stock levels |
| `prescriptions` | Rx upload, drug line extraction, validation, expiry | Payment, allocation |
| `dispense` | Per-line pharmacist decisions, H1 register, pre-dispatch sign-off | Physical stock |
| `orders` | Order header, state machine, partial approval, COD flow, CS ordering | Clinical validation |
| `inventory` | Batch ledger, FEFO reservation, stock_movements, back-order | Payment |
| `warehouse` | Bins, GRN, tasks, pick-pack-dispatch, returns inspection | Clinical substitution |
| `shipments` | AWB, tracking, OTP delivery, NDR, pincode check | Order approval |
| `payments` | Razorpay/Stripe/COD, auth/capture split, remittance reconciliation | Prescription review |
| `compliance` | Audit exports, H1 register, recall reports, inspection packs | Cart/checkout |
| `crm` | Customer 360, lifecycle, churn, abandoned cart (OTC only), reorder patterns | PHI data |
| `analytics` | KPI dashboards, funnels, GST reports, COD reconciliation | Clinical operations |
| `loyalty` | Points, tiers, referrals (OTC only — hard blocked for Rx) | Drug operations |
| `notifications` | SMS DLT, WhatsApp, email, in-app, preference enforcement | Business logic |
| `cod` | COD confirmation calls, remittance tracking, RTO management | Fulfillment |
| `override-engine` | Override requests, dual auth, audit, post-use reviews | Domain operations |
| `rbac` | Role definitions, permissions, SSD validation | Everything else |

### 5.2 Complete Module Folder Structure

```
src/
├── modules/
│   ├── auth/
│   │   ├── service.ts
│   │   ├── routes/
│   │   └── workflows/
│   │       ├── otp-login.ts           // Phone OTP primary login
│   │       ├── guest-session.ts       // Guest cart + OTP verification
│   │       ├── guest-to-account.ts    // Convert guest to full account (cart merge)
│   │       └── mfa-verify.ts
│   ├── customers/
│   │   ├── entities/
│   │   │   ├── customer-profile.entity.ts
│   │   │   └── family-profile.entity.ts
│   │   └── service.ts
│   ├── products/
│   │   ├── entities/
│   │   │   ├── drug-product.entity.ts
│   │   │   ├── molecule.entity.ts
│   │   │   ├── substitution-mapping.entity.ts
│   │   │   ├── stock-alert.entity.ts
│   │   │   └── recently-viewed.entity.ts
│   │   ├── service.ts
│   │   ├── drug-info.service.ts       // CDSCO + OpenFDA data management
│   │   ├── oos-manager.service.ts     // OOS detection, alerts, substitutions
│   │   └── admin/
│   ├── prescriptions/
│   │   ├── entities/
│   │   │   ├── prescription.entity.ts
│   │   │   ├── prescription-drug-line.entity.ts
│   │   │   ├── prescription-line-consumption.entity.ts
│   │   │   └── pharmacist-note.entity.ts
│   │   ├── service.ts
│   │   └── workflows/
│   │       ├── upload-and-queue.ts
│   │       ├── extract-drug-lines.ts
│   │       ├── validate-expiry.ts
│   │       └── check-duplicate-hash.ts
│   ├── dispense/
│   │   ├── entities/
│   │   │   ├── dispense-decision.entity.ts
│   │   │   ├── pharmacist-adjustment-log.entity.ts
│   │   │   ├── h1-register-entry.entity.ts
│   │   │   └── pre-dispatch-sign-off.entity.ts
│   │   ├── service.ts
│   │   └── workflows/
│   │       ├── make-decision.ts
│   │       ├── partial-approval.ts
│   │       ├── h1-register-write.ts   // Transactional with dispense decision
│   │       └── pre-dispatch-check.ts  // Pharmacist sign-off before Rx dispatch
│   ├── orders/
│   │   ├── entities/
│   │   │   ├── order.entity.ts
│   │   │   ├── order-item.entity.ts
│   │   │   ├── order-item-batch-allocation.entity.ts
│   │   │   ├── order-state-history.entity.ts
│   │   │   ├── cs-placed-order.entity.ts
│   │   │   ├── guest-session.entity.ts
│   │   │   └── partial-shipment-preference.entity.ts
│   │   ├── service.ts
│   │   └── workflows/
│   │       ├── create-guest-order.ts
│   │       ├── create-rx-order.ts
│   │       ├── apply-partial-approvals.ts
│   │       ├── recalculate-order-totals.ts
│   │       ├── order-state-machine.ts
│   │       ├── cs-place-order.ts       // CS agent places order on customer's behalf
│   │       └── partial-shipment.ts     // Split fulfillment logic
│   ├── cod/
│   │   ├── entities/
│   │   │   └── cod-order.entity.ts         // cod_remittance removed — Phase 2
│   │   ├── service.ts
│   │   ├── confirmation-call.service.ts    // CS team COD confirmation workflow
│   │   └── rto-manager.service.ts          // COD RTO tracking + customer scoring
│   │   // NOTE: remittance-reconcile.service.ts deferred to Phase 2
│   ├── inventory/
│   │   ├── entities/
│   │   │   ├── inventory-batch.entity.ts
│   │   │   └── stock-movement.entity.ts
│   │   ├── service.ts
│   │   └── workflows/
│   │       ├── fefo-allocate.ts
│   │       ├── release-reserved.ts
│   │       ├── confirm-deduction.ts
│   │       └── reorder-trigger.ts
│   ├── warehouse/
│   │   ├── entities/
│   │   │   ├── warehouse.entity.ts
│   │   │   ├── warehouse-zone.entity.ts
│   │   │   ├── warehouse-bin.entity.ts
│   │   │   ├── warehouse-task.entity.ts
│   │   │   ├── pick-list-line.entity.ts
│   │   │   ├── grn-record.entity.ts
│   │   │   ├── purchase-order.entity.ts
│   │   │   ├── supplier.entity.ts
│   │   │   └── returns-inspection.entity.ts
│   │   ├── service.ts
│   │   └── workflows/
│   │       ├── receive-grn.ts
│   │       ├── qc-approve.ts
│   │       ├── put-away.ts
│   │       ├── generate-pick-list.ts
│   │       ├── confirm-pick.ts
│   │       ├── pack-order.ts
│   │       └── dispatch.ts
│   ├── shipments/
│   │   ├── entities/
│   │   │   ├── shipment.entity.ts
│   │   │   ├── shipment-item.entity.ts
│   │   │   ├── delivery-otp-log.entity.ts
│   │   │   └── delivery-days-lookup.ts    // State-wise EDD table (no API needed)
│   │   ├── service.ts
│   │   ├── aftership.adapter.ts           // ONLY carrier adapter needed
│   │   ├── awb-entry.service.ts           // Manual AWB entry by staff after India Post handover
│   │   ├── delivery-estimate.service.ts   // Lookup table: pincode/state → estimated days
│   │   ├── otp-delivery.service.ts        // OTP delivery for Rx orders
│   │   ├── ndr-manager.service.ts         // Handles failed delivery attempts
│   │   └── webhooks/
│   │       └── aftership.webhook.ts       // AfterShip pushes tracking updates here
│   ├── payments/
│   │   ├── entities/
│   │   │   ├── payment.entity.ts
│   │   │   └── refund.entity.ts
│   │   ├── service.ts
│   │   ├── providers/
│   │   │   ├── razorpay.provider.ts   // UPI/Cards/NetBanking/EMI + payment links
│   │   │   └── stripe.provider.ts
│   │   └── workflows/
│   │       ├── authorize-full.ts
│   │       ├── capture-approved.ts
│   │       ├── release-rejected.ts
│   │       └── generate-payment-link.ts  // For CS team WhatsApp payment links
│   ├── compliance/
│   │   ├── entities/
│   │   │   ├── pharmacy-license.entity.ts
│   │   │   ├── compliance-record.entity.ts
│   │   │   ├── phi-audit-log.entity.ts
│   │   │   ├── batch-recall-log.entity.ts
│   │   │   └── override-request.entity.ts
│   │   ├── service.ts
│   │   ├── checklist.service.ts      // 20-item automated compliance check
│   │   └── reports/
│   │       ├── h1-register-export.ts
│   │       ├── recall-report.ts
│   │       ├── cdsco-inspection-pack.ts
│   │       └── gstr1-export.ts
│   ├── crm/
│   │   ├── customer-360.service.ts
│   │   ├── lifecycle-stage.job.ts
│   │   ├── churn-score.job.ts
│   │   ├── abandoned-cart.subscriber.ts  // OTC only — Rx NEVER
│   │   ├── chronic-reorder.service.ts    // Pattern detection + reminder triggers
│   │   └── winback.workflow.ts
│   ├── analytics/
│   │   ├── kpi-dashboard.service.ts
│   │   ├── funnel.service.ts
│   │   ├── inventory-analytics.service.ts
│   │   ├── cohort.service.ts
│   │   ├── cod-analytics.service.ts
│   │   └── gst-report.service.ts
│   ├── loyalty/
│   │   ├── points-ledger.service.ts
│   │   ├── tier-engine.service.ts
│   │   ├── referral.service.ts
│   │   └── points-expiry.job.ts
│   ├── reviews/
│   │   ├── review.service.ts
│   │   ├── review-moderation.service.ts
│   │   └── qna.service.ts
│   ├── notifications/
│   │   ├── sms.service.ts              // MSG91 + DLT template enforcement
│   │   ├── whatsapp.service.ts         // Twilio/Gupshup WABA
│   │   ├── email.service.ts            // SendGrid
│   │   ├── in-app.service.ts           // Redis pub/sub → admin bell icon
│   │   ├── preference-enforcer.ts      // Checks opt-in before every send
│   │   └── dlt-template-registry.ts   // All DLT IDs + template management
│   ├── content-moderation/
│   │   ├── lint.service.ts
│   │   └── moderation-queue.service.ts
│   ├── legitscript-compliance/
│   │   ├── checklist.service.ts
│   │   └── seal.service.ts
│   ├── google-ads-feed/
│   │   ├── feed-generator.service.ts
│   │   └── price-sync-audit.job.ts
│   ├── dpdp-compliance/
│   │   ├── consent.service.ts
│   │   ├── deletion-request.service.ts
│   │   └── breach-notification.service.ts
│   ├── grievance/
│   │   └── grievance.service.ts
│   └── rbac/
│       ├── entities/
│       │   ├── role.entity.ts
│       │   ├── permission.entity.ts
│       │   ├── user-role.entity.ts
│       │   └── role-audit-log.entity.ts
│       ├── rbac.service.ts
│       ├── ssd-validator.service.ts
│       └── seeds/
│           └── roles-permissions.seed.ts
│
├── middleware/
│   ├── authenticate.middleware.ts
│   ├── authorize.middleware.ts
│   ├── mfa-verified.middleware.ts
│   ├── phi-access.middleware.ts
│   ├── ssd-check.middleware.ts
│   ├── session-expiry.middleware.ts
│   ├── rx-gate.middleware.ts
│   ├── schedule-x-block.middleware.ts
│   └── rate-limit.middleware.ts
│
├── workflows/
│   ├── verify-prescription.ts
│   ├── process-rx-checkout.ts
│   ├── process-otc-checkout.ts
│   ├── process-cod-order.ts
│   ├── generate-supply-memo.ts
│   ├── recall-batch.ts
│   └── partial-shipment-decision.ts
│
└── jobs/
    ├── license-expiry-check.ts
    ├── batch-expiry-alert.ts           // 90/60/30 day alerts
    ├── expiry-auto-quarantine.ts
    ├── refill-reminders.ts
    ├── chronic-reorder-reminders.ts    // Pattern-based monthly reminders
    ├── google-feed-sync.ts
    ├── price-sync-audit.ts
    ├── phi-retention-audit.ts
    ├── lifecycle-stage-compute.ts
    ├── churn-score-compute.ts
    ├── loyalty-points-expiry.ts
    ├── pincode-cache-refresh.ts
    ├── cod-remittance-reconcile.ts     // Weekly COD reconciliation
    ├── stock-alert-notify.ts           // Notify customers when OOS restocked
    └── analytics-materialized-views.ts // pg_cron every 15 minutes
```

---

## PART 6 — COD MODULE (CRITICAL FOR INDIA)

COD represents 60-70% of ecommerce orders in India.
Rx drugs: COD NOT available (payment must be confirmed before pharmacist dispenses).
OTC drugs: COD available with ₹40-60 surcharge, shown transparently before payment.

### 6.1 COD Order Flow

```
Customer selects COD at checkout
  → COD surcharge added as line item (₹49 — configurable in admin)
  → Order created with status: 'pending_cod_confirmation'
  → If order value > ₹500: CS team receives in-app notification
    → CS agent calls customer within 2 hours to confirm
    → Outcomes: confirmed / no_answer (retry) / declined (auto-cancel)
    → After 2 failed attempts: order auto-cancelled, in-app alert to admin
  → If order value ≤ ₹500: auto-confirmed (skip confirmation call)
  → On confirmation: status → 'fully_approved' → normal fulfillment
```

### 6.2 COD Customer Scoring (Fraud + RTO Prevention)

```typescript
interface CodCustomerScore {
  customer_id:          string
  total_cod_orders:     number
  cod_rto_count:        number
  cod_rto_rate:         number      // rto_count / total_cod_orders
  consecutive_rtos:     number      // RTOs in last N orders
  cod_eligible:         boolean     // false after 2+ consecutive RTOs
  cod_limit:            number      // Max order value for COD (reduce after 1 RTO)
  last_evaluated_at:    Date
}

// Rules:
// 1 RTO → COD limit reduced to ₹500 max
// 2 consecutive RTOs → COD disabled, show prepaid incentive
// Customer can appeal via CS WhatsApp — CS agent can manually re-enable
// New customers (first order) → COD available up to ₹1000
```

### 6.3 COD Prepaid Conversion Nudge

At checkout when customer selects COD:
- Show: "Pay online via UPI and save ₹49 COD charges + get priority dispatch"
- Show: "Razorpay-secured payment — UPI, Cards, NetBanking accepted"
- If customer has previously had a COD RTO: more prominent nudge
- Goal: convert meaningful % of COD to prepaid — track conversion rate in analytics

### 6.4 COD Remittance Reconciliation

```
Weekly job (Monday morning):
  1. Fetch all COD orders with status 'delivered_collected' from last week
  2. Calculate expected_remittance = sum of COD amounts
  3. Finance admin enters actual_remittance from carrier bank transfer
  4. System calculates variance
  5. If variance > ₹0: flag for finance_admin review
  6. Generate weekly COD reconciliation report
  7. Match to Delhivery/Shiprocket remittance statements
```

---

## PART 7 — GUEST CHECKOUT & OTP LOGIN

### 7.1 Guest Checkout Flow

```
New customer visits → No registration required
  → Adds items to cart (stored in Redis: cart:{session_token}, TTL 7 days)
  → Goes to checkout → enters phone number
  → OTP sent via SMS → verified (confirms real customer)
  → Enters email (optional for OTC, required for Rx)
  → Enters delivery address
  → Pays (Razorpay for prepaid, COD if eligible)
  → Order placed under guest_session

Post-order:
  → "Create an account to track this order and reorder easily"
  → If customer creates account: guest order merged into new account
  → Cart from Redis merged into DB cart

For Rx items in guest checkout:
  → Phone OTP verification mandatory before Rx upload allowed
  → Prescription upload flow same as registered customer
  → Guest Rx prescriptions linked to guest_session_id
  → On account creation: Rx linked to new customer_id
```

### 7.2 OTP Login Flow (Primary for India)

```
Login page → Enter phone number → OTP sent (MSG91, DLT template T01)
  → OTP valid 5 minutes, max 3 resends/hour
  → On verify: JWT issued with customer_id + role claims
  → Existing guest cart: merged into account cart
  → If no account exists: soft registration prompt
    (name + email optional, account created with phone only)

Email + password login: Secondary option (for desktop preference)
Google OAuth: Available for OTC-only shoppers
Pharmacist/admin: Email + password + mandatory TOTP 2FA only
```

---

## PART 8 — DELIVERY ESTIMATE (India Post Speed Post)

India Post delivers to every pincode in India — no serviceability blocking needed.
Show estimated delivery date using a lookup table — zero external API calls.

### 8.1 Delivery Estimate at Checkout

```
Customer enters delivery address
  → Extract state from pincode using free India pincode dataset
    (stored in delivery_days_lookup table — loaded once as seed data)
  → Look up: origin_state (Telangana) → dest_state → estimated days
  → Add 1 day if current time > 2 PM (missed pickup cutoff)
  → Add 1 day buffer if Rx order pending pharmacist review
  → Show: "Expected Monday, 17 March" (specific date — never a vague range)
  → Zero external API calls — pure lookup table — 0ms response time

Lookup table seed data (delivery_days_lookup):
  Telangana → Telangana:       1–2 days
  Telangana → AP/Karnataka:    2–3 days
  Telangana → Tamil Nadu:      3–4 days
  Telangana → Maharashtra:     3–5 days
  Telangana → North India:     4–6 days
  Telangana → Northeast/J&K:   6–10 days
  Default (any other):         5–8 days

Admin can update estimates at /admin/settings/delivery-estimates
```

### 8.2 AfterShip ETA Override

```
Once AWB is entered by staff and AfterShip registers the tracking:
  AfterShip provides its own EDD based on actual carrier scan data
  Override the initial estimate with AfterShip EDD
  Update shipment.estimated_delivery + notify customer if date changed significantly
```

---

## PART 9 — NOTIFICATION TEMPLATE LIBRARY

All SMS templates must be DLT-registered with TRAI via MSG91 before go-live.
DLT registration takes 3-7 working days. Register templates before development starts.

### 9.1 SMS Templates (Transactional — DLT Category: Transactional)

```
T01_OTP:
  "Your Suprameds OTP is {#var#}. Valid for 5 minutes. Do not share. -Suprameds"
  DLT Category: Transactional (fast approval)

T02_ORDER_CONFIRMED:
  "Order #{#var#} confirmed at Suprameds. Total: Rs.{#var#}. Track: {#var#} -Suprameds"

T03_COD_CONFIRMATION:
  "Confirm your Suprameds COD order #{#var#} of Rs.{#var#}? Reply YES to confirm or call {#var#} -Suprameds"

T04_RX_RECEIVED:
  "Prescription received for Order #{#var#}. Our pharmacist will review within 4 hours. -Suprameds"

T05_RX_APPROVED:
  "Your prescription is approved. Order #{#var#} is being processed. -Suprameds"

T06_RX_REJECTED:
  "Prescription for Order #{#var#} could not be verified. Reason: {#var#}. Call {#var#} -Suprameds"

T07_ORDER_DISPATCHED:
  "Order #{#var#} dispatched via {#var#}. AWB: {#var#}. Track: suprameds.in/track/{#var#} -Suprameds"

T08_OUT_FOR_DELIVERY:
  "Your Suprameds order #{#var#} is out for delivery today. {#var#} -Suprameds"

T09_DELIVERED:
  "Order #{#var#} delivered. Questions? WhatsApp: {#var#} or call {#var#} -Suprameds"

T10_RX_OTP_DELIVERY:
  "OTP {#var#} required for delivery of your Suprameds Rx order #{#var#}. Share only with delivery agent. -Suprameds"

T11_STOCK_ALERT:
  "{#var#} is back in stock at Suprameds. Order now: suprameds.in -Suprameds"

T12_LICENSE_EXPIRY_INTERNAL:
  "ALERT: Pharmacy license {#var#} expires on {#var#}. Renew immediately. -Suprameds System"
  (Internal use — sent to compliance_officer only)
```

### 9.2 WhatsApp Templates (Require WABA Approval — Submit Before Go-Live)

```
W01_ORDER_CONFIRMED: Rich order confirmation with item list, total, expected delivery
W02_RX_STATUS: Prescription status update with approve/reject detail per line
W03_DISPATCH: Dispatch notification with carrier name, AWB, and "Track Order" button
W04_DELIVERY_ATTEMPT: Delivery attempt notification with reattempt scheduling option
W05_REFILL_REMINDER: Monthly refill reminder with "Reorder Now" quick action button
W06_RX_EXPIRY_WARNING: Prescription expiry warning with telemedicine consultation link
W07_PARTIAL_APPROVAL: Lists approved vs rejected Rx lines with reasons
W08_COD_CONFIRMATION: COD confirmation request with "Confirm" / "Cancel" buttons
W09_PAYMENT_LINK: CS-generated payment link message with amount and expiry
W10_GRIEVANCE_UPDATE: Ticket status update with resolution details
```

### 9.3 Email Templates (SendGrid)

```
E01: Order confirmation with full GST invoice + memo download link
E02: Prescription received — what happens next (timeline explainer)
E03: Rx approved — proceed to checkout CTA
E04: Rx rejected — reason + what to do next
E05: Order dispatched — tracking details
E06: Order delivered — review CTA (OTC only — never Rx)
E07: Welcome new account — getting started guide
E08: Password reset
E09: Refund processed — amount + timeline
E10: Low stock alert (for wishlisted OTC items)
E11: Loyalty tier upgrade notification
E12: Monthly account statement (for B2B accounts)
```

---

## PART 10 — OUT OF STOCK HANDLING

### 10.1 OOS Product Page

```
When variant.quantity_available = 0:
  - "Out of Stock" badge replaces Add to Cart
  - "Notify me when available" button → captures phone/email → stock_alert record
  - "Similar Medicines" section:
    → Shows substitution_mappings alternatives (pharmacist-approved only)
    → Label: "Pharmacist-approved alternative"
    → NEVER auto-recommend — only show if substitution_mapping exists
  - "We don't stock this?" link → creates stock_request for admin
```

### 10.2 OOS Detection During Order

```
If stock runs out AFTER order placed but BEFORE picking:
  1. Warehouse confirms 'short_pick' during picking task
  2. Customer notified via WhatsApp + SMS immediately
  3. Customer options presented:
     a) "Ship rest of order now, cancel OOS item" → partial shipment
     b) "Wait for restock (estimated N days)" → back-order
     c) "Cancel entire order" → full refund
  4. Payment adjusted based on choice
  5. OOS item removed from CDSCO memo if shipped without it
```

### 10.3 Back-Order Flow

```
For temporarily OOS items with known restock ETA:
  - Product page shows: "Back-order — ships in 3-5 days" with estimated date
  - Customer can place order normally
  - Payment captured immediately for prepaid, COD confirmed
  - Order held in 'allocation_pending' until stock arrives
  - PO auto-created if item below reorder point
  - Customer notified when item arrives and dispatched
  - 7-day back-order maximum — cancel and refund if stock not received in 7 days
```

---

## PART 11 — IN-APP NOTIFICATIONS (Admin + Pharmacist + Warehouse)

Real-time via Redis pub/sub. Bell icon in admin header. Fallback: email digest every hour.

### 11.1 Notification Rules by Role

```
PHARMACIST / PIC:
  🔔 New Rx uploaded — requires review (with link to Rx workspace)
  🔔 Rx pending > 4 hours — SLA warning
  🔔 Rx pending > 8 hours — SLA breach
  🔔 Drug interaction detected in cart — review flagged
  🔔 Pre-dispatch sign-off required for order #{X}
  🔔 Schedule H1 dispense pending H1 register completion
  🔔 Override request awaiting your approval

WAREHOUSE_MANAGER / WAREHOUSE_STAFF:
  🔔 New pick list ready — N orders pending picking
  🔔 Batch expiring in 30 days — {drug} {batch}
  🔔 Stock below reorder point — {drug} current:{qty} reorder:{qty}
  🔔 GRN received — pending QC inspection
  🔔 Short pick exception — {order} needs reallocation
  🔔 Returns inspection pending — {N} items in returns queue

SUPPORT_AGENT / SUPPORT_SUPERVISOR:
  🔔 COD order requires confirmation call — {order} value ₹{X}
  🔔 COD confirmation — 2nd attempt failed, action needed
  🔔 Grievance SLA breach — ticket #{X} open > 36 hours
  🔔 New grievance ticket assigned to you

ADMIN / PLATFORM_ADMIN:
  🔔 Low stock — {N} products below 7-day supply
  🔔 COD RTO spike — carrier RTO rate > 30% this week
  🔔 Compliance checklist failure — {item} failing
  🔔 Override requested — requires your approval

COMPLIANCE_OFFICER:
  🔔 License expiring in 30 days — {license type} {number}
  🔔 License expiring in 7 days — URGENT
  🔔 Post-use review overdue — override #{X}
  🔔 Override CDSCO notification pending — {override type}
```

---

## PART 12 — DRUG INFORMATION DATA STRATEGY

### 12.1 Data Sources (Priority Order)

```
Source 1: CDSCO Drug Database (authoritative for India)
  URL: cdscoonline.gov.in
  Data: drug registration numbers, approved indications, schedule classification
  Import: one-time bulk import via migration script + weekly delta sync
  Use for: regulatory classification, CDSCO approval number

Source 2: OpenFDA Drug Label API (free, covers many Indian drugs)
  GET https://api.fda.gov/drug/label.json?search=brand_name:"{drug}"
  Data: indications, warnings, dosage, storage, side effects
  Use for: initial population of drug_information fields

Source 3: Pharmacist review (mandatory before publish for Rx drugs)
  Pharmacist reviews and edits all drug info before:
    - Any Rx drug goes live on storefront
    - Any drug gets content_moderation_status = 'approved'
  Priority order:
    Week 1: Top 50 products by your order volume (these ship first day)
    Ongoing: 10 products/day until catalog complete

Source 4: Placeholder for incomplete products
  drug_info_status = 'pending' → show on PDP:
  "Detailed information coming soon.
   Questions? Call our pharmacist: [number]"
  This is acceptable — do not delay go-live waiting for complete drug info
```

### 12.2 Drug Information Fields on PDP

```
Accordion sections (expand/collapse):
  1. Drug Information
     Generic Name, Manufacturer, Drug Class, Dosage Form, Strength
  2. How to Use
     dosage_info field — sourced from CDSCO/OpenFDA, reviewed by pharmacist
  3. Side Effects (OTC products only — displayed if data available)
     side_effects field
  4. Important Warnings
     black_box_warning (red bordered box, mandatory display if true)
     contraindications field
  5. Drug Interactions
     drug_interactions_summary from OpenFDA interaction check
  6. Storage Instructions
     storage_condition field
  7. Regulatory Information
     CDSCO registration number, batch info, manufacturer license

PHARMA CONTENT RULES ON PDP:
  - Never claim drug "cures" or "treats" a condition by name
  - Never show testimonials implying efficacy
  - Always show: "Consult your doctor or pharmacist before use"
  - Schedule H/H1 drugs: show "Sold only on prescription of a Registered Medical Practitioner"
```

---

## PART 13 — PRODUCT IMAGE STRATEGY

### 13.1 Image Standards

```
Required for all drugs:
  - Actual product packaging (front of strip/bottle/box)
  - White or light grey background
  - Minimum 800×800px, maximum 2MB
  - No lifestyle images of sick/healthy people (Drugs & Magic Remedies Act)
  - No before/after images
  - No images implying the drug treats a specific condition by showing symptoms
  - No text overlays claiming efficacy

File format: WebP (primary) + JPEG fallback
CDN: CloudFront with cache-control: public, max-age=31536000
Fallback: category placeholder (tablets.jpg, capsules.jpg, syrup.jpg, drops.jpg)
```

### 13.2 Image Sourcing Plan

```
Before go-live (minimum viable):
  1. Request pack shots from your top 5 suppliers via email
     Most Indian pharma manufacturers provide these to stockists for free
  2. Create 6 category placeholders: tablets, capsules, syrup, drops, injection, powder
  3. Use category placeholders for any drug without a pack shot on day 1

Post go-live (ongoing):
  - Admin image manager: shows products with placeholder images
  - Assign to catalog_manager: upload 10 product images/day
  - Target: 80% of catalog with real images within 30 days of launch
```

---

## PART 14 — CHRONIC PATIENT REORDER FLOW

### 14.1 Pattern Detection

```
Job: chronic-reorder-reminders.ts (runs daily)
  For each customer with ≥ 3 orders:
    For each variant ordered ≥ 3 times:
      Calculate: average_days_between_orders
      Calculate: confidence_score (0-100, based on consistency)
      If confidence_score > 60:
        Upsert chronic_reorder_patterns record
        Set next_expected_at = last_purchased_at + avg_days

  When current_date = next_expected_at - 5 days AND reminder not sent:
    Send WhatsApp (W05_REFILL_REMINDER) if whatsapp_opt_in = true
    Send SMS (T11 variant) if sms_opt_in = true
    Mark reminder_sent_at = now()
```

### 14.2 "Your Regular Medicines" Dashboard Section

```
On /account dashboard (logged-in):
  Section: "Your Regular Medicines"
  Shows top 5 most re-ordered products
  Each has: "Reorder" button → adds to cart in one click
  Below: "All your orders" link

Quick reorder from order history:
  Every completed order in /account/orders:
  "Reorder All OTC Items" button → adds all OTC items to cart
  Rx items: adds to cart but triggers Rx check at checkout
  (Customer must have valid Rx on file or upload new one)
```

---

## PART 15 — CS ORDER INTAKE TOOL (WhatsApp Orders)

Build at `/admin/cs/place-order` — available to `support_agent` role.

```
CS Agent Order Flow:
  1. Agent receives order on WhatsApp Business number
  2. Opens "Place Order for Customer" in admin panel
  3. Searches customer by phone → existing customer loaded
     OR creates minimal customer record (phone + name)
  4. Adds products (same catalog, stock check applied)
  5. For Rx drugs: attaches prescription (CS uploads PDF received on WhatsApp)
  6. Selects delivery address (existing or enter new)
  7. Selects payment:
     Option A: COD → standard COD flow
     Option B: Payment link → system generates Razorpay payment link
               Agent sends link to customer on WhatsApp
               Link expires in 2 hours
               On payment: order auto-confirmed
  8. Places order → enters normal order flow
  9. cs_placed_orders record created with agent_id + channel='whatsapp'

Analytics: Track % of orders placed via CS vs self-service
           This metric tells you when to invest more in UX vs CS staffing
```

---

## PART 16 — PRE-DISPATCH PHARMACIST SIGN-OFF

For ALL Rx orders, before carrier booking is triggered:

```
After packing is complete → task created for pharmacist:
  Pharmacist opens pre-dispatch check in /pharmacy portal

  Checklist (all must be checked):
  ✓ Drug name on package matches dispense decision
  ✓ Quantity matches approved quantity
  ✓ Batch number on package matches allocation record
  ✓ Expiry date on package ≥ 30 days from today
  ✓ Package sealed and undamaged
  ✓ Packing slip attached
  ✓ CDSCO memo reference on package

  Pharmacist approves → carrier booking triggered automatically
  Pharmacist rejects → order_item status → 'exception', warehouse_manager alerted
  Rejection reason: mandatory field

  SLA: pre-dispatch sign-off within 2 hours of packing complete
  Breach alert: in-app notification to PIC after 2 hours

  For OTC orders: warehouse_manager sign-off only (no pharmacist needed)
  This keeps Rx traceability complete without slowing OTC dispatch

  Record: pre_dispatch_sign_offs table — CDSCO inspection evidence
```

---

## PART 17 — ACCOUNTING / GST EXPORT STRATEGY

### 17.1 Continue Using Vyappar

Medusa generates all required financial documents. Vyappar continues as accounting software.

```
Weekly export from Medusa to Vyappar:
  /admin/analytics → Export → "Weekly Sales Journal"

  CSV format for Vyappar import:
  Date | Invoice No | Party Name | HSN | Item | Qty | Rate | CGST | SGST | IGST | Total | Payment Mode

  Accountant imports this CSV into Vyappar every Monday morning
  This is the lowest-friction path — no API integration needed

Available exports in Medusa Admin:
  1. Daily Sales Summary (CSV)
  2. Weekly Sales Journal (Vyappar-compatible CSV)
  3. Monthly GSTR-1 compatible report (for CA)
  4. Razorpay settlement reconciliation (CSV)
  5. COD remittance reconciliation (CSV)
  6. GST collected by category (CGST/SGST/IGST split)
```

---

## PART 18 — DPDP CONSENT BANNER

Server-rendered on first visit (LegitScript + CDSCO crawlers cannot execute JavaScript).

```
Banner structure (rendered in HTML, not client-side only):
  "Suprameds uses cookies to provide essential services
   and, with your consent, to improve your experience.
   [Accept All] [Manage Preferences] [Essential Only]"

Consent categories:
  essential:   Always on — cart, session, OTP auth
               Legal basis: legitimate interest (not consent)
  functional:  Order history, saved addresses, recently viewed
               Requires: consent at registration
  analytics:   PostHog page views and events
               Requires: explicit consent
               Off by default
  marketing:   Abandoned cart emails, promotional WhatsApp
               Requires: explicit, separate consent
               Off by default

Storage:
  Pre-login: cookie_consent_logs table with session_id
  Post-login: dpdp_consents table with customer_id

Customer control at /account/privacy:
  - View all consents given with timestamps
  - Withdraw any non-essential consent
  - "Download my data" → generates data export in 24 hours
  - "Delete my account" → creates data_deletion_request (reviewed by compliance_officer)

On consent withdrawal:
  - Stop PostHog events in current session
  - Remove from marketing segments immediately
  - DLT marketing templates: unsubscribe flag propagated to MSG91
```

---

## PART 19 — ERROR PAGES + MAINTENANCE MODE

All error pages must be static HTML stored at Nginx level — no dependency on Medusa being up.

```
404 Page (static HTML at nginx/error_pages/404.html):
  - Suprameds header with pharmacy license number
  - "Page not found" message
  - Emergency contact footer: Poison Control 1800-116-117
  - Links: Home | Products | Contact Us
  - NO drug recommendations (Drugs & Magic Remedies Act)
  - NO promotional content

500 Page (static HTML at nginx/error_pages/500.html):
  - Same compliance header
  - "Our system is temporarily unavailable"
  - Customer service WhatsApp: [number]
  - "Your orders and prescriptions are safe"
  - Estimated resolution: "We're fixing this — check back in 30 minutes"

Maintenance Mode Page (nginx/error_pages/maintenance.html):
  - Full pharmacy license number displayed (LegitScript may crawl during maintenance)
  - CDSCO registration number
  - "Suprameds is upgrading — back soon"
  - WhatsApp support number
  - LegitScript seal image (static, not CDN-dependent)
  - Estimated return time

Nginx config:
  error_page 404 /error_pages/404.html;
  error_page 500 502 503 504 /error_pages/500.html;
  # Maintenance mode: comment out proxy_pass, uncomment return 503
```

---

## PART 20 — ADMIN MOBILE VIEW FOR PHARMACIST

Build lightweight mobile-optimized pharmacist view at `/pharmacy/mobile` (Next.js route).

```
Mobile pharmacist can:
  ✓ View Rx queue (count + list)
  ✓ Open prescription PDF (mobile-optimized PDF viewer)
  ✓ Approve / reject each drug line with reason
  ✓ Add clinical notes
  ✓ View drug interaction warnings
  ✓ Complete pre-dispatch sign-off checklist

Mobile pharmacist CANNOT (desktop-only features):
  ✗ Modify batch records or initiate recalls
  ✗ Manage licenses or compliance exports
  ✗ Access analytics or CRM
  ✗ View patient PII beyond the minimum needed for dispensing

Authentication: Same JWT + TOTP as desktop
               TOTP re-verification for each approval session
               Session expires after 2 hours on mobile (shorter than desktop)

Push notifications to mobile:
  Web Push API + service worker (PWA)
  Triggers: new Rx in queue, SLA warning, pre-dispatch pending
```

---

## PART 21 — MULTI-DEVICE CART PERSISTENCE

```
Logged-in customer:
  Cart stored in PostgreSQL via Medusa Cart module
  Syncs across all devices on login (phone ↔ desktop ↔ tablet)
  No action needed from customer

Guest customer:
  Cart stored in Redis: cart:{session_token}
  TTL: 7 days
  Session token in httpOnly cookie (7-day expiry)
  If customer logs in: guest cart merged into account cart
  Conflict resolution: if same variant in both, keep higher quantity

Cart recovery notification (OTC items only — never Rx):
  Abandoned cart trigger: cart inactive 1 hour with items + identified customer
  T+1h: in-app notification next visit ("You have items in your cart")
  T+24h: WhatsApp reminder (if opt-in)
  T+72h: Email with 5% OTC discount code
  Cart remains valid 7 days from last update
```

---

## PART 22 — RECENTLY VIEWED

```
Storage:
  Logged-in: PostgreSQL recently_viewed table (30-day history, max 20 items)
             + Redis sorted set for real-time access
  Guest: localStorage (client-side only, cleared on browser close)

Update trigger: every product detail page view
  Upsert recently_viewed record (customer_id, variant_id, viewed_at)
  If > 20 records: delete oldest

Display locations:
  - Bottom of every PDP: "You recently viewed" (max 4 items, horizontal scroll on mobile)
  - Homepage (logged-in): "Continue where you left off" section
  - Search results with 0 results: show recently viewed instead of empty page
    "No results for '{query}'. Here's what you were looking at recently:"

Pharma note:
  Rx drugs CAN appear in recently viewed (it's the user's own history, not advertising)
  Rx drugs CANNOT appear in: marketing emails, WhatsApp campaigns,
  abandoned cart recovery, loyalty promotions
```

---

## PART 23 — PGBOUNCER CONNECTION POOLING

Required for ECS Fargate auto-scaling — prevents PostgreSQL connection exhaustion.

```yaml
# docker-compose.prod.yml addition
services:
  pgbouncer:
    image: bitnami/pgbouncer:latest
    restart: always
    environment:
      POSTGRESQL_HOST: postgres  # or RDS endpoint in prod
      POSTGRESQL_PORT: 5432
      PGBOUNCER_DATABASE: medusa
      PGBOUNCER_POOL_MODE: transaction    # Best for stateless web apps
      PGBOUNCER_MAX_CLIENT_CONN: 1000     # Total client connections
      PGBOUNCER_DEFAULT_POOL_SIZE: 20     # Connections per database user
      PGBOUNCER_MIN_POOL_SIZE: 5
      PGBOUNCER_RESERVE_POOL_SIZE: 5
      PGBOUNCER_SERVER_IDLE_TIMEOUT: 600
    ports:
      - "6432:6432"
    healthcheck:
      test: ["CMD", "pg_isready", "-h", "localhost", "-p", "6432"]
      interval: 10s

# Medusa backend connects to PgBouncer, NOT directly to PostgreSQL
# DATABASE_URL=postgresql://user:pass@pgbouncer:6432/medusa
```

---

## PART 24 — RBAC: 25 ROLES ACROSS 5 TIERS

### Tier 1 — Customer Roles
| Role | MFA | Scope |
|---|---|---|
| `guest` | OTP for Rx actions | Public pages + cart |
| `customer` | Optional TOTP | Own data only |
| `b2b_buyer` | Recommended | Own org orders/invoices |
| `b2b_admin` | Mandatory | Own org management |

### Tier 2 — Pharmacy / Clinical Roles
| Role | MFA | Key Scope |
|---|---|---|
| `pharmacy_technician` | Mandatory | Rx queue view only, assigned picks |
| `pharmacist` | Mandatory TOTP | Rx review, dispense decisions, pre-dispatch, Q&A |
| `pharmacist_in_charge` | Mandatory TOTP | All pharmacist + team oversight + H1 register + Schedule H1 override |

### Tier 3 — Warehouse / Operations Roles
| Role | MFA | Scope |
|---|---|---|
| `grn_staff` | No | GRN creation, inbound |
| `qc_staff` | No | GRN QC approval (SSD: ≠ grn_staff on same GRN) |
| `picker` | No | Assigned pick lists only (masked order ref) |
| `packer` | No | Pack queue, label printing |
| `dispatch_staff` | No | Dispatch queue, carrier booking |
| `returns_staff` | No | Returns inspection |
| `warehouse_manager` | Mandatory | All warehouse + stock audits + supplier management |

### Tier 4 — Business / Admin Roles
| Role | MFA | Key Scope |
|---|---|---|
| `support_agent` | No | Orders (read), tracking, grievance, COD confirmation calls, CS order placement |
| `support_supervisor` | Recommended | All support + SLA reports + refund approval ≤ ₹500 |
| `catalog_manager` | No | Product CRUD, pricing (OTC), HSN/GST, drug info, images |
| `content_moderator` | No | Content moderation queue, reviews, Q&A, blog |
| `marketing_admin` | No | Promotions (OTC only), loyalty, campaigns, DLT templates |
| `finance_admin` | Mandatory TOTP | Refund approval (all), GST reports, COD reconciliation, revenue analytics |
| `compliance_officer` | Mandatory TOTP | License registry, LegitScript, CDSCO, override approvals, PHI audit (read) |
| `platform_admin` | Mandatory TOTP | User management, platform settings, all analytics (read), CRM |

### Tier 5 — Elevated / External Roles
| Role | MFA | Scope | Special |
|---|---|---|---|
| `super_admin` | FIDO2 hardware key | Everything | Max 3 accounts; 4th requires 2-of-3 existing approval |
| `cdsco_inspector` | Mandatory TOTP | Read-only compliance records | 48h TTL, issued by compliance_officer |
| `supplier` | Recommended | Own portal: invoices, CoA, own GRN/PO status | |

### SSD — 8 Hard Constraints (API-Level)
| # | Rule |
|---|---|
| SSD-01 | Rx submitter ≠ Rx approving pharmacist |
| SSD-02 | GRN creator ≠ GRN QC approver (same GRN) |
| SSD-03 | PO raiser ≠ PO approver |
| SSD-04 | Refund raiser ≠ refund approver |
| SSD-05 | Content writer ≠ content approver (same product) |
| SSD-06 | Recall initiator ≠ quarantine clearance approver; PIC always required |
| SSD-07 | Compliance flag override requires super_admin co-approval |
| SSD-08 | `cdsco_inspector` role cannot coexist with any internal role |

---

## PART 25 — OVERRIDE ENGINE

### Absolute Walls (Zero Override Code Path)
- NDPS / Schedule X online sale — criminal liability
- Dispensing without any prescription at all — criminal liability
- Drug advertising (Rx in Google feed, Rx in emails/SMS/WhatsApp) — criminal liability
- H1 register write on Schedule H1 dispense — criminal liability

### Overridable With Break Glass (Dual Auth + Immutable Audit)
| Type | Requestor | Approver | Dual Auth | Valid | CDSCO |
|---|---|---|---|---|---|
| OVR-01: FEFO bypass | WH Manager | PIC | ❌ | 4h | No |
| OVR-02: Rx validity extension | Pharmacist | PIC + Compliance | ✅ | 24h | ✅ |
| OVR-03: Fill limit extension | Pharmacist | PIC + Compliance | ✅ | 24h | ✅ |
| OVR-04: Batch quarantine release | QC/WH Mgr | PIC | Conditional | Permanent | No |
| OVR-05: Min shelf life bypass | Pharmacist | PIC + Compliance | ✅ | 4h | ✅ |
| OVR-06: State license bypass | Compliance | Super Admin | ❌ | 48h | ✅ |
| OVR-07: SSD bypass (Rx only) | PIC/Admin | Super Admin + Compliance | ✅ | 2h | ✅ |
| OVR-08: Content flag clear | Compliance | PIC + Platform Admin | ✅ | Permanent | No |
| OVR-09: Price sync mismatch | Marketing | Platform Admin | ❌ | 2h | No |
| OVR-10: Payment capture timing | Finance Admin | Super Admin | ❌ | 1h | No |
| OVR-11: Task reassignment | WH Manager | WH Manager (self) | ❌ | 8h | No |
| OVR-12: Ads eligibility manual set | Compliance | Super Admin | ❌ | Permanent | No |
| OVR-13: Recall scope reduction | Compliance | PIC + Super Admin | ✅ | Permanent | ✅ |
| Emergency | Super Admin | 2nd Super Admin (quorum) | ✅ | 1h | Always |

Override frequency alert: if any override type used > 5 times in 30 days → systemic issue alert to platform_admin.

---

## PART 26 — LegitScript PRE-CERTIFICATION CHECKLIST

All 20 items must pass in CI before deployment.

```
✓ SSL valid (TLS 1.3+, HSTS 1-year enabled)
✓ Physical address server-rendered on site
✓ Phone number server-rendered on site
✓ Pharmacist name + RPh license number displayed
✓ CDSCO Form 18AA registration on file + displayed
✓ Privacy policy page exists and is server-rendered
✓ Terms of service page exists
✓ Returns/refund policy page exists
✓ Prescription policy page exists
✓ LegitScript seal embedded in footer (dynamic from CDN)
✓ No Rx product without requires_prescription gate
✓ No Schedule X/NDPS in google_ads_eligible set
✓ All prices match between DB and Google feed (price sync audit passes)
✓ No content moderation flags on live products
✓ No drug advertising on any page (Rx never in Google feed)
✓ Grievance officer details displayed on site
✓ 12h/7d support availability confirmed (fix from current 9am-9pm 6 days)
✓ Batch numbers tracked for all inventory
✓ 5-year data retention policy active
✓ robots.txt configured (compliance pages crawlable by LegitScript bots)
```

---

## PART 27 — STOREFRONT PAGES (Medusa Bloom)

### Bloom Build Sessions

**SESSION 1 — COMPLIANCE LAYOUT:**
> "Build a pharmaceutical ecommerce storefront for Suprameds.in, a licensed Indian online pharmacy based in Hyderabad. Create a professional homepage with: a compliance header showing pharmacy license number and Registered Pharmacist name, a footer with LegitScript certification seal, CDSCO registration number, physical address, grievance officer contact, emergency Poison Control (1800-116-117). Create these mandatory pages: /pharmacy/licenses, /about/legal, /privacy, /terms, /returns, /prescription-policy, /grievance. All content must be in server-rendered HTML, not client-side JavaScript."

**SESSION 2 — CATALOG:**
> "Product listing with MeiliSearch, filters for Drug Type/Schedule/Category/Brand/Price. Show MRP strikethrough with selling price. GST badge. Red Rx-Only badge on prescription drugs. Out of Stock state with Notify Me button and Similar Medicines section. Never show Rx drugs in promoted or featured slots."

**SESSION 3 — PDP:**
> "Product detail page with drug info accordion (Generic name, Manufacturer, Batch, Expiry, Storage), black-box warning section (red border, server-rendered, visible only when flag is true), drug interaction warning, Rx gate CTA with upload flow, pharmacist Q&A section (pharmacist answers only), MRP vs selling price, GST-inclusive display, estimated delivery date, JSON-LD Drug/MedicalWebPage structured data."

**SESSION 4 — CHECKOUT:**
> "Multi-step checkout: 1) Address with live pincode serviceability check and estimated delivery date. 2) Payment — Razorpay (UPI/Cards/NetBanking/EMI/COD with ₹49 COD surcharge transparently shown) or Stripe for international. Show prepaid incentive nudge if COD selected. 3) GST invoice preview. 4) Order confirmation with CDSCO memo download link. Guest checkout available — phone OTP verification only required for Rx items."

**SESSION 5 — ACCOUNT + PORTALS:**
> "Customer account: order history with memo download, 'Your Regular Medicines' reorder section, prescription vault with per-line dispense decision detail, refill manager, DPDP privacy panel (data download, deletion request, consent management). Pharmacist portal at /pharmacy: Rx review workspace (PDF viewer + drug line confirmation + per-line dispense decision + pre-dispatch checklist), H1 register view, batch management. Warehouse portal at /warehouse: task board for GRN/pick/pack/dispatch."

### Complete Route List

| Route | Notes |
|---|---|
| `/` | Homepage |
| `/products` | Catalog with OOS indicators |
| `/products/[handle]` | PDP with drug info, Rx gate, OOS handling |
| `/cart` | Cart with Rx gate banner, multi-device sync |
| `/checkout` | Guest-friendly, COD option, pincode check, delivery estimate |
| `/track/[awb]` | Public tracker — no login required |
| `/account` | Dashboard with "Your Regular Medicines" |
| `/account/orders` | Order history with memo download |
| `/account/prescriptions` | Rx vault with fill count per line |
| `/account/refills` | Subscription management |
| `/account/notifications` | Granular communication preferences |
| `/account/privacy` | DPDP consent management |
| `/wishlist` | Saved products + OTC price alerts |
| `/loyalty` | Points, tier, referral link |
| `/pharmacy` | Pharmacist portal (RPh role) |
| `/pharmacy/prescriptions` | Rx review workspace + pre-dispatch sign-off |
| `/pharmacy/mobile` | Lightweight mobile Rx approval view |
| `/pharmacy/batches` | Batch management, expiry alerts, recall |
| `/pharmacy/licenses` | Public license display (LegitScript + CDSCO required) |
| `/warehouse` | Warehouse task board (warehouse roles) |
| `/admin` | Medusa Admin + all domain consoles |
| `/about/legal` | Business transparency |
| `/prescription-policy` | Rx policy |
| `/privacy` | DPDP compliant |
| `/terms` | Terms of service |
| `/returns` | Returns policy |
| `/grievance` | Grievance officer + ticket form |
| `/blog/[slug]` | Pharmacist-authored wellness content |
| `/legal/baa` | BAA notice |
| `/404` | Compliant error page (static) |
| `/500` | System error page (static) |
| `/maintenance` | Maintenance mode (static, Nginx-served) |

---

## PART 28 — SECURITY & COMPLIANCE

- **AES-256 at rest:** Rx images, DOB, H1 register, pharmacist notes
- **TLS 1.3 minimum** + HSTS (1-year, includeSubDomains)
- **S3 SSE-S3** on all health documents; signed URLs 1-hour TTL
- **PHI audit log:** immutable, partitioned monthly — every access logged
- **5-year retention:** Rx records, supply memos, GRN records, H1 register, audit logs
- **Rate limiting (Redis):** Auth 5/min | Rx upload 3/min | Checkout 10/min | Admin login 3/min | COD confirmation 2/min
- **Helmet.js:** CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- **Admin IP allowlist:** restrict /admin routes to office + VPN CIDRs
- **TOTP 2FA:** mandatory for all clinical + admin roles
- **FIDO2:** mandatory for super_admin
- **No tracking pixels on:** /pharmacy, /checkout, /account/prescriptions, any PHI page
- **PostHog:** OTC + non-PHI pages only
- **Zod schemas:** all custom API routes
- **TypeORM parameterized queries:** no raw SQL with user input
- **PCI-DSS:** Razorpay Checkout.js + Stripe Elements — no raw card data ever

---

## PART 29 — INFRASTRUCTURE

### Docker Compose (Production)
```yaml
services:
  medusa-backend:     # Node 20 Alpine, PORT 9000, connects to pgbouncer:6432
  next-storefront:    # Node 20 Alpine, PORT 3000
  postgres:           # PostgreSQL 15, encrypted volume
  pgbouncer:          # Connection pooler, PORT 6432, pool_mode: transaction
  redis:              # Redis 7 Alpine, persistent AOF
  meilisearch:        # Latest, persistent volume
  nginx:              # SSL, rate limiting, admin IP restriction, static error pages
# No ports exposed except 80/443 via Nginx
# docker-compose.dev.yml adds: pgAdmin, Redis Commander, Mailhog
```

### AWS Services (Mumbai ap-south-1)
| Service | Spec | Purpose |
|---|---|---|
| ECS Fargate (backend) | 2 vCPU / 4GB, auto-scale 2–10 | Medusa API |
| ECS Fargate (frontend) | 1 vCPU / 2GB, auto-scale 2–8 | Next.js / Bloom |
| RDS PostgreSQL 15 | db.t3.medium, Multi-AZ | Primary database |
| ElastiCache Redis | cache.t3.micro | Cache + queues + JWT blocklist |
| S3 (two buckets) | SSE-S3 | Rx docs (private) + assets (CDN-enabled) |
| CloudFront | CDN | Static assets + product images |
| ALB | HTTPS only | Load balancer |
| ACM | Auto-renew | SSL certificate |
| SES | Mumbai | Transactional email |
| CloudWatch | Logs + alarms | Monitoring |
| AWS Backup | Daily snapshots | 5-year PHI retention |

### Monthly Cost (Baseline Production)
~₹23,500/month (~$280 USD). At 1M users: ~₹1,20,000–1,80,000/month.

### Scaling Path
| Scale | Action |
|---|---|
| 350–5k orders/month | Current spec — no changes needed |
| 5k–20k | Redis caching for catalog, RDS r6g.large |
| 20k–100k | MeiliSearch cluster, CDN for all assets, ECS 4–12 tasks |
| 100k–500k | RDS read replicas, SQS for Rx queue |
| 500k–1M | Aurora PostgreSQL Serverless v2, DynamoDB for sessions |

---

## PART 30 — LOGGING, MONITORING & BACKUP

- **Winston:** JSON structured → CloudWatch; PHI audit stream write-only, 5-year retention; never log Rx content, DOB, card data
- **Sentry:** PII scrubbing on all events; P0/P1 → Slack + email
- **PostHog (self-hosted):** OTC non-PHI pages; track OTC funnel, COD vs prepaid rate, Rx upload completion rate
- **AWS Backup:** RDS daily (35-day retention); S3 Rx docs versioned + cross-region replication ap-southeast-1; RTO 4h, RPO 24h

---

## PART 31 — CI/CD PIPELINE

```yaml
# ci.yml (on every PR)
- ESLint + TypeScript strict check (zero `any` types)
- Jest: all modules — FEFO algorithm, GST calc, Rx expiry/fill limits,
        COD scoring, SSD constraints, partial approval + payment split
- Playwright E2E: OTC purchase, Rx full flow, partial approval,
                  COD order + confirmation, guest checkout,
                  pharmacist portal, recall workflow
- Content moderation lint on product seed data
- Compliance checklist dry-run (all 20 items must pass)
- OWASP dependency-check

# deploy.yml (on merge to main)
- Build Docker images → push to ECR
- Run DB migrations
- Blue-green deploy to ECS
- Smoke test: /health, /products, /pharmacy/licenses,
              /feeds/google-shopping.xml, /track/{test-awb}

# compliance-cron.yml (weekly, Monday 6 AM IST)
- License expiry: FAIL BUILD if expiry < 30 days
- Batch expiry: flag batches expiring < 90 days
- Price sync audit: DB vs Google Shopping feed
- PHI retention: flag records approaching 5-year mark
- DLT audit: verify all active SMS templates have registered DLT IDs
- COD reconciliation: flag unreconciled remittances > 7 days old
- 12h/7d support coverage: verify support shift schedule covers requirement
```

---

## PART 32 — BUILD EXECUTION ORDER

**Build in dependency order. Never in feature-excitement order.**

```
PHASE 1 — FOUNDATION (everything depends on this)
  1. RBAC module: all 25 roles, permissions, SSD constraints seeded
  2. Middleware stack: authenticate, mfa-verified, authorize, ssd-check,
                       phi-access, session-expiry, rx-gate, schedule-x-block
  3. Core audit scaffolding: phi_audit_log, audit_logs, order_state_history
  4. Core product/variant entity + molecule + substitution + stock_alert tables
  5. PgBouncer + Docker Compose full stack running locally

PHASE 2 — CLINICAL BACKBONE
  6. Prescription module: upload, hash check, drug line extraction workspace
  7. Dispense module: per-line decision, H1 register write (transactional), pre-dispatch sign-off
  8. Payment module: Razorpay auth/capture/release split; COD payment type; payment links

PHASE 3 — ORDERS + INVENTORY
  9. Orders module: state machine, COD flow, guest order, CS order placement
  10. Inventory module: batch ledger, FEFO allocation, stock_movements
  11. order_item_batch_allocations: split-batch support
  12. prescription_line_consumptions: per-line refill balance
  13. COD module: confirmation calls, scoring, remittance reconciliation

PHASE 4 — WAREHOUSE
  14. Warehouse zones (ambient only) + bin locations
  15. GRN workflow: receive → quarantine → QC approve → put-away (SSD enforced)
  16. Pick workflow: FEFO list generation → confirm pick → short pick handling
  17. Pack → pre-dispatch sign-off → dispatch
  18. Returns inspection + disposition

PHASE 5 — FULFILLMENT + LOGISTICS
  19. Shipment module: Shiprocket + Delhivery + Xpressbees adapters
  20. Pincode serviceability check + delivery date estimate
  21. OTP delivery for Rx orders
  22. NDR management
  23. Supply memo generation (CDSCO)
  24. Batch recall workflow + CDSCO report

PHASE 6 — COMPLIANCE + OVERRIDES
  25. LegitScript compliance module + 20-item automated checklist
  26. Override engine: all 14 types + emergency override
  27. DPDP consent banner + cookie management
  28. Google Ads feed generator (OTC only)

PHASE 7 — GROWTH + OPERATIONS
  29. CRM: customer 360, lifecycle, churn, abandoned cart (OTC), chronic reorder patterns
  30. Analytics: KPI dashboard, funnel, COD analytics, GST export
  31. Loyalty + referral (OTC only)
  32. Reviews + pharmacist Q&A
  33. SMS DLT templates (register with TRAI on Day 1 of project — takes 3-7 days)
  34. WhatsApp Business templates (submit for WABA approval on Day 1)
  35. In-app notification system (Redis pub/sub)
  36. Drug information data import (CDSCO + OpenFDA)
  37. Grievance module

PHASE 8 — ADMIN EXTENSIONS
  38. Prescription review workspace (/admin/prescriptions/:id)
  39. Dispense decision ledger
  40. Warehouse task board
  41. COD confirmation dashboard
  42. Finance reconciliation dashboard
  43. Compliance inspection dashboard
  44. Analytics + CRM consoles
  45. Override management panel
  46. Internal notification center

PHASE 9 — STOREFRONT (Medusa Bloom Sessions 1–5)
  Session 1: Compliance layout + all mandatory pages
  Session 2: Product catalog + OOS handling
  Session 3: PDP + drug info + Rx gate
  Session 4: Checkout (guest, COD, pincode check, delivery estimate)
  Session 5: Account, pharmacist portal, warehouse portal, mobile pharmacist view

PHASE 10 — INFRASTRUCTURE + VALIDATION
  47. Docker + Nginx (with static error pages) + PgBouncer
  48. GitHub Actions (ci.yml, deploy.yml, compliance-cron.yml)
  49. AWS Mumbai: ECS + RDS + ElastiCache + S3 + CloudFront
  50. Compliance checklist: all 20 items pass
  51. All SSD constraints tested
  52. All Rx gate integration tests pass
  53. COD flow end-to-end tested
  54. Guest checkout end-to-end tested
  55. Playwright E2E full suite
  56. Lighthouse: 90+ Performance, 100 SEO, 100 Accessibility
  57. OWASP ZAP: no critical findings
  58. DLT SMS templates: all registered with TRAI
  59. WhatsApp templates: all approved by Meta
  60. LegitScript application submitted with certification evidence pack
```

---

## PART 33 — CRITICAL NON-NEGOTIABLE RULES

*Immutable constraints. No role, configuration, or admin action overrides these.*
*Enforced at: DB constraint + API middleware + workflow validation — all three.*

```
RULE 1: NDPS / Schedule X
  Cannot be purchased online. No override type exists.
  Enforced: DB CHECK constraint + schedule-x-block.middleware.ts (stateless)

RULE 2: Rx gate
  No Rx drug leaves warehouse without pharmacist-authored dispense_decision.
  order_items.dispense_decision_id is non-nullable for Rx items — DB enforced.

RULE 3: Pre-dispatch pharmacist sign-off
  No Rx shipment carrier booking triggered without completed
  pre_dispatch_sign_offs record. Enforced in dispatch.workflow.ts.

RULE 4: Stock ledger
  inventory_batches quantities never updated directly.
  All changes via stock_movements inserts only.
  All inventory mutations routed through inventory.service.ts.

RULE 5: Payment capture
  Rx orders: capture only sum of approved lines.
  Release authorization for rejected lines.
  Enforced in capture-approved.workflow.ts.

RULE 6: Drug advertising
  Rx drugs: never in Google feed, never in emails/SMS/WhatsApp marketing,
  never in abandoned cart recovery, never in loyalty promotions.
  Enforced at: feed generator (hard filter), notification dispatcher
  (template validator), loyalty module (product type guard).

RULE 7: FEFO
  All allocations use earliest-expiring active batch with ≥ 30 days shelf life.
  Manual override (OVR-01) requires PIC approval and 4h TTL.

RULE 8: SSD
  8 constraints enforced at API middleware level.
  UI cannot bypass ssd-check.middleware.ts.
  Financial SSD (SSD-04) and content SSD (SSD-05) have NO override type.

RULE 9: PHI audit
  Every read/write to prescriptions, dispense_decisions, patient DOB,
  H1 register, or insurance data → immutable phi_audit_log entry.
  Logged before and after every action. Failed access logged too.

RULE 10: 5-year retention
  Rx records, supply memos, GRN records, H1 register, phi_audit_logs.
  No auto-deletion. Destruction requires compliance_officer + super_admin.

RULE 11: MFA
  Pharmacist, PIC, finance_admin, compliance_officer, platform_admin:
  mandatory MFA for all write actions.
  Every override approval: fresh MFA re-verification regardless of session state.
  super_admin: FIDO2 hardware key — no exceptions.

RULE 12: TypeScript strict
  "strict": true throughout. Zero `any` types. Zero implicit returns.

RULE 13: Server-side rendering for compliance
  /pharmacy/licenses, /privacy, /terms, /prescription-policy, /about/legal,
  /grievance — all server-rendered HTML.
  LegitScript and CDSCO crawlers cannot execute JavaScript.

RULE 14: Dispense fills_consumed immutability
  fills_consumed computed only from prescription_line_consumptions.
  No direct column update ever. Remove direct update permission at DB level.

RULE 15: H1 register transactional integrity
  Every Schedule H1 dispense_decision triggers h1_register_entries insert
  in the SAME database transaction.
  If H1 write fails → entire dispense decision rolled back.
  No H1 drug leaves without a register entry. Criminal law obligation.

RULE 16: COD surcharge transparency
  COD surcharge shown as explicit line item before payment confirmation.
  Never hidden in order total. Consumer Protection Rules 2020 compliance.

RULE 17: Override frequency
  Any override type used > 5 times in 30 days → systemic issue alert
  to platform_admin. Overrides are exceptions, not workarounds.
  Frequent overrides indicate broken process, not need for more overrides.
```

---

## PART 34 — PRODUCT & PRICE MANAGEMENT

### 34.1 Price Fields Per Product Variant

```typescript
interface ProductPricing {
  mrp:             number   // Maximum Retail Price — mandatory display (Indian law)
                            // Cannot sell above this — legal violation if exceeded
  selling_price:   number   // Actual price charged (must be ≤ mrp always)
  cost_price:      number   // Purchase price — visible to finance_admin/platform_admin only
                            // Never exposed to customer
  // Computed (auto-calculated, never manually set):
  discount_amount: number   // mrp - selling_price
  discount_pct:   number    // (mrp - selling_price) / mrp × 100
  margin_pct:     number    // (selling_price - cost_price) / selling_price × 100
}
```

Display rule: selling_price < mrp → show MRP with strikethrough + selling_price
              selling_price = mrp → show price only (no strikethrough)

### 34.2 Price Edit Interface (Single Product)

At `/admin/products/[id]` → Pricing tab:

Fields editable by `catalog_manager` (OTC) and `finance_admin` (all):
- **MRP** — validates: must be ≥ selling_price at all times
- **Selling Price** — validates: must be ≤ MRP
- **Cost Price** — finance_admin + platform_admin only
- **GST Rate** — dropdown: 0% / 5% / 12% / 18% — finance_admin only
- **HSN Code** — text with GSTIN format validation

On save validations:
- `selling_price > mrp` → BLOCK: "Selling price cannot exceed MRP (Indian law)"
- `selling_price < cost_price` → WARN (not block): "Margin is negative"
- `mrp` lowered → WARN: "Affects all carts containing this product"
- `gst_rate` changed → WARN: "Affects all future invoices"
- Price changed + product in Google feed → trigger immediate price_sync_audit

Live margin preview as catalog_manager types selling_price: "Margin: X%"

### 34.3 Bulk Price Edit

At `/admin/products` → select products → "Bulk Edit Prices":

Options:
1. Set exact selling price: "₹___"
2. Percentage below MRP: "X% off MRP"
3. Set margin: "X% above cost" (requires cost_price populated)
4. Adjust by amount: "+₹X / -₹X"
5. Adjust by percentage: "+X% / -X%"

Preview table before confirming:
`| Product | Current Price | New Price | Change | MRP | Will Exceed MRP? |`

System rejects any row where new price > MRP. Rx drug bulk edits require finance_admin.

### 34.4 Price History

```typescript
// TABLE: price_history (APPEND-ONLY)
interface PriceHistory {
  id:                  string
  variant_id:          string
  changed_by:          string
  changed_by_role:     string
  previous_mrp:        number
  new_mrp:             number
  previous_price:      number
  new_price:           number
  previous_cost_price: number
  new_cost_price:      number
  reason:              string | null
  changed_at:          Date
}
```

Display at `/admin/products/[id]` → Pricing → "Price History" tab.
CSV export for finance_admin audit. CDSCO inspection evidence.

### 34.5 Margin Dashboard

At `/admin/analytics` → Pricing tab (finance_admin + platform_admin):
- Products sorted by margin % low to high
- Red highlight: margin < 5%
- Red urgent: selling_price < cost_price (negative margin)
- Average margin by category
- Margin impact what-if calculator (enter proposed price → see margin change)

### 34.6 Product Field Edit Reference

| Field | Editable By | Admin Tab | Constraint |
|---|---|---|---|
| Title / brand name | catalog_manager | General | Content lint on save |
| Generic name | catalog_manager | General | |
| Manufacturer | catalog_manager | General | |
| Dosage form / strength | catalog_manager | General | |
| Description | catalog_manager | General | Content lint, moderation queue |
| Images (up to 8) | catalog_manager | General | WebP preferred, 800×800px min |
| Status (Published/Draft/Archived) | catalog_manager | General | Auto-unpublish on flag |
| Schedule classification | pharmacist_in_charge | Regulatory | |
| Requires prescription flag | pharmacist_in_charge | Regulatory | |
| NDPS scheduled | super_admin only | Regulatory | Extreme — requires audit reason |
| CDSCO approval number | compliance_officer | Regulatory | |
| Google Ads eligible | compliance_officer | Regulatory | Only if content_moderation_status = 'approved' |
| Indications / dosage info | catalog_manager | Drug Info | Content lint enforced |
| Side effects | catalog_manager | Drug Info | Content lint enforced |
| Contraindications | catalog_manager | Drug Info | Content lint enforced |
| Black box warning text | pharmacist_in_charge | Drug Info | Clinical field — RPh only |
| MRP | catalog_manager, finance_admin | Pricing | See 34.2 |
| Selling price | catalog_manager (OTC), finance_admin (all) | Pricing | Must be ≤ MRP |
| Cost price | finance_admin, platform_admin | Pricing | Never shown to customer |
| GST rate / HSN code | finance_admin | Pricing | |
| Reorder point | warehouse_manager | Inventory | |
| Back-order allowed | catalog_manager | Inventory | |
| SEO title / meta description | catalog_manager | SEO | Content lint enforced |
| URL slug | catalog_manager | SEO | Auto-generated, manually overridable |

### 34.7 Promotions & Discounts

Built on Medusa Promotions Module. Role: marketing_admin, platform_admin, super_admin.
**HARD RULE: No promotion applies to Rx drugs — system enforced, not just UI.**

**Promotion types:**

**1. Coupon Code** — % or ₹ off total, category, or specific OTC products. Min order, max uses, per-customer limit, valid date range.

**2. Automatic Discount** — cart value threshold, category trigger, or product-specific. No code needed.

**3. Buy X Get Y** — OTC + supplements only.

**4. Free Shipping Above Threshold** — applies to all orders (shipping discount is not drug advertising). Most conversion-friendly promotion type for pharma.

**5. First Order Discount** — auto-applied, ₹ amount, OTC only, 1 use per customer (enforced by customer_id not email).

**Legally permitted (Indian law):**
- "Free shipping on orders above ₹499" ✅
- "10% off on vitamins and supplements" ✅
- "₹50 off your first OTC order" ✅

**Prohibited (Drugs & Magic Remedies Act 1954):**
- "20% off on antibiotics" ❌ — illegal drug advertising
- "Discount on prescription medicines" ❌ — illegal
- "Buy 2 get 1 free on Schedule H drugs" ❌ — illegal

System auto-excludes Rx drugs at promotion calculation level. marketing_admin cannot override.

### 34.8 Stock Management Tools

**Quick Stock View** at `/admin/inventory`:
- All products: current stock / reserved / available / reorder point status
- Expiry warning: red (30 days), orange (90 days)
- Filters: by category / schedule / expiry risk / stock status

**Manual Stock Adjustment** at `/admin/inventory/[batch_id]` → "Adjust Stock":
- Type: damage / admin_correction / count_update / other
- Quantity: +/- number
- Reason: mandatory minimum 20 characters
- Evidence: optional photo upload (S3)
- Writes stock_movement: movement_type = 'audit_adjustment'
- Rx drug adjustments: pharmacist approval required + phi_audit_log entry

**Auto-publish rules:**
- All batches expired AND quantity = 0 → auto-set product to 'draft', notify admin
- content_moderation_status changes to 'flagged' → auto-unpublish to 'draft', notify admin

### 34.9 Additional Tables

```typescript
// TABLE: price_history — APPEND-ONLY (defined above in 34.4)
// TABLE: product_edit_log — APPEND-ONLY
interface ProductEditLog {
  id:           string
  product_id:   string
  variant_id:   string | null
  changed_by:   string
  role:          string
  field_name:   string   // e.g. "selling_price", "schedule_classification"
  old_value:    string   // JSON serialized
  new_value:    string   // JSON serialized
  changed_at:   Date
}
```

---

## PART 35 — EVENT SUBSCRIBERS (COMPLETE MAP)

Every domain event must have a subscriber. Without subscribers, events fire into a void.
All subscriber files live in `src/subscribers/`.

### 35.1 Prescription Subscribers

```
prescription.uploaded.subscriber.ts
  → Notify pharmacist: in-app (Redis pub/sub) + WhatsApp to pharmacist team
  → Set SLA timer in Redis (4h TTL for warning, 8h for breach)
  → Check duplicate hash → flag prescription if match found
  → Emit internal_notification: type='rx_pending'

prescription.fully_approved.subscriber.ts
  → Notify customer: WhatsApp W02 + SMS T05
  → Progress order: pending_rx_review → payment_captured
  → Trigger FEFO allocation workflow for all approved lines
  → Clear SLA Redis key
  → If COD order: skip — COD was already confirmed separately

prescription.partially_approved.subscriber.ts
  → Notify customer: WhatsApp W07 (per-line detail)
  → Trigger partial-approval.workflow (capture approved lines, release rejected)
  → If CS-placed order: notify CS agent in-app

prescription.rejected.subscriber.ts
  → Notify customer: SMS T06 + WhatsApp with rejection reason
  → Release full payment authorization
  → Cancel all order items linked to this prescription
  → Log to phi_audit_log

prescription.expired.subscriber.ts
  → If linked to active refill_subscription: PAUSE subscription
  → Notify customer: WhatsApp W06 variant (Rx expired — renew needed)
  → If chronic patient with churn_risk > 60: flag for CS proactive outreach
```

### 35.2 Order Subscribers

```
order.created.subscriber.ts
  → Run duplicate-order-check.workflow
  → If COD + OTC: create cod_order record, notify CS team in-app (type='cod_confirmation_due')
  → If Rx: hold in pending_rx_review, emit internal_notification to pharmacist
  → If prepaid + OTC only: trigger FEFO allocation immediately
  → Pre-generate supply_memo as draft (fills in on dispatch)

order.payment_captured.subscriber.ts
  → Trigger FEFO batch allocation for all approved items
  → Create warehouse_task (type='pick'), notify warehouse_manager in-app
  → Generate final supply_memo PDF → upload S3 → attach to order
  → Send order confirmation: Email E01 + SMS T02 + WhatsApp W01

order.dispatched.subscriber.ts
  → Send: SMS T07 + WhatsApp W03 + Email E05
  → Begin tracking poll (Shiprocket webhook will push updates)
  → If COD: update cod_order.status = 'dispatched'
  → Award loyalty points is DEFERRED to order.delivered (not on dispatch)

order.delivered.subscriber.ts
  → Award loyalty points for OTC items ONLY
  → If COD: mark cod_order.status = 'delivered_collected'
  → Send review request: Email E06 (OTC only, 24-hour delay via job)
  → Update chronic_reorder_patterns.last_purchased_at + recalculate next_expected_at
  → Increment customer.total_orders + total_spend in CRM

order.cancelled.subscriber.ts
  → Release all batch reservations → write stock_movements (reservation_release)
  → Release payment authorization if not captured
  → Issue refund if payment was already captured
  → Notify customer: SMS + WhatsApp
  → If COD RTO: update cod_customer_score (increment consecutive_rtos)
  → Update order_state_history

payment.failed.subscriber.ts
  → Set order status = 'payment_retry_pending'
  → Notify customer: SMS + WhatsApp W09 variant with new payment link
  → Generate Razorpay payment link (15-minute expiry)
  → After 2 hours with no payment: trigger cancel-order.workflow
```

### 35.3 Inventory Subscribers

```
batch.recalled.subscriber.ts
  → IMMEDIATELY set all pick_list_lines for this batch to 'exception'
  → Set all order_item_batch_allocations for this batch to 'recalled'
  → Re-trigger FEFO allocation for all affected orders (find alternate batches)
  → If no alternate: notify warehouse_manager + pharmacist in-app (URGENT)
  → Create return requests for all delivered orders containing this batch
  → Emit customer recall notifications (SMS + WhatsApp + Email)

stock.below_reorder_point.subscriber.ts
  → Create purchase_order draft for this variant
  → Notify warehouse_manager in-app (type='stock_low')
  → If variant already OOS (quantity_available = 0): also notify CS team

stock.restocked.subscriber.ts
  → Query stock_alerts table for this variant
  → Batch notify waiting customers (max 50 at a time, FIFO order)
  → If back-ordered items exist for this variant: trigger back-order fulfillment job
  → Update product.status from 'draft' back to 'published' if was auto-unpublished
```

### 35.4 Shipment Subscribers

```
shipment.tracking_updated.subscriber.ts
  → Append new ShipmentEvent to shipment.events[]
  → Update shipment.status
  → If 'out_for_delivery': send SMS T08 + WhatsApp
  → If 'delivered': emit order.delivered
  → If 'ndr_received': trigger NDR management workflow
  → If 'rto_initiated': notify CS team in-app + update cod_customer_score if COD

shipment.ndr_received.subscriber.ts
  → Send WhatsApp to customer with response options (W04 template)
  → Start 24h response timer in Redis
  → Log NDR attempt in shipment.events
  → After 3rd NDR: auto-trigger RTO + notify CS team
```

### 35.5 Warehouse Subscribers

```
grn.qc_approved.subscriber.ts
  → Set batch.status = 'active', qc_status = 'passed'
  → Create warehouse_task (type='put_away')
  → Notify warehouse_manager in-app
  → Check: any back-ordered items waiting for this variant? → trigger fulfillment
  → Emit stock.restocked event

warehouse_task.exception.subscriber.ts
  → Notify warehouse_manager in-app immediately
  → If pick exception (short_pick): trigger FEFO reallocation for shortfall
  → If pack exception + Rx order: notify pharmacist in-app
  → Log exception in order_state_history
```

### 35.6 CRM Subscribers

```
customer.at_risk.subscriber.ts
  → Add to win-back campaign segment
  → Trigger win-back WhatsApp message with OTC product recommendations
  → Notify CS team if customer LTV > ₹5,000

customer.churned.subscriber.ts
  → Send final win-back email (E-series)
  → Add to suppression list (no more automated outreach)
  → Flag for manual CS outreach if LTV > ₹10,000

review.submitted.subscriber.ts
  → Run content moderation lint on review text
  → If clean: set status = 'pending', add to moderation queue
  → If flagged: set status = 'flagged', notify content_moderator in-app
  → Award 50 loyalty points ONLY after review is approved (not on submission)
```

### 35.7 Compliance Subscribers

```
override.approved.subscriber.ts
  → Generate single-use override_token (UUID, stored hashed)
  → Notify requester: in-app + email with token and validity window
  → If CDSCO notification required: add to monthly compliance report queue
  → Start expiry countdown

override.used.subscriber.ts
  → Consume token (mark used_at = now())
  → Write override_audit_log entry (immutable)
  → If post_use_review required: create review task in compliance_officer queue with deadline

license.expiry_approaching.subscriber.ts
  → 90 days: in-app notification to compliance_officer
  → 30 days: in-app + email (urgent level)
  → 7 days: in-app + email + SMS T12 to compliance_officer (CRITICAL level)
```

### 35.8 Search & Media Subscribers

```
product.created.subscriber.ts
  → Update PostgreSQL search_vector column for new product (BullMQ background)
  → If status = 'published': add to Google Shopping feed generation queue

product.updated.subscriber.ts
  → Update search_vector column for changed fields (BullMQ background)
  → If price changed: trigger immediate price_sync_audit (not waiting for daily cron)
  → If status changed to 'published': add to feed queue
  → If status changed from 'published': remove from feed immediately
  → Emit CloudFront cache invalidation for product images

product.archived.subscriber.ts
  → Set search_vector to NULL (removes from search results immediately)
  → Remove from Google Shopping feed
  → Invalidate CloudFront cache for product images
  → Check for active orders: if any found, alert admin before completing archive

product.image_updated.subscriber.ts
  → Convert uploaded image to WebP using Sharp
  → Generate thumbnail sizes (400×400, 800×800)
  → Upload all sizes to S3 under /images/products/[variant_id]/
  → Invalidate CloudFront cache for old image paths
  → Update product.metadata.image_urls with new CloudFront URLs
```

---

## PART 36 — WEBHOOK RECEIVERS

All webhook endpoints live at `src/api/webhooks/`.
Every webhook is verified by signature before processing.
All webhook payloads stored in `webhook_logs` table for idempotency + debugging.

```typescript
// TABLE: webhook_logs (idempotency — prevents double-processing)
interface WebhookLog {
  id:             string
  source:         'razorpay' | 'stripe' | 'shiprocket' | 'delhivery' |
                  'legitscript' | 'whatsapp'
  event_type:     string        // e.g. 'payment.captured', 'shipment_track'
  event_id:       string        // Provider's unique event ID
  payload:        object        // Full raw payload
  processed:      boolean
  processed_at:   Date | null
  error:          string | null
  created_at:     Date
  // UNIQUE constraint on (source, event_id) — prevents duplicate processing
}
```

### 36.1 Razorpay Webhook — `POST /webhooks/razorpay`

```typescript
// Security: verify X-Razorpay-Signature using HMAC-SHA256
// Secret: RAZORPAY_WEBHOOK_SECRET from environment

Events handled:
  'payment.captured'      → emit order.payment_captured(orderId)
  'payment.failed'        → emit payment.failed(orderId)
  'refund.processed'      → update refund.status = 'processed', notify customer
  'payment_link.paid'     → confirm CS-placed order, notify CS agent
```

### 36.2 Stripe Webhook — `POST /webhooks/stripe`

```typescript
// Security: verify Stripe-Signature using stripe.webhooks.constructEvent()

Events handled:
  'payment_intent.succeeded'      → emit order.payment_captured
  'payment_intent.payment_failed' → emit payment.failed
  'charge.refunded'               → update refund.status = 'processed'
```

### 36.3 Shiprocket Webhook — `POST /webhooks/shiprocket`

```typescript
// Security: verify X-Shiprocket-Hmac-Sha256 header

Events handled:
  'shipment_track'    → normalize to ShipmentEvent → emit shipment.tracking_updated
  'ndr'               → emit shipment.ndr_received with reason
  'rto'               → update shipment.status = 'rto_initiated'
  'delivered'         → emit order.delivered

// Normalize carrier status codes to internal ShipmentStatus enum
// e.g. Shiprocket 'NDR' → internal 'ndr_received'
//      Shiprocket 'DLVD' → internal 'delivered'
```

### 36.4 Delhivery Webhook — `POST /webhooks/delhivery`

```typescript
// Direct carrier webhook (for orders booked directly, not via Shiprocket)
// Normalize Delhivery status codes to same internal ShipmentEvent format
// Handle: Scan, OFD, DEL, RTO, NDR events
```

### 36.5 LegitScript Monitoring Webhook — `POST /webhooks/legitscript/monitoring`

```typescript
Events handled:
  'certification_status_changed' → update compliance_records.status
                                   notify compliance_officer in-app + email
  'monitoring_alert'             → create compliance incident
                                   notify compliance_officer + platform_admin immediately
```

### 36.6 WhatsApp Inbound Webhook — `POST /webhooks/whatsapp/inbound`

```typescript
// Security: verify Meta webhook signature using X-Hub-Signature-256
// This is critical — your CS team currently handles orders via WhatsApp

Message routing logic:
  Text "YES" or "1" → match to pending cod_order confirmation by phone number
                       → confirm COD order, notify CS agent
  Text "NO" or "3"  → match to pending cod_order → cancel order
  Image or PDF      → attempt Rx classification by filename/content type
                       → create draft prescription record linked to customer
                       → notify pharmacist in-app: "Prescription received via WhatsApp"
                       → confirm receipt to customer: "Prescription received. We'll review shortly."
  Any other text    → route to CS conversation queue in /admin/cs/conversations
                       → CS agent sees conversation threaded with customer order history

Customer matching:
  Look up customer by phone number (from WhatsApp sender)
  If no match: create anonymous conversation, CS agent can link to customer
```

---

## PART 37 — COMPLETE WORKFLOW REGISTRY

All workflow files in `src/workflows/`.

### 37.1 Existing Workflows (from V7)

Already defined: `verify-prescription`, `process-rx-checkout`, `process-otc-checkout`, `process-cod-order`, `generate-supply-memo`, `recall-batch`, `partial-shipment-decision`

### 37.2 New Workflows (additions)

**`cancel-order.workflow.ts`**
```
Triggers: customer request | admin action | COD non-confirmation | payment failure | 2h retry timeout
Steps:
  1. Gate: order.status must be ≤ 'payment_captured' to cancel without warehouse ops
     If status is 'pick_pending' or beyond: return CANNOT_CANCEL_IN_PROGRESS
     (Customer must contact CS — warehouse must be notified to stop picking)
  2. Release all FEFO reservations → write stock_movement 'reservation_release' per allocation
  3. If payment authorized but not captured: void authorization via Razorpay/Stripe
  4. If payment captured: create refund request (raised_by = 'system', approved_by = auto for cancel)
  5. Update order_state_history: reason mandatory
  6. Notify customer: SMS + WhatsApp
  7. If prescription was tied to this order: fills_consumed does NOT decrease
     (security: cancellation does not restore fill count — prevents abuse)
  8. Emit order.cancelled event
```

**`retry-payment.workflow.ts`**
```
Trigger: payment.failed event
Steps:
  1. Generate new Razorpay payment link (15-min expiry)
  2. Send to customer: WhatsApp W09 + SMS with link
  3. Set order.status = 'payment_retry_pending'
  4. Schedule job: after 2 hours with no payment → cancel-order.workflow
  5. If customer pays: razorpay.webhook → payment.captured → order.payment_captured
```

**`address-change-after-order.workflow.ts`**
```
Trigger: Customer requests from /account/orders/:id → "Change Address"
Steps:
  1. Gate: order.status must be ≤ 'payment_captured' (before picking starts)
     If picking started: return TOO_LATE_FOR_ADDRESS_CHANGE, show CS contact
  2. Validate new pincode serviceability via Shiprocket API
  3. If new pincode not serviceable: return PINCODE_NOT_SERVICEABLE
  4. Update order shipping_address
  5. If AWB already assigned: cancel AWB via Shiprocket → re-book with new address
  6. Log change in order_state_history: old_address, new_address, changed_by, timestamp
  7. Notify customer: address change confirmed + new estimated delivery date
```

**`subscription-pause.workflow.ts`** + **`subscription-resume.workflow.ts`**
```
PAUSE:
  1. Set refill_subscription.status = 'paused', paused_at = now(), paused_by = customer_id
  2. Cancel all scheduled refill_reminder notifications for this subscription
  3. Cancel any FEFO reservations for upcoming scheduled refill
  4. Notify customer: WhatsApp confirmation with resume instructions

RESUME:
  1. Re-validate Rx: is linked prescription still valid (not expired, fills remaining)?
  2. If Rx expired: notify customer to upload new Rx first → block resume
  3. If Rx valid: set status = 'active'
  4. Recalculate next_refill_date from today (not from pause date)
  5. Notify customer: WhatsApp confirmation with next refill date
```

**`process-return.workflow.ts`**
```
Trigger: return_request approved by finance_admin
Steps:
  1. Create returns_inspection warehouse_task
  2. On inspection completion: evaluate result
     saleable → write stock_movement 'return_restock' → update batch.quantity_available
     damaged/opened/near_expiry → write stock_movement 'damage_write_off'
     recalled → follows batch-destruction.workflow
  3. Process refund: Razorpay/Stripe API call
  4. Generate credit note (CDSCO requirement for returned drug supply)
  5. Notify customer: WhatsApp refund confirmation + timeline (5-7 days)
  6. Update order_item.quantity_returned
```

**`dpdp-data-export.workflow.ts`**
```
Trigger: customer submits download request at /account/privacy
SLA: 24 hours (DPDP Act requirement)
Steps:
  1. Create data_deletion_request with type='export', status='processing'
  2. Collect (non-PHI fields only in export JSON):
     - customer_profile (name, email, phone, addresses)
     - order_history (order IDs, dates, totals — no drug names in export per minimization)
     - prescription_references (IDs and dates only — no document URLs)
     - loyalty_history (points earned/burned with dates)
     - consent_records (all dpdp_consents with timestamps)
  3. Generate ZIP file containing JSON files per category
  4. Upload to S3: exports/{customer_id}/data-export-{timestamp}.zip
  5. Generate signed URL (7-day TTL)
  6. Email customer with download link (Email E07 variant)
  7. Log in phi_audit_log: entity_type='data_export', customer_id
  8. Update data_deletion_request.status = 'completed'
```

**`dpdp-delete-account.workflow.ts`**
```
Trigger: customer submits deletion request + compliance_officer approves
SLA: 30 days (DPDP Act)
Steps:
  1. Gate checks:
     - Active orders? → Cannot delete until fulfilled or cancelled
     - Legal hold records (Rx within 5 years, memos within 5 years)? → Cannot delete those
     - Outstanding COD collection? → Cannot delete until settled
  2. Anonymize PII:
     customer.first_name = 'Deleted'
     customer.last_name = 'User'
     customer.email = 'deleted_{id}@void.suprameds'
     customer.phone = '0000000000'
     customer.addresses → all anonymized to "Address Redacted"
  3. Delete: cart contents, wishlist, guest_sessions, non-retained analytics events
  4. RETAIN (legal hold): orders (GST records — 7 years), Rx prescription references
     (CDSCO — 5 years), audit logs (compliance), supply memos
  5. Set customer.is_deleted = true, deleted_at = now()
  6. Log every field in phi_audit_log: action='delete', field_name, performed_by
  7. Revoke all active JWT tokens via Redis blocklist
  8. Confirm to customer: email with deletion confirmation + what was retained + why
```

**`batch-destruction.workflow.ts`**
```
Trigger: warehouse_manager initiates for expired/recalled/damaged stock
Steps:
  1. Submit compliance_officer approval request (in-app approval)
  2. On compliance_officer approval:
     a. Generate destruction_order record
     b. Warehouse staff performs physical destruction
     c. Record: quantity_destroyed, method, witness_id, date
     d. Upload disposal_certificate (PDF) to S3
     e. Write stock_movement: movement_type = 'destruction', qty = -destroyed_qty
     f. Update batch: quantity_destroyed += qty, status = 'destroyed' if fully destroyed
  3. If recalled batch: update batch_recall_log.stock_destroyed_qty + destruction_certificate
  4. Add to CDSCO inspection export pack
  5. Notify compliance_officer + warehouse_manager: destruction complete
```

**`duplicate-order-check.workflow.ts`**
```
Trigger: order.created event (runs before payment authorization)
Steps:
  1. Query: same customer_id + overlapping variant_ids + created within last 10 minutes
  2. If duplicate found:
     a. Set new order.status = 'duplicate_suspected'
     b. Notify customer on order confirmation page: "You recently placed Order #X with the
        same items. Continue with this order or cancel it below."
     c. Customer must confirm within 30 minutes or new order auto-cancels
  3. If no duplicate: allow order to proceed normally
```

**`onboard-new-staff.workflow.ts`**
```
Trigger: platform_admin creates staff user at /admin/staff → Create
Steps:
  1. Create user record with temp_password (randomly generated, 12+ chars)
  2. Assign selected roles → write user_roles records → log in role_audit_log
  3. If pharmacist or PIC role: require RPh license number + council + expiry date
     → write pharmacist_profiles record
  4. Send welcome email: temporary password + MFA setup instructions
     "Your Suprameds admin account has been created. Set up MFA before first login."
  5. Set force_password_change = true (enforced on first login)
  6. If pharmacist: add to pharmacist_profiles with verified RPh details
```

**`offboard-staff.workflow.ts`**
```
Trigger: platform_admin marks staff as inactive
Steps:
  1. Set user.is_active = false
  2. Add all user's active JWT tokens to Redis blocklist (immediate session kill)
  3. Set all user_roles.is_active = false → log revocations in role_audit_log
  4. Transfer all open Rx review tasks to unassigned pool (pharmacist queue)
  5. Transfer all open warehouse tasks to unassigned pool
  6. Revoke any API keys created by this user
  7. Generate offboarding audit record: revoked_by, reason, timestamp
  8. Notify platform_admin: offboarding complete summary
```

**`ewaybill-generate.workflow.ts`**
```
Trigger: order.dispatched event when interstate + order_value > ₹50,000
Steps:
  1. Check: shipping_state ≠ origin_state AND total > ₹50,000
  2. If both true: call NIC eWaybill API with:
     seller GSTIN, buyer GSTIN (if B2B), HSN codes, item values, transporter ID
  3. On success: store ewaybill_number + document URL on shipment record
  4. Attach eWaybill number to supply_memo
  5. If generation fails: HOLD dispatch, notify admin — dispatch cannot proceed
     without eWaybill for qualifying orders (legal requirement)
```

---

## PART 38 — COMPLETE SCHEDULED JOBS REGISTRY

All jobs in `src/jobs/`. Every job has: schedule (cron), idempotency guard, error alerting.

### 38.1 Existing Jobs (from V7) — Confirmed

`license-expiry-check`, `batch-expiry-alert`, `expiry-auto-quarantine`, `refill-reminders`, `chronic-reorder-reminders`, `google-feed-sync`, `price-sync-audit`, `phi-retention-audit`, `lifecycle-stage-compute`, `churn-score-compute`, `loyalty-points-expiry`, `pincode-cache-refresh`, `cod-remittance-reconcile`, `stock-alert-notify`, `analytics-materialized-views`

### 38.2 New Jobs (additions)

```
session-cleanup.job.ts                 Schedule: every hour
  DELETE guest_sessions WHERE expires_at < NOW()
  Purge Redis keys: cart:{expired_tokens}
  Log count of sessions cleaned

sitemap-generate.job.ts                Schedule: daily 1 AM IST
  Build /public/sitemap.xml:
    All published OTC product pages (/products/[handle])
    All compliance pages (/privacy, /terms, /pharmacy/licenses, /prescription-policy, etc.)
    All published blog posts (/blog/[slug])
  EXCLUDE: /account, /admin, /pharmacy portal, /checkout, Rx-only product pages
  Submit to Google Search Console API on completion
  NEVER include Rx-only product URLs (LegitScript + Google Ads policy)

meilisearch-full-reindex.job.ts        Schedule: weekly Sunday 3 AM IST
  Full rebuild of MeiliSearch product index
  Catches any products that failed incremental indexing during week
  Prune deleted/archived products from index

cod-auto-cancel.job.ts                 Schedule: every 30 minutes
  Query: cod_orders WHERE status = 'pending_confirmation'
         AND created_at < NOW() - INTERVAL '24 hours'
         AND LENGTH(confirmation_calls) >= 2
  For each: trigger cancel-order.workflow
  Notify CS team: summary of auto-cancelled orders

override-expiry.job.ts                 Schedule: every 15 minutes
  Query: override_requests WHERE status = 'approved'
         AND expires_at < NOW() AND used_at IS NULL
  For each: set status = 'expired'
  Notify requester in-app: "Your override OVR-XX expired unused"

prescription-expiry-notify.job.ts      Schedule: daily 9 AM IST
  Query: prescriptions WHERE status = 'fully_approved'
         AND valid_until BETWEEN NOW() AND NOW() + INTERVAL '30 days'
         AND expiry_reminder_sent_at IS NULL
  For each: send WhatsApp W06 (expiry warning + telemedicine link)
  Set expiry_reminder_sent_at = NOW()

back-order-fulfillment.job.ts          Schedule: every 2 hours
  Query: order_items WHERE is_back_ordered = true
  For each: check if variant now has sufficient available stock
  If yes: trigger FEFO allocation → progress order to pick_pending
  Notify customer: "Your back-ordered item [name] is now ready"

gstr1-monthly.job.ts                   Schedule: 1st of month 6 AM IST
  Generate GSTR-1 report for previous month
  Upload PDF + CSV to S3
  Notify finance_admin in-app + email: "GSTR-1 for [month] is ready — file by 11th"

h1-register-monthly.job.ts             Schedule: 1st of month 7 AM IST
  Generate Schedule H1 dispensing register summary for previous month
  Upload to S3
  Notify compliance_officer: ready for CDSCO records

payment-link-expiry.job.ts             Schedule: every 30 minutes
  Query: cs_placed_orders WHERE payment_method = 'payment_link'
         AND payment_link_expires_at < NOW()
         AND payment_status = 'pending'
  For each: cancel order + notify CS agent
  CS agent can regenerate link via admin if customer still wants to pay

cod-customer-score-compute.job.ts      Schedule: nightly 2 AM IST
  Recompute CodCustomerScore for all customers with COD orders
  Update: total_cod_orders, cod_rto_count, cod_rto_rate, consecutive_rtos
  Update cod_eligible + cod_limit based on scoring rules
  If cod_eligible changed false: notify CS team for that customer

review-request-send.job.ts             Schedule: every hour
  Query: orders WHERE status = 'delivered'
         AND delivered_at < NOW() - INTERVAL '24 hours'
         AND review_requested = false
         AND is_rx_order = false   (OTC only — never Rx)
  Send review request: Email E06
  Set review_requested = true on order

delivery-otp-expiry.job.ts             Schedule: every hour
  Query: delivery_otp_logs WHERE verified = false
         AND created_at < NOW() - INTERVAL '48 hours'
  Mark as expired
  Transition shipment to NDR status
  Notify warehouse_manager + CS team

stock-turnover-compute.job.ts          Schedule: weekly Sunday 4 AM IST
  For each variant: units sold / avg stock over last 30 days
  Update product.metadata.stock_turnover_rate
  Generate slow-moving stock report (turnover < 1x/month)

cloudfront-cache-refresh.job.ts        Schedule: on-demand (admin trigger button)
  AWS CloudFront CreateInvalidation for updated product image paths
  Batch up to 1000 paths per call (CloudFront limit)
  Used after bulk product image uploads
```

---

## PART 39 — COMPLETE API ROUTE REGISTRY

### 39.1 Public Routes (no auth)

```
GET  /health                           Health check (ECS probe)
GET  /feeds/google-shopping.xml        Google Shopping feed (OTC only)
GET  /sitemap.xml                      SEO sitemap (auto-generated)
GET  /robots.txt                       Crawler instructions
GET  /api/scan/:qr_code                Drug batch QR scanner (public)
GET  /api/pincode/check?pincode=X      Serviceability AJAX check
GET  /ref/:code                        Referral link handler → redirect with UTM
GET  /track/:awb                       Public order tracking
```

### 39.2 Webhook Routes (no auth — signature verified internally)

```
POST /webhooks/razorpay                Razorpay payment events
POST /webhooks/stripe                  Stripe payment events
POST /webhooks/aftership               AfterShip tracking updates (all India Post events)
POST /webhooks/legitscript/monitoring  LegitScript certification monitoring
POST /webhooks/whatsapp/inbound        Inbound WhatsApp messages from customers
```

### 39.3 Auth Routes

```
POST /auth/otp/send                    Send OTP to phone (DLT template T01)
POST /auth/otp/verify                  Verify OTP → issue JWT
POST /auth/google                      Google OAuth callback
POST /auth/refresh                     Refresh JWT token
POST /auth/logout                      Invalidate token (Redis blocklist)
POST /auth/password/reset-request      Send password reset email
POST /auth/password/reset              Apply new password
```

### 39.4 Customer Routes (auth: customer role)

```
GET    /customers/me                   Get own profile
PUT    /customers/me                   Update profile (name, email, preferences)
POST   /customers/me/phone-change      Phone change flow (OTP on old + new phones)
GET    /customers/me/orders            Order history (paginated)
GET    /customers/me/orders/:id        Single order detail + memo download link
GET    /customers/me/prescriptions     Prescription list (no PHI document content)
GET    /customers/me/prescriptions/:id Prescription status + line decisions
POST   /customers/me/prescriptions     Upload new prescription
GET    /customers/me/addresses         Saved address book
POST   /customers/me/addresses         Add address
PUT    /customers/me/addresses/:id     Edit address
DELETE /customers/me/addresses/:id     Remove address
POST   /customers/me/family            Add family profile
PUT    /customers/me/family/:fid       Update family profile
DELETE /customers/me/family/:fid       Remove family profile
GET    /customers/me/loyalty           Loyalty account + tier + points history
GET    /customers/me/notifications     Communication preferences
PUT    /customers/me/notifications     Update preferences (consent audit logged)
POST   /customers/me/data-export       DPDP data download request
POST   /customers/me/delete-request    DPDP account deletion request
GET    /customers/me/refill-subscriptions       Active subscriptions
POST   /customers/me/refill-subscriptions       Create subscription
PUT    /customers/me/refill-subscriptions/:id   Pause/resume/update
DELETE /customers/me/refill-subscriptions/:id   Cancel subscription
```

### 39.5 Product & Cart Routes (public + customer)

```
GET  /products                         Product catalog (MeiliSearch, OOS-aware)
GET  /products/:handle                 Product detail page data
GET  /products/:id/interactions        Drug interaction check (cart use)
GET  /products/:id/substitutes         Pharmacist-approved substitutions
POST /products/:id/stock-alert         Subscribe to OOS restock alert
DELETE /products/:id/stock-alert       Unsubscribe from OOS alert

GET    /cart                           Get current cart (DB or Redis)
POST   /cart/items                     Add item (triggers interaction check)
PUT    /cart/items/:id                 Update quantity
DELETE /cart/items/:id                 Remove item
DELETE /cart                           Clear cart
POST   /cart/merge                     Merge guest Redis cart into account cart on login
POST   /cart/coupon                    Apply promotion coupon code
DELETE /cart/coupon                    Remove coupon
```

### 39.6 Order Routes (customer)

```
POST   /orders                         Create order (OTC prepaid, Rx hold, COD)
GET    /orders/:id                     Order detail
GET    /orders/:id/memo                Download CDSCO supply memo PDF (signed URL)
GET    /orders/:id/invoice             Download GST invoice PDF
POST   /orders/:id/cancel              Cancel order (validates state machine)
PUT    /orders/:id/address             Change address (pre-pick only)
POST   /orders/:id/retry-payment       Generate new payment link on failure
POST   /orders/:id/partial-preference  Submit ship_available / wait_for_all choice
POST   /orders/:id/confirm-duplicate   Confirm intentional duplicate order
```

### 39.7 Admin — Product Management

```
GET    /admin/products                 Product list (filters: status, schedule, category, stock)
POST   /admin/products                 Create product
GET    /admin/products/:id             Product detail with all tabs
PUT    /admin/products/:id             Update product
POST   /admin/products/:id/publish     Publish product
POST   /admin/products/:id/archive     Archive product (soft — not hard delete)
POST   /admin/products/bulk-price      Bulk price update (preview + confirm steps)
GET    /admin/products/:id/price-history  Price change audit log
POST   /admin/products/:id/images      Upload product images
DELETE /admin/products/:id/images/:img Delete specific image

GET    /admin/categories               Category list
POST   /admin/categories               Create category
PUT    /admin/categories/:id           Update category
DELETE /admin/categories/:id           Archive category
```

### 39.8 Admin — Inventory & Warehouse

```
GET    /admin/inventory                Batch list (filters: product, expiry, status)
POST   /admin/inventory/batches        Create batch (triggered by GRN approval)
PUT    /admin/inventory/batches/:id    Update batch status
POST   /admin/inventory/batches/:id/adjust   Manual stock adjustment
GET    /admin/inventory/batches/:id/movements Stock movement ledger
GET    /admin/inventory/batches/:id/allocations   Open reservations

GET    /admin/warehouse/tasks          Task board (all types)
GET    /admin/warehouse/tasks/:id      Task detail
PUT    /admin/warehouse/tasks/:id      Update task status / assign staff

POST   /admin/warehouse/grn            Create GRN
GET    /admin/warehouse/grn            GRN list
GET    /admin/warehouse/grn/:id        GRN detail
POST   /admin/warehouse/grn/:id/approve   QC approve (SSD: different staff from creator)
POST   /admin/warehouse/grn/:id/reject    QC reject with reason

GET    /admin/warehouse/bins           Bin map data (for visual grid widget)
POST   /admin/warehouse/bins           Create bin
PUT    /admin/warehouse/bins/:id       Update bin (capacity, active status)

POST   /admin/warehouse/suppliers      Create supplier
GET    /admin/warehouse/suppliers      Supplier list with QC rating
GET    /admin/warehouse/suppliers/:id  Supplier detail + GRN history + score
PUT    /admin/warehouse/suppliers/:id  Update supplier
DELETE /admin/warehouse/suppliers/:id  Deactivate supplier (soft)

POST   /admin/warehouse/purchase-orders       Create PO
GET    /admin/warehouse/purchase-orders       PO list
GET    /admin/warehouse/purchase-orders/:id   PO detail
PUT    /admin/warehouse/purchase-orders/:id   Update PO (before sending)
POST   /admin/warehouse/purchase-orders/:id/send   Send PO to supplier (email PDF)
POST   /admin/warehouse/purchase-orders/:id/receive Link PO to GRN on delivery
```

### 39.9 Admin — Orders & Customers

```
GET    /admin/orders                   Order list (filters: status, date, payment, Rx)
GET    /admin/orders/:id               Full order detail with all related data
PUT    /admin/orders/:id/status        Manual status update (with reason)
POST   /admin/orders/:id/refund        Initiate refund request
GET    /admin/orders/export            CSV export (Vyappar-compatible format)
GET    /admin/orders/cod               COD orders dashboard + confirmation queue

GET    /admin/customers                Customer list (search by name/phone/email)
GET    /admin/customers/:id            Customer 360 profile
PUT    /admin/customers/:id            Edit customer details
POST   /admin/customers/:id/merge      Merge duplicate customer accounts
POST   /admin/customers/:id/cod-toggle Toggle COD eligibility for customer (CS use)
POST   /admin/customers/:id/order      CS agent places order on behalf of customer
GET    /admin/cs/conversations         WhatsApp conversation queue
GET    /admin/cs/conversations/:id     Single conversation thread
POST   /admin/cs/conversations/:id/reply  Reply to customer via WhatsApp
POST   /admin/cs/conversations/:id/link   Link conversation to customer/order
```

### 39.10 Admin — Prescriptions & Pharmacist

```
GET    /admin/prescriptions            Rx queue with SLA timers (pharmacist view)
GET    /admin/prescriptions/:id        Full Rx with inline PDF viewer
GET    /admin/prescriptions/:id/document  Signed S3 URL for Rx doc (PHI-logged)
POST   /admin/prescriptions/:id/lines/:lid/decide  Per-line dispense decision
POST   /admin/prescriptions/:id/pre-dispatch        Pre-dispatch pharmacist sign-off
GET    /admin/h1-register              H1 dispensing register view
GET    /admin/h1-register/export       H1 register PDF/CSV export
```

### 39.11 Admin — Staff Management

```
GET    /admin/staff                    All staff users
POST   /admin/staff                    Create staff → triggers onboard-staff.workflow
GET    /admin/staff/:id                Staff detail + activity log + open tasks
PUT    /admin/staff/:id                Update profile + roles
POST   /admin/staff/:id/deactivate     Offboard → triggers offboard-staff.workflow
GET    /admin/staff/:id/activity       Full audit log for this staff member
POST   /admin/staff/:id/roles          Add role assignment (with reason)
DELETE /admin/staff/:id/roles/:role_id Remove role (with reason, logged)
```

### 39.12 Admin — Compliance, Reports & Analytics

```
GET    /admin/compliance/checklist/run     Trigger checklist manually
GET    /admin/compliance/checklist         Latest 20-item checklist results
GET    /admin/compliance/licenses          License registry list
POST   /admin/compliance/licenses          Add license
PUT    /admin/compliance/licenses/:id      Update / renew license
GET    /admin/overrides                    Override request list
POST   /admin/overrides/request            Submit override request
POST   /admin/overrides/:id/approve        Approve (MFA re-verify required)
POST   /admin/overrides/:id/reject         Reject with reason

GET    /admin/reports/gstr1                GSTR-1 report (month param)
GET    /admin/reports/h1-register          H1 register (date range param)
GET    /admin/reports/cdsco-pack           CDSCO inspection export (ZIP download)
GET    /admin/reports/sales                Sales CSV (Vyappar-compatible)
GET    /admin/reports/margin               Margin analysis by product/category
GET    /admin/reports/price-history        Price change report
// NOTE: /admin/reports/cod-reconciliation deferred to Phase 2

GET    /admin/analytics/kpi                Main KPI dashboard data
GET    /admin/analytics/funnel             Checkout funnel conversion
GET    /admin/analytics/inventory          Inventory metrics
GET    /admin/analytics/cohorts            Cohort retention heatmap
GET    /admin/analytics/cod                COD vs prepaid analytics
GET    /admin/analytics/pricing            Margin dashboard

GET    /admin/crm/customers                Customer 360 list with filters
GET    /admin/crm/segments                 Saved segments
POST   /admin/crm/segments                 Create/update segment
POST   /admin/crm/campaigns/:id/trigger    Manual campaign trigger for segment

GET    /admin/notifications/templates      Template list with DLT status
POST   /admin/notifications/templates      Create template
PUT    /admin/notifications/templates/:id  Update template
POST   /admin/notifications/test           Send test to self

GET    /admin/reviews                      Moderation queue
POST   /admin/reviews/:id/approve          Approve with optional note
POST   /admin/reviews/:id/reject           Reject with reason

GET    /admin/grievances                   All tickets with SLA timers
PUT    /admin/grievances/:id               Update status / assign / escalate

POST   /admin/loyalty/adjust              Manual loyalty point adjustment
```

---

## PART 40 — COMPLETE INTEGRATION REGISTRY

All integrations in `src/integrations/`. Each integration is a standalone service with its own error handling, retry logic, and circuit breaker.

### 40.1 Payment Integrations

**Razorpay** (`razorpay.provider.ts`)
- Payment orders: create, authorize, capture, void
- Refunds: full + partial
- Payment links: create (for CS team WhatsApp orders), check status, expire
- COD: create COD shipment order
- Webhook: signature verification
- Fallback: if Razorpay returns 503 → route to Cashfree (40.2)

**Stripe** (`stripe.provider.ts`)
- Payment intents: create, capture, cancel
- Refunds
- 3DS2 authentication handling
- Webhook: signature verification
- Use for: international orders only

**Cashfree** (`cashfree.provider.ts`) — Payment Gateway Fallback
- Activated when Razorpay returns 503 or times out (circuit breaker: 3 failures in 60s)
- Supports same methods: UPI, cards, netbanking
- Customer experience: seamless — same checkout UI, different backend
- Admin setting: `force_fallback_gateway` toggle for planned Razorpay maintenance
- Health check endpoint polled every 30 seconds to detect Razorpay recovery

### 40.2 Logistics Integrations

**India Post Speed Post Pro (EZ Shipment)** — Your existing carrier account
- You book shipments manually via India Post EZ Shipment portal
- COD collection handled by India Post delivery agents
- Monthly remittance to your bank account (managed outside platform in Phase 1)
- AWB format: EU/EE/CP + 8 digits + IN (e.g. EU123456789IN)
- Confirm with India Post account manager: tracking numbers are Speed Post article numbers

**AfterShip** (`aftership.adapter.ts`) — Tracking layer only
- Registers AWB numbers with AfterShip after staff manual entry
- AfterShip polls India Post and pushes status updates via webhook
- `POST /trackings` — register new tracking number
  ```json
  { "tracking": { "tracking_number": "EU123456789IN", "slug": "india-post" } }
  ```
- Webhook: `POST /webhooks/aftership` — AfterShip pushes on every status change
- Normalized statuses: Pending → InfoReceived → InTransit → OutForDelivery → Delivered
- Branded tracking page: configure at AfterShip dashboard → use tracking.suprameds.in CNAME
- Pricing: AfterShip Essentials ~₹924/month + overages (~₹2,604/month at 350 orders)

**Delivery Estimate Service** (`delivery-estimate.service.ts`) — Pure lookup table
- India Post delivers everywhere — no serviceability API call needed
- Pincode → state lookup using free India pincode dataset (seed data, stored in DB)
- State → estimated delivery days from `delivery_days_lookup` table
- 0ms response time vs 200-500ms for any external API call

### 40.3 Communication Integrations

**MSG91** (`sms.service.ts`)
- Send SMS via DLT-registered templates only
- Template validation: reject send if DLT ID not registered
- OTP: separate flow via MSG91 OTP API (higher priority delivery)
- Bulk SMS: queued via Redis, sent in batches of 100
- Delivery receipt webhooks → update notification delivery status

**Twilio / Gupshup WhatsApp Business API** (`whatsapp.service.ts`)
- Send templated messages (requires WABA-approved templates)
- Send media: PDF supply memo attachments, prescription receipt
- Inbound webhook: route messages to WhatsApp inbound handler
- Conversation API: two-way CS conversations in admin

**SendGrid** (`email.service.ts`)
- Transactional emails via templates
- Suppression list sync (honors unsubscribe from marketing opt-out)
- Bounce handling webhook → update customer.email_bounced flag
- PHI firewall: never include drug names or health data in email subjects/preheaders

### 40.4 Search — PostgreSQL Full-Text Search

No external service. No additional cost. Runs entirely inside your Medusa Cloud PostgreSQL database.

**Database Setup (one-time migration):**

```sql
-- 1. Add search_vector column to products table
ALTER TABLE products ADD COLUMN search_vector tsvector;

-- 2. Populate from multiple drug fields
UPDATE products SET search_vector =
  to_tsvector('english',
    COALESCE(title, '') || ' ' ||
    COALESCE(metadata->>'generic_name', '') || ' ' ||
    COALESCE(metadata->>'manufacturer', '') || ' ' ||
    COALESCE(metadata->>'drug_class', '') || ' ' ||
    COALESCE(metadata->>'dosage_form', '')
  );

-- 3. GIN index — makes search fast even with 10,000 products
CREATE INDEX idx_products_search_vector
  ON products USING GIN(search_vector);

-- 4. Also index for filtering (used heavily in catalog)
CREATE INDEX idx_products_schedule
  ON products((metadata->>'schedule_classification'));
CREATE INDEX idx_products_requires_rx
  ON products((metadata->>'requires_prescription'));

-- 5. Auto-update trigger — keeps search_vector current on every save
CREATE OR REPLACE FUNCTION update_product_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector('english',
      COALESCE(NEW.title, '') || ' ' ||
      COALESCE(NEW.metadata->>'generic_name', '') || ' ' ||
      COALESCE(NEW.metadata->>'manufacturer', '') || ' ' ||
      COALESCE(NEW.metadata->>'drug_class', '') || ' ' ||
      COALESCE(NEW.metadata->>'dosage_form', '')
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_search_vector_update
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_product_search_vector();
```

**Search Service (`src/modules/products/pg-search.service.ts`):**

```typescript
interface SearchParams {
  query: string
  filters?: {
    schedule_classification?: string    // 'OTC' | 'H' | 'H1'
    requires_prescription?: boolean
    category?: string
    min_price?: number
    max_price?: number
    in_stock_only?: boolean             // filter by mv_inventory_status.available > 0
  }
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'name_asc'
  limit?: number    // default 20
  offset?: number   // for pagination
}

async function searchProducts(params: SearchParams): Promise<Product[]> {
  const { query, filters, sort = 'relevance', limit = 20, offset = 0 } = params

  // Prefix search (as-you-type): append :* to last word for partial matching
  // "dolo 6" → finds "Dolo 650"
  const tsQuery = query
    .trim()
    .split(/\s+/)
    .map((word, i, arr) => i === arr.length - 1 ? `${word}:*` : word)
    .join(' & ')

  const result = await db.query(`
    SELECT
      p.*,
      pv.*,
      mv.available,
      mv.earliest_expiry,
      ts_rank(p.search_vector, to_tsquery('english', $1)) AS relevance
    FROM products p
    JOIN product_variants pv ON pv.product_id = p.id
    LEFT JOIN mv_inventory_status mv ON mv.variant_id = pv.id
    WHERE
      p.status = 'published'
      AND ($1 = '' OR p.search_vector @@ to_tsquery('english', $1))
      ${filters?.schedule_classification
        ? `AND p.metadata->>'schedule_classification' = '${filters.schedule_classification}'`
        : ''}
      ${filters?.requires_prescription !== undefined
        ? `AND (p.metadata->>'requires_prescription')::boolean = ${filters.requires_prescription}`
        : ''}
      ${filters?.in_stock_only
        ? 'AND mv.available > 0'
        : ''}
    ORDER BY
      ${sort === 'relevance'   ? 'mv.available DESC, relevance DESC, p.title ASC' : ''}
      ${sort === 'price_asc'   ? 'pv.price ASC' : ''}
      ${sort === 'price_desc'  ? 'pv.price DESC' : ''}
      ${sort === 'name_asc'    ? 'p.title ASC' : ''}
    LIMIT $2 OFFSET $3
  `, [tsQuery || '', limit, offset])

  return result.rows
}

// Weekly rebuild job (pg-fts-rebuild.ts) — catches any missed trigger updates:
async function rebuildAllSearchVectors() {
  await db.query(`
    UPDATE products SET search_vector =
      to_tsvector('english',
        COALESCE(title, '') || ' ' ||
        COALESCE(metadata->>'generic_name', '') || ' ' ||
        COALESCE(metadata->>'manufacturer', '') || ' ' ||
        COALESCE(metadata->>'drug_class', '') || ' ' ||
        COALESCE(metadata->>'dosage_form', '')
      )
  `)
}
```

**What this handles for Suprameds:**
- ✅ Brand name search: "Dolo" → finds "Dolo 650"
- ✅ Generic name search: "paracetamol" → finds all paracetamol products
- ✅ Manufacturer search: "Cipla" → all Cipla products
- ✅ Prefix (as-you-type): "dolo 6" → "Dolo 650" (`:*` operator)
- ✅ Filtering by: schedule, Rx/OTC, category, price, stock status
- ✅ OOS-aware: in-stock products ranked higher by default
- ✅ Zero external service — entirely inside Medusa Cloud PostgreSQL
- ✅ < 10ms response time even with 10,000 products

**What it does NOT handle (acceptable trade-off at your scale):**
- ❌ Fuzzy typo tolerance: "paracetamol" won't find "paracetamo" (missing last letter)
  → Acceptable: customers searching for medicines know the drug name
  → Workaround: add common misspellings as product tags/metadata
- ❌ Phonetic matching ("Dolo" won't find "Doloe")
  → Not needed for a pharmacy catalog

**Upgrade path:** If typo tolerance becomes a real customer complaint after launch,
add MeiliSearch self-hosted on Railway (~₹500/month). The search service interface
is identical — swap the implementation, keep all the routes and UI unchanged.

### 40.5 Drug Data Integrations

**OpenFDA Drug Label API** (`openfda-labels.service.ts`)
- Endpoint: `api.fda.gov/drug/label.json?search=brand_name:"{name}"`
- Use: initial population of indications, warnings, dosage, side effects
- Rate limit: 1000 requests/hour (free tier) — batch import job respects this
- Cache results in drug_information table (weekly refresh)

**OpenFDA Drug Interaction API** (`openfda-interactions.service.ts`)
- Endpoint: `api.fda.gov/drug/interaction.json?drug={rxcui}`
- Trigger: product.created (import interactions) + cart add event (real-time check)
- Cache: interaction pairs in drug_interactions table (weekly refresh via job)
- Real-time cart check: compare molecule_id of all cart items against interaction table
  - mild → info banner (no block)
  - moderate → warning banner (can proceed)
  - severe → BLOCK add to cart, show "Consult pharmacist before combining these"

**CDSCO Drug Database** (`cdsco-db-sync.service.ts`)
- Source: cdscoonline.gov.in (public CSV downloads)
- Import: drug registration numbers, schedule classification, approved indications, manufacturer
- Schedule: weekly delta sync job
- Data quality: CDSCO data is authoritative for Indian schedule classification

### 40.6 Compliance Integrations

**GSTN Validation API** (`gstn-validator.service.ts`)
- Endpoint: `api.gst.gov.in/commonapi/v1.1/search?action=TP&gstin=XX`
- Use: validate GSTIN on B2B customer registration and B2B invoice generation
- Free API, no auth required for format check
- Also validate GSTIN format locally: 15-character alphanumeric with checksum

**NIC eWaybill API** (`ewaybill.service.ts`)
- Endpoint: `ewaybillgst.gov.in` (NIC portal API)
- Trigger: order.dispatched when interstate + order_value > ₹50,000
- Generates: eWaybill number + document PDF
- Attach: eWaybill number to supply_memo + shipment record
- Failure handling: hold dispatch, alert admin — cannot proceed without eWaybill

**LegitScript Seal CDN** (`legitscript-seal.service.ts`)
- Dynamic seal embed from LegitScript CDN in site footer
- Seal links to LegitScript verification lookup URL
- Fallback: static seal image if CDN unavailable (non-blocking)

**Google Search Console API** (`search-console.service.ts`)
- Triggered by sitemap-generate.job.ts on completion
- Submits sitemap URL for indexing
- Pings on new published products

### 40.7 Infrastructure Integrations

**AWS S3** (via AWS SDK)
- Buckets: `suprameds-rx-documents` (private, SSE-S3) + `suprameds-assets` (public + CDN)
- Signed URL generation: 1h TTL for Rx docs, 7 days for data exports
- Lifecycle rules: 
  - rx-documents: no expiry (retained 5 years minimum — CDSCO requirement)
  - temp-exports: delete after 7 days
  - product-images: no expiry

**AWS CloudFront** (via AWS SDK)
- Cache invalidation: called by product.image_updated subscriber
- Distribution: suprameds-assets bucket → CloudFront → storefront image URLs
- Cache headers: `Cache-Control: public, max-age=31536000` for product images

**AWS SES** (via AWS SDK + SendGrid fallback)
- Primary: SendGrid for transactional emails (better deliverability tooling)
- Fallback: AWS SES if SendGrid rate-limited or down
- Email unsubscribe: both services honor suppression list

**Redis** (ioredis client)
- Session storage: guest carts, OTP codes, SLA timers, JWT blocklist
- Pub/Sub: real-time in-app notifications to admin browser (SSE gateway)
- Rate limiting: using sliding window algorithm per IP + per user
- Distributed locks: for FEFO allocation (prevent race conditions)

### 40.8 Optional / Future Integrations

**ABHA Health ID** (`abha-verification.service.ts`) — Phase 2
- NHA API: `healthid.ndhm.gov.in`
- Verify patient ABHA ID, link to family_profile
- Positions Suprameds for National Digital Health Mission compliance
- Optional field at family profile creation

**Freshdesk** (`freshdesk.service.ts`) — Phase 2
- Medusa grievance.created → create Freshdesk ticket
- Freshdesk ticket resolved → update grievance.status in Medusa
- Prescription query tag → auto-assign to pharmacist team in Freshdesk
- PHI firewall: Freshdesk widget script disabled on /checkout, /account/prescriptions

**Tally Integration** — Phase 3 (when order volume makes Vyappar CSV import slow)
- Medusa → webhook → Tally XML format
- Automates daily sales journal entries
- Consider when: weekly manual CSV import to Vyappar takes > 2 hours

---

## PART 41 — ADMIN CRUD PANELS (COMPLETE)

Every entity has a full admin management interface. These are custom Medusa Admin extensions.

### 41.1 Supplier Management (`/admin/warehouse/suppliers`)

```
List view:
  Columns: Name | Drug License | QC Rating | Last GRN | Active POs | Status
  Filters: active/inactive, QC rating range, product category
  Search: by name, license number, GSTIN

Detail view (/admin/warehouse/suppliers/:id):
  Tabs: Overview | GRN History | Purchase Orders | Performance Score
  Overview: all contact details, license number, GSTIN, approved products list
  Performance: QC pass rate %, on-time delivery %, price variance chart

Create/Edit form:
  supplier_name, drug_license_no, license_expiry,
  gst_number (validated via GSTN API), contact_person,
  phone, email, address, payment_terms,
  approved_products (multi-select from product catalog),
  kyc_documents (upload: license copy, GST cert)

Deactivate: soft delete with mandatory reason
  Checks: any active POs? → cannot deactivate until POs closed
```

### 41.2 Purchase Order Management (`/admin/warehouse/purchase-orders`)

```
List view:
  Columns: PO Number | Supplier | Items | Total Value | Status | Expected Delivery
  Filters: status (draft/sent/partial/received/closed), supplier, date range

Detail view:
  PO line items with product, quantity, expected unit price
  GRN linkage: which GRNs have arrived against this PO
  Outstanding: quantity ordered vs received per line

Create form:
  Select supplier → auto-populate from approved_products
  Add line items: product + qty + expected_price
  Set expected_delivery_date
  Save as draft → Edit → Confirm → Send (emails PDF to supplier)

Status flow:
  draft → confirmed → sent → [partial_received] → fully_received → closed
```

### 41.3 Staff Management (`/admin/staff`)

```
List view:
  Columns: Name | Roles | Last Active | MFA Status | Status
  Filters: by role, active/inactive, MFA enabled/disabled

Detail view (/admin/staff/:id):
  Tabs: Profile | Roles | Open Tasks | Activity Log
  Profile: name, email, phone, RPh details if pharmacist
  Roles: all assigned roles with assignment date + who assigned
  Open Tasks: Rx queue items, warehouse tasks, pending approvals
  Activity: full audit log of actions by this staff member

Create form:
  name, email, phone, role(s), warehouse_id (for warehouse staff)
  If pharmacist role: rph_license_number, rph_council, rph_license_expiry
  Triggers: onboard-staff.workflow

Edit: same fields + role management
Deactivate: triggers offboard-staff.workflow with mandatory reason
```

### 41.4 Notification Template Management (`/admin/notifications/templates`)

```
List view:
  Columns: Code | Channel | Trigger Event | DLT ID | DLT Status | Active
  Filter: by channel (SMS/WhatsApp/email), by DLT registration status

Detail/Edit view:
  Template code (readonly), channel, trigger_event
  DLT Template ID (SMS: mandatory, shows warning if missing)
  DLT registration status + registered date
  Sender ID (MSG91 sender)
  Template text with {#var#} variable highlighting
  Variables list (auto-detected from template text)
  is_rx_allowed toggle (false for all promotional)
  Test button: sends test to your own phone/email with dummy variables

Warning on edit:
  "Changing an SMS template that is DLT-registered requires
   re-registration with TRAI (3-7 days). Change the DLT ID field
   after re-registration is approved."
```

### 41.5 Reviews Moderation (`/admin/reviews`)

```
Queue view:
  Columns: Product | Customer | Rating | Date | Status | Flag Reason
  Filters: status (pending/approved/rejected/flagged), rating, date, product
  Bulk actions: approve all clean, reject all flagged

Individual review:
  Full review text with flagged terms highlighted in red
  Customer order verification: shows order_id that triggered review (verified purchase badge)
  Approve: with optional moderator note
  Reject: with mandatory reason (shown to customer if they enquire)
  Flag: override flag for additional review

Pharmacist Q&A moderation:
  All unanswered customer questions across all PDPs
  Pharmacist clicks question → types answer → publishes
  Answer includes: pharmacist name + RPh license number (regulatory requirement)
```

### 41.6 Grievance Management (`/admin/grievances`)

```
Dashboard:
  SLA countdown timers: 24h (acknowledge), 48h (resolve)
  Color: green > 12h remaining, orange 6–12h, red < 6h
  Stats: open, in progress, resolved today, avg resolution time

List view:
  Columns: Ticket # | Customer | Type | Assigned To | Status | SLA Timer
  Filters: type, status, agent, date range

Detail view:
  Full conversation history + all customer messages
  Order/prescription linkage (if relevant)
  Status update: open → in_progress → resolved → escalated
  Assign to agent
  Escalate to supervisor (auto-escalates at 36h anyway)
  Internal notes: agents can leave notes not visible to customer

Escalation:
  Auto-escalated at 36h → supervisor assigned
  Email notification to supervisor on escalation
```

### 41.7 CS Conversation Queue (`/admin/cs/conversations`)

```
List view (real-time, Redis pub/sub):
  All active WhatsApp conversations from /webhooks/whatsapp/inbound
  Unassigned conversations shown first
  Customer match status: matched / unmatched (needs manual link)

Conversation view (/admin/cs/conversations/:id):
  Full WhatsApp message thread
  Customer profile panel (if matched): name, phone, last order, open orders
  Quick actions: Link to customer, Link to order, Escalate to pharmacist
  Reply box: compose reply → sends via WhatsApp Business API
  Attachment: can forward prescription PDF to pharmacist queue
  Tag: order_enquiry | prescription_query | complaint | new_order

COD Confirmation queue:
  Separate tab within CS conversations
  All COD orders awaiting confirmation call
  Agent marks outcome: confirmed / no_answer / declined
  System updates cod_order.confirmation_calls array
```

### 41.8 Loyalty Manual Adjustment (`/admin/loyalty/adjust`)

```
Search: customer by phone / email / name
Customer loyalty panel:
  Current points, tier, lifetime points, tier expiry
  Full points ledger (last 50 transactions)

Adjustment form:
  Type: add / subtract
  Amount: number of points
  Reason: mandatory (minimum 20 chars)
  Internal note: optional (not shown to customer)

Constraints:
  Cannot subtract more than current balance
  Tier downgrade: requires compliance_officer approval (separate flow)
  All adjustments logged in loyalty_transactions with performed_by
```

---

## PART 42 — ADMIN WIDGETS (UI COMPONENTS)

These are React components rendered inside Medusa Admin custom routes.
All use real-time data via SSE (Server-Sent Events from Redis pub/sub).

```
1. ORDER KANBAN BOARD (/admin/orders/board)
   Columns: Pending Review | Approved | Pick Pending | Packing | Dispatched
   Cards: order ID (masked), item count, value, COD indicator, SLA badge
   Real-time: new orders appear without refresh (SSE)
   Click card: open order detail panel (slide-in)
   Drag: disabled (state transitions only via workflow — no drag-and-drop)

2. RX QUEUE SLA WIDGET (top of /admin/prescriptions)
   Gauge: "N prescriptions pending — oldest: Xh Ym"
   Each Rx row: countdown timer from upload time
   Green: < 2 hours | Orange: 2–4 hours | Red: > 4 hours (SLA warning)
   Pharmacist can "claim" a prescription (locks it to their queue)
   Real-time: new Rx uploads appear without refresh

3. COMPLIANCE HEALTH SCORE (/admin/dashboard)
   Score badge: 18/20 (green) | 14/20 (orange) | < 12/20 (red)
   Expandable: click → see all 20 checklist items with pass/fail
   Failing items: direct link to the fix action
   Refreshes: every hour via analytics materialized view

4. REAL-TIME REVENUE TICKER (/admin/dashboard)
   Today's GMV: ₹X,XXX (updates every 5 minutes)
   Orders today: N confirmed / M pending
   vs same day last week: +X% / -X%

5. COD CONVERSION WIDGET (/admin/dashboard)
   Donut chart: today's COD% vs Prepaid%
   7-day trend sparkline
   Revenue at risk (COD not yet collected): ₹X,XXX

6. BATCH EXPIRY CALENDAR (/admin/inventory)
   Monthly heatmap: ₹ value of stock expiring per month
   Green = low | Orange = moderate | Red = high value expiring
   Click month → list of specific batches + values

7. PRESCRIPTION PDF INLINE VIEWER (/admin/prescriptions/:id)
   PDF renders inline (not download) using PDF.js
   Pharmacist tools: zoom, rotate (for landscape prescriptions)
   Drug line confirmation: click on drug name in PDF → link to product variant
   Approve/reject per line: action buttons visible alongside PDF
   Notes: text field below each line for pharmacist clinical notes

8. STOCK HEATMAP WIDGET (/admin/warehouse)
   Visual grid of warehouse zone → bins
   Bin color: green (>50% capacity), orange (20–50%), red (<20%), grey (empty)
   Click zone → drill to bin level
   Click bin → see batch list in that bin

9. INTERNAL NOTIFICATION BELL (global admin header)
   Bell icon with unread count badge
   Click: dropdown with last 10 notifications
   Types: color-coded by severity (red = critical, orange = warning, blue = info)
   Click notification: navigate directly to relevant admin page
   "Mark all read" button
   Full notification history at /admin/notifications

10. PHARMACIST MOBILE RX CARD (/pharmacy/mobile)
    Card per pending prescription: patient first name, drug count, upload time
    Tap card: inline PDF viewer (mobile-optimized)
    Per-line swipe: right = approve, left = reject (with reason prompt)
    Approved count badge updates in real-time
```

---

## PART 43 — MISSING BUSINESS LOGIC (COMPLETE)

### 43.1 Duplicate Order Detection

On `order.created` — before payment authorization:
```
Query: SELECT * FROM orders
       WHERE customer_id = :id
       AND created_at > NOW() - INTERVAL '10 minutes'
       AND status NOT IN ('cancelled', 'refunded')
       AND has overlapping variant_ids with current order

If duplicate found:
  → Set new order.status = 'duplicate_suspected'
  → Show on order confirmation page:
    "⚠️ You already placed Order #X with the same items 5 minutes ago.
     Are you sure you want to place this order too?"
  → [Confirm New Order] [Cancel New Order]
  → 30-minute response window — auto-cancel if no response
  → Log duplicate detection in order_state_history
```

### 43.2 Phone Number Change Workflow

Phone is primary identity for OTP login. Cannot allow self-service without double verification.
```
Customer initiates: /account/settings → "Change Phone"
  Step 1: Enter new phone number
  Step 2: OTP sent to CURRENT phone → must verify (you own current number)
  Step 3: OTP sent to NEW phone → must verify within 5 minutes
  Both verified: phone updated
  System: invalidate ALL active JWTs for this customer (Redis blocklist)
  Notify: SMS to old phone: "Your Suprameds account phone was changed to ending XXXX.
          Not you? Call 1800-XXX-XXXX immediately"
```

### 43.3 Address Book Management

```
Customer has multiple saved addresses (not just one):
  Default shipping + default billing can be DIFFERENT addresses
  CRUD: add / edit / delete saved addresses in /account/addresses
  On add: validate pincode format (6 digits) + phone format (10 digits)
  On add: run pincode serviceability check → mark address as serviceable: yes/no
          Serviceable status cached, refreshed weekly
  At checkout: show serviceable addresses first, unserviceable with warning

Address validation fields:
  full_name, phone (10 digits), address_1, address_2 (optional),
  city, state (dropdown), pincode (6 digits, validated)
  is_default_shipping, is_default_billing
```

### 43.4 Order Modification Rules

```
ALLOWED (before picking starts — status ≤ 'payment_captured'):
  → Change delivery address (triggers address-change-after-order.workflow)
  → Change COD → prepaid (generate Razorpay link for balance)
  → Reduce quantity on OTC items (partial cancellation)

NOT ALLOWED:
  → Add new items to existing order (customer creates a new order)
  → Change Rx items after pharmacist has dispensed (cancel the order, reorder)
  → Increase quantities after order placed

After picking starts (status = 'pick_pending' or beyond):
  → NO modifications allowed
  → Show: "Order is being prepared. Contact CS to modify."
  → CS can force-cancel with warehouse_manager confirmation (warehouse stops picking)
```

### 43.5 Returns Eligibility Rules

```
Before showing return button on /account/orders:
  Check all conditions:
  1. Order delivered within last 48 hours ← window check
  2. Item type eligible: NOT Rx drugs (medications non-returnable by default)
     Exception: wrong product | damaged | recalled | near_expiry on arrival
  3. Customer has not already submitted a return for this item
  4. Item not already in returns queue

If ineligible:
  Show reason: "Returns accepted only within 48 hours of delivery for
               damaged, wrong, or recalled products. Contact CS for exceptions."
  Show CS WhatsApp number

Return form:
  Reason: wrong_product | damaged | recalled | near_expiry | other
  Evidence: photo upload (mandatory for damaged/wrong)
  Refund preference: original_payment | store_credit | loyalty_points
```

### 43.6 Refill Subscription Settings

```
Per subscription at /account/refills/:id:
  frequency_days:    28 | 30 | 60 | 90 (customer selects)
  delivery_day_pref: any | monday | tuesday | ... (preferred delivery day)
  auto_pause_on_rx_expiry: true | false toggle
  notification_preference: whatsapp | sms | email | all
  payment_method: cod | saved_card | saved_upi
  next_refill_date: shown with option to "Reschedule" (shift by ±7 days)

Auto-pause rules:
  If auto_pause_on_rx_expiry = true AND linked prescription.valid_until < next_refill_date:
    → Pause subscription
    → Notify customer: "Subscription paused — your prescription expires before next refill"
    → Link to telemedicine partner for prescription renewal

Back to top of subscription list in account: "Active", "Paused", "Cancelled" sections
```

### 43.7 Family Prescription Management

```
When customer uploads prescription at checkout/account:
  Option: "This prescription is for: Myself | Family Member"
  If family member: select from family_profiles (or add new member)

Prescription record:
  customer_id: account owner (payer)
  family_member_id: the actual patient

Supply memo shows:
  "Patient: [family member name]"
  "Account Holder: [owner name]"

CDSCO requirement:
  Both names recorded in supply_memo and h1_register_entries (for H1 drugs)
  This is critical for Schedule H1 compliance — the register must name the patient,
  not the account holder if they're different people

Order history for account:
  All orders (including those for family members) shown in /account/orders
  Filter: "My orders" | "Family orders" | "All"
```

### 43.8 Delivery OTP for Rx Orders — Complete Flow

```
On Rx order dispatch:
  1. Generate 4-digit OTP
  2. Store HASHED in delivery_otp_logs (never plain)
  3. Send SMS T10 to customer's registered phone: "OTP: XXXX for order #{id}"
  4. Print on packing slip: "OTP delivery required. Carrier will request OTP."
  5. Carrier app: agent enters OTP customer provides at door
  6. On correct OTP: delivery confirmed → emit order.delivered
  7. On wrong OTP: log failed attempt
     After 3 wrong attempts: delivery marked 'failed', NDR raised
     Customer must contact CS to resolve — not auto-retry

Why: CDSCO chain-of-custody. Rx drug must be confirmed as received
     by the intended patient (or their authorized representative).
     This creates a verifiable handover record.
```

### 43.9 eWaybill Trigger Rules

```
Check on order.dispatched:
  Condition A: shipping state ≠ origin state (Suprameds warehouse state)
  Condition B: order total > ₹50,000

If BOTH conditions true:
  → Trigger ewaybill-generate.workflow
  → HOLD dispatch until eWaybill number received from NIC API
  → If NIC API fails: alert admin, do NOT dispatch — legal requirement

If only Condition A (interstate but < ₹50,000):
  → No eWaybill required for most pharma goods under this threshold
  → Your CA to confirm based on exact HSN codes

Attach to order:
  ewaybill_number → shipment.metadata.ewaybill_number
  ewaybill_pdf_url → S3 URL, attached to supply memo
```

---

## PART 44 — COMPLETE FILE STRUCTURE (V10 FINAL)

```
src/
├── lib/
│   ├── queue.ts                        // BullMQ: 4 queues (critical/notifications/background/scheduled)
│   ├── queue-workers.ts                // Worker concurrency: 10/5/3/1
│   └── phi-audit-buffer.service.ts    // Redis write-ahead buffer → PostgreSQL every 5 seconds
│
database/
├── migrations/
│   ├── 001-core-schema.sql             // All base tables
│   ├── 002-pg-fts-search.sql           // search_vector column + GIN index + trigger (Part 40.4)
│   ├── 003-materialized-views.sql      // All 4 materialized views (Part 46.9)
│   └── 004-fefo-function.sql           // fefo_allocate() atomic function (Part 46.3)
│
├── modules/
│   ├── auth/               (otp-login, guest-session, guest-to-account, mfa-verify)
│   ├── customers/          (customer-profile, family-profile)
│   ├── products/           (drug-product, molecule, substitution, stock-alert, recently-viewed, drug-info, oos-manager, pg-search.service)
│   ├── prescriptions/      (prescription, drug-line, line-consumption, pharmacist-note)
│   ├── dispense/           (dispense-decision, adjustment-log, h1-register, pre-dispatch-sign-off)
│   ├── orders/             (order, order-item, batch-allocation, state-history, cs-placed-order, guest-session, partial-shipment-pref)
│   ├── cod/                (cod-order, cod-customer-score, confirmation-call, rto-manager)
│   ├── inventory/          (inventory-batch, stock-movement)
│   ├── warehouse/          (warehouse, zone, bin, task, pick-list-line, grn, purchase-order, supplier, returns-inspection)
│   ├── shipments/          (shipment, shipment-item, delivery-otp-log, delivery-days-lookup)
│   ├── payments/           (payment, refund — providers: razorpay, stripe, cashfree)
│   ├── compliance/         (pharmacy-license, compliance-record, phi-audit-log, batch-recall-log, override-request)
│   ├── crm/                (customer-360, lifecycle, churn, abandoned-cart, chronic-reorder, winback)
│   ├── analytics/          (kpi-dashboard, funnel, inventory-analytics, cohort, cod-analytics, gst-report, margin-dashboard)
│   ├── loyalty/            (points-ledger, tier-engine, referral, points-expiry)
│   ├── reviews/            (review, review-moderation, qna)
│   ├── notifications/      (sms, whatsapp, email, in-app, preference-enforcer, dlt-template-registry)
│   ├── content-moderation/ (lint, moderation-queue)
│   ├── legitscript/        (checklist, seal)
│   ├── google-ads-feed/    (feed-generator, price-sync-audit)
│   ├── dpdp/               (consent, deletion-request, breach-notification)
│   ├── grievance/          (grievance — SLA timers, escalation)
│   └── rbac/               (role, permission, user-role, role-audit-log, ssd-validator)
│
├── integrations/
│   ├── razorpay.provider.ts
│   ├── razorpay-links.service.ts
│   ├── stripe.provider.ts
│   ├── cashfree.provider.ts          (payment fallback)
│   ├── shiprocket.adapter.ts
│   ├── msg91.service.ts
│   ├── whatsapp-outbound.service.ts
│   ├── whatsapp-inbound.service.ts   (WhatsApp Business webhook handler)
│   ├── sendgrid.service.ts
│   ├── aws-ses.service.ts            (email fallback)
│   ├── aws-s3.service.ts
│   ├── aws-s3-presigned.service.ts   (presigned URL for direct Rx uploads)
│   ├── aws-cloudfront.service.ts     (cache invalidation)
│   ├── aftership.adapter.ts          (tracking — India Post via AfterShip)
│   ├── openfda-labels.service.ts
│   ├── openfda-interactions.service.ts
│   ├── cdsco-db-sync.service.ts
│   ├── gstn-validator.service.ts
│   ├── ewaybill.service.ts
│   ├── search-console.service.ts
│   ├── legitscript-seal.service.ts
│   └── abha-verification.service.ts  (Phase 2 — optional)
│
├── subscribers/
│   ├── prescription.uploaded.ts       // → queue: notify pharmacist (BullMQ notifications queue)
│   ├── prescription.fully_approved.ts // → queue: notify customer (BullMQ notifications queue)
│   ├── prescription.partially_approved.ts
│   ├── prescription.rejected.ts
│   ├── prescription.expired.ts
│   ├── order.created.ts               // → queue: duplicate check, COD record (BullMQ background)
│   ├── order.payment_captured.ts      // → queue: FEFO alloc (sync), notifications (BullMQ)
│   ├── order.dispatched.ts            // → queue: notifications (BullMQ)
│   ├── order.delivered.ts             // → queue: points, review request (BullMQ background)
│   ├── order.cancelled.ts
│   ├── payment.failed.ts              // → queue: retry payment link (BullMQ notifications)
│   ├── batch.recalled.ts
│   ├── stock.below_reorder_point.ts
│   ├── stock.restocked.ts
│   ├── shipment.tracking_updated.ts   // → queue: customer notifications (BullMQ)
│   ├── shipment.ndr_received.ts
│   ├── grn.qc_approved.ts
│   ├── warehouse_task.exception.ts
│   ├── customer.at_risk.ts
│   ├── customer.churned.ts
│   ├── review.submitted.ts
│   ├── override.approved.ts
│   ├── override.used.ts
│   ├── license.expiry_approaching.ts
│   ├── product.created.ts             // → queue: PG FTS index update + feed (BullMQ background)
│   ├── product.updated.ts             // → queue: PG FTS + CloudFront (BullMQ background)
│   ├── product.archived.ts
│   └── product.image_updated.ts       // → queue: Sharp WebP conversion + S3 (BullMQ background)
│
├── api/
│   ├── webhooks/
│   │   ├── razorpay.webhook.ts         // idempotency check FIRST, then process
│   │   ├── stripe.webhook.ts           // idempotency check FIRST
│   │   ├── aftership.webhook.ts        // India Post tracking updates via AfterShip
│   │   ├── legitscript.webhook.ts
│   │   └── whatsapp.inbound.webhook.ts
│   ├── public/
│   │   ├── health.ts
│   │   ├── google-shopping-feed.ts
│   │   ├── sitemap.ts
│   │   ├── robots.ts
│   │   ├── qr-scan.ts
│   │   ├── prescription-upload-url.ts  // Presigned S3 URL for direct browser upload
│   │   └── referral-redirect.ts
│   ├── customer/
│   │   └── (all customer routes — see Part 39.4)
│   └── admin/
│       └── (all admin routes — see Part 39.7–39.12)
│
├── middleware/
│   ├── authenticate.middleware.ts
│   ├── authorize.middleware.ts
│   ├── mfa-verified.middleware.ts
│   ├── phi-access.middleware.ts
│   ├── ssd-check.middleware.ts
│   ├── session-expiry.middleware.ts
│   ├── rx-gate.middleware.ts
│   ├── schedule-x-block.middleware.ts
│   ├── rate-limit.middleware.ts
│   └── webhook-signature.middleware.ts    (shared signature verification)
│
├── workflows/
│   ├── verify-prescription.ts
│   ├── process-rx-checkout.ts
│   ├── process-otc-checkout.ts
│   ├── process-cod-order.ts
│   ├── generate-supply-memo.ts
│   ├── recall-batch.ts
│   ├── partial-shipment-decision.ts
│   ├── cancel-order.ts
│   ├── retry-payment.ts
│   ├── address-change-after-order.ts
│   ├── subscription-pause.ts
│   ├── subscription-resume.ts
│   ├── process-return.ts
│   ├── dpdp-data-export.ts
│   ├── dpdp-delete-account.ts
│   ├── batch-destruction.ts
│   ├── duplicate-order-check.ts
│   ├── onboard-new-staff.ts
│   ├── offboard-staff.ts
│   └── ewaybill-generate.ts
│
└── jobs/
    ├── license-expiry-check.ts          (daily)
    ├── batch-expiry-alert.ts            (daily — 90/60/30 day windows)
    ├── expiry-auto-quarantine.ts        (daily)
    ├── refill-reminders.ts              (daily)
    ├── chronic-reorder-reminders.ts     (daily)
    ├── google-feed-sync.ts              (daily 2 AM IST)
    ├── price-sync-audit.ts              (daily)
    ├── phi-retention-audit.ts           (weekly)
    ├── phi-audit-log-flush.ts           (every 5 seconds via BullMQ — drains Redis buffer to PostgreSQL)
    ├── lifecycle-stage-compute.ts       (nightly)
    ├── churn-score-compute.ts           (daily)
    ├── loyalty-points-expiry.ts         (monthly)
    ├── stock-alert-notify.ts            (every 15 min)
    ├── analytics-materialized-views.ts  (every 15 min via pg_cron)
    ├── session-cleanup.ts               (hourly)
    ├── sitemap-generate.ts              (daily 1 AM IST)
    ├── pg-fts-rebuild.ts                (weekly Sunday 3 AM IST — rebuilds all search_vector columns)
    ├── cod-auto-cancel.ts               (every 30 min)
    ├── override-expiry.ts               (every 15 min)
    ├── prescription-expiry-notify.ts    (daily 9 AM IST)
    ├── back-order-fulfillment.ts        (every 2 hours)
    ├── gstr1-monthly.ts                 (1st of month 6 AM IST)
    ├── h1-register-monthly.ts           (1st of month 7 AM IST)
    ├── payment-link-expiry.ts           (every 30 min)
    ├── cod-customer-score-compute.ts    (nightly 2 AM IST)
    ├── review-request-send.ts           (hourly)
    ├── delivery-otp-expiry.ts           (hourly)
    ├── stock-turnover-compute.ts        (weekly Sunday 4 AM IST)
    └── cloudfront-cache-refresh.ts      (on-demand via admin trigger)
```

---

## PART 45 — BUILD EXECUTION ORDER (V9 FINAL)

```
PHASE 1 — FOUNDATION
  1. RBAC module: 25 roles, permissions, SSD constraints, seeds
  2. Middleware: authenticate, mfa-verified, authorize, ssd-check,
                 phi-access, session-expiry, rx-gate, schedule-x-block,
                 rate-limit, webhook-signature
  3. Core audit tables: phi_audit_log, audit_logs, order_state_history,
                        webhook_logs, product_edit_log, price_history
  4. Core entities: products, variants, molecules, substitutions,
                    stock_alerts, recently_viewed, family_profiles
  5. PostgreSQL FTS: add search_vector column + GIN index + trigger to products table
                     (Part 40.4 migration — runs with initial DB migrations)
  6. BullMQ: queue definitions + workers setup (src/lib/queue.ts)
  7. Medusa Cloud: project created, GitHub connected, environments configured

PHASE 2 — CLINICAL + PAYMENT BACKBONE
  6. Prescription module: upload, hash check, drug line extraction workspace
  7. Dispense module: per-line decisions, H1 register (transactional),
                      pre-dispatch sign-off
  8. Payment module: Razorpay (auth/capture/release split, payment links, COD)
                   + Stripe + Cashfree fallback
  9. Webhook receivers: razorpay.webhook, stripe.webhook (payment events first)

PHASE 3 — ORDERS + INVENTORY + COD
  10. Orders module: state machine, guest orders, CS order placement,
                     duplicate-order-check.workflow
  11. COD module: cod_orders, confirmation workflow, customer scoring
  12. Inventory module: FEFO allocation, stock_movements, back-order support
  13. order_item_batch_allocations, prescription_line_consumptions
  14. Workflows: process-rx-checkout, process-otc-checkout,
                 process-cod-order, cancel-order, retry-payment

PHASE 4 — WAREHOUSE EXECUTION
  15. Warehouse zones (ambient only) + bins
  16. GRN workflow: receive → quarantine → QC approve (SSD enforced) → put-away
  17. Pick workflow: FEFO list → confirm pick → short_pick handling + reallocation
  18. Pack → pre-dispatch sign-off (Rx) → dispatch
  19. Returns inspection + batch-destruction.workflow
  20. Supplier management + Purchase Orders

PHASE 5 — FULFILLMENT + LOGISTICS
  21. Shipment module: Shiprocket + Delhivery + Xpressbees adapters
  22. Pincode serviceability check + delivery date estimate at checkout
  23. OTP delivery for Rx orders
  24. NDR management
  25. Webhook receivers: shiprocket.webhook, delhivery.webhook
  26. ewaybill-generate.workflow (inter-state orders > ₹50k)
  27. Supply memo generation (CDSCO)
  28. Batch recall workflow + CDSCO report

PHASE 6 — SUBSCRIBERS (wire up all event → reaction chains)
  29. All prescription subscribers
  30. All order subscribers
  31. All inventory subscribers
  32. All shipment subscribers
  33. All warehouse subscribers
  34. All product subscribers (search index + feed + CloudFront)
  35. CRM, compliance, review subscribers

PHASE 7 — COMPLIANCE + OVERRIDES
  36. LegitScript compliance module + 20-item automated checklist
  37. Override engine: 14 types + emergency override
  38. DPDP consent banner + cookie management
  39. dpdp-data-export.workflow + dpdp-delete-account.workflow
  40. Google Ads feed generator (OTC only — Rx hard excluded)
  41. Batch-destruction.workflow + compliance reports

PHASE 8 — GROWTH + OPERATIONS
  42. CRM: customer 360, lifecycle, churn, abandoned cart (OTC), chronic reorder
  43. Analytics: KPI dashboard, funnel, COD analytics, GST report, margin dashboard
  44. Loyalty + referral (OTC only)
  45. Reviews + pharmacist Q&A
  46. DLT SMS templates registered with TRAI (Day 1 of project — takes 3-7 days)
  47. WhatsApp WABA templates submitted for Meta approval (Day 1 of project)
  48. In-app notification system (Redis pub/sub → SSE to admin browser)
  49. Drug information import (CDSCO + OpenFDA)
  50. Grievance module
  51. WhatsApp inbound webhook: whatsapp.inbound.webhook.ts
  52. CS conversation queue in admin

PHASE 9 — PRODUCT MANAGEMENT
  53. Price edit interface (single + bulk) with validation
  54. Price history table + audit log
  55. Product edit log
  56. Content moderation CMS lint (real-time on save)
  57. Margin dashboard
  58. Promotions module (OTC-only enforcement)

PHASE 10 — ADMIN EXTENSIONS (Medusa Admin custom routes + widgets)
  59. Order kanban board
  60. Rx queue with SLA timers widget
  61. Prescription PDF inline viewer
  62. Compliance health score widget
  63. Real-time revenue ticker + COD conversion widget
  64. Batch expiry calendar
  65. Stock heatmap (warehouse bins visual)
  66. Internal notification bell
  67. Supplier management CRUD
  68. Purchase order CRUD
  69. Staff management + onboard/offboard workflows
  70. Notification template management (DLT tracking)
  71. Reviews moderation queue
  72. Grievance management with SLA timers
  73. CS conversation queue (WhatsApp inbound)
  74. Loyalty manual adjustment
  75. Finance: Razorpay settlement reconciliation

PHASE 11 — STOREFRONT (Medusa Bloom Sessions 1–5)
  Session 1: Compliance layout + all mandatory pages (server-rendered)
  Session 2: Catalog with OOS handling, substitution, back-order display
  Session 3: PDP with drug info, inline interaction warnings, Rx gate
  Session 4: Checkout — guest, COD, delivery estimate (lookup table), DPDP consent
  Session 5: Account dashboard, Rx vault, pharmacist portal, warehouse portal,
             mobile pharmacist view, family prescription management

PHASE 12 — INFRASTRUCTURE + VALIDATION
  76. Medusa Cloud: project created, GitHub connected, environments configured
  77. Medusa Cloud: environment variables set (all keys from Pre-Dev checklist)
  78. All 20 compliance checklist items: PASS
  79. All SSD constraints: unit tested
  80. All Rx gate: integration tested
  81. All webhook receivers: end-to-end tested (idempotency guard verified)
  82. All subscriber → BullMQ queue chains: integration tested
  83. COD flow: end-to-end tested
  84. Guest checkout: end-to-end tested
  85. Partial approval + payment split: tested
  86. FEFO race condition: concurrent order test (2 simultaneous orders on same low-stock product)
  87. Playwright E2E: full OTC + Rx + pharmacist + recall + COD suite
  88. Lighthouse: 90+ Performance, 100 SEO, 100 Accessibility, 100 Best Practices
  89. OWASP ZAP: no critical findings
  90. DLT SMS templates: all registered + tested
  91. WhatsApp templates: all approved + tested
  92. LegitScript application: submitted with full certification evidence pack

PHASE 13 — PERFORMANCE VALIDATION
  93. Load test: 50 concurrent checkout sessions — p95 response time < 500ms
  94. FEFO allocation under concurrency: no double-allocation at 20 concurrent orders
  95. BullMQ queue depth: no queue backup after 100 orders placed in 5 minutes
  96. Materialized views: admin dashboard loads in < 2 seconds under load
  97. Product catalog page: Lighthouse Performance score 90+ with 50 products displayed
  98. Rx upload: presigned URL flow tested — server response < 100ms
  99. Drug interaction check: cart add response < 30ms (local DB only, no OpenFDA live calls)
  100. Webhook idempotency: duplicate webhook delivery results in exactly one notification sent
```


---

## PART 46 — PERFORMANCE ARCHITECTURE

### 46.1 The Core Principle: Sync/Async Boundary

The single most important performance decision in the platform.
Everything that runs inside the HTTP request-response cycle must complete in < 500ms.
Everything else goes to BullMQ queues on the existing Redis instance.

```
HTTP REQUEST BOUNDARY — must complete < 500ms:
  ✓ JWT validation (CPU only — no I/O for most requests)
  ✓ RBAC permission check (Redis cache, TTL 5 min — only miss on first check)
  ✓ Input validation (Zod — pure CPU, 0ms I/O)
  ✓ FEFO batch reservation (single atomic PostgreSQL function — < 20ms)
  ✓ Payment authorization (Razorpay — external, ~300ms — unavoidable)
  ✓ Rx gate check (indexed DB query — < 10ms)
  ✓ Core DB write (order record, payment record — < 20ms)
  ✓ HTTP response to customer

BULLMQ NOTIFICATIONS QUEUE (5 concurrent workers — completes in < 5 seconds):
  All customer-facing SMS, WhatsApp, and email notifications
  Customer never waits for these — they see "Order confirmed" immediately
  Order confirmation SMS + WhatsApp + email
  Prescription uploaded → pharmacist notification
  Prescription approved/rejected → customer notification
  Dispatch → customer notification
  Payment failed → retry link generation + customer notification

BULLMQ BACKGROUND QUEUE (3 concurrent workers — completes in < 30 seconds):
  Supply memo PDF generation + S3 upload
  phi_audit_log flush from Redis write-ahead buffer to PostgreSQL
  MeiliSearch index update on product changes
  product_edit_log + price_history writes
  Loyalty points award (on delivery confirmation)
  customer_360 materialized view refresh trigger
  CloudFront cache invalidation on product/image updates
  Duplicate order check
  Google Shopping feed update
  Chronic reorder pattern recalculation

BULLMQ SCHEDULED QUEUE:
  All cron jobs from Part 38 (migrated from simple setInterval to BullMQ scheduler)
  BullMQ scheduler survives server restarts — cron jobs never missed

DIRECT TO POSTGRESQL — always synchronous (these are source of truth):
  FEFO allocation (atomic function — must be synchronous)
  Order status transitions (state machine enforcement)
  Payment state changes (financial integrity)
  Batch stock movements (inventory accuracy)
  Any DB write that another synchronous operation reads immediately
```

### 46.2 BullMQ Queue Setup

```typescript
// src/lib/queue.ts
// BullMQ uses your existing Redis instance — zero additional infrastructure cost

import { Queue, Worker, QueueScheduler } from 'bullmq'
import { redis } from './redis'

const connection = { connection: redis }

export const queues = {
  // Payment + auth — highest priority, never delayed
  critical: new Queue('critical', connection),

  // Customer notifications — 5 workers, processed within 5 seconds
  notifications: new Queue('notifications', connection),

  // PDF generation, index updates, audit logs — 3 workers, 30 seconds
  background: new Queue('background', connection),

  // Cron jobs — BullMQ scheduler, survives restarts
  scheduled: new Queue('scheduled', connection)
}

// Worker concurrency settings
new Worker('critical',       processCritical,      { ...connection, concurrency: 10 })
new Worker('notifications',  processNotifications, { ...connection, concurrency: 5  })
new Worker('background',     processBackground,    { ...connection, concurrency: 3  })
new Worker('scheduled',      processScheduled,     { ...connection, concurrency: 1  })

// Job naming convention: 'module:action'
// Examples:
//   'notifications:order_confirmed' → sends SMS T02 + WhatsApp W01 + email E01
//   'background:generate_supply_memo' → PDF generation + S3 upload
//   'background:meilisearch_index_update' → product search index
//   'background:phi_audit_flush' → drain Redis buffer to PostgreSQL (every 5 seconds)
```

### 46.3 Atomic FEFO Allocation

Single PostgreSQL function — no round trips, no race conditions:

```sql
-- database/functions/fefo_allocate.sql
-- Called as: SELECT * FROM fefo_allocate(variant_id, quantity, order_item_id, user_id)

CREATE OR REPLACE FUNCTION fefo_allocate(
  p_variant_id     UUID,
  p_quantity       INTEGER,
  p_order_item_id  UUID,
  p_performed_by   TEXT
) RETURNS TABLE(batch_id UUID, qty INTEGER) AS $$
DECLARE
  v_batch    RECORD;
  v_remain   INTEGER := p_quantity;
  v_alloc    INTEGER;
BEGIN
  FOR v_batch IN
    SELECT id,
           (quantity_available - quantity_reserved) AS avail
    FROM   inventory_batches
    WHERE  variant_id   = p_variant_id
      AND  status       = 'active'
      AND  qc_status    = 'passed'
      AND  expiry_date  > NOW() + INTERVAL '30 days'
    ORDER BY expiry_date ASC, created_at ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    EXIT WHEN v_remain <= 0;
    v_alloc := LEAST(v_batch.avail, v_remain);
    CONTINUE WHEN v_alloc <= 0;

    INSERT INTO order_item_batch_allocations
      (order_item_id, batch_id, quantity_allocated, allocated_by, status)
    VALUES (p_order_item_id, v_batch.id, v_alloc, p_performed_by, 'reserved');

    INSERT INTO stock_movements
      (batch_id, movement_type, quantity, reference_type, reference_id, performed_by)
    VALUES (v_batch.id, 'reservation', -v_alloc, 'order_item', p_order_item_id, p_performed_by);

    UPDATE inventory_batches
       SET quantity_reserved = quantity_reserved + v_alloc
     WHERE id = v_batch.id;

    RETURN QUERY SELECT v_batch.id, v_alloc;
    v_remain := v_remain - v_alloc;
  END LOOP;

  IF v_remain > 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK:% units short for variant %', v_remain, p_variant_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

### 46.4 Presigned S3 Upload for Prescriptions

Customer uploads directly to S3 — server never handles file bytes:

```
Step 1: GET /api/prescription-upload-url
  → Server generates S3 presigned URL (< 10ms, no I/O)
  → Returns: { upload_url, s3_key, expires_in: 300 }

Step 2: Browser PUT [upload_url] with file (PDF or image)
  → Goes directly from browser to S3 Mumbai
  → Bypasses your server entirely — saves bandwidth + compute
  → Speed limited only by customer's internet + S3 (fast)

Step 3: POST /prescriptions { s3_key }
  → Server creates prescription record
  → Queues background job: verify file exists in S3 + validate format
  → Notifies pharmacist queue (BullMQ notifications)
  → Returns immediately: { id, status: 'pending' }

Server response time: < 50ms
Customer sees "Prescription uploaded" immediately
```

### 46.5 Drug Interaction Check — Local DB Only

Cart add response must be fast. Never call OpenFDA API during customer actions:

```
Pre-computation strategy:
  On product.created → BullMQ background job:
    Fetch all interactions for this molecule from OpenFDA
    Store in drug_interactions table (molecule_a, molecule_b, severity)
    Cache indefinitely — refresh weekly via job

  On cart.item.added:
    Extract molecule_id of new item
    Query drug_interactions WHERE molecule_a = ? OR molecule_b = ?
                              AND molecule_a IN [cart_molecule_ids]
                            OR molecule_b IN [cart_molecule_ids]
    Pure local DB query — < 5ms with index

    mild severity     → return info banner text
    moderate severity → return warning banner text
    severe severity   → BLOCK add, return "Consult pharmacist" message

  Result: add-to-cart from 200-800ms (OpenFDA live) → < 10ms (local DB)
```

### 46.6 PHI Audit Log Write-Ahead Buffer

```typescript
// src/lib/phi-audit-buffer.service.ts
// Redis buffer prevents phi_audit_log table from becoming a bottleneck

class PhiAuditBuffer {
  private readonly BUFFER_KEY = 'phi_audit_buffer'
  private readonly FLUSH_INTERVAL = 5000 // 5 seconds

  // Called by phi-access.middleware.ts on every PHI access
  // < 1ms — just writes to Redis list
  async log(entry: PhiAuditEntry): Promise<void> {
    await redis.lpush(this.BUFFER_KEY, JSON.stringify({
      ...entry,
      timestamp: new Date().toISOString()
    }))
  }

  // BullMQ scheduled job — runs every 5 seconds
  // Drains buffer into PostgreSQL in a single batch INSERT
  async flush(): Promise<void> {
    const entries = await redis.lrange(this.BUFFER_KEY, 0, 999)
    if (entries.length === 0) return

    await db.query(`
      INSERT INTO phi_audit_log
        (user_id, role, action, entity_type, entity_id, ip_address, user_agent, access_granted, timestamp)
      SELECT * FROM UNNEST($1::phi_audit_entry[])
    `, [entries.map(JSON.parse)])

    await redis.ltrim(this.BUFFER_KEY, entries.length, -1)
  }
}
// Compliance note: 5-second buffer is acceptable for CDSCO audit requirements
// Logs are immutable once in PostgreSQL — Redis is only a staging buffer
```

### 46.7 JWT Validation — Skip Redis for Low-Risk Requests

```typescript
// src/middleware/authenticate.middleware.ts

async function authenticate(req, res, next) {
  const payload = jwt.verify(token, JWT_SECRET) // CPU only — 0.1ms

  // Only check Redis blocklist when genuinely needed:
  const needsBlocklistCheck =
    ADMIN_ROLES.includes(payload.role) ||  // Admin always checks
    req.method !== 'GET' ||                 // Write operations check
    payload.iat < Date.now()/1000 - 86400  // Tokens older than 24h check

  if (needsBlocklistCheck) {
    const blocked = await redis.get(`blocklist:${payload.jti}`)
    if (blocked) return res.status(401).json({ error: 'TOKEN_REVOKED' })
  }

  req.user = payload
  next()
}
// ~80% of customer GET requests skip Redis entirely
// Admin + write operations always check (correct security posture)
```

### 46.8 HTTP Caching Strategy

```
CACHE AT CLOUDFRONT EDGE (zero database load during TTL):
  Product catalog pages:     s-maxage=300, stale-while-revalidate=60
  Product detail pages:      s-maxage=120, stale-while-revalidate=60
  Blog posts:                s-maxage=3600, stale-while-revalidate=300
  /pharmacy/licenses:        s-maxage=3600 (changes rarely)
  /feeds/google-shopping.xml: s-maxage=3600

  Cache invalidated by: product.updated subscriber → BullMQ background job
                        → CloudFront CreateInvalidation API call

NEXT.JS ISR (Incremental Static Regeneration):
  All product pages: export const revalidate = 120
  All compliance pages: export const revalidate = 3600
  Blog posts: export const revalidate = 3600

NEVER CACHE:
  /cart, /checkout, /account/*, /pharmacy/*, /admin/*
  All routes with customer-specific or PHI-adjacent data

IMPACT:
  For 80%+ of browsing traffic — product pages, catalog, blog:
  CloudFront serves from edge cache
  Zero database hits, zero Medusa backend compute
  Sub-100ms page loads from CloudFront edge
```

### 46.9 Materialized Views (Admin Dashboard Performance)

All analytics queries read from materialized views — never raw tables:

```sql
-- database/migrations/materialized-views.sql

-- KPI dashboard — refreshed every 15 minutes via pg_cron
CREATE MATERIALIZED VIEW mv_daily_gmv AS
  SELECT DATE(created_at) as date,
         SUM(total) as gmv,
         COUNT(*) as order_count,
         AVG(total) as aov
  FROM orders
  WHERE status NOT IN ('cancelled', 'refunded')
  GROUP BY DATE(created_at);
CREATE INDEX ON mv_daily_gmv(date DESC);

-- Product velocity — powers top sellers + slow movers
CREATE MATERIALIZED VIEW mv_product_sales_velocity AS
  SELECT oi.product_variant_id,
         SUM(oi.quantity) as units_sold_30d,
         SUM(oi.line_total) as revenue_30d
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.created_at > NOW() - INTERVAL '30 days'
    AND o.status = 'delivered'
  GROUP BY oi.product_variant_id;

-- Rx queue stats — refreshed every 5 minutes (operational widget)
CREATE MATERIALIZED VIEW mv_rx_queue_stats AS
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE status = 'under_review') as in_review_count,
    COALESCE(MAX(EXTRACT(EPOCH FROM (NOW() - created_at))/3600)
      FILTER (WHERE status IN ('pending','under_review')), 0) as oldest_hours
  FROM prescriptions;

-- Inventory status — powers stock heatmap + reorder alerts
CREATE MATERIALIZED VIEW mv_inventory_status AS
  SELECT variant_id,
         SUM(quantity_available - quantity_reserved) as available,
         SUM(quantity_available) as total_stock,
         MIN(expiry_date) as earliest_expiry,
         COUNT(*) FILTER (WHERE expiry_date < NOW() + INTERVAL '30 days') as expiring_soon_batches
  FROM inventory_batches
  WHERE status = 'active'
  GROUP BY variant_id;

-- pg_cron refresh schedule:
-- mv_daily_gmv: every 15 minutes
-- mv_product_sales_velocity: every 15 minutes
-- mv_rx_queue_stats: every 5 minutes
-- mv_inventory_status: every 10 minutes
-- mv_customer_360: every 60 minutes
```

### 46.10 N+1 Query Prevention on Search Results

PostgreSQL FTS already returns full product + variant data in a single query (see pg-search.service.ts above). No secondary fetch needed — the search query JOINs products, variants, and inventory status in one call.

```typescript
// WRONG — fetching product details after search results (N+1):
const ids = await pgSearch.search(query)           // 1 query
for (const id of ids) {
  const product = await db.findOne(Product, id)    // N queries
}

// CORRECT — already handled in pg-search.service.ts:
// The search query itself JOINs products + variants + mv_inventory_status
// One query returns everything needed to render the catalog page
const products = await pgSearch.searchProducts(params)  // 1 query, complete data
```

### 46.11 Webhook Idempotency — Correct Order of Operations

```typescript
// src/api/webhooks/razorpay.webhook.ts

router.post('/webhooks/razorpay', async (req, res) => {
  const { event, payload } = req.body
  const eventId = payload.payment?.entity?.id || payload.order?.entity?.id

  // STEP 1: Idempotency check BEFORE processing
  const existing = await db.findOne(WebhookLog, {
    where: { source: 'razorpay', event_id: eventId }
  })
  if (existing?.processed) {
    return res.status(200).send('Already processed') // Silent success — safe to return
  }

  // STEP 2: Mark as in-progress (prevents duplicate processing on concurrent retries)
  await db.save(WebhookLog, {
    source: 'razorpay', event_id: eventId,
    event_type: event, payload: req.body,
    processed: false
  })

  // STEP 3: Process
  try {
    await processRazorpayEvent(event, payload)
    await db.update(WebhookLog, { source: 'razorpay', event_id: eventId },
                    { processed: true, processed_at: new Date() })
  } catch (err) {
    await db.update(WebhookLog, { source: 'razorpay', event_id: eventId },
                    { error: err.message })
    return res.status(500).send('Processing failed') // Razorpay will retry
  }

  res.status(200).send('OK')
})
```

### 46.12 Environment Variables (Performance-Specific)

```
# BullMQ concurrency (tune based on Medusa Cloud compute allocation)
QUEUE_CONCURRENCY_CRITICAL=10
QUEUE_CONCURRENCY_NOTIFICATIONS=5
QUEUE_CONCURRENCY_BACKGROUND=3

# PHI audit log Redis buffer flush interval (milliseconds)
PHI_AUDIT_FLUSH_INTERVAL_MS=5000

# Presigned S3 URL TTL for prescription uploads (seconds)
RX_UPLOAD_PRESIGNED_TTL_SECONDS=300

# Drug interaction cache — max age before background refresh (hours)
DRUG_INTERACTION_CACHE_MAX_AGE_HOURS=168

# HTTP cache TTLs (seconds) — set as Next.js revalidate values
CACHE_TTL_PRODUCT_PAGE=120
CACHE_TTL_CATALOG_PAGE=300
CACHE_TTL_BLOG_PAGE=3600
CACHE_TTL_COMPLIANCE_PAGE=3600
```

### 46.13 Performance Summary

| Bottleneck | Before | After | Method |
|---|---|---|---|
| Checkout response time | 2–3 seconds | < 500ms | BullMQ async notifications |
| Cart add (interaction check) | 200–800ms | < 10ms | Local DB cache, no OpenFDA live calls |
| Rx upload response | 500ms–2s | < 50ms | Presigned S3 — browser uploads direct |
| Product page load (first hit) | 200–500ms | < 150ms | Next.js ISR |
| Product page load (cached) | 200–500ms | < 30ms | CloudFront edge cache |
| FEFO under concurrent orders | Race condition possible | Eliminated | Atomic PostgreSQL function |
| Admin dashboard load | 1–3 seconds (full table scans) | < 200ms | Materialized views |
| PHI audit log write | 20–50ms per request | < 1ms | Redis write-ahead buffer |
| JWT validation (customer GET) | 3–5ms (Redis check) | < 0.2ms | Skip Redis for low-risk requests |
| Webhook duplicate processing | Possible | Eliminated | Idempotency guard first |
| Product catalog search | External MeiliSearch API call | < 10ms | PostgreSQL FTS with GIN index |
| Search as-you-type | External API + network latency | < 10ms | PostgreSQL prefix search (`:*` operator) |

---

## PART 47 — ENVIRONMENT VARIABLES (COMPLETE V9 REFERENCE)

```
# ── MEDUSA CLOUD AUTO-INJECTS THESE (DO NOT SET MANUALLY) ──
# DATABASE_URL     → PostgreSQL 15 connection string
# REDIS_URL        → Redis 7 connection string
# S3 credentials   → AWS S3 bucket access

# ── YOU SET THESE IN MEDUSA CLOUD ENVIRONMENT SETTINGS ──

# App Identity
STOREFRONT_URL=https://suprameds.in
ADMIN_CORS=https://suprameds.in,https://admin.suprameds.in
STORE_CORS=https://suprameds.in
AUTH_CORS=https://suprameds.in,https://admin.suprameds.in
MEDUSA_ADMIN_EMAIL=your@email.com

# Auth Secrets (generate with: openssl rand -base64 32)
COOKIE_SECRET=<32+ char random string>
JWT_SECRET=<32+ char random string>

# Payments
RAZORPAY_KEY_ID=rzp_live_XXXXXXXX
RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXX
RAZORPAY_WEBHOOK_SECRET=XXXXXXXX
STRIPE_SECRET_KEY=sk_live_XXXXXXXX
STRIPE_PUBLISHABLE_KEY=pk_live_XXXXXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXX
CASHFREE_APP_ID=XXXXXXXX
CASHFREE_SECRET_KEY=XXXXXXXX

# Communications
MSG91_AUTH_KEY=XXXXXXXXXXXXXXXX
MSG91_SENDER_ID=SUPMED
TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXX
TWILIO_AUTH_TOKEN=XXXXXXXXXXXXXXXX
TWILIO_WHATSAPP_FROM=whatsapp:+91XXXXXXXXXX
META_WEBHOOK_VERIFY_TOKEN=<your chosen verify string>
SENDGRID_API_KEY=SG.XXXXXXXXXXXXXXXX
SENDGRID_FROM_EMAIL=orders@suprameds.in

# Tracking (AfterShip)
AFTERSHIP_API_KEY=XXXXXXXXXXXXXXXX
AFTERSHIP_WEBHOOK_SECRET=XXXXXXXXXXXXXXXX

# Search: PostgreSQL Full-Text Search
# No environment variables needed — uses Medusa Cloud PostgreSQL automatically
# search_vector column + GIN index set up via database migration

# Monitoring
SENTRY_DSN_BACKEND=https://XXXXXX@sentry.io/XXXXXX
SENTRY_DSN_STOREFRONT=https://XXXXXX@sentry.io/XXXXXX
NEXT_PUBLIC_POSTHOG_KEY=phc_XXXXXXXX
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# BullMQ Queue Concurrency
QUEUE_CONCURRENCY_CRITICAL=10
QUEUE_CONCURRENCY_NOTIFICATIONS=5
QUEUE_CONCURRENCY_BACKGROUND=3

# Performance Tuning
PHI_AUDIT_FLUSH_INTERVAL_MS=5000
RX_UPLOAD_PRESIGNED_TTL_SECONDS=300
DRUG_INTERACTION_CACHE_MAX_AGE_HOURS=168
CACHE_TTL_PRODUCT_PAGE=120
CACHE_TTL_CATALOG_PAGE=300

# Drug Data
OPENFDA_BASE_URL=https://api.fda.gov

# Compliance (no API keys — public data)
INDIA_POST_ACCOUNT_NUMBER=your_pro_account_number
```

---

## CRITICAL NON-NEGOTIABLE RULES (V9 — FINAL)

```
RULE 1: NDPS / Schedule X
  Cannot be purchased online. No override type exists.
  DB constraint + schedule-x-block.middleware.ts (stateless — no bypass possible)

RULE 2: Rx gate
  No Rx drug leaves warehouse without pharmacist dispense_decision.
  order_items.dispense_decision_id non-nullable for Rx — DB enforced.

RULE 3: Pre-dispatch pharmacist sign-off
  No Rx shipment carrier booking without completed pre_dispatch_sign_offs record.

RULE 4: Stock ledger
  inventory_batches quantities never updated directly.
  All changes via stock_movements inserts only. Enforced in inventory.service.ts.

RULE 5: Payment capture
  Rx orders: capture only sum of approved lines. Release auth for rejected lines.

RULE 6: Drug advertising
  Rx drugs: never in Google feed, never in any marketing communication.
  Enforced at: feed generator, notification dispatcher, loyalty module.

RULE 7: FEFO
  All allocations use atomic PostgreSQL fefo_allocate() function.
  Manual override (OVR-01) requires PIC approval + 4h TTL + override_audit_log.

RULE 8: SSD
  8 constraints enforced at ssd-check.middleware.ts. UI cannot bypass.
  Financial SSD (SSD-04) and content SSD (SSD-05) have no override type.

RULE 9: PHI audit
  Every read/write to prescriptions, dispense_decisions, H1 register, DOB:
  → Write to Redis phi_audit_buffer immediately (< 1ms)
  → Flush to phi_audit_log PostgreSQL every 5 seconds
  → Immutable once in PostgreSQL

RULE 10: 5-year retention
  Rx records, supply memos, GRN records, H1 register, phi_audit_logs.
  No auto-deletion. Destruction needs compliance_officer + super_admin approval.

RULE 11: MFA
  All clinical + admin roles: mandatory MFA for write actions.
  Every override approval: fresh MFA re-verification regardless of session state.
  super_admin: FIDO2 hardware key only.

RULE 12: TypeScript strict
  "strict": true throughout. Zero 'any' types.

RULE 13: Compliance pages server-rendered
  /pharmacy/licenses, /privacy, /terms, /prescription-policy, /about/legal, /grievance
  All server-rendered HTML. Never client-side only.

RULE 14: Dispense fills_consumed immutability
  Computed only from prescription_line_consumptions. No direct column update ever.

RULE 15: H1 register transactional integrity
  Every Schedule H1 dispense triggers h1_register_entries in the SAME transaction.
  If H1 write fails → entire dispense decision rolled back. Criminal law obligation.

RULE 16: COD surcharge transparency
  COD surcharge shown as explicit line item before payment confirmation.
  Never hidden. Consumer Protection Rules 2020.

RULE 17: Override frequency
  Any override type used > 5 times in 30 days → systemic issue alert to platform_admin.

RULE 18: BullMQ queue reliability
  All BullMQ jobs must be idempotent — safe to run twice if a worker crashes.
  Use job IDs based on the underlying entity ID to prevent duplicate processing.

RULE 19: Webhook idempotency
  webhook_logs idempotency check ALWAYS runs BEFORE webhook processing.
  Never process first and log second.

RULE 20: Never call OpenFDA during customer actions
  Drug interaction checks during cart operations use local drug_interactions table only.
  OpenFDA API is called only by background jobs during off-peak hours.
```
