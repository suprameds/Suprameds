# Testing Guide

## Overview

| Framework | Scope | Location | Command |
|-----------|-------|----------|---------|
| **Jest** | Backend unit + integration | `apps/backend/src/**/__tests__/` | `pnpm test:unit` |
| **Vitest** | Storefront components | `apps/storefront/src/__tests__/` | `pnpm test` |
| **Playwright** | End-to-end | `e2e/` | `pnpm e2e` |

## Backend Testing (Jest)

### Configuration

File: `apps/backend/jest.config.js`

Test type is controlled by `TEST_TYPE` environment variable:

```bash
# Unit tests (fast, no DB needed)
cd apps/backend
pnpm test:unit

# Integration tests — HTTP endpoints
pnpm test:integration:http

# Integration tests — module services
pnpm test:integration:modules
```

### Test File Patterns

- Unit: `src/**/__tests__/**/*.unit.spec.ts`
- Integration (modules): `src/modules/*/__tests__/**/*.ts`
- Integration (HTTP): `integration-tests/http/*.spec.ts`

### Current Test Suites (11 suites, 145 tests)

| Suite | Tests | Covers |
|-------|-------|--------|
| `rate-limiter.unit.spec.ts` | Token bucket rate limiting |
| `rbac-authorize.unit.spec.ts` | Role-based access control |
| `sync-aftership-status.unit.spec.ts` | AfterShip webhook sync |
| `compliance-rules.unit.spec.ts` | Schedule validation rules |
| `signature-verification.unit.spec.ts` | Webhook HMAC verification |
| `raise-refund.unit.spec.ts` | Refund creation workflow |
| `approve-refund.unit.spec.ts` | Refund approval + SSD-04 |
| `stats.unit.spec.ts` | Pharmacist stats aggregation |
| `returns.unit.spec.ts` | Warehouse returns inspection |
| `service.unit.spec.ts` | Wishlist service methods |
| `health.spec.ts` | Backend health endpoint |

### Writing Backend Tests

```ts
// Example: src/workflows/payment/__tests__/raise-refund.unit.spec.ts
import { RaiseRefundWorkflow } from "../raise-refund"

describe("RaiseRefundWorkflow", () => {
  const mockService = {
    createPharmaRefunds: jest.fn(),
  }

  it("creates refund with pending_approval status", async () => {
    // Test implementation
  })

  it("throws if order_id is missing", async () => {
    // Validation test
  })
})
```

## Storefront Testing (Vitest)

### Configuration

File: `apps/storefront/vitest.config.ts`

```bash
cd apps/storefront

pnpm test              # Run once
pnpm test:watch        # Watch mode
pnpm test:coverage     # With coverage report
```

### Current Test Suites (10 suites, 88 tests)

| Suite | Tests | Covers |
|-------|-------|--------|
| `accessibility.test.tsx` | WCAG, keyboard nav, screen readers |
| `branding.test.tsx` | Typography, spacing, brand consistency |
| `cart.test.tsx` | Add/remove, quantity, totals |
| `checkout-address-step.test.tsx` | Address form validation |
| `checkout-delivery-step.test.tsx` | Shipping method selection |
| `checkout-payment-step.test.tsx` | Payment gateway init |
| `consent-banner.test.tsx` | Cookie consent, GDPR |
| `payment-button.test.tsx` | Payment submission |
| `button.test.tsx` | UI button component |
| `checkout.test.ts` | Checkout utility functions |

### Writing Storefront Tests

```tsx
// Example: src/__tests__/components/wishlist-button.test.tsx
import { render, screen, fireEvent } from "@testing-library/react"
import { WishlistButton } from "@/components/wishlist-button"

describe("WishlistButton", () => {
  it("renders heart icon", () => {
    render(<WishlistButton productId="prod_123" />)
    expect(screen.getByRole("button")).toBeInTheDocument()
  })
})
```

## E2E Testing (Playwright)

### Configuration

File: `playwright.config.ts`

```bash
# Run all E2E tests
pnpm e2e

# Interactive UI mode
pnpm e2e:ui

# View last report
pnpm e2e:report
```

**Requirements:** Backend and storefront must be running. In CI, servers auto-start via `webServer` config.

### Test Specs (9 files, 122 tests)

| Spec | Tests | Coverage |
|------|-------|----------|
| `health.spec.ts` | Backend API health checks |
| `browse-and-search.spec.ts` | Homepage, products, search, categories |
| `cart-checkout.spec.ts` | Cart CRUD, full checkout flow |
| `rx-flow.spec.ts` | Rx upload, checkout blocking, drug interactions |
| `account.spec.ts` | Register, login, profile, addresses, wishlist |
| `wishlist.spec.ts` | Add/remove, price alerts |
| `admin-operations.spec.ts` | Admin UI routes, API endpoints |
| `admin-api.spec.ts` | Admin API validation |
| `storefront-browse.spec.ts` | Storefront navigation |

### Fixtures

```
e2e/
├── fixtures/
│   ├── auth.ts         # loginAsCustomer(), loginAsAdmin()
│   └── test-data.ts    # Test credentials, addresses, product handles
└── pages/
    └── checkout.page.ts  # Page Object Model for checkout flow
```

### Writing E2E Tests

```ts
// Example: e2e/wishlist.spec.ts
import { test, expect } from "@playwright/test"
import { loginAsCustomer } from "./fixtures/auth"

test.describe("Wishlist", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCustomer(page)
  })

  test("can add product to wishlist", async ({ page }) => {
    await page.goto("/in/store")
    await page.click('[aria-label="Add to wishlist"]')
    await expect(page.locator('[aria-label="Remove from wishlist"]')).toBeVisible()
  })
})
```

## CI Pipeline

GitHub Actions runs all test suites on push/PR:

| Job | What it runs | Blocking? |
|-----|-------------|-----------|
| `typecheck-backend` | `tsc --noEmit` | Yes |
| `typecheck-storefront` | `tsc --noEmit` | Yes |
| `build-backend` | `pnpm build` | Yes |
| `build-storefront` | `pnpm build` | Yes |
| `lint-storefront` | `eslint --max-warnings 0` | Yes |
| `test-storefront` | `vitest run` | Yes |
| `test-backend-unit` | `jest --ci` | Yes |
| `test-e2e` | Playwright (push only) | Yes |
| `audit` | `pnpm audit --audit-level=high` | Yes |
| `docker-build` | Dockerfile validation | Yes |
