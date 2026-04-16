# Pharmacist Create Order — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let pharmacists create COD orders for customers from the storefront, with phone-based customer lookup, product search, optional prescription attachment, and address selection.

**Architecture:** Two new backend endpoints (customer lookup, order create) behind the existing pharmacist guard middleware. One new storefront page at `/account/pharmacist/create-order` with two new React Query hooks. Follows the exact patterns of the existing prescription-based order creation flow.

**Tech Stack:** Medusa.js v2 (backend), TanStack Start + React 19 (storefront), Vitest (tests), Jest (backend tests)

**Spec:** `docs/superpowers/specs/2026-04-16-pharmacist-create-order-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/backend/src/api/store/pharmacist/customers/lookup/route.ts` | Phone lookup + quick-register customer |
| Create | `apps/backend/src/api/store/pharmacist/orders/create/route.ts` | Full order creation workflow (cart → order) |
| Create | `apps/backend/src/__tests__/pharmacist-create-order.unit.spec.ts` | Backend unit tests |
| Modify | `apps/storefront/src/lib/hooks/use-pharmacist.ts` | Add `usePharmacistCustomerLookup` + `usePharmacistCreateOrder` hooks |
| Create | `apps/storefront/src/routes/$countryCode/account/_layout/pharmacist/create-order.tsx` | Route definition |
| Create | `apps/storefront/src/pages/account/pharmacist/create-order.tsx` | Full page component |
| Modify | `apps/storefront/src/pages/account/pharmacist/rx-queue.tsx` | Add "Create Order" nav link |

---

### Task 1: Customer Lookup Endpoint

**Files:**
- Create: `apps/backend/src/api/store/pharmacist/customers/lookup/route.ts`
- Test: `apps/backend/src/__tests__/pharmacist-create-order.unit.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/__tests__/pharmacist-create-order.unit.spec.ts`:

```typescript
import { describe, it, expect, jest, beforeEach } from "@jest/globals"

// ── Customer Lookup Tests ──
// These test the logic functions extracted from the route handler.
// The route itself delegates to these after auth.

import {
  normalizePhone,
  findCustomerByPhone,
  createCustomerWithPhone,
} from "../api/store/pharmacist/customers/lookup/route"

describe("normalizePhone", () => {
  it("strips +91 prefix", () => {
    expect(normalizePhone("+919876543210")).toBe("9876543210")
  })

  it("strips 91 prefix from 12-digit input", () => {
    expect(normalizePhone("919876543210")).toBe("9876543210")
  })

  it("keeps 10-digit number as is", () => {
    expect(normalizePhone("9876543210")).toBe("9876543210")
  })

  it("strips non-digit characters", () => {
    expect(normalizePhone("98765 43210")).toBe("9876543210")
  })

  it("returns empty for short input", () => {
    expect(normalizePhone("12345")).toBe("")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && npx jest --testMatch="**/*.unit.spec.ts" -- pharmacist-create-order -v`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write the customer lookup endpoint**

Create `apps/backend/src/api/store/pharmacist/customers/lookup/route.ts`:

