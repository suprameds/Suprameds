import { test, expect } from "@playwright/test"
import { loginAsAdmin } from "./fixtures/auth"
import { BACKEND_URL, TEST_ADMIN } from "./fixtures/test-data"

let adminToken: string

/**
 * Admin UI and API operations.
 *
 * UI tests use loginAsAdmin() to authenticate via the browser.
 * API tests use a JWT token obtained in beforeAll.
 */

test.beforeAll(async ({ request }) => {
  const res = await request.post(`${BACKEND_URL}/auth/user/emailpass`, {
    data: { email: TEST_ADMIN.email, password: TEST_ADMIN.password },
  })
  const body = await res.json()
  adminToken = body.token
  expect(adminToken).toBeTruthy()
})

function authHeaders() {
  return { Authorization: `Bearer ${adminToken}` }
}

// ── Admin UI ─────────────────────────────────────────────────────

test.describe("Admin UI", () => {
  test("admin login page renders", async ({ page }) => {
    const res = await page.goto("/admin/login")
    expect(res?.status()).toBeLessThan(500)
    await expect(page.locator('[name="email"]')).toBeVisible({ timeout: 10_000 })
  })

  test("admin dashboard loads after login", async ({ page }) => {
    await loginAsAdmin(page)
    await expect(page).toHaveURL(/\/admin/)
    await expect(page.getByRole("main")).toBeVisible()
  })

  test("admin products page is visible", async ({ page }) => {
    test.slow()
    await loginAsAdmin(page)
    await page.goto("/admin/products")
    await page.waitForLoadState("networkidle")
    await expect(page.getByRole("main")).toBeVisible()
    // Should list products or show a heading
    await expect(
      page.getByRole("heading", { name: /Products/i }).first()
        .or(page.locator("table").first())
    ).toBeVisible({ timeout: 15_000 })
  })

  test("admin prescriptions queue is accessible", async ({ page }) => {
    test.slow()
    await loginAsAdmin(page)
    await page.goto("/admin/prescriptions")
    await page.waitForLoadState("networkidle")
    await expect(page.getByRole("main")).toBeVisible()
  })

  test("admin pharmacist portal loads with stats", async ({ page }) => {
    test.slow()
    await loginAsAdmin(page)
    await page.goto("/admin/pharmacist")
    await page.waitForLoadState("networkidle")
    await expect(page.getByRole("main")).toBeVisible()
  })

  test("admin warehouse portal loads", async ({ page }) => {
    test.slow()
    await loginAsAdmin(page)
    await page.goto("/admin/warehouse")
    await page.waitForLoadState("networkidle")
    await expect(page.getByRole("main")).toBeVisible()
  })

  test("admin refunds page loads", async ({ page }) => {
    test.slow()
    await loginAsAdmin(page)
    await page.goto("/admin/refunds")
    await page.waitForLoadState("networkidle")
    await expect(page.getByRole("main")).toBeVisible()
  })

  test("admin analytics page loads", async ({ page }) => {
    test.slow()
    await loginAsAdmin(page)
    await page.goto("/admin/analytics")
    await page.waitForLoadState("networkidle")
    await expect(page.getByRole("main")).toBeVisible()
  })

  test("admin loyalty page loads", async ({ page }) => {
    test.slow()
    await loginAsAdmin(page)
    await page.goto("/admin/loyalty")
    await page.waitForLoadState("networkidle")
    await expect(page.getByRole("main")).toBeVisible()
  })

  test("admin compliance page loads", async ({ page }) => {
    test.slow()
    await loginAsAdmin(page)
    await page.goto("/admin/compliance")
    await page.waitForLoadState("networkidle")
    await expect(page.getByRole("main")).toBeVisible()
  })

  test("admin GRN (goods received notes) page loads", async ({ page }) => {
    test.slow()
    await loginAsAdmin(page)
    await page.goto("/admin/grn")
    await page.waitForLoadState("networkidle")
    await expect(page.getByRole("main")).toBeVisible()
  })

  test("admin roles page loads", async ({ page }) => {
    test.slow()
    await loginAsAdmin(page)
    await page.goto("/admin/roles")
    await page.waitForLoadState("networkidle")
    await expect(page.getByRole("main")).toBeVisible()
  })
})

// ── Admin API — Analytics ────────────────────────────────────────

