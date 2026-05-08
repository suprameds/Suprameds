# Login-Required Add-to-Cart + OTP-First Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate add-to-cart behind authentication, unify login/signup into a single mobile-OTP-first flow, and expand the profile page so OTP-only signups can complete their details (email, DOB, gender, allergies, ABHA ID, etc.) post-signup.

**Architecture:**
- **Auth model:** Mobile+OTP becomes the primary identity. Phone is the unique key; email becomes optional and editable. Existing email/password remains as a sub-link for legacy users — not a primary tab.
- **Cart gate:** Add-to-cart hook (`useAddToCart`) checks for an authenticated customer before mutating. Unauthenticated users get a "Sign in to continue" prompt with `redirectTo=<current_url>&pendingAction=add_to_cart:<variant_id>` so the action resumes after login. Public browsing of `/`, `/products/*`, `/categories/*`, `/drugs/*` is unaffected — SEO + Ads landing pages stay reachable.
- **New profile fields:** Stored in `customer.metadata` initially (no schema migration). A typed wrapper (`PharmaCustomerMetadata`) keeps the surface clean. Migration to first-class columns deferred until compliance reporting demands it.
- **JIT email upgrade:** OTP-only signups currently get an auto-generated email (`{phone}@phone.suprameds.in`). Profile page exposes a "Set your real email" affordance so they can replace it; address step at checkout already captures name per-address so order creation isn't blocked.
- **Register page:** Redirected to `/account/login` (301) — single entry point. Preserves existing SEO/ad equity for `/account/register`.

**Tech Stack:** TanStack Start (React 19, Vite), TanStack Query, Medusa.js v2, MikroORM, Vitest + Jest. Existing OTP infra: BulkSMS (primary), MSG91 (fallback), Resend (email).

**Out of scope (deliberately deferred):**
- ABHA / ABDM integration (link only, no live sync)
- Aadhaar/PAN KYC
- Web push notification permission prompt on signup
- Removing email/password backend route (kept for legacy users)
- Native app deep-link gating

---

## File Structure

### Frontend (apps/storefront/)

**Modify:**
- `src/routes/account/login.tsx` — Phone-OTP primary, email-OTP secondary, password-link tertiary. Drop the 3-tab toggle for a clearer hierarchy.
- `src/routes/account/register.tsx` — Replace body with redirect to `/account/login` (preserve `redirectTo`/`ref` query params).
- `src/lib/hooks/use-cart.ts` — Add auth gate at the top of `useAddToCart` mutationFn. Throw a typed error the UI can catch.
- `src/lib/hooks/use-customer.ts` — Extend `useUpdateCustomer` to accept `email`, `metadata` patch (DOB, gender, allergies, etc.).
- `src/routes/account/_layout/profile.tsx` — Add editable email field (with verification indicator), DOB, gender, allergies, chronic conditions, ABHA ID, language, GST, emergency contact. Show "Complete your profile" progress bar.

**Create:**
- `src/lib/hooks/use-auth-guard.ts` — Reusable `useAuthGuard()` hook returning `{ requireAuth(action: string) => boolean | redirect }`. Centralizes redirect-with-pending-action logic.
- `src/components/cart/add-to-cart-button.tsx` — Wrap raw "Add to Cart" buttons; checks auth via `useAuthGuard()` before delegating to mutation. (Or modify existing button components — see Task 3 for which.)
- `src/lib/types/pharma-customer.ts` — Typed wrapper for `customer.metadata` pharma fields:
  ```ts
  export interface PharmaCustomerMetadata {
    dob?: string                // ISO date "YYYY-MM-DD"
    gender?: "male" | "female" | "other" | "prefer_not_to_say"
    allergies?: string[]
    chronic_conditions?: string[]
    abha_id?: string
    emergency_contact?: { name: string; phone: string }
    preferred_language?: "en" | "hi" | "ml" | "te" | "ta"
    gst_number?: string
    consent_marketing?: { accepted: boolean; at: string }  // ISO datetime
    consent_terms?: { accepted: boolean; at: string }
    kyc_status?: "none" | "basic" | "full"
    referred_by?: string        // Already in use today
  }
  ```
- `src/components/profile/profile-completion-banner.tsx` — Top-of-account banner that shows missing fields percentage with a "Complete now" CTA. Hidden when ≥ 80% complete.
- `src/components/profile/pharma-fields-form.tsx` — DOB, gender, allergies (chips), chronic conditions (chips), ABHA ID, language, GST. Composed into profile.tsx.
- `src/components/profile/emergency-contact-form.tsx` — Name + phone pair.
- `src/lib/utils/profile-completeness.ts` — `computeProfileCompleteness(customer): { percent: number; missing: string[] }`.

**Tests:**
- `src/lib/hooks/use-cart.test.ts` — Add 2 tests for auth gate (anonymous → throws AuthRequiredError; authenticated → succeeds).
- `src/lib/utils/profile-completeness.test.ts` — Pure unit tests for the completeness calculator (5–6 cases).
- `src/lib/hooks/use-auth-guard.test.ts` — Test redirect URL construction with pending action encoding.

### Backend (apps/backend/)

**Modify:**
- `src/api/store/customers/me/route.ts` (or whatever the customer-update route is — verify exact path during Task 6) — Ensure POST accepts `email`, `metadata` patch. Validate metadata fields against the same shape as `PharmaCustomerMetadata`. Reject `kyc_status` writes from the client (server-set only).

