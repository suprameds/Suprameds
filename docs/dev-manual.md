# Suprameds Developer Manual

**Version:** 1.0  
**Last Updated:** April 2026  
**Audience:** New developers, contractors, future team members  
**Scope:** Complete guide to understanding, running, modifying, and deploying the Suprameds codebase

---

## Table of Contents

- [Part 1: Quick Start](#part-1-quick-start)
- [Part 2: Architecture Overview](#part-2-architecture-overview)
- [Part 3: Backend Deep Dive](#part-3-backend-deep-dive)
- [Part 4: Storefront Deep Dive](#part-4-storefront-deep-dive)
- [Part 5: Caching Strategy](#part-5-caching-strategy)
- [Part 6: Indian Pharma Compliance](#part-6-indian-pharma-compliance)
- [Part 7: Integrations](#part-7-integrations)
- [Part 8: Database & Data Model](#part-8-database--data-model)
- [Part 9: Testing](#part-9-testing)
- [Part 10: Deployment & Infrastructure](#part-10-deployment--infrastructure)
- [Part 11: Common Gotchas](#part-11-common-gotchas)
- [Part 12: API Reference](#part-12-api-reference)

---

# Part 1: Quick Start

## 1.1 Prerequisites

| Tool       | Minimum Version | Install |
|------------|----------------|---------|
| Node.js    | 20.x           | [nodejs.org](https://nodejs.org) |
| pnpm       | 10.33+         | `corepack enable && corepack prepare pnpm@10.33.0 --activate` |
| PostgreSQL | 14+            | Supabase (recommended for dev) or local install |
| Redis      | 7.x (optional) | `docker compose up -d` or install locally |
| Git        | 2.x            | [git-scm.com](https://git-scm.com) |

Redis is optional for local development. When `REDIS_URL` is not set, Medusa falls back to an in-memory event bus and in-memory cache. Redis is required in production for the cache layer, background job queues, and the event bus.

## 1.2 Clone & Install

```bash
git clone https://github.com/your-org/suprameds.git
cd suprameds
pnpm install
```

The monorepo uses pnpm workspaces. `pnpm install` at the root installs dependencies for both `apps/backend` and `apps/storefront`.

## 1.3 Environment Variables

### Backend (`apps/backend/.env`)

Copy the template and fill in your values:

```bash
cp apps/backend/.env.template apps/backend/.env
```

**Required variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/medusa` |
| `JWT_SECRET` | Secret for JWT signing | Any random string |
| `COOKIE_SECRET` | Secret for session cookies | Any random string |
| `STORE_CORS` | Storefront origins (comma-separated) | `http://localhost:5173` |
| `ADMIN_CORS` | Admin dashboard origins | `http://localhost:5173,http://localhost:9000` |
| `AUTH_CORS` | Auth flow origins | `http://localhost:5173,http://localhost:9000` |

**Optional variables for local development:**

| Variable | Description |
|----------|-------------|
| `REDIS_URL` | Redis connection (comment out if Redis not running) |
| `PAYTM_MERCHANT_ID` | Paytm Business merchant ID |
| `PAYTM_MERCHANT_KEY` | Paytm merchant key (secret) |
| `RAZORPAY_TEST_KEY_ID` | Razorpay test key |
| `RAZORPAY_TEST_KEY_SECRET` | Razorpay test secret |
| `RESEND_API_KEY` | Resend API key for email |
| `AFTERSHIP_API_KEY` | AfterShip tracking API key |
| `MSG91_AUTH_KEY` | MSG91 SMS OTP key |
| `PHI_ENCRYPTION_KEY` | AES-256-GCM key (64 hex chars) for encrypting patient data |
| `FIREBASE_PROJECT_ID` | Firebase project for push notifications |
| `FIREBASE_CLIENT_EMAIL` | Firebase admin SDK email |
| `FIREBASE_PRIVATE_KEY` | Firebase private key (PEM format) |
| `SENTRY_DSN` | Sentry error tracking DSN |

### Storefront (`apps/storefront/.env`)

```bash
cp apps/storefront/.env.example apps/storefront/.env
```

**Required variables:**

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_MEDUSA_BACKEND_URL` | Backend URL | `http://localhost:9000` |
| `VITE_MEDUSA_PUBLISHABLE_KEY` | Medusa publishable API key | Get from admin dashboard |

**Optional variables:**

| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_*` | Firebase config (7 variables for push notifications) |
| `VITE_PAYTM_MERCHANT_ID` | Paytm merchant ID (public, safe to expose) |
| `VITE_RAZORPAY_KEY_ID` | Razorpay key ID (public) |
| `VITE_SENTRY_DSN` | Sentry client DSN |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |

## 1.4 Database Setup

We recommend Supabase for development databases. Create a free project at [supabase.com](https://supabase.com) and use the connection string as `DATABASE_URL`.

```bash
cd apps/backend

# Run Medusa migrations (creates all core + custom module tables)
npx medusa db:migrate

# Run seed scripts (demo data, RBAC roles, pincodes, etc.)
npx medusa exec ./src/scripts/run-migrations.ts
```

Shorthand:

```bash
# Local dev: migrate + seed with demo product data
pnpm db:setup

# Production: migrate + seed without demo products
pnpm db:setup:prod

# Fresh reset: re-run all seeds forcefully
pnpm db:fresh
```

## 1.5 Running Locally

**Start both services (recommended):**

```bash
pnpm dev
```

This uses Turborepo to run both apps concurrently.

**Start individually:**

```bash
pnpm backend:dev     # Backend only → http://localhost:9000
pnpm storefront:dev  # Storefront only → http://localhost:5173
```

**Start Redis (optional but recommended):**

```bash
docker compose up -d
```

This starts a `redis:7-alpine` container on port 6379. Make sure `REDIS_URL=redis://localhost:6379` is uncommented in your backend `.env` file.

**Admin Dashboard:**

The Medusa admin dashboard is available at `http://localhost:9000/app` when the backend is running.

## 1.6 Running Tests

### Backend (Jest)

```bash
cd apps/backend

# Unit tests (~635 tests)
npx jest --testMatch="**/*.unit.spec.ts"

# Integration tests (HTTP)
pnpm test:integration:http

# Integration tests (Modules)
pnpm test:integration:modules
```

> **Windows Note:** `TEST_TYPE=unit pnpm test` does not work on Windows. Use the `npx jest --testMatch` syntax directly.

### Storefront (Vitest)

```bash
cd apps/storefront

# All tests (~92 tests)
pnpm test

# Watch mode
pnpm test:watch

# Single file
vitest run src/path/to/file.test.ts
```

### End-to-End (Playwright)

```bash
# From the project root
pnpm test:e2e

# With UI
pnpm test:e2e:ui

# Mobile-specific tests
pnpm test:e2e:mobile
```

## 1.7 Verification Checklist

After setup, verify everything works:

- [ ] `pnpm backend:dev` starts without errors, `http://localhost:9000/health` returns 200
- [ ] Admin dashboard loads at `http://localhost:9000/app`
- [ ] `pnpm storefront:dev` starts, `http://localhost:5173` renders the storefront
- [ ] Products load on the storefront (requires seed data)
- [ ] Backend unit tests pass: `cd apps/backend && npx jest --testMatch="**/*.unit.spec.ts"`
- [ ] Storefront tests pass: `cd apps/storefront && pnpm test`
- [ ] TypeScript compiles: `cd apps/backend && npx tsc --noEmit`
- [ ] Linting passes: `cd apps/storefront && npx eslint src/ --max-warnings 0`

---

# Part 2: Architecture Overview

## 2.1 System Architecture Diagram

```
                            +---------------------------+
                            |       CLIENTS             |
                            |  Browser / Android App    |
                            +----------+----------------+
                                       |
                                       | HTTPS
                                       v
                  +--------------------+--------------------+
                  |                                         |
                  v                                         v
    +---------------------------+        +---------------------------+
    |   STOREFRONT (SSR)        |        |   ADMIN DASHBOARD         |
    |   TanStack Start + React  |        |   Medusa Admin (Vite)     |
    |   Port 3000 (prod)        |        |   Port 9000/app           |
    |   Port 5173 (dev)         |        |                           |
    +----------+----------------+        +----------+----------------+
               |                                    |
               |  REST API                          |  REST API
               v                                    v
    +---------------------------------------------------+
    |              MEDUSA.JS v2 BACKEND                  |
    |              Port 9000                             |
    |                                                    |
    |  +-----------+  +-----------+  +---------------+   |
    |  | Store API |  | Admin API |  | Webhooks      |   |
    |  | /store/*  |  | /admin/*  |  | /webhooks/*   |   |
    |  +-----------+  +-----------+  +---------------+   |
    |                                                    |
    |  +-------------------------------------------+     |
    |  | 17 Custom Pharma Modules                  |     |
    |  | pharmaCore, pharmaPrescription,           |     |
    |  | pharmaInventoryBatch, pharmaRbac, ...     |     |
    |  +-------------------------------------------+     |
    |                                                    |
    |  +-------------------------------------------+     |
    |  | 18 Workflows | 40 Subscribers | 18 Jobs   |     |
    |  +-------------------------------------------+     |
    |                                                    |
    |  +-------------------------------------------+     |
    |  | 5 Providers                               |     |
    |  | payment-paytm, payment-razorpay,          |     |
    |  | notification-resend, notification-bulksms, |     |
    |  | fulfillment-conditional                   |     |
    |  +-------------------------------------------+     |
    +--------+-----------+-------------+----------------+
             |           |             |
             v           v             v
    +--------+--+ +------+------+ +----+------+
    | PostgreSQL | |    Redis    | |  Supabase |
    | (Neon/     | | Cache, Jobs | |  Storage  |
    |  Supabase) | | Event Bus   | |  (S3)     |
    +------------+ +-------------+ +-----------+

    External Services:
    +--------+ +--------+ +----------+ +----------+ +---------+
    | Paytm  | | Resend | | BulkSMS  | | AfterShip| | Firebase|
    | Razorpay|         | | MSG91    | |          | | (FCM)   |
    +--------+ +--------+ +----------+ +----------+ +---------+
```

## 2.2 Monorepo Structure

The project is a monorepo managed by **pnpm workspaces** and **Turborepo**.

```
suprameds/
  apps/
    backend/         # Medusa.js v2 server (API + Admin + 17 custom modules)
    storefront/      # TanStack Start (Vite + React 19) customer-facing app
  docs/              # Project documentation
  e2e/               # Playwright end-to-end tests
  package.json       # Root: Turborepo scripts, shared devDependencies
  pnpm-workspace.yaml
  turbo.json         # Turborepo task configuration
  docker-compose.yml # Local Redis service
  Dockerfile.backend
  Dockerfile.storefront
```

**pnpm-workspace.yaml:**

```yaml
packages:
  - "apps/**"
  - "!apps/backend/.medusa/**"
```

The `.medusa/` directory is excluded because Medusa compiles TypeScript to `.medusa/server/src/` at build time. This compiled output should not be treated as a workspace package.

**turbo.json tasks:**

| Task    | Behavior |
|---------|----------|
| `build` | Depends on `^build` (builds dependencies first), outputs `dist/**` |
| `dev`   | Not cached, persistent (long-running dev servers) |
| `start` | Depends on `^build` |
| `lint`  | No outputs (check-only) |
| `test`  | No outputs (check-only) |

## 2.3 Backend: Medusa.js v2

The backend is built on [Medusa.js v2](https://docs.medusajs.com/), an open-source headless commerce framework. Medusa provides:

- Core commerce modules (products, orders, customers, carts, payments, fulfillment, inventory, promotions, regions, pricing, auth)
- A dependency injection container
- Workflow engine for multi-step business processes
- Event system (subscribers)
- Background job scheduler
- Admin dashboard (Vite-based)

Our backend extends Medusa with 17 custom modules for pharmaceutical-specific functionality (drug schedules, prescriptions, batch tracking, RBAC, dispensing, compliance, etc.).

**Key versions:** Medusa 2.13.4, TypeScript 5.8.3, Node 20+.

## 2.4 Storefront: TanStack Start

The storefront is built with [TanStack Start](https://tanstack.com/router/latest/docs/start), a full-stack React framework powered by Vite. Key characteristics:

- **React 19** with server-side rendering (SSR)
- **File-based routing** with `$param` syntax (not `[param]`)
- **TanStack Router** for type-safe routing with route loaders
- **TanStack React Query** for server state management and caching
- **Tailwind CSS 4** with CSS custom properties for theming
- **Capacitor** for Android hybrid app builds

**Key versions:** React 19.1.1, TanStack Router 1.144, Vite 7.1, Tailwind CSS 4.1.

## 2.5 Database: PostgreSQL

The primary database is PostgreSQL, hosted on Supabase (development) or Neon (production). The database holds:

- All Medusa core tables (products, orders, carts, customers, payments, etc.)
- 17 custom module table sets (drug products, prescriptions, batches, RBAC, dispensing, compliance, etc.)
- 7 cross-module link tables

Database connections use SSL and connection pooling configured in `medusa-config.ts`:

```
pool: { min: 2, max: 20, idleTimeoutMillis: 30_000, acquireTimeoutMillis: 60_000 }
```

## 2.6 Redis

When `REDIS_URL` is set, Redis serves three purposes:

1. **Cache Layer** (`@medusajs/medusa/cache-redis`): Caches API responses (product data, search results, pharma metadata) with configurable TTLs.
2. **Event Bus**: Distributes events to subscribers across multiple server instances.
3. **Rate Limiting**: Used by OTP endpoints to prevent brute-force attacks.

Without Redis, Medusa uses in-memory implementations. This is acceptable for local development but not for production.

---

# Part 3: Backend Deep Dive

## 3.1 Custom Modules

All 17 custom modules are registered in `medusa-config.ts` using **camelCase keys**. Each module lives under `apps/backend/src/modules/` and follows the standard Medusa module structure:

```
modules/<name>/
  index.ts      # Module definition (Module() wrapper)
  service.ts    # MedusaService subclass
  models/       # Data models (database tables)
  migrations/   # Database migrations
  __tests__/    # Unit tests
```

### Module Registry

| Config Key | Directory | Purpose | Models |
|-----------|-----------|---------|--------|
| `pharmaCore` | `pharma/` | Drug product metadata (schedule, MRP, composition, GST) | `DrugProduct` |
| `pharmaPrescription` | `prescription/` | Customer prescription management and lifecycle | `Prescription`, `PrescriptionLine` |
| `pharmaInventoryBatch` | `inventoryBatch/` | Batch tracking with expiry dates, FEFO allocation | `Batch`, `BatchDeduction`, `BatchAuditLog`, `PurchaseOrder`, `PurchaseOrderLine` |
| `pharmaRbac` | `rbac/` | Role-based access control (25 roles, 65+ permissions) | `Role`, `Permission`, `UserRole`, `InviteRole`, `MfaSecret`, `StaffCredential`, `SignupRequest`, `RoleAuditLog` |
| `pharmaDispense` | `dispense/` | Pharmacist dispensing decisions and sign-off | `DispenseDecision`, `PharmacistNote`, `PharmacistAdjustmentLog`, `PreDispatchSignOff` |
| `pharmaOrder` | `orders/` | Extended order data, guest sessions, CS-placed orders | `OrderExtension`, `OrderStateHistory`, `GuestSession`, `CsPlacedOrder`, `PartialShipmentPreference` |
| `pharmaCod` | `cod/` | Cash-on-delivery scoring and order tracking | `CodOrder`, `CodCustomerScore` |
| `pharmaWarehouse` | `warehouse/` | Warehouse management, bins, zones, GRN, pick lists | `Warehouse`, `WarehouseBin`, `WarehouseZone`, `WarehouseTask`, `GrnRecord`, `PickListLine`, `ReturnsInspection`, `ServiceablePincode`, `Supplier` |
| `pharmaShipment` | `shipment/` | Shipment tracking, delivery days, delivery OTP | `Shipment`, `ShipmentItem`, `DeliveryDaysLookup`, `DeliveryOtpLog` |
| `pharmaPayment` | `payment/` | Payment records, refunds, supply memos, COD refund details | `PaymentRecord`, `Refund`, `SupplyMemo`, `CodRefundDetails` |
| `pharmaCompliance` | `compliance/` | H1 register, PHI audit, pharmacy licenses, DPDP consent | `H1RegisterEntry`, `PhiAuditLog`, `PharmacyLicense`, `CustomerDocument`, `OverrideRequest`, `DpdpConsent` |
| `pharmaCrm` | `crm/` | Chronic reorder pattern detection | `ChronicReorderPattern` |
| `pharmaAnalytics` | `analytics/` | Custom analytics queries (no persistent models) | (none) |
| `pharmaLoyalty` | `loyalty/` | Loyalty points system (earn, redeem, expire) | `LoyaltyAccount`, `LoyaltyTransaction` |
| `pharmaWishlist` | `wishlist/` | Customer wishlist with price-drop alerts | `WishlistItem` |
| `pharmaNotification` | `notification/` | In-app notification center and templates | `InternalNotification`, `NotificationTemplate` |
| `wallet` | `wallet/` | Digital wallet for refund credits | `WalletAccount`, `WalletTransaction` |

### Module Registration Rule

Module names in the `Module()` call **must be camelCase**. Hyphenated names (`Module("inventory-batch")`) silently fail to register.

```typescript
// CORRECT
import { Module } from "@medusajs/framework/utils"
import PharmaInventoryBatchService from "./service"
export const INVENTORY_BATCH_MODULE = "pharmaInventoryBatch"
export default Module(INVENTORY_BATCH_MODULE, { service: PharmaInventoryBatchService })

// WRONG — will silently fail
export default Module("inventory-batch", { service: PharmaInventoryBatchService })
```

## 3.2 MedusaService Gotchas

All module services extend `MedusaService`. Several behaviors differ from typical ORM patterns:

### Update Signature

`MedusaService.updateXxxs()` takes a **single object with `id` included** — not separate `(id, data)` arguments:

```typescript
// CORRECT
await this.updateDrugProducts({ id: drugId, schedule: "H1" })

// WRONG — will not work as expected
await this.updateDrugProducts(drugId, { schedule: "H1" })
```

### Method Pluralization

Method names use **smart English plurals** derived from the model registration key (not the class name):

| Model Class | Registration Key | List Method | Create Method |
|-------------|-----------------|-------------|---------------|
| `H1RegisterEntry` | `h1RegisterEntry` | `listH1RegisterEntries` | `createH1RegisterEntries` |
| `SupplyMemo` | `supplyMemo` | `listSupplyMemoes` | `createSupplyMemoes` |
| `Batch` | `batch` | `listBatches` | `createBatches` |
| `Refund` | (imported as `refund`) | `listRefunds` | `createRefunds` |

### Create Return Types

`MedusaService.create()` returns a **single object** for single input, and an **array** for array input:

```typescript
const single = await this.createBatches({ batch_number: "B001" })     // Returns object
const multi  = await this.createBatches([{ batch_number: "B001" }])    // Returns array
```

### JSON Fields

Model fields typed as `model.json()` resolve to `Record<string, unknown>`. When passing arrays, use `as any`:

```typescript
await this.updateOrders({ id, line_items: items as any })
```

## 3.3 API Routes

All API routes live under `apps/backend/src/api/`. Routes follow Medusa's file-based routing convention where each directory maps to a URL path.

### Route Conventions

1. **HTTP methods:** `GET` (reads), `POST` (creates and updates), `DELETE` (removes). **Never use PUT or PATCH.**
2. **Store routes:** `/store/` prefix for customer-facing endpoints
3. **Admin routes:** `/admin/` prefix for dashboard and back-office endpoints
4. **Webhook routes:** `/webhooks/` prefix for external service callbacks
5. **OTP auth routes:** `/store/otp/` prefix for phone/email OTP flows

### Route File Structure

```
api/
  store/              # Customer-facing endpoints
    products/         # GET /store/products/*
    carts/[id]/       # POST /store/carts/:id/*
    orders/           # GET, POST /store/orders/*
    prescriptions/    # GET, POST /store/prescriptions/*
    ...
  admin/              # Dashboard endpoints (RBAC-protected)
    pharma/           # Drug products, batches, purchases
    prescriptions/    # Prescription review
    warehouse/        # Warehouse management
    rbac/             # Role management
    ...
  webhooks/           # External callbacks
    paytm/            # Paytm payment callbacks
    razorpay/         # Razorpay payment webhooks
    aftership/        # Shipment tracking updates
    msg91/            # SMS delivery reports
    whatsapp/         # WhatsApp Business API webhooks
```

## 3.4 RBAC Middleware

Admin routes are protected with RBAC middleware:

```typescript
import { authorize } from "../../rbac/middleware"

// Single permission check
export const GET = [authorize("analytics", "read"), handler]

// Separation of duties enforcement
import { enforceSsd } from "../../rbac/middleware"
export const POST = [
  authorize("dispense", "decide"),
  enforceSsd("pharmacist_not_self_dispense", getRelatedUserId),
  handler,
]
```

The RBAC system includes:
- **25 roles** (super_admin, pharmacist, warehouse_manager, customer_support, PIC, etc.)
- **~65 permissions** in `resource:action` format (e.g., `prescription:review`, `inventory:adjust`)
- Seed via `POST /admin/rbac/seed`

## 3.5 Providers

### Payment Providers

| Provider | ID | Directory | Purpose |
|----------|----|-----------|---------|
| Paytm Business | `paytm` | `providers/payment-paytm/` | Primary payment gateway for India |
| Razorpay | `razorpay` | `providers/payment-razorpay/` | Backup payment gateway |
| System Default | (Medusa built-in) | N/A | Cash on delivery (COD) |

### Notification Providers

| Provider | ID | Directory | Channels |
|----------|----|-----------|----------|
| Resend | `resend` | `providers/notification-resend/` | `email` |
| BulkSMS | `bulksms` | `providers/notification-bulksms/` | `sms` |

### Fulfillment Providers

| Provider | ID | Directory | Purpose |
|----------|----|-----------|---------|
| Manual | `manual` | (Medusa built-in) | Default fulfillment |
| Conditional Shipping | `conditional-shipping` | `providers/fulfillment-conditional/` | Pincode-based shipping rules |

### ModuleProvider Pattern

Custom providers **must** use the `ModuleProvider()` wrapper in `index.ts` plus a separate `service.ts` class. Exporting the service class directly causes `moduleProviderServices is not iterable`.

```
providers/<name>/
  index.ts    # ModuleProvider() wrapper
  service.ts  # Provider class implementing the interface
```

```typescript
// index.ts — CORRECT pattern
import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import PaytmPaymentService from "./service"

export default ModuleProvider(Modules.PAYMENT, {
  services: [PaytmPaymentService],
})
```

## 3.6 Workflows & Hooks

Workflows define multi-step business processes with rollback capabilities.

### Core Workflows

| Workflow | Directory | Steps |
|----------|-----------|-------|
| Complete Cart | `checkout/complete-cart.ts` | Custom checkout completion |
| Create Prescription | `create-prescription.ts` | Upload and validate prescription |
| Review Prescription | `review-prescription.ts` | Pharmacist prescription review |
| Upload Rx | `prescription/upload-rx.ts` | File upload + record creation |
| Review Rx | `prescription/review-rx.ts` | Approval/rejection flow |
| FEFO Allocation | `fulfillment/fefo-allocation.ts` | First-Expiry-First-Out batch allocation |
| Create Shipment | `fulfillment/create-shipment.ts` | Carrier booking with pharma checks |
| Pharmacist Decision | `dispense/pharmacist-decision.ts` | Approve/modify/cancel dispensing |
| Pre-Dispatch Check | `dispense/pre-dispatch-check.ts` | Final pharmacist sign-off |
| Award Points | `loyalty/award-points.ts` | Calculate and credit loyalty points |
| Confirm COD | `order/confirm-cod.ts` | COD order confirmation |
| Raise Refund | `payment/raise-refund.ts` | Initiate refund request |
| Approve Refund | `payment/approve-refund.ts` | Manager approves refund |
| Process Refund | `payment/process-refund.ts` | Execute refund to gateway/wallet |
| Approve GRN | `warehouse/approve-grn.ts` | Goods Received Note approval |
| Inspect Return | `warehouse/inspect-return.ts` | Return inspection and restocking |
| Recall Batch | `inventory/recall-batch.ts` | Batch recall workflow |
| Request Override | `compliance/request-override.ts` | Compliance override request |
| Merge Guest Cart | `customer/merge-guest-cart.ts` | Post-login guest cart merge |

### Workflow Hooks

Four hooks intercept Medusa core workflows:

| Hook | File | Purpose |
|------|------|---------|
| `addToCartWorkflow.hooks.validate` | `schedule-x-block-add-to-cart.ts` | Blocks Schedule X drugs, cold chain items; checks drug interactions |
| `completeCartWorkflow.hooks.validate` | `validate-cart-rx-compliance.ts` | Enforces prescription requirements, pincode serviceability, promo-once-per-customer |
| `completeCartWorkflow.hooks.orderCreated` | `on-order-created.ts` | Links prescriptions to orders, awards loyalty points |
| `createFulfillmentWorkflow.hooks.validate` | `fulfillment-fefo-mrp-check.ts` | FEFO batch allocation, MRP compliance check |

**Important:** Medusa does not support multiple handlers for the same hook. If you need additional validations, add them to the existing handler.

## 3.7 Subscribers

40 event subscribers handle side effects for the order lifecycle, prescriptions, shipments, loyalty, and notifications. Each subscriber is a file under `apps/backend/src/subscribers/`.

### Key Subscribers by Domain

**Order Lifecycle:**
| Subscriber | Event | Purpose |
|------------|-------|---------|
| `order-placed.ts` | `order.placed` | Link prescription, send confirmation email/SMS |
| `order-canceled.ts` | `order.canceled` | Reverse batch deductions, notify customer |
| `order-delivered.ts` | `order.delivered` | Award loyalty points, request feedback |
| `order-dispatched.ts` | `order.dispatched` | Send tracking email with AfterShip link |
| `order-updated.ts` | `order.updated` | Sync state history |
| `order-payment-captured.ts` | `order.payment_captured` | Record payment, update order state |
| `auto-capture-prepaid.ts` | `order.placed` | Auto-capture prepaid (non-COD) payments |

**Prescription:**
| Subscriber | Event | Purpose |
|------------|-------|---------|
| `prescription-uploaded.ts` | `prescription.uploaded` | Notify pharmacist, queue for review |
| `prescription-fully-approved.ts` | `prescription.fully_approved` | Notify customer, unblock fulfillment |
| `prescription-partially-approved.ts` | `prescription.partially_approved` | Notify with details of partial approval |
| `prescription-rejected.ts` | `prescription.rejected` | Send rejection email with reason |
| `prescription-expired.ts` | `prescription.expired` | Alert customer to re-upload |

**Payments & Refunds:**
| Subscriber | Event | Purpose |
|------------|-------|---------|
| `payment-failed.ts` | `payment.failed` | Notify customer, log failure |
| `refund-raised.ts` | `refund.raised` | Notify finance team |
| `refund-approved.ts` | `refund.approved` | Initiate gateway refund |
| `refund-processed.ts` | `refund.processed` | Send confirmation to customer |

**Cache & System:**
| Subscriber | Event | Purpose |
|------------|-------|---------|
| `cache-invalidation.ts` | `product.updated/created/deleted` | Invalidate Redis cache with glob patterns |
| `product-price-changed.ts` | `product.price_changed` | Trigger wishlist price-drop alerts |
| `product-shipping-profile.ts` | `product.created` | Auto-assign shipping profile |

## 3.8 Background Jobs

18 scheduled jobs run on configurable intervals. Located in `apps/backend/src/jobs/`.

| Job | Purpose | Key Details |
|-----|---------|-------------|
| `auto-allocate-fefo.ts` | FEFO batch allocation for pending orders | First-Expiry-First-Out |
| `cancel-unconfirmed-cod.ts` | Auto-cancel COD orders not confirmed within timeout | Prevents ghost orders |
| `check-low-stock.ts` | Alert when inventory falls below threshold | Uses `LOW_STOCK_THRESHOLD` env var |
| `check-wishlist-price-alerts.ts` | Notify customers when wishlisted items drop in price | Compares `price_at_addition` vs current |
| `clear-phi-audit-logs.ts` | Purge old PHI access logs per DPDP Act | Data minimization |
| `expire-loyalty-points.ts` | Expire unused loyalty points after validity period | Configurable per tier |
| `flag-near-expiry-batches.ts` | Flag batches expiring within 90 days | Prevents dispatch of nearly-expired stock |
| `generate-h1-report.ts` | Generate monthly H1 register report | Legal requirement for Schedule H1 drugs |
| `generate-sales-tax-report.ts` | GST report generation | GSTR-1 compatible |
| `identify-chronic-reorders.ts` | Detect chronic medication reorder patterns | Enables refill reminders |
| `purge-expired-prescriptions.ts` | Mark expired prescriptions as `expired` | Based on `valid_until` date |
| `release-expired-guest-sessions.ts` | Clean up expired guest checkout sessions | Free database space |
| `remind-abandoned-carts.ts` | Send reminder emails for abandoned carts | Configurable delay |
| `send-chronic-refill-reminders.ts` | Send refill reminders for chronic medications | Based on identified patterns |
| `sync-aftership-status.ts` | Sync shipment status from AfterShip API | Pulls latest tracking events |
| `sync-inventory-to-storefront.ts` | Sync inventory levels to storefront cache | Ensures stock accuracy |
| `update-delivery-days.ts` | Update delivery day estimates per pincode | Based on historical data |
| `verify-dlt-templates.ts` | Verify DLT template registration status | TRAI compliance for SMS |

## 3.9 Cross-Module Links

Seven link definitions connect Medusa core entities with custom module entities. Located in `apps/backend/src/links/`.

| Link File | Entities Connected | Purpose |
|-----------|--------------------|---------|
| `product-drug.ts` | Product ↔ DrugProduct | Associates Medusa products with pharma metadata |
| `order-prescription.ts` | Order ↔ Prescription | Links orders to their prescriptions |
| `order-batch-deduction.ts` | Order ↔ BatchDeduction | Tracks which batches filled each order |
| `order-shipment.ts` | Order ↔ Shipment | Maps orders to shipment tracking |
| `customer-prescription.ts` | Customer ↔ Prescription | Ties prescriptions to customer accounts |
| `customer-loyalty.ts` | Customer ↔ LoyaltyAccount | Links customer to loyalty program |
| `variant-batch.ts` | ProductVariant ↔ Batch | Maps variants to inventory batches |

## 3.10 Scripts

Located in `apps/backend/src/scripts/`:

| Script | Command | Purpose |
|--------|---------|---------|
| `seed.ts` | `pnpm seed` | Seed demo data (products, categories, regions) |
| `run-migrations.ts` | `pnpm db:seed` | Run all custom seed scripts (RBAC, pincodes, etc.) |
| `import-products.ts` | `pnpm import:products` | Import product catalog from CSV |
| `import-fresh-data.ts` | `pnpm db:import` | Full data import |
| `assign-super-admin.ts` | `pnpm assign:admin` | Assign super-admin role to a user |
| `cloud-start.mjs` | `pnpm start` | Production start script for Medusa Cloud/Railway |

---

# Part 4: Storefront Deep Dive

## 4.1 TanStack Start + React 19

The storefront uses TanStack Start, which provides:

- **Server-Side Rendering (SSR)** with streaming
- **Type-safe file-based routing** via TanStack Router
- **Server functions** for data loading and mutations
- **Vite** as the build tool and dev server

Build process:

```bash
pnpm build   # Runs: vite build && vite build --config vite.sw.config.ts
```

The second build step compiles the service worker for PWA support.

## 4.2 File-Based Routing

Routes use `$param` syntax (not `[param]`). All customer-facing routes are prefixed with `$countryCode/` (India = `in`).

### Route Structure

```
src/routes/
  __root.tsx                    # Root layout (GA4, GTM, fonts, QueryClient)
  index.tsx                     # Landing page redirect
  $.tsx                         # Catch-all (404)
  cart.tsx                      # /cart
  checkout.tsx                  # /checkout
  store.tsx                     # /store (unified product listing)
  terms.tsx                     # /terms
  privacy.tsx                   # /privacy
  returns.tsx                   # /returns
  grievance.tsx                 # /grievance
  prescription-policy.tsx       # /prescription-policy
  health.ts                     # /health (health check endpoint)
  sitemap[.]xml.ts              # /sitemap.xml (SSR generated)
  pharmacy/                     # Pharmacy information pages
  $countryCode.tsx              # Layout for /:countryCode/* routes
  $countryCode/
    index.tsx                   # /:countryCode (home page)
    store.tsx                   # /:countryCode/store
    search.tsx                  # /:countryCode/search
    cart.tsx                    # /:countryCode/cart
    checkout.tsx                # /:countryCode/checkout
    upload-rx.tsx               # /:countryCode/upload-rx
    account.tsx                 # /:countryCode/account (layout)
    account/                    # Account sub-routes
    categories/                 # /:countryCode/categories/*
    drugs/                      # /:countryCode/drugs/*
    order/                      # /:countryCode/order/*
    products/                   # /:countryCode/products/*
```

**Important:** `routeTree.gen.ts` is auto-generated by TanStack Router. Never edit it manually.

## 4.3 Route Loaders and Data Fetching

TanStack Start supports route loaders for server-side data fetching. Product and category pages use loaders to fetch data before rendering:

```typescript
// Example: Product page loader
export const Route = createFileRoute("/$countryCode/products/$handle")({
  loader: async ({ params }) => {
    // Fetch product data server-side
    return fetchProduct(params.handle, params.countryCode)
  },
  component: ProductPage,
})
```

Data fetching follows a layered approach:

1. **Route loaders** fetch initial data server-side for SSR
2. **React Query hooks** manage client-side caching and refetching
3. **SDK calls** communicate with the Medusa backend

## 4.4 React Query Hooks

All data fetching hooks live in `apps/storefront/src/lib/hooks/`. Each hook wraps TanStack React Query with configured `staleTime` values.

### Hook Reference Table

| Hook File | Hook Name | staleTime | Purpose |
|-----------|-----------|-----------|---------|
| `use-products.ts` | `useProducts` | 5 min | Product list (infinite scroll) |
| `use-products.ts` | `useProduct` | 5 min | Single product by handle |
| `use-products.ts` | `useRelatedProducts` | 5 min | Related products |
| `use-products.ts` | `useLatestProducts` | 5 min | Latest products |
| `use-cart.ts` | `useCart` | 30 sec | Current cart |
| `use-cart.ts` | `useAddToCart` | N/A (mutation) | Add item to cart (optimistic updates) |
| `use-cart.ts` | `useUpdateLineItem` | N/A (mutation) | Update quantity (optimistic) |
| `use-cart.ts` | `useDeleteLineItem` | N/A (mutation) | Remove item (optimistic) |
| `use-cart.ts` | `useRedeemLoyaltyPoints` | N/A (mutation) | Redeem loyalty points |
| `use-customer.ts` | `useCustomer` | 15 min | Current customer profile |
| `use-customer.ts` | `useLogin` | N/A (mutation) | Email/password login |
| `use-customer.ts` | `useRegister` | N/A (mutation) | Customer registration |
| `use-customer.ts` | `useOtpSend` | N/A (mutation) | Send OTP via SMS or email |
| `use-customer.ts` | `useOtpVerify` | N/A (mutation) | Verify OTP and get JWT |
| `use-regions.ts` | `useRegions` | 30 min | All regions |
| `use-regions.ts` | `useRegion` | 30 min | Region by country code |
| `use-categories.ts` | `useCategories` | 30 min | Product categories |
| `use-orders.ts` | `useCustomerOrders` | 2 min | Customer order list |
| `use-orders.ts` | `useOrder` | 1 min | Single order details |
| `use-search.ts` | `useSearch` | 2 min | Full-text product search |
| `use-pharma.ts` | `useBulkPharma` | 5 min | Bulk pharma metadata by product IDs |
| `use-pharma.ts` | `usePharmaFilter` | 5 min | Filter products by schedule/dosage |
| `use-prescriptions.ts` | `useCustomerPrescriptions` | 30 sec | Customer prescription list |
| `use-prescriptions.ts` | `useCartRxStatus` | 0 (always fresh) | Cart prescription status |
| `use-wishlist.ts` | `useWishlist` | (default) | Customer wishlist |
| `use-wallet.ts` | `useWallet` | 2 min | Wallet balance and transactions |
| `use-notifications.ts` | `useNotifications` | 2 min | In-app notifications |
| `use-notifications.ts` | `useUnreadCount` | 1 min | Unread notification count |
| `use-documents.ts` | `useCustomerDocuments` | 30 sec | Customer uploaded documents |
| `use-checkout.ts` | `usePaymentProviders` | 5 min | Available payment methods |
| `use-checkout.ts` | `useShippingOptions` | 5 min | Shipping options |

### Mutation Patterns

Cart mutations use **optimistic updates** for instant UI feedback:

```typescript
// useAddToCart creates an optimistic item immediately, then reconciles with server
onMutate: async (variables) => {
  await queryClient.cancelQueries({ predicate: queryKeys.cart.predicate })
  const previousCart = getCurrentCart(queryClient, fields)
  addItemOptimistically(queryClient, optimisticItem, previousCart, fields)
  return { previousCart }
},
onError: (err, variables, context) => {
  rollbackOptimisticCart(queryClient, context.previousCart, fields)
},
```

## 4.5 Data Layer

### SDK Instance

The Medusa JS SDK is instantiated in `apps/storefront/src/lib/utils/sdk.ts`:

```typescript
import Medusa from "@medusajs/js-sdk"
export const sdk = new Medusa({
  baseUrl: import.meta.env.VITE_MEDUSA_BACKEND_URL,
  publishableKey: import.meta.env.VITE_MEDUSA_PUBLISHABLE_KEY,
})
```

### Server-Side Fetchers

Located in `apps/storefront/src/lib/data/`:

| File | Functions | Purpose |
|------|-----------|---------|
| `products.ts` | Product fetching | SSR product data |
| `categories.ts` | Category fetching | SSR category data |
| `regions.ts` | Region fetching | SSR region data |
| `cart.ts` | Cart operations | Cart management utilities |
| `order.ts` | Order fetching | SSR order data |
| `country-code.ts` | Country code resolution | Maps country code to region |
| `common.ts` | Shared utilities | Common data helpers |
| `custom.ts` | Custom API calls | Non-standard Medusa endpoints |
| `checkout/` | Checkout flow | Payment and shipping logic |

## 4.6 Design System

### Colors (CSS Custom Properties)

Defined in `apps/storefront/src/styles/theme.css`:

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-brand-navy` | `#0D1B2A` | Primary brand, clinical authority |
| `--color-brand-navy-90` | `#1a2d42` | Navy lighter variant |
| `--color-brand-navy-80` | `#1e3554` | Navy lightest variant |
| `--color-brand-teal` | `#0E7C86` | Accent, actionable, pharmaceutical |
| `--color-brand-teal-light` | `#16a5b0` | Teal hover states |
| `--color-brand-teal-dark` | `#0a5f67` | Teal active states |
| `--color-brand-cream` | `#F8F6F2` | Background warmth |
| `--color-brand-cream-dark` | `#EDE9E1` | Background variant |
| `--color-brand-rx` | `#C0392B` | Rx-only badge, warnings |
| `--color-brand-rx-light` | `#fadbd8` | Warning background |
| `--color-brand-ok` | `#1A7A4A` | In-stock, verified |
| `--color-brand-ok-light` | `#d5f0e2` | Success background |
| `--color-brand-warn` | `#D68910` | Warnings, caution |
| `--color-brand-warn-light` | `#fdebd0` | Warning background |

### Typography

| Token | Value |
|-------|-------|
| `--font-sans` | `"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` |
| `--font-serif` | `"Fraunces", Georgia, "Times New Roman", serif` |

### Tailwind Pattern

Colors are used via CSS custom properties in Tailwind classes:

```html
<div class="bg-[var(--color-brand-navy)] text-[var(--color-brand-cream)]">
```

The project uses Tailwind CSS 4 with the `@tailwindcss/vite` plugin.

## 4.7 Component Architecture

Components are organized into two tiers:

### UI Primitives (`src/components/ui/`)

Low-level, reusable UI components (buttons, inputs, modals, etc.).

### Domain Components (`src/components/`)

50+ components organized by domain:

**Product:**
`product-card.tsx`, `product-actions.tsx`, `product-grid.tsx`, `product-option-select.tsx`, `product-price.tsx`, `product-substitutes.tsx`

**Cart & Checkout:**
`cart.tsx`, `checkout-address-step.tsx`, `checkout-delivery-step.tsx`, `checkout-payment-step.tsx`, `checkout-prescription-step.tsx`, `checkout-review-step.tsx`, `checkout-summary.tsx`, `checkout-progress.tsx`

**Payment:**
`payment-button.tsx`, `payment-container.tsx`, `payment-method-info.tsx`, `paytm-payment-button.tsx`, `razorpay-payment-button.tsx`

**Pharma-Specific:**
`drug-interaction-warnings.tsx`, `delivery-estimate.tsx`, `shipment-tracker.tsx`, `return-request-form.tsx`

**Account:**
`loyalty-dashboard.tsx`, `loyalty-redeem.tsx`, `wallet-dashboard.tsx`, `wishlist-button.tsx`, `notification-bell.tsx`

**Layout:**
`layout.tsx`, `navbar.tsx`, `footer.tsx`, `bottom-tab-bar.tsx`, `animated-outlet.tsx`

**Mobile:**
`pull-to-refresh.tsx`, `offline-screen.tsx`, `push-notification-manager.tsx`

---

# Part 5: Caching Strategy

## 5.1 Backend Redis Cache

When `REDIS_URL` is set, the cache module is registered in `medusa-config.ts`:

```typescript
[Modules.CACHE]: {
  resolve: "@medusajs/medusa/cache-redis",
  options: { redisUrl: process.env.REDIS_URL },
}
```

API routes access the cache via the DI container:

```typescript
const cacheService = req.scope.resolve(Modules.CACHE)
```

### Cache operations:

```typescript
// Read from cache
const cached = await cacheService.get<ResponseType>(cacheKey)
if (cached) return res.json(cached)

// Write to cache with TTL (in seconds)
await cacheService.set(cacheKey, responseData, 900) // 15 min

// Invalidate with glob patterns
await cacheService.invalidate("store:products:*")
```

## 5.2 Cached Routes with TTLs

| Route | Cache Key Pattern | TTL | Reason |
|-------|------------------|-----|--------|
| `GET /store/products/pharma` | `store:pharma:{productId}` | 900s (15 min) | Drug metadata changes infrequently |
| `GET /store/products/pharma/bulk` | `store:pharma:bulk:{ids_hash}` | 900s (15 min) | Bulk pharma data for product grids |
| `GET /store/products/pharma/bulk` (filter mode) | `store:pharma:filter:{params_hash}` | 900s (15 min) | Schedule/dosage form filtering |
| `GET /store/products/search` | `store:search:{query_hash}` | 120s (2 min) | Search results change with inventory |

### Cache Key Patterns

User-supplied input (search queries, product ID lists) is hashed with SHA-256 to create fixed-length cache keys:

```typescript
import { createHash } from "crypto"
const hash = createHash("sha256").update(userInput).digest("hex").slice(0, 16)
const cacheKey = `store:search:${hash}`
```

## 5.3 Cache Invalidation

The `cache-invalidation.ts` subscriber listens for product changes and invalidates related cache entries using glob patterns:

```typescript
export default async function cacheInvalidationHandler({ container }) {
  const cacheService = container.resolve(Modules.CACHE)
  const keysToInvalidate = [
    "store:products:*",
    "store:categories:*",
    "store:regions:*",
  ]
  for (const key of keysToInvalidate) {
    await cacheService.invalidate(key)
  }
}

export const config = {
  event: ["product.updated", "product.created", "product.deleted"],
}
```

## 5.4 Frontend React Query Cache

The storefront uses TanStack React Query for client-side caching. Each hook specifies its own `staleTime` based on how frequently the data changes.

### staleTime Reference

| Data Type | staleTime | Rationale |
|-----------|-----------|-----------|
| Regions | 30 min | Almost never change |
| Categories | 30 min | Rarely updated |
| Customer profile | 15 min | Changes on profile edits |
| Products (list/detail) | 5 min | Catalog changes occasionally |
| Pharma metadata | 5 min | Drug info is stable |
| Payment/shipping options | 5 min | Provider config changes rarely |
| Search results | 2 min | Affected by inventory changes |
| Order list | 2 min | New orders appear |
| Wallet | 2 min | Balance changes on transactions |
| Notifications | 2 min | New notifications arrive |
| Order detail | 1 min | Status updates during fulfillment |
| Unread notification count | 1 min | Changes frequently |
| Cart | 30 sec | Mutations invalidate; avoid refetch on mount |
| Prescriptions | 30 sec | Status changes during review |
| Documents | 30 sec | Status changes during review |
| Cart Rx status | 0 (always fresh) | Critical for checkout compliance |

## 5.5 Pharma Constraints on Caching

1. **MRP must invalidate immediately** when prices change. The `product-price-changed` subscriber triggers cache invalidation to prevent serving stale MRP data (selling above MRP is illegal).

2. **Prescriptions are never cached aggressively** (`staleTime: 30s` or `0`). Prescription status changes during pharmacist review, and stale data could allow checkout with a rejected prescription.

3. **Cart Rx status uses `staleTime: 0`** to always fetch fresh data. This ensures the checkout flow always reflects the current prescription attachment state.

4. **Drug schedule checks are fail-closed.** If the pharma service is unavailable during cache miss, checkout is blocked rather than allowed.

---

# Part 6: Indian Pharma Compliance

This section documents the legal and regulatory requirements enforced in the codebase. These rules are **non-negotiable** and violations can result in criminal penalties.

## 6.1 Drug Schedules

Indian drugs are classified into schedules under the Drugs and Cosmetics Act, 1940:

| Schedule | Classification | Online Sale | Prescription Required | Special Rules |
|----------|---------------|-------------|----------------------|---------------|
| **X** | Narcotic/Psychotropic | PROHIBITED | N/A | NDPS Act, 1985 |
| **H1** | High-risk prescription | Allowed | Yes (must be valid) | H1 Register entry mandatory |
| **H** | Standard prescription | Allowed | Yes (must be valid) | Pharmacist verification |
| **OTC** | Over-the-counter | Allowed | No | No restrictions |

## 6.2 Schedule X Blocking

Schedule X drugs (narcotics, psychotropics under the NDPS Act) **cannot be sold online under any circumstances**. This is enforced at two levels:

1. **Add to Cart** (`schedule-x-block-add-to-cart.ts`): The `addToCartWorkflow.hooks.validate` hook checks every item being added. If the drug's schedule is `X` or `is_narcotic` is true, the operation throws `NOT_ALLOWED`.

2. **Checkout** (`validate-cart-rx-compliance.ts`): The `completeCartWorkflow.hooks.validate` hook re-checks all cart items. This prevents bypasses via direct API calls.

Both checks **fail closed**: if the drug schedule cannot be determined (database error), the operation is blocked.

## 6.3 Prescription Requirements

Schedule H and H1 drugs require a valid prescription before purchase:

1. Customer uploads prescription image via `/store/prescriptions` or `/store/prescriptions/upload-file`
2. Prescription is attached to cart via `POST /store/carts/:id/prescription`
3. At checkout, the `validate-cart-rx-compliance` hook verifies:
   - A prescription ID is present in `cart.metadata.prescription_id`
   - The prescription exists and belongs to the customer
   - The prescription status is `approved` or `pending_review` (not `rejected`, `expired`, or `used`)
   - The prescription has not expired (`valid_until` date check)

**Post-order flow:** The pharmacist reviews the prescription after order placement but before fulfillment. This allows orders to be placed quickly while maintaining compliance.

## 6.4 MRP Compliance

Under Indian law, no product can be sold above its Maximum Retail Price (MRP). The system enforces:

1. **MRP stored in paise** in the `DrugProduct` model (`mrp_paise` field). Example: MRP of Rs.78.50 is stored as `7850`.
2. **Price validation** at fulfillment: the `fulfillment-fefo-mrp-check` hook verifies that the selling price does not exceed MRP for any dispatched batch.
3. **Highest MRP rule**: When multiple batches are used to fulfill an order, the **highest** MRP across all dispatched batches is used for compliance.
4. **Cache invalidation on price change**: The `product-price-changed` subscriber invalidates price caches immediately.

## 6.5 H1 Register

The H1 Register is a legal record required for every Schedule H1 drug transaction. The `pharmaCompliance` module maintains `H1RegisterEntry` records containing:

- Drug name, batch number, quantity
- Purchaser details (name, address)
- Prescriber details (doctor name, registration number)
- Date and time of sale
- Pharmacist who dispensed

The `generate-h1-report` background job produces monthly H1 reports. The admin dashboard provides an export endpoint at `GET /admin/dispense/h1-register/export`.

## 6.6 No Promotions on Rx Drugs

Promotional codes and discounts **cannot be applied** to prescription drugs. This is enforced in the `validate-cart-rx-compliance` hook. The system also enforces a **once-per-customer** rule for promo codes.

## 6.7 PHI Encryption

When `PHI_ENCRYPTION_KEY` is set, Protected Health Information (patient names, addresses, doctor details) is encrypted at rest using AES-256-GCM. The key is a 64-character hex string (32 bytes):

```bash
# Generate a key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

PHI access is logged in `PhiAuditLog` records and periodically purged by the `clear-phi-audit-logs` job.

## 6.8 Pharmacist Sign-Off

Before any order containing prescription drugs can be dispatched:

1. A licensed pharmacist must review the prescription
2. The pharmacist records a `DispenseDecision` (approve, modify, or reject)
3. A `PreDispatchSignOff` must be recorded
4. Only after sign-off can the carrier booking proceed

This is enforced via the admin dispensing workflow and the `pre-dispatch-check` workflow.

## 6.9 GST Compliance

All products carry a GST rate in the `DrugProduct` model (`gst_rate` field). The system supports:

- **GSTR-1 reports** via `GET /admin/reports/gstr1`
- **Sales tax reports** via `GET /admin/reports/sales-tax` and the `generate-sales-tax-report` job
- **Invoice generation** with GST details via `/admin/invoices/:orderId/pdf`

Pharmacy details (GSTIN, DL number, address) are configured via environment variables:

```
PHARMACY_NAME=Suprameds Pharmacy
PHARMACY_GSTIN=36XXXXXXXXXXXZX
PHARMACY_DL_NUMBER=TG/28/20B/XXXXX
PHARMACY_ADDRESS=Hyderabad, Telangana, India
```

---

# Part 7: Integrations

## 7.1 Payments

### Paytm Business (Primary)

- **Provider:** `providers/payment-paytm/`
- **Config key:** `paytm` in `medusa-config.ts`
- **Environment variables:**
  - `PAYTM_MERCHANT_ID` — Merchant ID from Paytm Business dashboard
  - `PAYTM_MERCHANT_KEY` — Secret merchant key
  - `PAYTM_WEBSITE_NAME` — Usually `DEFAULT`
  - `PAYTM_CALLBACK_URL` — Webhook URL for payment callbacks
  - `PAYTM_TEST_MODE` — `true` for staging gateway
- **Webhook:** `POST /webhooks/paytm`
- **Storefront:** `VITE_PAYTM_MERCHANT_ID` (public, safe to expose)

### Razorpay (Backup)

- **Provider:** `providers/payment-razorpay/`
- **Config key:** `razorpay` in `medusa-config.ts`
- **Environment variables:**
  - `RAZORPAY_TEST_KEY_ID` / `RAZORPAY_KEY_ID`
  - `RAZORPAY_TEST_KEY_SECRET` / `RAZORPAY_KEY_SECRET`
  - `RAZORPAY_WEBHOOK_SECRET`
- **Webhook:** `POST /webhooks/razorpay`
- **Storefront:** `VITE_RAZORPAY_KEY_ID` (public key ID)
- **Fallback behavior:** If Razorpay API returns 500, the storefront auto-falls back to COD with a toast notification.

### Cash on Delivery (COD)

- **Provider:** Medusa built-in `pp_system_default`
- **Default selection** on the payment step
- **COD confirmation:** `POST /store/orders/cod-confirm`
- **Auto-cancellation:** The `cancel-unconfirmed-cod` job cancels COD orders not confirmed within the timeout window.

## 7.2 Email (Resend)

- **Provider:** `providers/notification-resend/`
- **From address:** `Suprameds <support@supracynpharma.com>`
- **API key:** `RESEND_API_KEY`

### Email Templates

9 React Email templates in `apps/backend/src/email-templates/`:

| Template | Triggered By |
|----------|-------------|
| `order-confirmation.tsx` | Order placed |
| `shipping-confirmation.tsx` | Order dispatched |
| `delivery-confirmation.tsx` | Order delivered |
| `order-canceled.tsx` | Order canceled |
| `prescription-approved.tsx` | Prescription approved |
| `prescription-rejected.tsx` | Prescription rejected |
| `refund-processed.tsx` | Refund completed |
| `batch-recall-notice.tsx` | Batch recalled |
| `pharmacist-order-created.tsx` | Pharmacist creates order from Rx |

Preview email templates locally:

```bash
cd apps/backend && pnpm email:dev
# Opens at http://localhost:9004
```

## 7.3 SMS / OTP

### BulkSMSPlans.com (Primary)

- **Provider:** `providers/notification-bulksms/`
- **DLT entity:** SUPRACYN PRIVATE LIMITED (1501684950000036033)
- **Sender IDs:** Suprra, Ssupra, suppra
- **Environment variables:**
  - `BULKSMS_API_ID`
  - `BULKSMS_API_PASSWORD`
  - `BULKSMS_SENDER_ID`
  - `BULKSMS_DLT_*` (DLT template IDs)

### MSG91 (Fallback)

- **Environment variables:**
  - `MSG91_AUTH_KEY`
  - `MSG91_TEMPLATE_ID_OTP`
  - `MSG91_WEBHOOK_TOKEN`
- **Webhook:** `POST /webhooks/msg91`

### OTP Flow

1. `POST /store/otp/send` — Sends 6-digit OTP via SMS or email
2. `POST /store/otp/verify` — Verifies OTP, returns JWT
3. JWT stored in `localStorage` as `_suprameds_otp_jwt`
4. Subsequent requests use `Authorization: Bearer <jwt>` header

## 7.4 Push Notifications (Firebase)

- **Backend:** `firebase-admin` SDK for sending FCM messages
- **Storefront:** `firebase` SDK for receiving push notifications
- **Device registration:** `POST /store/push/register`
- **Device unregistration:** `POST /store/push/unregister`
- **Environment variables (backend):**
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`
- **Environment variables (storefront):**
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
  - `VITE_FIREBASE_MEASUREMENT_ID`
  - `VITE_FIREBASE_VAPID_KEY`

## 7.5 Shipping (AfterShip)

- **API key:** `AFTERSHIP_API_KEY`
- **Webhook:** `POST /webhooks/aftership`
- **Webhook secret:** `AFTERSHIP_WEBHOOK_SECRET` (for signature verification)
- **Background job:** `sync-aftership-status` periodically pulls tracking updates
- **Storefront component:** `shipment-tracker.tsx` displays tracking timeline

## 7.6 File Storage (Supabase S3)

The file module supports three configurations (checked in order):

1. **Cloudflare R2:** If `R2_FILE_URL` and `R2_ACCESS_KEY_ID` are set
2. **AWS S3 / Supabase S3:** If `S3_ACCESS_KEY_ID` and `S3_REGION` are set
3. **Local filesystem:** Default fallback for development

For production, Supabase Storage (S3-compatible) is used:

```
S3_FILE_URL=https://your-project.supabase.co/storage/v1/s3
S3_BUCKET=suprameds
S3_REGION=ap-south-1
S3_ENDPOINT=https://your-project.supabase.co/storage/v1/s3
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
```

## 7.7 Analytics

### Google Analytics 4

- **Measurement ID:** `G-JKGJ3D3B86`
- **Loaded in:** `__root.tsx`
- **Events in:** `lib/utils/analytics.ts`
- E-commerce events fire to GA4 + Meta Pixel + GTM dataLayer simultaneously

### Google Tag Manager

- **Container:** `GTM-5T86ZHZF`
- **Env var:** `VITE_GTM_ID`
- AdScale connects through GTM as a custom HTML tag

### Meta Pixel

- **Env var:** `VITE_META_PIXEL_ID` (slot ready, not yet active)

## 7.8 Error Tracking (Sentry)

- **Backend:** `@sentry/node` — DSN via `SENTRY_DSN`
- **Storefront:** `@sentry/react` with Vite plugin — DSN via `VITE_SENTRY_DSN`
- Source map uploads during CI/CD builds (optional):
  - `SENTRY_AUTH_TOKEN`
  - `SENTRY_ORG`
  - `SENTRY_PROJECT`

---

# Part 8: Database & Data Model

## 8.1 Key Tables and Relationships

The database contains Medusa core tables plus custom module tables. Here are the major entity groups:

### Medusa Core Entities

| Entity | Purpose |
|--------|---------|
| `product` | Base product catalog |
| `product_variant` | SKU-level variants (size, pack) |
| `product_category` | Category hierarchy |
| `order` | Customer orders |
| `cart` | Shopping carts (pre-order) |
| `customer` | Customer accounts |
| `payment` | Payment records |
| `fulfillment` | Fulfillment records |
| `region` | Geographic regions |
| `promotion` | Discount codes |

### Custom Module Tables

**Pharma Core:**
- `drug_product` — Drug metadata (schedule, MRP, composition, GST, dosage form, strength, manufacturer, therapeutic class)

**Prescriptions:**
- `prescription` — Uploaded prescriptions (file_url, status, doctor_name, patient_name, valid_until)
- `prescription_line` — Individual items on a prescription

**Inventory Batches:**
- `batch` — Inventory batches (batch_number, expiry_date, quantity, mrp_paise)
- `batch_deduction` — Records of stock deductions per order
- `batch_audit_log` — Audit trail for batch operations
- `purchase_order` — Purchase orders from suppliers
- `purchase_order_line` — Line items in purchase orders

**RBAC:**
- `role` — Role definitions (pharmacist, warehouse_manager, etc.)
- `permission` — Permission definitions (resource:action format)
- `user_role` — User-to-role assignments
- `invite_role` — Pre-assigned roles for invited users
- `mfa_secret` — MFA TOTP secrets
- `staff_credential` — Staff professional credentials (pharmacy license, etc.)
- `signup_request` — Self-service signup requests
- `role_audit_log` — Audit log for role changes

**Dispensing:**
- `dispense_decision` — Pharmacist approve/modify/reject decisions
- `pharmacist_note` — Notes from pharmacist review
- `pharmacist_adjustment_log` — Quantity/substitution adjustments
- `pre_dispatch_sign_off` — Final sign-off before carrier booking

**Orders:**
- `order_extension` — Extended order metadata
- `order_state_history` — Full state transition history
- `guest_session` — Guest checkout sessions
- `cs_placed_order` — Orders placed by customer support
- `partial_shipment_preference` — Customer preference for partial shipments

**Payments:**
- `payment_record` — Payment transaction records
- `refund` — Refund requests and processing
- `supply_memo` — Credit/debit memos
- `cod_refund_details` — Bank details for COD refunds

**COD:**
- `cod_order` — COD-specific order data
- `cod_customer_score` — COD reliability scoring

**Compliance:**
- `h1_register_entry` — H1 register entries (legal requirement)
- `phi_audit_log` — PHI access audit trail
- `pharmacy_license` — Pharmacy license records
- `customer_document` — Aadhaar, PAN, etc. uploads
- `override_request` — Compliance override requests
- `dpdp_consent` — DPDP Act consent records

**Warehouse:**
- `warehouse` — Warehouse locations
- `warehouse_bin` — Storage bin locations
- `warehouse_zone` — Temperature/security zones
- `warehouse_task` — Warehouse tasks
- `grn_record` — Goods Received Notes
- `pick_list_line` — Pick list items for orders
- `returns_inspection` — Return inspection records
- `serviceable_pincode` — Delivery serviceability by pincode
- `supplier` — Supplier records

**Shipment:**
- `shipment` — Shipment records with AfterShip tracking
- `shipment_item` — Items in each shipment
- `delivery_days_lookup` — Estimated delivery days by pincode
- `delivery_otp_log` — Delivery verification OTP records

**Loyalty:**
- `loyalty_account` — Customer loyalty accounts (points balance, tier)
- `loyalty_transaction` — Points earned/redeemed/expired

**Wallet:**
- `wallet_account` — Customer wallet (refund credits)
- `wallet_transaction` — Wallet credit/debit transactions

**Wishlist:**
- `wishlist_item` — Customer wishlist items with price alerts

**Notifications:**
- `internal_notification` — In-app notification records
- `notification_template` — Notification templates

**CRM:**
- `chronic_reorder_pattern` — Detected chronic medication patterns

## 8.2 Cross-Module Link Tables

| Table | Columns | Purpose |
|-------|---------|---------|
| `product_drug_product` | `product_id`, `drug_product_id` | Product to drug metadata |
| `order_prescription` | `order_id`, `prescription_id` | Order to prescription |
| `order_batch_deduction` | `order_id`, `batch_deduction_id` | Order to batch deductions |
| `order_shipment` | `order_id`, `shipment_id` | Order to shipment tracking |
| `customer_prescription` | `customer_id`, `prescription_id` | Customer to prescriptions |
| `customer_loyalty` | `customer_id`, `loyalty_account_id` | Customer to loyalty account |
| `variant_batch` | `variant_id`, `batch_id` | Product variant to inventory batch |

## 8.3 Migration Strategy

Medusa manages migrations for both core and custom module tables:

```bash
# Run all pending migrations
cd apps/backend && npx medusa db:migrate

# Generate a new migration after model changes
cd apps/backend && npx medusa db:generate <module_name>
```

Each custom module maintains its own `migrations/` directory. Migrations run in dependency order during `db:migrate`.

**Production note:** The `SKIP_MIGRATIONS=true` flag on Railway skips `db:migrate` during deploy (saves ~3 minutes). Unset this flag when pushing schema changes.

## 8.4 Seeding

```bash
# Full seed (RBAC roles, pincodes, demo products)
pnpm db:setup

# Production seed (no demo products)
pnpm db:setup:prod

# Force re-seed (overwrite existing data)
pnpm db:fresh

# Import product catalog from CSV
pnpm import:products
```

The RBAC system requires seeding before admin users can access the dashboard:

```bash
# Or via API after backend is running
curl -X POST http://localhost:9000/admin/rbac/seed
```

---

# Part 9: Testing

## 9.1 Backend Testing (Jest)

### Configuration

Backend tests use Jest with SWC for TypeScript compilation. Tests are organized by type:

- `*.unit.spec.ts` — Unit tests (isolated, no database)
- `*.integration.http.spec.ts` — HTTP integration tests
- `*.integration.modules.spec.ts` — Module integration tests

### Running Tests

```bash
cd apps/backend

# Unit tests (recommended for development)
npx jest --testMatch="**/*.unit.spec.ts"

# Integration tests (require running database)
pnpm test:integration:http
pnpm test:integration:modules

# Single test file
npx jest src/modules/pharma/__tests__/pharma.unit.spec.ts
```

### Test Patterns

Unit tests follow this pattern:

```typescript
describe("PharmaService", () => {
  let service: PharmaService

  beforeEach(() => {
    service = new PharmaService(/* mock dependencies */)
  })

  it("should reject Schedule X drugs", async () => {
    // Arrange
    const drugProduct = { schedule: "X", product_id: "prod_123" }

    // Act & Assert
    await expect(service.validateForSale(drugProduct))
      .rejects
      .toThrow("Schedule X")
  })
})
```

### Windows Workaround

The standard `TEST_TYPE=unit pnpm test` command does not work on Windows because environment variable syntax differs. Use the direct Jest command:

```bash
# Windows-safe command
npx jest --testMatch="**/*.unit.spec.ts"
```

## 9.2 Storefront Testing (Vitest)

### Configuration

Storefront tests use Vitest with React Testing Library and jsdom. Tests are in `src/__tests__/` and colocated `*.test.ts(x)` files.

### Running Tests

```bash
cd apps/storefront

# All tests
pnpm test

# Watch mode (re-runs on file change)
pnpm test:watch

# Coverage report
pnpm test:coverage

# Single file
vitest run src/__tests__/components/accessibility.test.tsx
```

### Test Patterns

Component tests use React Testing Library:

```typescript
import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import ProductCard from "@/components/product-card"

describe("ProductCard", () => {
  it("renders product title", () => {
    render(<ProductCard product={mockProduct} />)
    expect(screen.getByText("Atorcyn 10")).toBeInTheDocument()
  })
})
```

## 9.3 End-to-End Testing (Playwright)

```bash
# From project root
pnpm test:e2e              # All E2E tests
pnpm test:e2e:ui           # Interactive UI mode
pnpm test:smoke            # Smoke tests only
pnpm test:security         # Security tests
pnpm test:a11y             # Accessibility audit
pnpm test:visual           # Visual regression
pnpm test:e2e:mobile       # Mobile viewport tests
```

## 9.4 Pre-Push Checklist

Always run before pushing:

```bash
# 1. Type-check
cd apps/backend && npx tsc --noEmit
cd apps/storefront && npx tsc --noEmit

# 2. Lint
cd apps/storefront && npx eslint src/ --max-warnings 0

# 3. Tests
cd apps/backend && npx jest --testMatch="**/*.unit.spec.ts"
cd apps/storefront && pnpm test
```

---

# Part 10: Deployment & Infrastructure

## 10.1 Railway Setup

The application is deployed on Railway with three services:

| Service | Port | Health Check | Dockerfile |
|---------|------|-------------|------------|
| Backend (Medusa) | 9000 | `GET /health` | `Dockerfile.backend` |
| Storefront (TanStack Start) | 3000 | `GET /` | `Dockerfile.storefront` |
| Redis | 6379 | Built-in | `redis:7-alpine` |

### Production URLs

| Service | Railway URL | Custom Domain |
|---------|------------|---------------|
| Backend | `https://backend-production-9d3a.up.railway.app` | `api.suprameds.in` |
| Storefront | `https://storefront-production-3f20.up.railway.app` | `suprameds.in` |

## 10.2 Docker Builds

### Backend Dockerfile (multi-stage)

```
Stage 1 (deps): Install dependencies, create pruned production node_modules
Stage 2 (build): Copy source, run medusa build
Stage 3 (runtime): Copy pruned node_modules + build output, start server
```

Build-time environment variables for the backend are set with placeholder values since the build process requires them but they are overridden at runtime.

### Storefront Dockerfile (multi-stage)

```
Stage 1 (deps): Install dependencies
Stage 2 (build): Copy source, inject VITE_* args, run vite build
Stage 3 (runtime): Copy build output, start node server
```

**Critical:** Storefront `VITE_*` variables must be set as Railway service variables. Railway injects them as Docker build args automatically when matching `ARG` declarations exist in the Dockerfile.

The Storefront Dockerfile declares these build args:

- `VITE_MEDUSA_BACKEND_URL`
- `VITE_MEDUSA_PUBLISHABLE_KEY`
- `VITE_FIREBASE_*` (8 variables)
- `VITE_PAYTM_MERCHANT_ID`
- `VITE_PAYTM_TEST_MODE`
- `VITE_RAZORPAY_KEY_ID`
- `VITE_SENTRY_DSN`

### Test Docker Build Locally

```bash
bash scripts/test-deploy.sh
```

This requires an `.env.storefront` file (copy from `.env.storefront.example`).

## 10.3 Branch Strategy

| Branch | Environment | Deploy Trigger |
|--------|-------------|---------------|
| `main` | Production | Auto-deploy on push |
| `development` | Staging | Auto-deploy on push |

Railway watches both branches. Each push triggers a build and deployment.

**Merge method:** Squash merge to `main`.

## 10.4 CI/CD Pipeline

The CI pipeline runs on every push:

1. **TypeScript check** — `tsc --noEmit` for both backend and storefront
2. **ESLint** — Zero warnings policy
3. **Unit tests** — Jest (backend) + Vitest (storefront)
4. **Storefront build** — Vite build
5. **Backend build** — Medusa build
6. **Docker image build** — Both Dockerfiles
7. **E2E Playwright tests**
8. **Accessibility audit**
9. **Security audit**

### pnpm Lockfile Issue

If `--frozen-lockfile` fails in Docker with "specifiers don't match":

```bash
# Fix: regenerate the lockfile
rm pnpm-lock.yaml
pnpm install   # From project root with no node_modules
git add pnpm-lock.yaml
git commit -m "fix: regenerate pnpm lockfile"
```

## 10.5 Health Checks

```bash
# Backend health
curl -sf https://backend-production-9d3a.up.railway.app/health

# Storefront health (returns 200 on successful page render)
curl -sf https://storefront-production-3f20.up.railway.app
```

## 10.6 SKIP_MIGRATIONS Flag

`SKIP_MIGRATIONS=true` is set on the Railway backend service by default. This skips `db:migrate` during deployment, saving approximately 3 minutes per deploy.

**When to unset:** Whenever you push changes that include new database migrations. After the migration deploy completes, re-enable the flag.

## 10.7 Environment Variables Reference

### Backend (Railway)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes (prod) | Redis connection string |
| `JWT_SECRET` | Yes | JWT signing secret |
| `COOKIE_SECRET` | Yes | Cookie encryption secret |
| `STORE_CORS` | Yes | Storefront origins |
| `ADMIN_CORS` | Yes | Admin dashboard origins |
| `AUTH_CORS` | Yes | Auth flow origins |
| `PAYTM_MERCHANT_ID` | Yes | Paytm merchant ID |
| `PAYTM_MERCHANT_KEY` | Yes | Paytm merchant key |
| `PAYTM_CALLBACK_URL` | Yes | Paytm webhook callback URL |
| `RAZORPAY_KEY_ID` | Optional | Razorpay key ID |
| `RAZORPAY_KEY_SECRET` | Optional | Razorpay key secret |
| `RESEND_API_KEY` | Yes | Resend email API key |
| `RESEND_FROM_EMAIL` | Optional | From address (default: `Suprameds <support@supracynpharma.com>`) |
| `BULKSMS_API_ID` | Yes | BulkSMS API ID |
| `BULKSMS_API_PASSWORD` | Yes | BulkSMS API password |
| `BULKSMS_SENDER_ID` | Yes | BulkSMS sender ID |
| `PHI_ENCRYPTION_KEY` | Optional | 64-char hex for PHI encryption |
| `AFTERSHIP_API_KEY` | Yes | AfterShip API key |
| `AFTERSHIP_WEBHOOK_SECRET` | Optional | AfterShip webhook signature secret |
| `MSG91_AUTH_KEY` | Optional | MSG91 SMS key |
| `FIREBASE_PROJECT_ID` | Optional | FCM push notifications |
| `FIREBASE_CLIENT_EMAIL` | Optional | Firebase admin email |
| `FIREBASE_PRIVATE_KEY` | Optional | Firebase private key |
| `SENTRY_DSN` | Optional | Sentry error tracking |
| `PHARMACY_NAME` | Yes | Invoice pharmacy name |
| `PHARMACY_GSTIN` | Yes | GST identification number |
| `PHARMACY_DL_NUMBER` | Yes | Drug license number |
| `PHARMACY_ADDRESS` | Yes | Pharmacy address |
| `WAREHOUSE_STATE` | Yes | Warehouse state (for GST) |
| `LOW_STOCK_THRESHOLD` | Optional | Stock alert threshold (default: 50) |
| `SKIP_MIGRATIONS` | Optional | Skip db:migrate on deploy |
| `DISABLE_ADMIN` | Optional | Disable admin dashboard |

### Storefront (Railway Build Args)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_MEDUSA_BACKEND_URL` | Yes | Backend API URL |
| `VITE_MEDUSA_PUBLISHABLE_KEY` | Yes | Medusa publishable key |
| `VITE_PAYTM_MERCHANT_ID` | Yes | Paytm merchant ID |
| `VITE_PAYTM_TEST_MODE` | Optional | `true` for test mode |
| `VITE_RAZORPAY_KEY_ID` | Optional | Razorpay key ID |
| `VITE_FIREBASE_*` | Optional | Firebase config (8 vars) |
| `VITE_SENTRY_DSN` | Optional | Sentry client DSN |
| `VITE_SUPABASE_URL` | Optional | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Optional | Supabase anon key |

---

# Part 11: Common Gotchas

## 11.1 MedusaService.updateXxxs() Signature

**Problem:** Passing `(id, data)` as separate arguments does nothing or silently fails.

**Solution:** Pass a single object with `id` included:

```typescript
// WRONG
await this.updateDrugProducts(drugId, { schedule: "H1" })

// CORRECT
await this.updateDrugProducts({ id: drugId, schedule: "H1" })
```

## 11.2 MedusaService Method Pluralization

**Problem:** Method names don't match what you'd expect from the model class name.

**Explanation:** Pluralization uses the model **registration key** (import alias), not the class name. English pluralization rules apply:

```typescript
// H1RegisterEntry → listH1RegisterEntries (not "Entrys")
// SupplyMemo → createSupplyMemoes (not "Memos")
// Batch → listBatches
// WishlistItem → listWishlistItems
```

**Tip:** Check the model import in `index.ts` to determine the registration key.

## 11.3 model.json() Fields

**Problem:** TypeScript complains when passing arrays to JSON fields.

**Solution:** Use `as any` cast:

```typescript
// model.json() is typed as Record<string, unknown>
// Arrays need explicit casting
await this.updateOrders({ id, metadata: { line_ids: itemIds as any } })
```

## 11.4 React Email Number Interpolation

**Problem:** `Your order #{display_id}` causes TS2322 — number not assignable to ReactNode & string.

**Solution:** Use template literals inside JSX:

```tsx
// WRONG
<Preview>Your order #{display_id}</Preview>

// CORRECT
<Preview>{`Your order #${display_id}`}</Preview>
```

## 11.5 Import Extensions for node16

**Problem:** Dynamic imports in the notification-resend service fail without `.js` extensions.

**Solution:** Add `.js` extensions and cast the module:

```typescript
// WRONG
const mod = await import("../../email-templates/order-confirmation")

// CORRECT
const mod = await import("../../email-templates/order-confirmation.js") as any
```

## 11.6 Windows Test Commands

**Problem:** `TEST_TYPE=unit pnpm test` does not work on Windows.

**Solution:** Use Jest directly:

```bash
# Windows-safe alternatives
npx jest --testMatch="**/*.unit.spec.ts"
npx jest --testMatch="**/*.integration.http.spec.ts"
```

## 11.7 ModuleProvider Pattern

**Problem:** `moduleProviderServices is not iterable` error.

**Cause:** Exporting the service class directly from `index.ts` instead of wrapping it.

**Solution:** Always use the `ModuleProvider()` wrapper:

```typescript
// index.ts
import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import MyService from "./service"

export default ModuleProvider(Modules.PAYMENT, {
  services: [MyService],
})
```

## 11.8 Stale .medusa/ Cache

**Problem:** Source code changes are not reflected at runtime.

**Cause:** Medusa compiles TypeScript to `.medusa/server/src/`. Stale compiled files can persist.

**Solution:** Delete the compiled directory:

```bash
rm -rf apps/backend/.medusa
pnpm backend:dev   # Will recompile
```

## 11.9 Redis in Local Dev

**Problem:** Endless `ioredis` connection errors in console.

**Cause:** `REDIS_URL` is set in `.env` but Redis is not running.

**Solution:** Comment out `REDIS_URL` when Redis is not running:

```env
# REDIS_URL=redis://localhost:6379
```

Medusa falls back to in-memory event bus and cache.

## 11.10 Module Naming

**Problem:** Module silently fails to register.

**Cause:** Using hyphens in `Module()` name.

**Solution:** Always use camelCase:

```typescript
// WRONG — silently fails
Module("inventory-batch", { service: InventoryBatchService })

// CORRECT
Module("pharmaInventoryBatch", { service: InventoryBatchService })
```

## 11.11 Workflow Hooks — Single Handler

**Problem:** Only one handler runs for a workflow hook, even though you registered multiple.

**Cause:** Medusa does not support multiple handlers for the same hook.

**Solution:** Combine all validations in a single handler function:

```typescript
completeCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
  // All validations in one handler:
  await validateScheduleX(cart, container)
  await validatePrescription(cart, container)
  await validatePincode(cart, container)
  await validatePromoOnce(cart, container)
})
```

## 11.12 Dynamic Imports of Transitive Dependencies

**Problem:** `ioredis`, `sharp`, etc. fail type checking during `medusa build`.

**Cause:** These packages are available at runtime via Medusa but lack type declarations in the build context.

**Solution:** Use `// @ts-ignore` before the dynamic import:

```typescript
// @ts-ignore — available at runtime via Medusa
const Redis = (await import("ioredis")).default
```

## 11.13 Money Amounts

**Problem:** Prices seem wrong by a factor of 100.

**Explanation:** Medusa stores money amounts in **whole currency units** for INR. Rs.10 is stored as `10`, not `1000`.

**Exception:** The `mrp_paise` field in `DrugProduct` stores MRP in **paise** (hundredths of a rupee). Rs.78.50 = `7850` paise.

## 11.14 MedusaService.create() Return Types

**Problem:** Unexpected type when destructuring create result.

**Explanation:** `create()` returns a single object for single input, an array for array input:

```typescript
const single = await this.createBatches({ batch_number: "B001" })
// typeof single === object

const multi = await this.createBatches([{ batch_number: "B001" }])
// typeof multi === array
```

## 11.15 routeTree.gen.ts

**Problem:** Manual edits to route tree are lost.

**Solution:** This file is auto-generated by TanStack Router. Never edit it. It regenerates when you add/remove route files.

## 11.16 Vite SSR Environment Variables

**Problem:** `process.env.VITE_*` returns `undefined` in SSR server handlers.

**Cause:** Vite does not expose `process.env` for `VITE_` prefixed variables at SSR runtime.

**Solution:** Use `import.meta.env.VITE_*` in TanStack Start server handlers:

```typescript
// WRONG (in SSR context)
const url = process.env.VITE_MEDUSA_BACKEND_URL

// CORRECT
const url = import.meta.env.VITE_MEDUSA_BACKEND_URL
```

## 11.17 Database URLs

**Problem:** Cannot connect to production database from local machine.

**Explanation:** Medusa Cloud Neon URLs are read-only externally. Use Supabase for local development, which provides a connection string that works from any network.

---

# Part 12: API Reference

## 12.1 Store API Endpoints

Customer-facing endpoints. All prefixed with `/store/`.

### Products

| Method | Path | Description |
|--------|------|-------------|
| GET | `/store/products/search` | Full-text product search with ranking |
| GET | `/store/products/pharma` | Get pharma metadata for a single product |
| GET | `/store/products/pharma/bulk` | Bulk pharma metadata for multiple products |
| GET | `/store/products/pharma/batch` | Batch inventory info for a product |
| GET | `/store/products/interactions` | Check drug interactions between products |
| GET | `/store/products/substitutes` | Get generic substitutes for a product |

### Cart & Checkout

| Method | Path | Description |
|--------|------|-------------|
| GET | `/store/carts/:id/prescription` | Get cart prescription status (Rx items, attached Rx) |
| POST | `/store/carts/:id/prescription` | Attach/detach prescription to cart |
| POST | `/store/carts/:id/loyalty-redeem` | Redeem loyalty points on cart |
| DELETE | `/store/carts/:id/loyalty-redeem` | Remove redeemed loyalty points |

### Orders

| Method | Path | Description |
|--------|------|-------------|
| POST | `/store/orders/cod-confirm` | Confirm COD order |
| POST | `/store/orders/gstin` | Add GSTIN to order (B2B) |
| GET | `/store/orders/guest` | Retrieve guest order by token |
| POST | `/store/orders/:id/return-request` | Submit return request |

### Prescriptions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/store/prescriptions` | List customer prescriptions |
| POST | `/store/prescriptions` | Create new prescription record |
| GET | `/store/prescriptions/:id` | Get prescription details |
| POST | `/store/prescriptions/upload-file` | Upload prescription image |

### OTP Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/store/otp/send` | Send OTP via SMS or email |
| POST | `/store/otp/verify` | Verify OTP, get JWT token |

### Loyalty

| Method | Path | Description |
|--------|------|-------------|
| GET | `/store/loyalty/account` | Get loyalty account (points, tier) |
| GET | `/store/loyalty/validate-referral` | Validate referral code |

### Wallet

| Method | Path | Description |
|--------|------|-------------|
| GET | `/store/wallet` | Get wallet balance and transactions |
| POST | `/store/wallet/apply` | Apply wallet balance to cart |
| POST | `/store/wallet/remove` | Remove wallet balance from cart |

### Wishlist

| Method | Path | Description |
|--------|------|-------------|
| GET | `/store/wishlist` | List wishlist items |
| POST | `/store/wishlist` | Add item to wishlist |
| DELETE | `/store/wishlist` | Remove item from wishlist |
| POST | `/store/wishlist/:id/alert` | Toggle price-drop alert |

### Notifications

| Method | Path | Description |
|--------|------|-------------|
| GET | `/store/notifications` | List in-app notifications |
| POST | `/store/notifications/:id/read` | Mark notification as read |

### Push Notifications

| Method | Path | Description |
|--------|------|-------------|
| POST | `/store/push/register` | Register device for push notifications |
| POST | `/store/push/unregister` | Unregister device |

### Reminders

| Method | Path | Description |
|--------|------|-------------|
| GET | `/store/reminders` | List medication reminders |
| POST | `/store/reminders` | Create/update reminder |
| DELETE | `/store/reminders/:id` | Delete reminder |

### Documents

| Method | Path | Description |
|--------|------|-------------|
| GET | `/store/documents` | List uploaded documents |
| POST | `/store/documents/upload` | Upload identity document |

### Invoices

| Method | Path | Description |
|--------|------|-------------|
| GET | `/store/invoices/:orderId/pdf` | Download invoice PDF |
| POST | `/store/invoices/:orderId/email` | Email invoice to customer |

### Shipments

| Method | Path | Description |
|--------|------|-------------|
| GET | `/store/shipments` | List customer shipments with tracking |

### Delivery Estimate

| Method | Path | Description |
|--------|------|-------------|
| GET | `/store/delivery-estimate` | Estimated delivery days for a pincode |

### Pincodes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/store/pincodes` | Check pincode serviceability |

### Pharmacist Portal

| Method | Path | Description |
|--------|------|-------------|
| GET | `/store/pharmacist/prescriptions` | List prescriptions for pharmacist review |
| GET | `/store/pharmacist/prescriptions/:id` | Get prescription details |
| POST | `/store/pharmacist/prescriptions/:id` | Update prescription (approve/reject) |
| POST | `/store/pharmacist/prescriptions/:id/create-order` | Create order from prescription |
| GET | `/store/pharmacist/products/search` | Search products (pharmacist context) |

## 12.2 Admin API Endpoints

Dashboard and back-office endpoints. All prefixed with `/admin/`. Protected by RBAC middleware.

### Analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/analytics` | Dashboard overview metrics |
| GET | `/admin/analytics/revenue` | Revenue analytics |
| GET | `/admin/analytics/products` | Product performance analytics |
| GET | `/admin/analytics/customers` | Customer analytics |
| GET | `/admin/analytics/wishlist` | Wishlist analytics |

### Auth & MFA

| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/auth/register` | Register admin user |
| POST | `/admin/mfa/setup` | Set up MFA (TOTP) |
| POST | `/admin/mfa/verify` | Verify MFA code |

### Compliance

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/compliance/override-requests` | List compliance override requests |
| POST | `/admin/compliance/override-requests` | Approve/reject override |
| GET | `/admin/compliance/phi-logs` | PHI access audit logs |

### Customers

| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/customers/:id/role` | Assign customer role |
| POST | `/admin/customers/import` | Bulk import customers |

### Dispensing

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/dispense/decisions` | List dispense decisions |
| POST | `/admin/dispense/decisions` | Record dispense decision |
| GET | `/admin/dispense/notes` | Pharmacist notes |
| POST | `/admin/dispense/notes` | Add pharmacist note |
| POST | `/admin/dispense/pre-dispatch` | Record pre-dispatch sign-off |
| GET | `/admin/dispense/h1-register/export` | Export H1 register |

### Documents

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/documents` | List customer documents |
| POST | `/admin/documents/:id/review` | Review/approve document |

### Inventory

| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/inventory/import` | Import inventory data |

### Invoices

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/invoices` | List invoices |
| GET | `/admin/invoices/:id` | Get invoice details |
| GET | `/admin/invoices/:orderId/pdf` | Generate invoice PDF |

### Loyalty

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/loyalty` | Loyalty program overview |
| POST | `/admin/loyalty` | Update loyalty settings |
| GET | `/admin/loyalty/customer/:id` | Customer loyalty details |

### Orders

| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/orders/cs-place` | Customer support places order |
| GET | `/admin/orders/returns` | List return requests |
| GET | `/admin/orders/:orderId/invoice` | Get order invoice |
| GET | `/admin/orders/:orderId/shipping-label` | Generate shipping label |

### Pharma

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/pharma/drug-products` | List/filter drug products |
| GET | `/admin/pharma/batches` | List inventory batches |
| POST | `/admin/pharma/batches` | Create batch |
| GET | `/admin/pharma/batches/:id` | Get batch details |
| POST | `/admin/pharma/batches/:id` | Update batch |
| POST | `/admin/pharma/batches/:id/recall` | Recall a batch |
| POST | `/admin/pharma/batches/adjust` | Adjust batch quantity |
| POST | `/admin/pharma/batches/import` | Import batches from CSV |
| GET | `/admin/pharma/batches/low-stock` | Low stock alert list |
| GET | `/admin/pharma/batches/report` | Batch report |
| POST | `/admin/pharma/import` | Import drug products |
| POST | `/admin/pharma/import/batch` | Batch import |
| GET | `/admin/pharma/export` | Export drug product data |
| GET | `/admin/pharma/purchases` | List purchase orders |
| POST | `/admin/pharma/purchases` | Create purchase order |
| GET | `/admin/pharma/purchases/:id` | Get PO details |
| POST | `/admin/pharma/purchases/:id` | Update PO |
| POST | `/admin/pharma/purchases/:id/lines` | Add PO lines |
| POST | `/admin/pharma/purchases/:id/receive` | Receive goods against PO |
| POST | `/admin/pharma/cod/mark-collected` | Mark COD as collected |
| POST | `/admin/pharma/cod/reconcile` | Reconcile COD amounts |

### Pharmacist

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/pharmacist/rx-queue` | Prescription review queue |
| GET | `/admin/pharmacist/stats` | Pharmacist workload stats |

### Pincodes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/pincodes` | List serviceable pincodes |
| POST | `/admin/pincodes` | Add/update pincodes |
| POST | `/admin/pincodes/import` | Bulk import pincodes |

### Prescriptions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/prescriptions` | List prescriptions (with filters) |
| GET | `/admin/prescriptions/:id` | Get prescription details |
| POST | `/admin/prescriptions/:id` | Update prescription (review decision) |
| GET | `/admin/prescriptions/:id/file-url` | Get signed URL for Rx image |
| POST | `/admin/prescriptions/:id/create-order` | Create order from prescription |

### Prices

| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/prices/import` | Bulk import prices |

### Products

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/products/search` | Admin product search |

### RBAC

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/rbac/roles` | List all roles |
| GET | `/admin/rbac/users` | List users with roles |
| GET | `/admin/rbac/me` | Current user's role and permissions |
| POST | `/admin/rbac/assign` | Assign role to user |
| POST | `/admin/rbac/revoke` | Revoke role from user |
| POST | `/admin/rbac/invite` | Invite user with pre-assigned role |
| POST | `/admin/rbac/seed` | Seed RBAC roles and permissions |
| GET | `/admin/rbac/audit-log` | RBAC audit log |
| GET | `/admin/rbac/credentials` | List staff credentials |
| POST | `/admin/rbac/credentials` | Add staff credential |
| GET | `/admin/rbac/credentials/:id` | Get credential details |
| POST | `/admin/rbac/credentials/:id` | Update credential |
| GET | `/admin/rbac/signup-requests` | List signup requests |
| POST | `/admin/rbac/signup-requests/:id/review` | Review signup request |

### Refunds

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/refunds` | List refund requests |
| GET | `/admin/refunds/:id` | Get refund details |
| POST | `/admin/refunds/:id/approve` | Approve refund |
| POST | `/admin/refunds/:id/reject` | Reject refund |
| POST | `/admin/refunds/:id/process` | Process refund payment |
| POST | `/admin/refunds/:id/cod-bank-details` | Add bank details for COD refund |

### Reports

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/reports/gstr1` | GSTR-1 tax report |
| GET | `/admin/reports/sales-tax` | Sales tax report |

### Shipments

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/shipments` | List shipments |
| POST | `/admin/shipments` | Create shipment |
| GET | `/admin/shipments/:id` | Get shipment details |
| POST | `/admin/shipments/:id` | Update shipment status |

### Warehouse

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/warehouse/bins` | List warehouse bins |
| POST | `/admin/warehouse/bins` | Create/update bins |
| GET | `/admin/warehouse/zones` | List warehouse zones |
| POST | `/admin/warehouse/zones` | Create/update zones |
| GET | `/admin/warehouse/grn` | List GRN records |
| POST | `/admin/warehouse/grn` | Create GRN record |
| GET | `/admin/warehouse/inventory` | Warehouse inventory view |
| POST | `/admin/warehouse/inventory/sync` | Sync inventory levels |
| GET | `/admin/warehouse/pick-lists` | List pick lists |
| POST | `/admin/warehouse/pick-lists` | Create pick list |
| GET | `/admin/warehouse/pick-lists/:orderId` | Get pick list for order |
| POST | `/admin/warehouse/pick-lists/:orderId/allocate` | Allocate batches |
| POST | `/admin/warehouse/pick-lists/:orderId/override` | Override allocation |
| POST | `/admin/warehouse/pick-lists/print` | Print pick lists |
| GET | `/admin/warehouse/returns` | List return inspections |
| POST | `/admin/warehouse/returns` | Record return inspection |

## 12.3 Webhook Endpoints

| Method | Path | Source | Purpose |
|--------|------|--------|---------|
| POST | `/webhooks/paytm` | Paytm | Payment status callbacks |
| POST | `/webhooks/razorpay` | Razorpay | Payment webhooks |
| POST | `/webhooks/aftership` | AfterShip | Shipment tracking updates |
| POST | `/webhooks/msg91` | MSG91 | SMS delivery reports |
| POST | `/webhooks/whatsapp` | Meta | WhatsApp Business API messages |

## 12.4 Authentication Methods

### 1. Email/Password (Session-based)

Standard Medusa auth flow using `sdk.auth.login("customer", "emailpass", { email, password })`. Creates a session cookie.

### 2. OTP via SMS

1. `POST /store/otp/send` with `{ phone, country_code: "91", channel: "sms" }`
2. `POST /store/otp/verify` with `{ phone, otp, country_code: "91" }`
3. Returns JWT token stored in `localStorage` as `_suprameds_otp_jwt`
4. Subsequent requests use `Authorization: Bearer <jwt>` header

### 3. OTP via Email

1. `POST /store/otp/send` with `{ email, channel: "email" }`
2. `POST /store/otp/verify` with `{ email, otp, channel: "email" }`
3. Same JWT flow as SMS OTP

### 4. Admin Auth

Standard Medusa admin auth with optional MFA (TOTP):

1. Login via Medusa admin auth
2. If MFA enabled: `POST /admin/mfa/verify` with TOTP code
3. MFA setup: `POST /admin/mfa/setup` returns QR code data

---

**End of Document**

This manual covers the complete Suprameds codebase as of April 2026. For the most current information, always cross-reference with `CLAUDE.md` at the project root, which serves as the living reference document.