test.describe("Admin API — Analytics", () => {
  test("dashboard returns order counts and revenue", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/admin/analytics`, {
      headers: authHeaders(),
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.type).toBe("dashboard")
    expect(body.orders).toHaveProperty("total")
    expect(body.revenue).toHaveProperty("total")
    expect(body.revenue.currency_code).toBe("inr")
    expect(body.status_distribution).toBeDefined()
    expect(body.top_products).toBeDefined()
  })

  test("revenue analytics returns trend data", async ({ request }) => {
    const res = await request.get(
      `${BACKEND_URL}/admin/analytics/revenue?from=2026-01-01&to=2026-12-31&granularity=month`,
      { headers: authHeaders() }
    )
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.granularity).toBe("month")
    expect(body.totals).toHaveProperty("revenue")
    expect(body.data).toBeInstanceOf(Array)
  })

  test("product analytics returns top sellers", async ({ request }) => {
    const res = await request.get(
      `${BACKEND_URL}/admin/analytics/products?view=top_sellers`,
      { headers: authHeaders() }
    )
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.view).toBe("top_sellers")
    expect(body.products).toBeInstanceOf(Array)
  })

  test("customer analytics returns LTV and geo data", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/admin/analytics/customers`, {
      headers: authHeaders(),
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.new_vs_returning).toBeDefined()
    expect(body.lifetime_value).toBeDefined()
    expect(body.geographic_distribution).toBeInstanceOf(Array)
  })
})

// ── Admin API — Pharma & Compliance ──────────────────────────────

test.describe("Admin API — Pharma & Compliance", () => {
  test("drug products list returns 54 items", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/admin/pharma/drug-products?limit=100`, {
      headers: authHeaders(),
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.drug_products.length).toBe(54)
  })

  test("batches list returns inventory batches", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/admin/pharma/batches?limit=5`, {
      headers: authHeaders(),
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.batches.length).toBeGreaterThan(0)
  })

  test("RBAC roles returns 26 roles", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/admin/rbac/roles`, {
      headers: authHeaders(),
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.roles.length).toBe(26)
  })

  test("prescriptions list is accessible and returns array", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/admin/prescriptions`, {
      headers: authHeaders(),
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.prescriptions).toBeInstanceOf(Array)
  })

  test("dispense decisions are accessible", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/admin/dispense/decisions`, {
      headers: authHeaders(),
    })
    expect(res.status()).toBe(200)
  })

  test("compliance PHI logs are accessible", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/admin/compliance/phi-logs`, {
      headers: authHeaders(),
    })
    expect(res.status()).toBe(200)
  })

  test("compliance override requests are accessible", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/admin/compliance/override-requests`, {
      headers: authHeaders(),
    })
    expect(res.status()).toBe(200)
  })

  test("warehouse GRN endpoint is accessible", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/admin/warehouse/grn`, {
      headers: authHeaders(),
    })
    expect(res.status()).toBe(200)
  })

  test("loyalty dashboard returns tier distribution", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/admin/loyalty`, {
      headers: authHeaders(),
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty("total_accounts")
    expect(body).toHaveProperty("tier_distribution")
  })

  test("sales tax report returns GST breakdown", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/admin/reports/sales-tax?month=2026-03`, {
      headers: authHeaders(),
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.summary).toBeDefined()
    expect(body.gst_breakdown).toBeDefined()
  })

  test("pincodes endpoint returns 163K+ entries", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/admin/pincodes?limit=1`, {
      headers: authHeaders(),
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.count).toBeGreaterThan(160_000)
  })
})

// ── Admin API — Inventory (batch) operations ─────────────────────

test.describe("Admin API — Inventory", () => {
  test("batch list endpoint returns batches with expiry data", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/admin/pharma/batches?limit=10`, {
      headers: authHeaders(),
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    const batch = body.batches[0]
    expect(batch).toHaveProperty("id")
    // Batch should have either expiry_date or batch_number
    expect(batch.expiry_date !== undefined || batch.batch_number !== undefined).toBe(true)
  })

  test("purchases list is accessible", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/admin/purchases?limit=5`, {
      headers: authHeaders(),
    })
    expect(res.status()).toBe(200)
  })
})

// ── Admin API — Security ─────────────────────────────────────────

test.describe("Admin API — Security", () => {
  test("webhook endpoints reject invalid AfterShip signature", async ({ request }) => {
    const aftership = await request.post(`${BACKEND_URL}/webhooks/aftership`, {
      data: { event: "test" },
    })
    expect(aftership.status()).toBe(500)
  })

  test("WhatsApp webhook rejects wrong verify token", async ({ request }) => {
    const whatsapp = await request.get(
      `${BACKEND_URL}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=test`
    )
    expect(whatsapp.status()).toBe(403)
  })

  test("unauthenticated requests to protected admin API get 401", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/admin/analytics`)
    // Medusa may return 401 for API routes without auth
    expect([401, 403]).toContain(res.status())
  })
})