**Create:**
- `src/api/store/customers/me/email/route.ts` (POST) — Dedicated endpoint to upgrade email. Validates uniqueness, optionally sends verification OTP to new email before persisting. Reuses existing OTP send/verify utilities.
- `src/__tests__/integration/http/customer-metadata.spec.ts` — Integration test: write metadata, read back, verify reject on `kyc_status`.

---

## Task 1: Auth-guard utility hook (frontend, foundation)

**Files:**
- Create: `apps/storefront/src/lib/hooks/use-auth-guard.ts`
- Create: `apps/storefront/src/lib/hooks/use-auth-guard.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/storefront/src/lib/hooks/use-auth-guard.test.ts
import { describe, it, expect, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { useAuthGuard } from "./use-auth-guard"

const mockNavigate = vi.fn()
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/products/atorcyn-10", search: "" }),
}))

vi.mock("./use-customer", () => ({
  useCustomer: () => ({ data: null, isLoading: false }),
}))

describe("useAuthGuard", () => {
  it("redirects anonymous users to login with redirectTo + pendingAction", () => {
    const { result } = renderHook(() => useAuthGuard())
    const allowed = result.current.requireAuth("add_to_cart:variant_123")
    expect(allowed).toBe(false)
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/account/login",
      search: { redirectTo: "/products/atorcyn-10", pendingAction: "add_to_cart:variant_123" },
    })
  })
})
```

- [ ] **Step 2: Run the test, expect FAIL**

```bash
cd apps/storefront && npx vitest run src/lib/hooks/use-auth-guard.test.ts
```

Expected: `Cannot find module './use-auth-guard'`.

- [ ] **Step 3: Implement the hook**

```ts
// apps/storefront/src/lib/hooks/use-auth-guard.ts
import { useNavigate, useLocation } from "@tanstack/react-router"
import { useCustomer } from "./use-customer"
import { useCallback } from "react"

export function useAuthGuard() {
  const { data: customer, isLoading } = useCustomer()
  const navigate = useNavigate()
  const location = useLocation()

  const requireAuth = useCallback(
    (pendingAction?: string): boolean => {
      if (isLoading) return false  // wait for hydration; caller should re-check
      if (customer) return true
      const redirectTo = location.pathname + (location.search ?? "")
      navigate({
        to: "/account/login",
        // @ts-expect-error - search shape extended for pending actions
        search: { redirectTo, ...(pendingAction ? { pendingAction } : {}) },
      })
      return false
    },
    [customer, isLoading, location, navigate]
  )

  return { customer, isLoading, isAuthenticated: !!customer, requireAuth }
}
```

- [ ] **Step 4: Run the test, expect PASS**

```bash
cd apps/storefront && npx vitest run src/lib/hooks/use-auth-guard.test.ts
```

Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/storefront/src/lib/hooks/use-auth-guard.ts apps/storefront/src/lib/hooks/use-auth-guard.test.ts
git commit -m "feat(auth): add useAuthGuard hook for action-level auth gating"
```

---

## Task 2: Extend login route to consume `pendingAction`

**Files:**
- Modify: `apps/storefront/src/routes/account/login.tsx:15-19` (validateSearch) and `:68-77` (navigateAfterLogin)

- [ ] **Step 1: Extend `validateSearch` to accept pendingAction**

Replace lines 15–19:

```ts
validateSearch: (search: Record<string, unknown>) => ({
  redirectTo: typeof search.redirectTo === "string" ? search.redirectTo : undefined,
  pendingAction: typeof search.pendingAction === "string" ? search.pendingAction : undefined,
}),
```

- [ ] **Step 2: Read pendingAction in component and pass through to navigateAfterLogin**

Replace lines 25 and 68–77:

```ts
const { redirectTo, pendingAction } = Route.useSearch()
// ...
const navigateAfterLogin = useCallback((isNewUser?: boolean) => {
  // pendingAction encodes "<verb>:<id>" — UI on the redirect target reads it from search params
  const search = pendingAction ? { pendingAction } : undefined
  if (redirectTo && redirectTo.startsWith("/")) {
    // @ts-expect-error - search shape varies per route
    navigate({ to: redirectTo as never, search })
  } else if (isNewUser) {
    navigate({ to: "/account" })
  } else {
    navigate({ to: "/" })
  }
}, [redirectTo, pendingAction, navigate])
```

- [ ] **Step 3: Type-check**

```bash
cd apps/storefront && npx tsc --noEmit
```

Expected: 0 errors related to login.tsx.

- [ ] **Step 4: Commit**

```bash
git add apps/storefront/src/routes/account/login.tsx
git commit -m "feat(auth): pass pendingAction through login redirect"
```

---

## Task 3: Gate add-to-cart in `useAddToCart` + resume on PDP

**Files:**
- Modify: `apps/storefront/src/lib/hooks/use-cart.ts:94-243` (useAddToCart)
- Modify: PDP add-to-cart button — locate via grep in step 1 below
- Create: `apps/storefront/src/lib/hooks/use-cart.test.ts` (or add to existing file if present)

- [ ] **Step 1: Find the PDP add-to-cart button(s)**

```bash
cd apps/storefront && rg -l "useAddToCart" src/
```

Expected: list of files. Open the PDP product detail component (likely `src/components/products/product-actions.tsx` or `src/routes/products/$handle.tsx`) and the cart drawer. Note exact paths for Step 4.

- [ ] **Step 2: Write the failing test for useAddToCart auth gate**

```ts
// apps/storefront/src/lib/hooks/use-cart.test.ts (add to existing file)
import { describe, it, expect, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useAddToCart, AuthRequiredError } from "./use-cart"