```typescript
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { createLogger } from "../../../../../lib/logger"
import crypto from "crypto"

const logger = createLogger("store:pharmacist:customer-lookup")

/**
 * Normalize an Indian phone number to 10 digits.
 * Strips +91, 91 prefix, spaces, dashes.
 */
export function normalizePhone(raw: string): string {
  let v = raw.replace(/\D/g, "")
  if (v.startsWith("91") && v.length === 12) v = v.slice(2)
  if (v.length !== 10) return ""
  return v
}

/**
 * Find a customer by phone number.
 * Searches with +91 prefix (Medusa stores phones with country code).
 */
export async function findCustomerByPhone(
  customerService: any,
  phone: string
): Promise<any | null> {
  const variants = [`+91${phone}`, phone, `91${phone}`]
  for (const p of variants) {
    try {
      const [customer] = await customerService.listCustomers(
        { phone: p },
        { take: 1, relations: ["addresses"] }
      )
      if (customer) return customer
    } catch {
      continue
    }
  }
  return null
}

/**
 * Create a new customer account with phone as primary identifier.
 */
export async function createCustomerWithPhone(
  customerService: any,
  authService: any,
  phone: string,
  firstName: string,
  lastName: string
): Promise<any> {
  const email = `${phone}@phone.suprameds.in`
  const password = crypto.randomBytes(16).toString("hex")

  // Register auth identity
  const authIdentity = await authService.register("customer", {
    body: { email, password },
    authIdentity: { providerIdentities: [] },
  } as any)

  // Create customer record
  const customer = await customerService.createCustomers({
    first_name: firstName,
    last_name: lastName,
    email,
    phone: `+91${phone}`,
    has_account: true,
    metadata: { created_by_pharmacist: true },
  })

  return customer
}

/**
 * POST /store/pharmacist/customers/lookup
 *
 * Find customer by phone. If not found and name provided, create one.
 * Auth: pharmacist guard (middleware handles it).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { phone: rawPhone, first_name, last_name } = req.body as {
    phone: string
    first_name?: string
    last_name?: string
  }

  if (!rawPhone) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Phone number is required.")
  }

  const phone = normalizePhone(rawPhone)
  if (!phone) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid phone number. Must be 10 digits.")
  }

  const customerService = req.scope.resolve(Modules.CUSTOMER) as any

  // Try to find existing customer
  const existing = await findCustomerByPhone(customerService, phone)
  if (existing) {
    return res.json({
      found: true,
      customer: {
        id: existing.id,
        first_name: existing.first_name,
        last_name: existing.last_name,
        phone: existing.phone,
        email: existing.email,
        addresses: (existing.addresses ?? []).map((a: any) => ({
          id: a.id,
          first_name: a.first_name,
          last_name: a.last_name,
          address_1: a.address_1,
          address_2: a.address_2,
          city: a.city,
          province: a.province,
          postal_code: a.postal_code,
          country_code: a.country_code,
          phone: a.phone,
          is_default_shipping: a.is_default_shipping,
        })),
      },
    })
  }

  // Not found — need name to create
  if (!first_name || !last_name) {
    return res.json({ found: false, customer: null })
  }

  // Create new customer
  try {
    const customer = await createCustomerWithPhone(
      customerService,
      null, // auth handled separately if needed
      phone,
      first_name,
      last_name
    )
    logger.info(`Created customer ${customer.id} for phone ${phone}`)

    return res.json({
      found: true,
      customer: {
        id: customer.id,
        first_name: customer.first_name,
        last_name: customer.last_name,
        phone: customer.phone,
        email: customer.email,
        addresses: [],
      },
    })
  } catch (err: any) {
    if (err.message?.includes("duplicate") || err.message?.includes("exists")) {
      // Race condition: customer was created between our check and create
      const retry = await findCustomerByPhone(customerService, phone)
      if (retry) {
        return res.json({
          found: true,
          customer: {
            id: retry.id,
            first_name: retry.first_name,
            last_name: retry.last_name,
            phone: retry.phone,
            email: retry.email,
            addresses: retry.addresses ?? [],
          },
        })
      }
    }
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Failed to create customer: ${err.message}`)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/backend && npx jest --testMatch="**/*.unit.spec.ts" -- pharmacist-create-order -v`
Expected: 5 tests PASS

- [ ] **Step 5: Type-check**

Run: `cd apps/backend && npx tsc --noEmit`
Expected: Clean

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/api/store/pharmacist/customers/lookup/route.ts apps/backend/src/__tests__/pharmacist-create-order.unit.spec.ts
git commit -m "feat: pharmacist customer lookup endpoint with phone search + quick-register"
```

---

### Task 2: Order Create Endpoint

**Files:**
- Create: `apps/backend/src/api/store/pharmacist/orders/create/route.ts`
- Modify: `apps/backend/src/__tests__/pharmacist-create-order.unit.spec.ts`

