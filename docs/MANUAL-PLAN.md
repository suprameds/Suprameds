# Suprameds Documentation Plan

## Two Deliverables

### 1. Staff Operations Manual (`docs/staff-manual.md`)
**Audience:** Non-technical staff (customer support, pharmacists, warehouse managers, finance, admin)
**Purpose:** How to use every feature in the admin dashboard and storefront from an operator's perspective
**Format:** Markdown with screenshots placeholders, step-by-step procedures, troubleshooting

### 2. Developer Manual (`docs/dev-manual.md`)
**Audience:** New developers, contractors, future team members
**Purpose:** Everything needed to understand, run, modify, and deploy the Suprameds codebase
**Format:** Markdown with architecture diagrams, code examples, API reference, decision rationale

---

## Staff Operations Manual - Table of Contents

### Part 1: Platform Overview
- 1.1 What is Suprameds (pharmacy ecommerce, generic medicines 50-80% off MRP)
- 1.2 System Components (Admin Dashboard, Storefront, Mobile App)
- 1.3 User Roles & Permissions (25 roles, what each can access)
- 1.4 Logging In (admin URL, credentials, MFA setup)

### Part 2: Customer-Facing Storefront (What Customers See)
- 2.1 Home Page & Product Browsing
- 2.2 Product Detail Pages (pharma info, tabs, variants, drug interactions)
- 2.3 Search & Categories
- 2.4 Shopping Cart
- 2.5 Checkout Flow (address, delivery, prescription, payment, review)
- 2.6 Payment Methods (Razorpay, Paytm, COD)
- 2.7 Customer Account (profile, addresses, orders, prescriptions, wishlist, reminders, notifications, verification)
- 2.8 Prescription Upload & Review Process
- 2.9 Order Tracking & Returns

### Part 3: Admin Dashboard - Orders & Fulfillment
- 3.1 Dashboard Overview & Analytics
- 3.2 Order Management
- 3.3 Prescription Review (pharmacist workflow: approve/reject/substitute/modify)
- 3.4 Dispensing & Pre-Dispatch Checks
- 3.5 Pick Lists & Batch Allocation (FEFO)
- 3.6 Shipping & Tracking (AfterShip integration)
- 3.7 Returns & Refund Processing
- 3.8 COD Reconciliation

### Part 4: Admin Dashboard - Inventory & Warehouse
- 4.1 Product Catalog Management
- 4.2 Creating New Medicines
- 4.3 Bulk Product Import
- 4.4 Batch Management (lot numbers, expiry dates, recalls)
- 4.5 Inventory Levels & Stock Sync
- 4.6 Low Stock Alerts & Near-Expiry Flagging
- 4.7 Warehouse Zones & Bins
- 4.8 Goods Receipt Notes (GRN)
- 4.9 Purchase Orders

### Part 5: Admin Dashboard - Compliance & Regulatory
- 5.1 Drug Schedule Classification (Schedule X, H, H1, OTC)
- 5.2 H1 Register (controlled drug dispensing log)
- 5.3 Prescription Policy Enforcement
- 5.4 MRP Compliance Rules
- 5.5 PHI (Protected Health Information) Access Logs
- 5.6 Compliance Override Requests
- 5.7 Document Verification (KYC)
- 5.8 GSTR-1 Tax Reports

### Part 6: Admin Dashboard - Customer & Marketing
- 6.1 Customer Management
- 6.2 Loyalty Program (tiers, points, referrals)
- 6.3 Pincode Serviceability Management
- 6.4 Notifications & Push Messages
- 6.5 Delivery Estimate Configuration

### Part 7: Admin Dashboard - User Management
- 7.1 Roles & Permissions (RBAC)
- 7.2 Adding Staff Users
- 7.3 Signup Request Approval
- 7.4 Audit Logs

### Part 8: Background Operations (What Happens Automatically)
- 8.1 Automated Inventory Allocation (FEFO)
- 8.2 COD Auto-Cancellation
- 8.3 Low Stock & Expiry Alerts
- 8.4 Chronic Refill Reminders
- 8.5 AfterShip Tracking Sync
- 8.6 Loyalty Points Expiry
- 8.7 Abandoned Cart Reminders
- 8.8 H1 Report Generation
- 8.9 Inventory Sync to Storefront

### Part 9: Troubleshooting
- 9.1 Common Issues & Solutions
- 9.2 Payment Failures
- 9.3 Prescription Upload Issues
- 9.4 Inventory Sync Discrepancies
- 9.5 Who to Contact

---

## Developer Manual - Table of Contents

### Part 1: Quick Start
- 1.1 Prerequisites (Node 20+, pnpm 10+, PostgreSQL, Redis optional)
- 1.2 Clone & Install
- 1.3 Environment Variables (.env setup)
- 1.4 Database Setup (Supabase for dev, migrations, seeding)
- 1.5 Running Locally (backend :9000, storefront :5173)
- 1.6 Running Tests (Jest backend, Vitest storefront)

### Part 2: Architecture Overview
- 2.1 Monorepo Structure (pnpm workspaces + Turborepo)
- 2.2 Backend: Medusa.js v2 (modules, providers, workflows, subscribers, jobs)
- 2.3 Storefront: TanStack Start (React 19, Vite, file-based routing)
- 2.4 Database: PostgreSQL (Medusa ORM + custom modules)
- 2.5 Redis: Cache (ICacheService) + Event Bus + Rate Limiting
- 2.6 Architecture Diagram (ASCII)

### Part 3: Backend Deep Dive
- 3.1 Custom Modules (17 modules, how to add a new one)
  - Module registration in medusa-config.ts (camelCase keys)
  - Model, Service, Migration pattern
  - MedusaService gotchas (update signature, pluralization, create return types)