vi.mock("./use-customer", () => ({
  useCustomer: () => ({ data: null, isLoading: false }),
}))

const wrapper = ({ children }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe("useAddToCart auth gate", () => {
  it("rejects anonymous add with AuthRequiredError", async () => {
    const { result } = renderHook(() => useAddToCart(), { wrapper })
    await act(async () => {
      await expect(
        result.current.mutateAsync({ variant_id: "v1", quantity: 1, country_code: "in" })
      ).rejects.toBeInstanceOf(AuthRequiredError)
    })
  })
})
```

- [ ] **Step 3: Run test — expect FAIL (AuthRequiredError not exported)**

```bash
cd apps/storefront && npx vitest run src/lib/hooks/use-cart.test.ts
```

- [ ] **Step 4: Implement gate in `useAddToCart`**

In `src/lib/hooks/use-cart.ts`, add at the top of the file:

```ts
export class AuthRequiredError extends Error {
  pendingAction: string
  constructor(pendingAction: string) {
    super("Authentication required")
    this.name = "AuthRequiredError"
    this.pendingAction = pendingAction
  }
}
```

Then, inside `useAddToCart`, before the existing region lookup (around line 108), add:

```ts
const { data: customer } = useCustomer()
// ...inside mutationFn, FIRST line:
if (!customer) {
  throw new AuthRequiredError(`add_to_cart:${variables.variant_id}`)
}
```

Import `useCustomer` at the top of the file if not already.

- [ ] **Step 5: Run test — expect PASS**

```bash
cd apps/storefront && npx vitest run src/lib/hooks/use-cart.test.ts
```

- [ ] **Step 6: Wire UI to redirect on AuthRequiredError**

In each PDP add-to-cart button handler identified in Step 1, change the `onError` to:

```ts
onError: (err) => {
  if (err instanceof AuthRequiredError) {
    const redirectTo = window.location.pathname + window.location.search
    navigate({
      to: "/account/login",
      // @ts-expect-error - search shape varies per route
      search: { redirectTo, pendingAction: err.pendingAction },
    })
    return
  }
  toast.error("Could not add to cart. Please try again.")
}
```

(Use the existing toast utility — find it via `rg "toast\\." src/components/products/`.)

- [ ] **Step 7: Resume add-to-cart after login on PDP**

In the PDP component (e.g. `src/routes/products/$handle.tsx`), add a `useEffect` that fires once after auth:

```ts
const search = useSearch({ strict: false }) as { pendingAction?: string }
const { data: customer } = useCustomer()
const addToCart = useAddToCart()
const resumedRef = useRef(false)

useEffect(() => {
  if (resumedRef.current) return
  if (!customer) return
  if (!search.pendingAction) return
  const [verb, variantId] = search.pendingAction.split(":")
  if (verb !== "add_to_cart" || !variantId) return
  resumedRef.current = true
  addToCart.mutate({ variant_id: variantId, quantity: 1, country_code: "in" })
  // Strip pendingAction from URL so a refresh doesn't re-fire
  navigate({ to: ".", search: (s) => ({ ...s, pendingAction: undefined }), replace: true })
}, [customer, search.pendingAction])
```

- [ ] **Step 8: Manual verification**

```bash
cd apps/storefront && pnpm dev
```

In a private browser window:
1. Navigate to `/products/atorcyn-10` (replace with a real handle).
2. Click "Add to Cart".
3. Expect redirect to `/account/login?redirectTo=/products/atorcyn-10&pendingAction=add_to_cart:<variant_id>`.
4. Sign in via phone OTP.
5. Expect redirect back to PDP and item added to cart automatically.

- [ ] **Step 9: Commit**

```bash
git add apps/storefront/src/lib/hooks/use-cart.ts apps/storefront/src/lib/hooks/use-cart.test.ts <pdp-files>
git commit -m "feat(cart): require login for add-to-cart with auto-resume after sign-in"
```

---

## Task 4: Phone-OTP-first login UI hierarchy

**Files:**
- Modify: `apps/storefront/src/routes/account/login.tsx:336-358` (mode toggle), `:577-606` (footer copy)

- [ ] **Step 1: Default mode = phone-OTP**

Change line 41:

```ts
const [mode, setMode] = useState<LoginMode>("phone-otp")
```

- [ ] **Step 2: Replace 3-tab toggle with primary CTA + secondary links**

Replace lines 336–358 with:

```tsx
{mode === "phone-otp" && (
  <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
    Enter your mobile number — we'll send a 6-digit OTP. New user? We'll create your account automatically.
  </p>
)}
{mode !== "phone-otp" && (
  <button
    type="button"
    onClick={() => switchMode("phone-otp")}
    className="text-sm font-medium hover:underline mb-4"
    style={{ color: TEAL }}
  >
    ← Use Mobile OTP instead (recommended)
  </button>
)}
```

- [ ] **Step 3: Replace footer with single secondary-options block**

Replace lines 577–606 with:

```tsx
<div className="mt-6 pt-6 border-t text-center" style={{ borderColor: "var(--border-primary)" }}>
  <p className="text-xs mb-2" style={{ color: "var(--text-tertiary)" }}>
    Trouble with SMS?
  </p>
  <div className="flex justify-center gap-4 text-sm">
    {mode !== "email-otp" && (
      <button type="button" onClick={() => switchMode("email-otp")} className="font-medium hover:underline" style={{ color: TEAL }}>
        Use Email OTP
      </button>
    )}
    {mode !== "email" && (
      <button type="button" onClick={() => switchMode("email")} className="font-medium hover:underline" style={{ color: TEAL }}>
        Sign in with password
      </button>
    )}
  </div>
</div>
```

- [ ] **Step 4: Update head meta**

Replace lines 9–14:

```ts
head: () => ({
  meta: [
    { title: "Sign in or sign up | Suprameds" },
    { name: "description", content: "Sign in to Suprameds with your mobile number. New here? We'll create your account automatically." },
    { name: "robots", content: "noindex, nofollow" },
  ],
}),
```

- [ ] **Step 5: Type-check**

```bash
cd apps/storefront && npx tsc --noEmit
```

- [ ] **Step 6: Manual verification**

```bash
cd apps/storefront && pnpm dev
```

Visit `/account/login` — expect phone-OTP form rendered first; "Use Email OTP" and "Sign in with password" as small secondary links at the bottom.

- [ ] **Step 7: Commit**

```bash
git add apps/storefront/src/routes/account/login.tsx
git commit -m "feat(auth): make mobile OTP the primary login mode"
```

---

## Task 5: Repurpose register page as a redirect

**Files:**
- Modify: `apps/storefront/src/routes/account/register.tsx`

- [ ] **Step 1: Replace register page body with redirect**

Replace the entire file with:

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/account/register")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirectTo: typeof search.redirectTo === "string" ? search.redirectTo : undefined,
    ref: typeof search.ref === "string" ? search.ref : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/account/login",
      // @ts-expect-error - search shape varies per route
      search: {
        redirectTo: search.redirectTo,
        // pass referral code through metadata channel — login page reads on signup
        ...(search.ref ? { ref: search.ref } : {}),
      },
      replace: true,
    })
  },
  component: () => null,
})
```

- [ ] **Step 2: Handle `ref` (referral code) on login page**

In `login.tsx`, extend `validateSearch` (lines 15–19) to also accept `ref`:

```ts
validateSearch: (search: Record<string, unknown>) => ({
  redirectTo: typeof search.redirectTo === "string" ? search.redirectTo : undefined,
  pendingAction: typeof search.pendingAction === "string" ? search.pendingAction : undefined,
  ref: typeof search.ref === "string" ? search.ref : undefined,
}),
```

In `handleVerifyPhoneOtp` and `handleVerifyEmailOtp` `onSuccess` blocks, after the existing trackSignup call, store the ref in customer metadata if `is_new && ref`:

```ts
if (is_new && ref) {
  // Fire-and-forget metadata write; tolerated to fail silently
  void sdk.store.customer.update({ metadata: { referred_by: ref } })
    .catch(() => { /* non-fatal */ })
}
```

- [ ] **Step 3: Type-check**

```bash
cd apps/storefront && npx tsc --noEmit
```

- [ ] **Step 4: Manual verification**

```bash
cd apps/storefront && pnpm dev
```

Visit `/account/register?ref=ABC123&redirectTo=/checkout` — expect 301-style redirect to `/account/login?redirectTo=/checkout&ref=ABC123`. Sign in via phone OTP as a new user, then check `customer.metadata.referred_by === "ABC123"` via DevTools → Network → `/store/customers/me` response.

- [ ] **Step 5: Commit**

```bash
git add apps/storefront/src/routes/account/register.tsx apps/storefront/src/routes/account/login.tsx
git commit -m "feat(auth): redirect /account/register to /account/login (unified entry point)"
```

---

## Task 6: Backend support for metadata + email update

**Files:**
- Modify: `apps/backend/src/api/store/customers/me/route.ts` (verify path during step 1)
- Create: `apps/backend/src/api/store/customers/me/email/route.ts`
- Create: `apps/backend/src/__tests__/integration/http/customer-metadata.spec.ts`

- [ ] **Step 1: Locate the customer-update route**

```bash
cd apps/backend && rg -l "store/customers/me" src/api/
```

Open the file (likely `src/api/store/customers/me/route.ts`). Confirm the POST handler. If the default Medusa `/store/customers/me` route from `@medusajs/medusa` is used (no custom override), create the file at the path above.

- [ ] **Step 2: Allow metadata patch with allow-list validation**

Add (or update) the POST handler:

```ts
// apps/backend/src/api/store/customers/me/route.ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

const ALLOWED_METADATA_KEYS = new Set([
  "dob", "gender", "allergies", "chronic_conditions",
  "abha_id", "emergency_contact", "preferred_language",
  "gst_number", "consent_marketing", "consent_terms",
  "referred_by",
  // NOTE: kyc_status intentionally omitted — server-set only
])

const SERVER_ONLY_KEYS = new Set(["kyc_status", "verified_phone"])

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  const body = req.body as {
    first_name?: string
    last_name?: string
    email?: string
    phone?: string
    metadata?: Record<string, unknown>
  }

  if (body.metadata) {
    for (const k of Object.keys(body.metadata)) {
      if (SERVER_ONLY_KEYS.has(k)) {
        return res.status(400).json({ message: `Field '${k}' cannot be set by the client` })
      }
      if (!ALLOWED_METADATA_KEYS.has(k)) {
        return res.status(400).json({ message: `Unknown metadata field: ${k}` })
      }
    }
  }

  const customerService = req.scope.resolve(Modules.CUSTOMER)
  const existing = await customerService.retrieveCustomer(customerId)

  // Email update goes through dedicated endpoint (uniqueness + verification)
  if (body.email && body.email !== existing.email) {
    return res.status(400).json({
      message: "Use POST /store/customers/me/email to change your email"
    })
  }

  const updated = await customerService.updateCustomers({
    id: customerId,
    first_name: body.first_name,
    last_name: body.last_name,
    phone: body.phone,
    metadata: { ...(existing.metadata ?? {}), ...(body.metadata ?? {}) },
  })

  return res.json({ customer: updated })
}
```

- [ ] **Step 3: Implement email-update endpoint**

```ts
// apps/backend/src/api/store/customers/me/email/route.ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context?.actor_id
  if (!customerId) return res.status(401).json({ message: "Unauthorized" })

  const { email } = req.body as { email?: string }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: "Invalid email" })
  }

  // Reject the auto-generated phone-bridge format
  if (email.endsWith("@phone.suprameds.in")) {
    return res.status(400).json({ message: "Please use a real email address" })
  }

  const customerService = req.scope.resolve(Modules.CUSTOMER)

  // Uniqueness check
  const [existing] = await customerService.listCustomers({ email })
  if (existing && existing.id !== customerId) {
    return res.status(409).json({ message: "This email is already in use" })
  }

  const updated = await customerService.updateCustomers({ id: customerId, email })
  return res.json({ customer: updated })
}
```

> **Note:** This first cut updates email immediately. A follow-up can require an email-OTP verification step before persistence — out of scope here.

- [ ] **Step 4: Write integration test**

```ts
// apps/backend/src/__tests__/integration/http/customer-metadata.spec.ts
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe("POST /store/customers/me — metadata", () => {
      let token: string
      beforeAll(async () => {
        // Use existing OTP test helpers — see existing customer integration tests
        // for the auth setup pattern.
        token = await registerOtpCustomer(api, "+919876543210")
      })

      it("accepts allow-listed metadata fields", async () => {
        const res = await api.post(
          "/store/customers/me",
          { metadata: { dob: "1990-01-01", gender: "male", allergies: ["penicillin"] } },
          { headers: { authorization: `Bearer ${token}` } }
        )
        expect(res.status).toBe(200)
        expect(res.data.customer.metadata.dob).toBe("1990-01-01")
        expect(res.data.customer.metadata.allergies).toEqual(["penicillin"])
      })

      it("rejects server-only fields", async () => {
        const res = await api.post(
          "/store/customers/me",
          { metadata: { kyc_status: "full" } },
          { headers: { authorization: `Bearer ${token}` }, validateStatus: () => true }
        )
        expect(res.status).toBe(400)
      })

      it("rejects unknown metadata keys", async () => {
        const res = await api.post(
          "/store/customers/me",
          { metadata: { random_field: "x" } },
          { headers: { authorization: `Bearer ${token}` }, validateStatus: () => true }
        )
        expect(res.status).toBe(400)
      })
    })
  },
})
```

> **Note:** `registerOtpCustomer` is a shared helper — check existing OTP tests under `apps/backend/src/__tests__/` for the equivalent and reuse. If none exists, hit `/store/otp/send` and `/store/otp/verify` directly with a fixed test phone.

- [ ] **Step 5: Run test**

```bash
cd apps/backend && pnpm test:integration:http -- customer-metadata
```

Expected: 3 passed.

- [ ] **Step 6: Type-check**

```bash
cd apps/backend && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/api/store/customers/me/ apps/backend/src/__tests__/integration/http/customer-metadata.spec.ts
git commit -m "feat(customer): allow metadata patch + dedicated email-change endpoint"
```

---

## Task 7: Frontend `useUpdateCustomer` accepts metadata + email

**Files:**
- Modify: `apps/storefront/src/lib/hooks/use-customer.ts:258-275`
- Create: `apps/storefront/src/lib/types/pharma-customer.ts`

- [ ] **Step 1: Create type module**

```ts
// apps/storefront/src/lib/types/pharma-customer.ts
export interface PharmaCustomerMetadata {
  dob?: string
  gender?: "male" | "female" | "other" | "prefer_not_to_say"
  allergies?: string[]
  chronic_conditions?: string[]
  abha_id?: string
  emergency_contact?: { name: string; phone: string }
  preferred_language?: "en" | "hi" | "ml" | "te" | "ta"
  gst_number?: string
  consent_marketing?: { accepted: boolean; at: string }
  consent_terms?: { accepted: boolean; at: string }
  referred_by?: string
}

export type CustomerProfileUpdate = {
  first_name?: string
  last_name?: string
  phone?: string
  metadata?: Partial<PharmaCustomerMetadata>
}
```

- [ ] **Step 2: Extend useUpdateCustomer**

Replace `useUpdateCustomer` (lines 258–275) with:

```ts
import type { CustomerProfileUpdate } from "@/lib/types/pharma-customer"

export function useUpdateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CustomerProfileUpdate) => {
      const { customer } = await sdk.store.customer.update(data as never)
      return customer
    },
    onSuccess: (customer) => {
      queryClient.setQueryData(["customer"], customer)
      queryClient.invalidateQueries({ queryKey: ["customer"] })
    },
  })
}

export function useUpdateCustomerEmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (email: string) => {
      const res = await sdk.client.fetch<{ customer: any }>("/store/customers/me/email", {
        method: "POST",
        body: { email },
      })
      return res.customer
    },
    onSuccess: (customer) => {
      queryClient.setQueryData(["customer"], customer)
      queryClient.invalidateQueries({ queryKey: ["customer"] })
    },
  })
}
```

- [ ] **Step 3: Type-check**

```bash
cd apps/storefront && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/storefront/src/lib/hooks/use-customer.ts apps/storefront/src/lib/types/pharma-customer.ts
git commit -m "feat(customer): typed metadata patches + dedicated email-update hook"
```

---

## Task 8: Profile completeness utility

**Files:**
- Create: `apps/storefront/src/lib/utils/profile-completeness.ts`
- Create: `apps/storefront/src/lib/utils/profile-completeness.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// apps/storefront/src/lib/utils/profile-completeness.test.ts
import { describe, it, expect } from "vitest"
import { computeProfileCompleteness } from "./profile-completeness"

describe("computeProfileCompleteness", () => {
  it("returns 100% when all fields present", () => {
    const result = computeProfileCompleteness({
      first_name: "Asha",
      last_name: "Kumar",
      email: "asha@example.com",
      phone: "+919876543210",
      metadata: { dob: "1990-01-01", gender: "female", preferred_language: "en" },
    } as never)
    expect(result.percent).toBe(100)
    expect(result.missing).toEqual([])
  })

  it("flags auto-generated email as missing", () => {
    const result = computeProfileCompleteness({
      first_name: "Asha",
      last_name: "Kumar",
      email: "9876543210@phone.suprameds.in",
      phone: "+919876543210",
      metadata: { dob: "1990-01-01", gender: "female", preferred_language: "en" },
    } as never)
    expect(result.missing).toContain("email")
    expect(result.percent).toBeLessThan(100)
  })

  it("returns ~0% for fresh OTP signup", () => {
    const result = computeProfileCompleteness({
      first_name: null,
      last_name: null,
      email: "9876543210@phone.suprameds.in",
      phone: "+919876543210",
      metadata: null,
    } as never)
    expect(result.percent).toBeLessThanOrEqual(20)  // phone is the only set field
  })
})
```

- [ ] **Step 2: Run test, expect FAIL**

```bash
cd apps/storefront && npx vitest run src/lib/utils/profile-completeness.test.ts
```

- [ ] **Step 3: Implement**

```ts
// apps/storefront/src/lib/utils/profile-completeness.ts
import type { PharmaCustomerMetadata } from "@/lib/types/pharma-customer"

type CustomerLike = {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  metadata?: PharmaCustomerMetadata | Record<string, unknown> | null
}

const PHONE_BRIDGE_RE = /@phone\.suprameds\.in$/

const FIELDS: Array<{ key: string; weight: number; check: (c: CustomerLike) => boolean }> = [
  { key: "phone", weight: 20, check: (c) => !!c.phone },
  { key: "first_name", weight: 15, check: (c) => !!c.first_name },
  { key: "last_name", weight: 15, check: (c) => !!c.last_name },
  { key: "email", weight: 15, check: (c) => !!c.email && !PHONE_BRIDGE_RE.test(c.email) },
  { key: "dob", weight: 10, check: (c) => !!(c.metadata as PharmaCustomerMetadata | null)?.dob },
  { key: "gender", weight: 10, check: (c) => !!(c.metadata as PharmaCustomerMetadata | null)?.gender },
  { key: "preferred_language", weight: 5, check: (c) => !!(c.metadata as PharmaCustomerMetadata | null)?.preferred_language },
  { key: "allergies", weight: 5, check: (c) => Array.isArray((c.metadata as PharmaCustomerMetadata | null)?.allergies) },
  { key: "emergency_contact", weight: 5, check: (c) => !!(c.metadata as PharmaCustomerMetadata | null)?.emergency_contact?.phone },
]

export function computeProfileCompleteness(customer: CustomerLike): { percent: number; missing: string[] } {
  const missing: string[] = []
  let earned = 0
  let total = 0
  for (const f of FIELDS) {
    total += f.weight
    if (f.check(customer)) earned += f.weight
    else missing.push(f.key)
  }
  return { percent: Math.round((earned / total) * 100), missing }
}
```

- [ ] **Step 4: Run test, expect PASS**

```bash
cd apps/storefront && npx vitest run src/lib/utils/profile-completeness.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/storefront/src/lib/utils/profile-completeness.ts apps/storefront/src/lib/utils/profile-completeness.test.ts
git commit -m "feat(profile): add profile-completeness scoring utility"
```

---

## Task 9: Profile page — extended fields form

**Files:**
- Modify: `apps/storefront/src/routes/account/_layout/profile.tsx`
- Create: `apps/storefront/src/components/profile/pharma-fields-form.tsx`
- Create: `apps/storefront/src/components/profile/profile-completion-banner.tsx`

- [ ] **Step 1: Build the completion banner**

```tsx
// apps/storefront/src/components/profile/profile-completion-banner.tsx
import { useCustomer } from "@/lib/hooks/use-customer"
import { computeProfileCompleteness } from "@/lib/utils/profile-completeness"

export function ProfileCompletionBanner() {
  const { data: customer } = useCustomer()
  if (!customer) return null
  const { percent, missing } = computeProfileCompleteness(customer)
  if (percent >= 80) return null

  return (
    <div
      className="rounded-lg p-4 mb-4 border"
      style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-primary)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Complete your profile ({percent}%)
        </p>
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          {missing.length} {missing.length === 1 ? "field" : "fields"} remaining
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-primary)" }}>
        <div className="h-full transition-all" style={{ width: `${percent}%`, background: "var(--brand-teal)" }} />
      </div>
      <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
        Helps us personalize medication reminders and flag drug interactions.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Build the pharma fields form**

```tsx
// apps/storefront/src/components/profile/pharma-fields-form.tsx
import { useState } from "react"
import { useUpdateCustomer } from "@/lib/hooks/use-customer"
import type { PharmaCustomerMetadata } from "@/lib/types/pharma-customer"

export function PharmaFieldsForm({ initial }: { initial: PharmaCustomerMetadata }) {
  const [dob, setDob] = useState(initial.dob ?? "")
  const [gender, setGender] = useState<PharmaCustomerMetadata["gender"]>(initial.gender)
  const [language, setLanguage] = useState<PharmaCustomerMetadata["preferred_language"]>(initial.preferred_language)
  const [allergies, setAllergies] = useState<string>((initial.allergies ?? []).join(", "))
  const [conditions, setConditions] = useState<string>((initial.chronic_conditions ?? []).join(", "))
  const [abhaId, setAbhaId] = useState(initial.abha_id ?? "")
  const [gst, setGst] = useState(initial.gst_number ?? "")
  const update = useUpdateCustomer()
  const [saved, setSaved] = useState(false)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    update.mutate(
      {
        metadata: {
          dob: dob || undefined,
          gender,
          preferred_language: language,
          allergies: allergies ? allergies.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
          chronic_conditions: conditions ? conditions.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
          abha_id: abhaId || undefined,
          gst_number: gst || undefined,
        },
      },
      {
        onSuccess: () => {
          setSaved(true)
          setTimeout(() => setSaved(false), 3000)
        },
      }
    )
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Date of birth">
        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={INPUT_CLS} />
      </Field>
      <Field label="Gender">
        <select value={gender ?? ""} onChange={(e) => setGender(e.target.value as never)} className={INPUT_CLS}>
          <option value="">Select…</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
          <option value="prefer_not_to_say">Prefer not to say</option>
        </select>
      </Field>
      <Field label="Preferred language">
        <select value={language ?? ""} onChange={(e) => setLanguage(e.target.value as never)} className={INPUT_CLS}>
          <option value="">Select…</option>
          <option value="en">English</option>
          <option value="hi">हिन्दी</option>
          <option value="ml">മലയാളം</option>
          <option value="te">తెలుగు</option>
          <option value="ta">தமிழ்</option>
        </select>
      </Field>
      <Field label="ABHA ID (optional)">
        <input value={abhaId} onChange={(e) => setAbhaId(e.target.value)} placeholder="14-digit ABHA" className={INPUT_CLS} />
      </Field>
      <Field label="Allergies (comma-separated)" wide>
        <input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="e.g. Penicillin, Sulfa" className={INPUT_CLS} />
      </Field>
      <Field label="Chronic conditions (comma-separated)" wide>
        <input value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="e.g. Diabetes, Hypertension" className={INPUT_CLS} />
      </Field>
      <Field label="GST number (for business invoices)" wide>
        <input value={gst} onChange={(e) => setGst(e.target.value)} placeholder="22AAAAA0000A1Z5" className={INPUT_CLS} />
      </Field>
      <div className="md:col-span-2 flex items-center gap-3">
        <button type="submit" disabled={update.isPending} className="px-4 py-2 rounded-lg text-white font-medium" style={{ background: "var(--brand-teal)" }}>
          {update.isPending ? "Saving…" : "Save medical details"}
        </button>
        {saved && <span className="text-sm" style={{ color: "var(--brand-teal)" }}>Saved ✓</span>}
      </div>
    </form>
  )
}

