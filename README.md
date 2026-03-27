# Suprameds

Indian pharmaceutical ecommerce platform built on **Medusa.js v2** + **TanStack Start** (React 19). Full regulatory compliance for online pharmacy operations in India.

> **Status:** ~80% complete · 17 custom modules · 103 API endpoints · 122 E2E tests

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Medusa.js v2, TypeScript, PostgreSQL |
| Storefront | TanStack Start, React 19, Tailwind CSS 4 |
| Payments | Razorpay (UPI/Cards/Netbanking/EMI) + COD |
| Notifications | Resend (email), MSG91 (SMS/OTP), Firebase (push), WhatsApp (Meta) |
| Shipping | AfterShip |
| Monorepo | pnpm workspaces + Turborepo |
| Infra | Docker, Nginx, Redis, Cloudflare R2 |

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 10
- **Docker** (for Redis)
- **PostgreSQL** (Supabase, Neon, or local)

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Start Redis
docker compose up -d

# 3. Configure environment
cp apps/backend/.env.example apps/backend/.env
cp apps/storefront/.env.example apps/storefront/.env
# Edit .env files with your DATABASE_URL, keys, etc.

# 4. Run database migrations
cd apps/backend && pnpm medusa db:migrate

# 5. Seed initial data
pnpm medusa exec ./src/scripts/run-migrations.ts

# 6. Start dev servers
cd ../.. && pnpm dev
# Backend:    http://localhost:9000
# Admin:      http://localhost:9000/app
# Storefront: http://localhost:5173

# 7. Get publishable API key
# Admin → Settings → Publishable API Keys → Copy
# Set VITE_MEDUSA_PUBLISHABLE_KEY in apps/storefront/.env
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start backend + storefront |
| `pnpm build` | Build all apps |
| `pnpm test` | Run all unit tests |
| `pnpm e2e` | Run Playwright E2E tests |
| `pnpm e2e:ui` | E2E tests with Playwright UI |
| `pnpm docker:build` | Build production Docker images |
| `pnpm docker:up` | Start production stack |

## Project Structure

```
suprameds/
├── apps/
│   ├── backend/           # Medusa.js v2 backend
│   │   ├── src/
│   │   │   ├── modules/   # 17 custom modules
│   │   │   ├── api/       # 103 API routes
│   │   │   ├── workflows/ # 19 multi-step workflows
│   │   │   ├── subscribers/ # 31 event handlers
│   │   │   ├── jobs/      # 18 scheduled jobs
│   │   │   ├── admin/     # Admin UI extensions
│   │   │   ├── providers/ # Razorpay, Resend, conditional shipping
│   │   │   └── lib/       # Integrations (AfterShip, Firebase, WhatsApp)
│   │   └── medusa-config.ts
│   │
│   └── storefront/        # TanStack Start storefront
│       ├── src/
│       │   ├── routes/    # File-based routing
│       │   ├── components/ # 50+ React components
│       │   └── lib/       # Hooks, data layer, utilities
│       └── vite.config.ts
│
├── e2e/                   # Playwright E2E tests (122 tests)
├── docs/                  # Project documentation
├── docker-compose.yml     # Dev (Redis)
└── docker-compose.production.yml  # Production stack
```

## Custom Modules

| Module | Purpose |
|--------|---------|
| `pharmaCore` | Drug schedules (OTC/H/H1/X), CDSCO registration, HSN/GST |
| `pharmaPrescription` | Rx upload → pharmacist review → approval → attachment to order |
| `pharmaDispense` | Pharmacist decisions, H1 register, pre-dispatch sign-off |
| `pharmaInventoryBatch` | FEFO allocation, lot tracking, expiry, MRP ceiling, batch recall |
| `pharmaWarehouse` | GRN, pick/pack tasks, zones/bins, returns inspection |
| `pharmaPayment` | Razorpay integration, refund workflows (SSD-04 enforced), supply memos |
| `pharmaOrder` | Order extensions, guest checkout, CS-placed orders |
| `pharmaCod` | COD confirmation, customer risk scoring |
| `pharmaShipment` | AfterShip tracking, delivery OTP, NDR handling |
| `pharmaCompliance` | H1 register, PHI audit logs, DPDP consent, override requests |
| `pharmaRbac` | 25 roles, ~65 permissions, SSD constraints, MFA |
| `pharmaWishlist` | Wishlist with price drop alerts |
| `pharmaLoyalty` | Points, tiers, earn/redeem ledger |
| `pharmaCrm` | Chronic reorder detection, refill reminders |
| `pharmaAnalytics` | Revenue, product, customer, wishlist analytics |
| `pharmaNotification` | Internal notifications, template management |

## Regulatory Compliance

- **NDPS Act** — Schedule X drugs blocked at middleware level
- **CDSCO** — H1 register for every Schedule H1 dispense
- **DPCO** — MRP ceiling enforcement (never sell above printed MRP)
- **DPDP Act 2023** — Consent management, PHI encryption (AES-256-GCM), audit logs
- **GST** — HSN code classification, CGST/SGST/IGST calculation, invoice generation
- **FEFO** — First Expiry First Out batch allocation

## Documentation

See [`docs/`](./docs/) for detailed documentation:

- [Setup Guide](./docs/setup-guide.md) — Environment setup, configuration, deployment
- [Architecture](./docs/architecture.md) — System design, module structure, data flow
- [API Reference](./docs/api-reference.md) — All 103 endpoints with request/response shapes
- [Compliance Guide](./docs/compliance.md) — Indian pharma regulatory features
- [Testing Guide](./docs/testing.md) — Unit, integration, and E2E testing

## License

Proprietary — All rights reserved.
