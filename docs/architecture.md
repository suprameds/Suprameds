# Architecture

## System Overview

Suprameds is a monorepo with two apps connected via Medusa's REST API:

```
┌─────────────────┐     REST API      ┌──────────────────┐
│   Storefront     │ ◄──────────────► │    Backend        │
│  TanStack Start  │                  │   Medusa.js v2    │
│  React 19 + Vite │                  │   + 17 modules    │
│  Port: 5173      │                  │   Port: 9000      │
└─────────────────┘                   └──────────┬───────┘
                                                  │
                          ┌───────────────────────┼───────────────────────┐
                          │                       │                       │
                    ┌─────▼─────┐          ┌─────▼─────┐          ┌─────▼─────┐
                    │ PostgreSQL │          │   Redis    │          │    R2/S3   │
                    │ (Supabase) │          │  (Cache)   │          │  (Files)   │
                    └───────────┘          └───────────┘          └───────────┘
```

## Module Architecture

All 17 custom modules follow this structure:

```
src/modules/<name>/
├── models/           # MikroORM entities (DML syntax)
│   └── <entity>.ts
├── migrations/       # Database migrations
│   └── Migration<timestamp>.ts
├── service.ts        # Extends MedusaService — auto-generates CRUD
├── index.ts          # Exports MODULE constant + Module() registration
└── __tests__/        # Unit tests
```

**Module registration** in `medusa-config.ts`:
```ts
modules: {
  pharmaCore: { resolve: "./src/modules/pharma" },
  // ... 16 more
}
```

## Data Flow: Order Lifecycle

```
Customer browses → Adds to cart → Cart validation hooks fire:
  ├─ Schedule X block (NDPS Act)
  ├─ Cold chain block
  ├─ Drug interaction warnings
  └─ Rx requirement check (H/H1)

Customer uploads Rx → S3/R2 storage → Status: pending_review

Checkout (5 steps):
  1. Address (pincode serviceability check)
  2. Shipping method
  3. Prescription attachment (for Rx items)
  4. Payment (Razorpay / COD)
  5. Review + place order

Order placed → Event: order.placed → Subscribers fire:
  ├─ Confirmation email/SMS/WhatsApp
  ├─ Loyalty points award
  └─ Warehouse task creation

Pharmacist reviews Rx → Approves/rejects drug lines
  └─ If H1 drug: H1 register entry auto-created

FEFO allocation → Picks nearest-expiry batches
  └─ MRP ceiling check (DPCO compliance)

Pre-dispatch sign-off → Pharmacist verifies
  └─ Shipment created → AfterShip tracking

Delivery → Event: order.delivered
  ├─ Delivery OTP verification
  ├─ Customer notification
  └─ Return window opens (48h)
```

## API Layer

```
src/api/
├── admin/            # 71 admin endpoints (authenticated)
│   ├── refunds/      # Refund lifecycle
│   ├── pharmacist/   # Rx queue, stats
│   ├── warehouse/    # Tasks, returns, inventory
│   ├── dispense/     # Decisions, notes, H1
│   ├── pharma/       # Products, batches, POs
│   └── ...
├── store/            # 27 customer endpoints (public + auth)
│   ├── wishlist/     # Wishlist CRUD
│   ├── prescriptions/ # Rx upload
│   ├── orders/       # Return requests
│   └── ...
├── webhooks/         # 5 webhook endpoints
│   ├── razorpay/     # Payment callbacks
│   ├── aftership/    # Tracking updates
│   └── ...
└── middlewares.ts    # Auth, rate limiting, body size limits
```

## Workflow Engine

Multi-step workflows with compensation (rollback on failure):

```ts
const workflow = createWorkflow("approve-refund", function* (input) {
  const refund = yield* fetchRefundStep(input)      // step 1
  yield* validateStatusStep(refund)                  // step 2
  yield* enforceSsdStep(refund, input.approved_by)   // step 3
  yield* updateRefundStep(refund)                    // step 4 (has compensation)
  yield* emitEventStep("refund.approved")            // step 5
})
```

## Event System

31 subscribers react to events asynchronously:

```
Event emitted → Event bus → Subscriber(s) fire
                          → May trigger more workflows
                          → May send notifications (4 channels)
```

## Scheduled Jobs

18 cron jobs handle background processing:

- **Inventory:** Low stock alerts, near-expiry flagging, FEFO allocation
- **Orders:** COD timeout cancellation, abandoned cart reminders
- **Compliance:** H1 report generation, PHI log archival
- **Shipping:** AfterShip status sync, delivery estimate updates
- **Loyalty:** Point expiration, chronic reorder detection

## Security

- **RBAC:** 25 roles, ~65 permissions, 4 SSD constraints
- **PHI Encryption:** AES-256-GCM for patient data at rest
- **Audit Logging:** Immutable PHI access logs
- **Webhook Verification:** HMAC signatures for all inbound webhooks
- **Rate Limiting:** Token bucket on sensitive endpoints
- **CORS:** Configured per environment

## External Integrations

| Service | Protocol | Auth | Purpose |
|---------|----------|------|---------|
| Razorpay | REST | API key + HMAC webhook | Payments |
| AfterShip | REST | API key + HMAC webhook | Shipping |
| MSG91 | REST | Auth key | SMS/OTP |
| Firebase | Admin SDK | Service account | Push notifications |
| Meta WhatsApp | Graph API | Bearer token + HMAC | Messaging |
| Resend | REST | API key | Email |
| Sentry | SDK | DSN | Error tracking |
| Cloudflare R2 | S3 API | Access key | File storage |