const INPUT_CLS = "w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2"

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "md:col-span-2" : undefined}>
      <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>{label}</label>
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Add email-edit affordance to profile.tsx**

In `apps/storefront/src/routes/account/_layout/profile.tsx`, replace the "Email cannot be changed" notice with an inline edit. Sketch:

```tsx
// Imports
import { useUpdateCustomerEmail } from "@/lib/hooks/use-customer"
import { ProfileCompletionBanner } from "@/components/profile/profile-completion-banner"
import { PharmaFieldsForm } from "@/components/profile/pharma-fields-form"

// Inside the component, add state for email edit
const [editingEmail, setEditingEmail] = useState(false)
const [newEmail, setNewEmail] = useState("")
const updateEmail = useUpdateCustomerEmail()
const isAutoEmail = customer?.email?.endsWith("@phone.suprameds.in")
```

Render at the top of the page:

```tsx
<ProfileCompletionBanner />
```

Replace the email block with:

```tsx
<div>
  <label className="block text-sm font-medium mb-1">Email address</label>
  {editingEmail ? (
    <div className="flex gap-2">
      <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="you@example.com" className="flex-1 px-3 py-2 rounded-lg border text-sm" />
      <button onClick={() => updateEmail.mutate(newEmail, { onSuccess: () => setEditingEmail(false) })} disabled={updateEmail.isPending} className="px-3 py-2 rounded-lg text-white text-sm" style={{ background: "var(--brand-teal)" }}>
        {updateEmail.isPending ? "Saving…" : "Save"}
      </button>
      <button onClick={() => setEditingEmail(false)} className="px-3 py-2 rounded-lg border text-sm">Cancel</button>
    </div>
  ) : (
    <div className="flex items-center gap-3">
      <span className="text-sm" style={{ color: isAutoEmail ? "var(--text-tertiary)" : "var(--text-primary)" }}>
        {isAutoEmail ? "Not set" : customer.email}
      </span>
      <button onClick={() => { setNewEmail(isAutoEmail ? "" : customer.email ?? ""); setEditingEmail(true) }} className="text-sm font-medium hover:underline" style={{ color: "var(--brand-teal)" }}>
        {isAutoEmail ? "Add email" : "Change"}
      </button>
    </div>
  )}
</div>
```

