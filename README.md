# Suprameds

[![CI](https://github.com/suprameds/Suprameds/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/suprameds/Suprameds/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-24-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/license-proprietary-lightgrey)

Licensed online pharmacy for India, selling generic medicines at 50–80% below MRP.
Live at **[supracyn.in](https://supracyn.in)** and on Android.

The platform is a **Medusa.js v2** commerce backend extended with 18 domain modules for
Indian pharmacy regulation (Drugs & Cosmetics Rules, NDPS Act, DPCO, DPDP Act), plus a
server-rendered **TanStack Start** storefront packaged as a native Android app via Capacitor.

---

## Highlights

- **Prescription workflow**: Rx upload, pharmacist review, order linking, and mandatory pre-dispatch sign-off for Schedule H/H1 drugs
- **Compliance enforced in code**: Schedule X sale block, no promotions on Rx items, MRP ceiling across batches, Schedule H1 register, DPDP consent and PHI audit logs
- **Batch-level inventory**: FEFO allocation, lot and expiry tracking, GRN, and recall support
- **RBAC**: 25 roles and ~65 `resource:action` permissions with separation-of-duties constraints
- **Operations**: COD risk scoring, AfterShip tracking, loyalty, CRM refill reminders, and analytics dashboards in the Medusa admin
- **Storefront**: SSR with structured data, OTP login, PWA service worker, and an Android app with one-tap SMS OTP autofill

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Medusa.js v2, TypeScript, PostgreSQL, Redis |
| Storefront | TanStack Start (Vite + React 19), Tailwind CSS v4, React Query |
| Mobile | Capacitor (Android) |
| Payments | Cash on Delivery; Razorpay and Paytm providers integrated |
| Messaging | Resend (email), BulkSMS / MSG91 (DLT-registered SMS OTP), Firebase Cloud Messaging |
| Logistics | AfterShip |
| Storage / CDN | Supabase Storage behind Cloudflare |
| Tooling | pnpm workspaces, Turborepo, Jest, Vitest, Playwright, GitHub Actions |
| Hosting | Railway (Docker) |

## Repository layout

```
.
├── apps/
│   ├── backend/              Medusa.js v2 server + admin extensions
│   │   └── src/
│   │       ├── modules/      Domain modules (prescription, dispense, inventoryBatch, rbac, …)
│   │       ├── workflows/    Multi-step business processes and validation hooks
│   │       ├── api/          REST routes: store/, admin/, webhooks/
│   │       ├── links/        Cross-module associations
│   │       ├── subscribers/  Event handlers
│   │       ├── jobs/         Scheduled jobs (FEFO, COD auto-cancel, expiry flagging, …)
│   │       ├── providers/    Payment, notification, and fulfillment providers
│   │       └── admin/        Dashboard routes and widgets
│   └── storefront/           TanStack Start app (+ android/ Capacitor project)
├── e2e/                      Playwright end-to-end suites
├── docs/                     Architecture, API, compliance, and operations docs
├── scripts/                  Tooling and deploy helpers
├── Dockerfile.backend
└── Dockerfile.storefront
```

## Getting started

**Prerequisites:** Node.js 24 (see `.nvmrc`), pnpm 10, PostgreSQL 15+, and optionally Docker for Redis.

```bash
pnpm install

cp apps/backend/.env.example apps/backend/.env
cp apps/storefront/.env.example apps/storefront/.env
# fill in DATABASE_URL and provider keys

docker compose up -d          # Redis (optional in development)

cd apps/backend
pnpm db:setup                 # run migrations and seed
cd ../..

pnpm dev
```

| Service | URL |
|---|---|
| Storefront | http://localhost:5173 |
| Backend API | http://localhost:9000 |
| Admin dashboard | http://localhost:9000/app |

After seeding, copy a publishable API key from **Admin → Settings → Publishable API Keys** into
`VITE_MEDUSA_PUBLISHABLE_KEY` in `apps/storefront/.env`.

## Development

| Command | Description |
|---|---|
| `pnpm dev` | Run backend and storefront together |
| `pnpm build` | Build all apps |
| `pnpm test` | Unit tests across the workspace |
| `pnpm e2e` | Playwright end-to-end tests |
| `cd apps/backend && npx tsc --noEmit` | Type-check the backend |
| `cd apps/storefront && npx eslint src/ --max-warnings 0` | Lint the storefront |

CI runs type-checks, lint, unit tests, both production builds, a dependency audit, and the
Docker image build on every push and pull request.

## Documentation

- [Setup guide](docs/setup-guide.md): environment, configuration, deployment
- [Architecture](docs/architecture.md): modules, data flow, integrations
- [API reference](docs/api-reference.md)
- [Compliance](docs/compliance.md): how regulatory requirements map to code
- [Testing](docs/testing.md)
- [Developer manual](docs/dev-manual.md) and [staff manual](docs/staff-manual.md)

## License

Proprietary. Copyright © 2026 Supracyn Private Limited. All rights reserved. See [LICENSE](LICENSE).