- 3.2 API Routes
  - Store routes (/store/), Admin routes (/admin/), Webhooks
  - Route conventions (GET, POST, DELETE only - never PUT/PATCH)
  - RBAC middleware (authorize, enforceSsd)
  - Customer auth routes (/v1/)
- 3.3 Providers
  - Payment: Razorpay + System Default (COD)
  - Notification: Resend email
  - Fulfillment: Conditional
  - ModuleProvider() wrapper pattern
- 3.4 Workflows & Hooks
  - Workflow structure (steps, compensation)
  - Hook system (validation, compliance checks)
  - Single handler per hook constraint
- 3.5 Subscribers (event handlers)
  - Event naming conventions
  - Cache invalidation subscriber
  - Order lifecycle events
- 3.6 Background Jobs (19 scheduled tasks)
  - Job registration
  - Batch query patterns (FEFO job as template)
  - Error handling and logging
- 3.7 Links (cross-module associations)
  - product-drug, order-prescription, variant-batch, etc.
- 3.8 Scripts (seed, migrations, import)

### Part 4: Storefront Deep Dive
- 4.1 TanStack Start + React 19
  - File-based routing ($param syntax)
  - Country-prefixed routes ($countryCode/)
  - Route loaders and data fetching
- 4.2 React Query Hooks
  - Query key conventions
  - staleTime configuration per data type
  - Mutation + cache invalidation patterns
- 4.3 Data Layer
  - Medusa JS SDK (lib/utils/sdk.ts)
  - Server-side data fetchers (lib/data/)
  - Client-side hooks (lib/hooks/)
- 4.4 Design System
  - CSS custom properties (theme.css)
  - Color palette, typography
  - Tailwind with CSS variables pattern
- 4.5 Components Architecture
  - UI primitives (components/ui/)
  - Feature components
  - PDP tab system
  - Checkout step components

### Part 5: Caching Strategy
- 5.1 Backend Redis Cache (ICacheService)
  - Registration in medusa-config.ts
  - Cache-aside pattern in API routes
  - TTL conventions by data type
  - Cache key patterns (SHA-256 hashing)
- 5.2 Cache Invalidation
  - Event-driven via subscriber
  - Glob pattern support
  - Pharma constraints (MRP, prescriptions)
- 5.3 Frontend React Query Cache
  - staleTime reference table
  - Route loader parallelization
  - Mutation-driven invalidation

### Part 6: Indian Pharma Compliance
- 6.1 Drug Schedules (X, H, H1, OTC)
- 6.2 Schedule X Blocking (NDPS Act 1985)
- 6.3 Prescription Requirements (H/H1)
- 6.4 MRP Compliance (never above printed MRP)
- 6.5 H1 Register (controlled drug dispensing log)
- 6.6 No Promotions on Rx Drugs
- 6.7 PHI Encryption
- 6.8 Pharmacist Sign-off for Rx Orders
- 6.9 GST & Tax Compliance (GSTR-1, HSN codes)

### Part 7: Integrations
- 7.1 Payments: Razorpay + Paytm
- 7.2 Email: Resend (11 templates)
- 7.3 SMS/OTP: BulkSMSPlans + MSG91 (DLT compliance)
- 7.4 Push: Firebase Cloud Messaging
- 7.5 Shipping: AfterShip
- 7.6 Storage: Supabase S3 (R2 compatible)
- 7.7 Analytics: GA4 + GTM + Meta Pixel
- 7.8 Error Tracking: Sentry

### Part 8: Database & Data Model
- 8.1 Entity Relationship Overview
- 8.2 Custom Module Tables
- 8.3 Cross-Module Links
- 8.4 Migration Strategy
- 8.5 Seeding (demo data, product import)

### Part 9: Testing
- 9.1 Backend: Jest (unit + integration)
  - Test file conventions (*.unit.spec.ts)
  - Mocking MedusaService
  - E2E tests (require running backend)
  - Windows test command workaround
- 9.2 Storefront: Vitest
  - Component testing
  - Hook testing
- 9.3 Test Counts & Coverage

### Part 10: Deployment & Infrastructure
- 10.1 Railway Setup (3 services: backend, storefront, Redis)
- 10.2 Docker Builds (Dockerfile.backend, Dockerfile.storefront)
- 10.3 Environment Variables Reference (full list with descriptions)
- 10.4 Branch Strategy (main = production, development = staging)
- 10.5 CI/CD Pipeline
- 10.6 Health Checks
- 10.7 SKIP_MIGRATIONS flag
- 10.8 Custom Domains & DNS

### Part 11: Common Gotchas & Troubleshooting
- 11.1 All gotchas from CLAUDE.md (with expanded explanations)
- 11.2 Stale .medusa/ cache
- 11.3 Redis connection issues in dev
- 11.4 pnpm lockfile workspace importers
- 11.5 Module naming (camelCase only)
- 11.6 Dynamic import extensions (.js)

### Part 12: API Reference
- 12.1 Store API (44 endpoints, full request/response examples)
- 12.2 Admin API (90+ endpoints, grouped by domain)
- 12.3 Webhook Endpoints (Razorpay, AfterShip, Paytm)
- 12.4 Authentication (OTP, session, JWT)

---

## Implementation Order

1. **Dev Manual first** (more structured, code-derived, less ambiguity)
2. **Staff Manual second** (benefits from dev manual as reference, needs more UX description)

## Estimated Size
- Staff Manual: ~8,000-12,000 words (~30-40 pages)
- Dev Manual: ~15,000-25,000 words (~50-80 pages)