After the existing first_name/last_name/phone form, render:

```tsx
<section className="mt-8 pt-8 border-t">
  <h2 className="text-lg font-semibold mb-4">Medical & contact details</h2>
  <PharmaFieldsForm initial={(customer.metadata ?? {}) as PharmaCustomerMetadata} />
</section>
```

- [ ] **Step 4: Run lint + type-check**

```bash
cd apps/storefront && npx tsc --noEmit && npx eslint src/ --max-warnings 0
```

- [ ] **Step 5: Manual verification**

```bash
cd apps/storefront && pnpm dev
```

1. Sign in via phone OTP as a new user.
2. Go to `/account/profile`. Expect:
   - Completion banner showing low percentage.
   - Email shown as "Not set" with "Add email" button (because email is `{phone}@phone.suprameds.in`).
   - Medical & contact details section visible with all fields.
3. Fill in DOB, gender, language. Save. Verify percentage increases on refresh.

- [ ] **Step 6: Commit**

```bash
git add apps/storefront/src/routes/account/_layout/profile.tsx apps/storefront/src/components/profile/
git commit -m "feat(profile): editable email + pharma fields + completion banner"
```

---

## Task 10: End-to-end smoke + final verification

**Files:** N/A — verification only

- [ ] **Step 1: Run full test suite**