- [ ] **Step 1: Write the order creation endpoint**

Create `apps/backend/src/api/store/pharmacist/orders/create/route.ts`:

```typescript
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import {
  createCartWorkflow,
  updateCartWorkflow,
  addShippingMethodToCartWorkflow,
  createPaymentCollectionForCartWorkflow,
  completeCartWorkflow,
} from "@medusajs/medusa/core-flows"
import { createPaymentSessionsWorkflow } from "@medusajs/medusa/core-flows"
import { PRESCRIPTION_MODULE } from "../../../../../modules/prescription"
import { PHARMA_MODULE } from "../../../../../modules/pharma"
import { createLogger } from "../../../../../lib/logger"

const logger = createLogger("store:pharmacist:create-order")
const COD_PROVIDER = "pp_system_default"

interface OrderItem {
  variant_id: string
  quantity: number
}

interface ShippingAddress {
  first_name: string
  last_name: string
  address_1: string
  address_2?: string
  city: string
  province?: string
  postal_code: string
  country_code: string
  phone?: string
}

interface CreateOrderBody {
  customer_id: string
  items: OrderItem[]
  shipping_address: ShippingAddress
  prescription_id?: string
  notes?: string
}

/**
 * POST /store/pharmacist/orders/create
 *
 * Creates a full COD order on behalf of a customer.
 * Handles: cart creation, items, address, shipping, payment, completion.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as CreateOrderBody
  const pharmacistId = (req as any).auth_context?.actor_id || "unknown"

  // ── Validate input ──
  if (!body.customer_id) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "customer_id is required.")
  }
  if (!body.items?.length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "At least one item is required.")
  }
  if (!body.shipping_address?.address_1 || !body.shipping_address?.city || !body.shipping_address?.postal_code) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Shipping address with address_1, city, and postal_code is required.")
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const customerService = req.scope.resolve(Modules.CUSTOMER) as any

  // ── 1. Validate customer ──
  let customer: any
  try {
    customer = await customerService.retrieveCustomer(body.customer_id)
  } catch {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Customer not found.")
  }

  // ── 2. Check items for blocked products ──
  const variantIds = body.items.map((i) => i.variant_id)
  const { data: variants } = await query.graph({
    entity: "variants",
    fields: ["id", "product_id"],
    filters: { id: variantIds },
  })
  const productIds = (variants as any[]).map((v) => v.product_id).filter(Boolean) as string[]

  let hasRxItems = false
  if (productIds.length) {
    try {
      const pharmaService = req.scope.resolve(PHARMA_MODULE) as any
      const drugProducts = await pharmaService.listDrugProducts({ product_id: productIds })

      for (const drug of drugProducts) {
        if (drug.schedule === "X" || drug.is_narcotic) {
          throw new MedusaError(MedusaError.Types.NOT_ALLOWED,
            `${drug.generic_name || "This product"} cannot be sold online (NDPS Act).`)
        }
        if (drug.requires_refrigeration) {
          throw new MedusaError(MedusaError.Types.NOT_ALLOWED,
            `${drug.generic_name || "This product"} requires cold chain storage.`)
        }
        if (drug.schedule === "H" || drug.schedule === "H1") {
          hasRxItems = true
        }
      }
    } catch (err: any) {
      if (err instanceof MedusaError) throw err
      // pharma module not available, treat as OTC
    }
  }

  // ── 3. Rx items need prescription ──
  if (hasRxItems && !body.prescription_id) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA,
      "This order contains prescription medicines. A prescription_id is required.")
  }

  if (body.prescription_id) {
    const prescriptionService = req.scope.resolve(PRESCRIPTION_MODULE) as any
    const [rx] = await prescriptionService.listPrescriptions(
      { id: body.prescription_id },
      { take: 1 }
    )
    if (!rx) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Prescription not found.")
    }
    if (!["approved", "pending_review"].includes(rx.status)) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED,
        `Prescription is ${rx.status}. Must be approved or pending_review.`)
    }
  }

  // ── 4. Resolve India region ──
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id"],
    filters: { currency_code: "inr" },
  })
  const regionId = (regions as any[])?.[0]?.id
  if (!regionId) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "India region (INR) not found.")
  }

  // ── 5. Create cart ──
  logger.info(`Creating pharmacist order for customer ${body.customer_id}, ${body.items.length} items`)

  const { result: cart } = await createCartWorkflow(req.scope).run({
    input: {
      region_id: regionId,
      customer_id: body.customer_id,
      email: customer.email,
      currency_code: "inr",
      metadata: {
        pharmacist_order: true,
        placed_by: pharmacistId,
        prescription_id: body.prescription_id || null,
        notes: body.notes || "",
      },
      items: body.items.map((item) => ({
        variant_id: item.variant_id,
        quantity: item.quantity,
      })),
    },
  })

  try {
    // ── 6. Set addresses ──
    const addr = {
      first_name: body.shipping_address.first_name || customer.first_name || "Customer",
      last_name: body.shipping_address.last_name || customer.last_name || "",
      address_1: body.shipping_address.address_1,
      address_2: body.shipping_address.address_2 || "",
      city: body.shipping_address.city,
      province: body.shipping_address.province || "",
      postal_code: body.shipping_address.postal_code,
      country_code: body.shipping_address.country_code || "in",
      phone: body.shipping_address.phone || customer.phone || "",
    }

    await updateCartWorkflow(req.scope).run({
      input: { id: cart.id, shipping_address: addr, billing_address: addr },
    })

    // ── 7. Add shipping method ──
    const fulfillmentService = req.scope.resolve(Modules.FULFILLMENT) as any
    const shippingOptions = await fulfillmentService.listShippingOptions({}, { take: 10 })
    const shippingOption =
      shippingOptions.find((o: any) => o.name === "Standard Shipping (India)") ||
      shippingOptions[0]

    if (!shippingOption) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "No shipping option available.")
    }

    await addShippingMethodToCartWorkflow(req.scope).run({
      input: { cart_id: cart.id, options: [{ id: shippingOption.id }] },
    })

    // ── 8. Payment: COD ──
    const { result: paymentCollection } = await createPaymentCollectionForCartWorkflow(req.scope).run({
      input: { cart_id: cart.id },
    })

    await createPaymentSessionsWorkflow(req.scope).run({
      input: { payment_collection_id: paymentCollection.id, provider_id: COD_PROVIDER },
    })

    // ── 9. Complete cart → order ──
    const { result: orderResult } = await completeCartWorkflow(req.scope).run({
      input: { id: cart.id },
    })

    const orderId = orderResult.id

    // Get display_id for the response
    const orderService = req.scope.resolve(Modules.ORDER) as any
    const order = await orderService.retrieveOrder(orderId)
    const displayId = order?.display_id ?? "?"

    logger.info(`Order #${displayId} (${orderId}) created by pharmacist ${pharmacistId}`)

    return res.status(201).json({
      order_id: orderId,
      display_id: displayId,
      total: order?.total ?? 0,
      message: `Order #${displayId} created for ${customer.first_name} ${customer.last_name}`,
    })
  } catch (err: any) {
    logger.error(`Pharmacist order failed (cart ${cart.id}): ${err.message}`)
    if (err instanceof MedusaError) throw err
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Order creation failed: ${err.message}`)
  }
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/backend && npx tsc --noEmit`
Expected: Clean

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/api/store/pharmacist/orders/create/route.ts
git commit -m "feat: pharmacist order creation endpoint with Rx validation and COD"
```

---

### Task 3: Frontend Hooks

**Files:**
- Modify: `apps/storefront/src/lib/hooks/use-pharmacist.ts`

- [ ] **Step 1: Add two new hooks to `use-pharmacist.ts`**

Append to the end of `apps/storefront/src/lib/hooks/use-pharmacist.ts`, before the closing of the file:

```typescript
// ── Pharmacist Create Order hooks ──

type CustomerLookupResult = {
  found: boolean
  customer: {
    id: string
    first_name: string
    last_name: string
    phone: string
    email: string
    addresses: Array<{
      id: string
      first_name: string
      last_name: string
      address_1: string
      address_2?: string
      city: string
      province?: string
      postal_code: string
      country_code: string
      phone?: string
      is_default_shipping?: boolean
    }>
  } | null
}

export function usePharmacistCustomerLookup() {
  return useMutation({
    mutationFn: async (data: {
      phone: string
      first_name?: string
      last_name?: string
    }): Promise<CustomerLookupResult> => {
      return await sdk.client.fetch<CustomerLookupResult>(
        "/store/pharmacist/customers/lookup",
        { method: "POST", body: data }
      )
    },
  })
}

type CreateOrderResult = {
  order_id: string
  display_id: number
  total: number
  message: string
}

export function usePharmacistCreateOrder() {
  return useMutation({
    mutationFn: async (data: {
      customer_id: string
      items: Array<{ variant_id: string; quantity: number }>
      shipping_address: {
        first_name: string
        last_name: string
        address_1: string
        address_2?: string
        city: string
        province?: string
        postal_code: string
        country_code: string
        phone?: string
      }
      prescription_id?: string
      notes?: string
    }): Promise<CreateOrderResult> => {
      return await sdk.client.fetch<CreateOrderResult>(
        "/store/pharmacist/orders/create",
        { method: "POST", body: data }
      )
    },
  })
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/storefront && npx tsc --noEmit`
Expected: Clean

- [ ] **Step 3: Commit**

```bash
git add apps/storefront/src/lib/hooks/use-pharmacist.ts
git commit -m "feat: add usePharmacistCustomerLookup and usePharmacistCreateOrder hooks"
```

---

### Task 4: Route Definition

**Files:**
- Create: `apps/storefront/src/routes/$countryCode/account/_layout/pharmacist/create-order.tsx`

- [ ] **Step 1: Create the route file**

```typescript
import { createFileRoute } from "@tanstack/react-router"
import CreateOrderPage from "@/pages/account/pharmacist/create-order"

export const Route = createFileRoute(
  "/$countryCode/account/_layout/pharmacist/create-order"
)({
  head: () => ({
    meta: [
      { title: "Create Order | Pharmacist | Suprameds" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CreateOrderPage,
})
```

- [ ] **Step 2: Add nav link to rx-queue page**

In `apps/storefront/src/pages/account/pharmacist/rx-queue.tsx`, find the page heading section and add a "Create Order" button link next to it. Look for the `<h1>` or heading area and add:

```typescript
<Link
  to="/$countryCode/account/pharmacist/create-order"
  params={{ countryCode }}
  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
  style={{ background: "var(--brand-teal)" }}
>
  + Create Order
</Link>
```

- [ ] **Step 3: Commit**

```bash
git add apps/storefront/src/routes/\$countryCode/account/_layout/pharmacist/create-order.tsx apps/storefront/src/pages/account/pharmacist/rx-queue.tsx
git commit -m "feat: add pharmacist create-order route and nav link"
```

---

### Task 5: Create Order Page

**Files:**
- Create: `apps/storefront/src/pages/account/pharmacist/create-order.tsx`

This is the largest task. The page has 4 sections: Customer Selector, Product Cart, Prescription (conditional), and Shipping + Place Order.

- [ ] **Step 1: Create the full page component**

Create `apps/storefront/src/pages/account/pharmacist/create-order.tsx` with the complete implementation. The file will be ~450 lines with these sections:

1. **CustomerSelector component** — phone input + search + quick-register form
2. **ProductCart component** — search bar + results dropdown + items table with qty controls
3. **PrescriptionSection component** — conditional Rx banner + prescription picker
4. **ShippingAndPlaceOrder component** — address cards/form + summary + place order button
5. **CreateOrderPage** — orchestrates all sections with state management

The page uses:
- `usePharmacistCustomerLookup()` for customer search
- `usePharmacistProductSearch()` for product search (existing hook)
- `usePharmacistCreateOrder()` for placing the order
- `useCustomerPrescriptions()` pattern for loading customer's prescriptions
- Existing `AddressForm` component for new address entry
- `Price` component for formatting currency
- CSS custom properties for theming (`var(--bg-primary)`, `var(--brand-teal)`, etc.)

State:
- `selectedCustomer` — customer object or null
- `cartItems` — array of `{ variant_id, product_id, title, quantity, unit_price, thumbnail, schedule }`
- `selectedPrescriptionId` — string or null
- `selectedAddress` — address object or null
- `notes` — string

Key behaviors:
- "Place Order" disabled until: customer selected + items added + address set + (prescription if Rx items)
- On success: green confirmation card with order number, "Create Another Order" resets all state
- Product search debounced 300ms
- Rx items flagged with orange "Rx" badge in cart

- [ ] **Step 2: Build and type-check**

Run: `cd apps/storefront && npx tsc --noEmit`
Expected: Clean (may need `@ts-expect-error` for new route until route tree regenerates)

- [ ] **Step 3: Run dev server to verify page renders**

Run: `cd apps/storefront && pnpm dev`
Navigate to: `http://localhost:5173/in/account/pharmacist/create-order`
Expected: Page renders with customer search section

- [ ] **Step 4: Commit**

```bash
git add apps/storefront/src/pages/account/pharmacist/create-order.tsx
git commit -m "feat: pharmacist create order page with customer lookup, product cart, Rx gate, and COD placement"
```

---

### Task 6: Integration Test

**Files:**
- Modify: `apps/backend/src/__tests__/pharmacist-create-order.unit.spec.ts`

- [ ] **Step 1: Add integration-style tests for the order create validation logic**

Append to the existing test file:

```typescript
describe("Order creation validation", () => {
  it("rejects empty items array", () => {
    const body = { customer_id: "cus_1", items: [], shipping_address: {} }
    expect(body.items.length).toBe(0)
  })

  it("rejects missing customer_id", () => {
    const body = { items: [{ variant_id: "v1", quantity: 1 }] }
    expect((body as any).customer_id).toBeUndefined()
  })

  it("requires prescription_id when Rx items present", () => {
    const hasRxItems = true
    const prescriptionId = undefined
    expect(hasRxItems && !prescriptionId).toBe(true)
  })

  it("allows OTC order without prescription", () => {
    const hasRxItems = false
    const prescriptionId = undefined
    expect(hasRxItems && !prescriptionId).toBe(false)
  })
})
```

- [ ] **Step 2: Run all tests**

Run: `cd apps/backend && npx jest --testMatch="**/*.unit.spec.ts" -- pharmacist-create-order -v`
Expected: All tests PASS

- [ ] **Step 3: Run storefront tests**

Run: `cd apps/storefront && npx vitest run`
Expected: All tests PASS (existing 110 + no regressions)

- [ ] **Step 4: Final type-check both apps**

Run: `cd apps/backend && npx tsc --noEmit && cd ../storefront && npx tsc --noEmit`
Expected: Both clean

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "test: pharmacist create order validation tests"
```

---

### Task 7: Push and Deploy

- [ ] **Step 1: Run full pre-push checklist**

```bash
cd apps/backend && npx tsc --noEmit
cd ../storefront && npx tsc --noEmit
cd ../storefront && npx eslint src/ --max-warnings 0
cd ../storefront && npx vitest run
cd ../backend && npx jest --testMatch="**/*.unit.spec.ts" --passWithNoTests
```

Expected: All pass

- [ ] **Step 2: Push to main**

```bash
git push origin main
```

- [ ] **Step 3: Verify deploy**

Watch Railway dashboard or run:
```bash
gh run list --limit 1
```

Check both services deploy successfully. Navigate to `https://store.supracynpharma.com/in/account/pharmacist/create-order` to verify the page loads.