```bash
cd apps/storefront && pnpm test                          # Vitest ~125 tests
cd apps/backend && npx jest --testMatch="**/*.unit.spec.ts"  # Jest ~635 tests
cd apps/backend && pnpm test:integration:http -- customer-metadata
```

Expected: all green.

- [ ] **Step 2: Lint + type-check both apps**

```bash
cd apps/storefront && npx eslint src/ --max-warnings 0
cd apps/storefront && npx tsc --noEmit
cd apps/backend && npx tsc --noEmit
```

- [ ] **Step 3: Manual E2E walkthrough (private window)**

1. Visit `/products/<a-real-handle>` (no login).
2. Click Add to Cart → expect login redirect with `pendingAction`.
3. Enter phone → OTP arrives via SMS → enter OTP → expect redirect back to PDP and item added to cart.
4. Visit `/account/profile` → fill email + DOB + gender → save → reload → values persist.
5. Visit `/account/register?ref=TEST123` → expect redirect to `/account/login` with `ref` preserved.
6. Sign in as a different new user with `?ref=TEST123` → after signup, check `customer.metadata.referred_by === "TEST123"`.
7. Visit `/checkout` (with item in cart) → existing flow proceeds (address step captures name).

- [ ] **Step 4: Commit any final cleanup**

If nothing changed, skip. Otherwise:

```bash
git add -A
git commit -m "chore: final cleanup after auth-gate rollout"
```

- [ ] **Step 5: Push to development for staging deploy**

```bash
git push origin <feature-branch>
gh pr create --base development --title "feat(auth): login required for add-to-cart + OTP-first flow"
```

After CI passes and the PR is reviewed, merge to `development` for Railway staging deploy. Verify on staging URL before promoting to `main`.

---

## Self-review (run before handing off)

**Spec coverage:**
- ✅ Add-to-cart requires login → Tasks 1, 3
- ✅ Mobile+OTP unified login/signup → Tasks 4, 5 (login UI + register redirect)
- ✅ New user auto-signup with phone (existing OTP verify endpoint already does this) → no new work
- ✅ Profile page editable for all listed fields → Tasks 6, 7, 8, 9
- ✅ Email upgrade for OTP-only users → Tasks 6 (backend), 7 (hook), 9 (UI)
- ✅ SEO/Ads landing pages stay public → no route guard added at root, by design
- ✅ Existing email/password login preserved as secondary → Task 4
- ✅ Existing test suites updated → Tasks 1, 3, 6, 8

**Open assumptions to validate during execution:**
1. The customer-update route at `/store/customers/me` is custom — if Medusa's default is used and intercepting it requires more plumbing, Task 6 grows.
2. SDK `sdk.store.customer.update({ metadata })` actually round-trips arbitrary metadata. If it strips unknown fields, switch to `sdk.client.fetch("/store/customers/me", { method: "POST", body })` directly.
3. The PDP add-to-cart button location — Task 3 Step 1 has the grep to find it. If there are multiple call sites (PDP, related products, cart drawer), each needs the same `onError` patch.

**No placeholders verified:** every step has either real code, a real command with expected output, or a precise verification action.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-08-login-required-add-to-cart.md`.**
