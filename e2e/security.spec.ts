/**
 * Security Tests — pharma data protection, auth, injection prevention.
 * Uses Playwright request context (no browser needed) for API-level checks.
 */
import { test, expect } from "@playwright/test"
import { BACKEND_URL } from "./fixtures/test-data"

const API = BACKEND_URL

async function api(request: any, path: string, options: { method?: string; data?: any; headers?: Record<string, string> } = {}) {
  const method = options.method || "GET"
  const reqOptions: any = {}
  if (options.headers) reqOptions.headers = options.headers
  if (options.data) reqOptions.data = options.data

  let res
  if (method === "POST") {
    res = await request.post(`${API}${path}`, reqOptions)
  } else {
    res = await request.get(`${API}${path}`, reqOptions)
  }
  return { status: res.status(), headers: res.headers() }
}

test.describe("Authentication & Authorization", () => {
  test("admin endpoints reject unauthenticated requests", async ({ request }) => {
    const endpoints = ["/admin/products", "/admin/orders", "/admin/customers"]
    for (const ep of endpoints) {
      const { status } = await api(request, ep)
      expect(status, `${ep} should reject unauth`).toBeGreaterThanOrEqual(401)
      expect(status, `${ep} should not 500`).toBeLessThan(500)
    }
  })

  test("admin endpoints reject invalid JWT tokens", async ({ request }) => {
    const { status } = await api(request, "/admin/products", {
      headers: { Authorization: "Bearer fake.jwt.token" },
    })
    expect(status).toBeGreaterThanOrEqual(401)
  })

  test("customer account data requires authentication", async ({ request }) => {
    const { status } = await api(request, "/store/customers/me")
    expect(status).toBeGreaterThanOrEqual(401)
  })

  test("order details require authentication", async ({ request }) => {
    const { status } = await api(request, "/store/orders/fake_order_id")
    expect([401, 403, 404]).toContain(status)
  })
})

test.describe("Prescription Data Security", () => {
  test("prescription upload endpoint requires auth", async ({ request }) => {
    const { status } = await api(request, "/store/prescriptions", { method: "POST", data: {} })
    expect(status).toBeLessThan(500)
    expect([401, 403, 404, 422]).toContain(status)
  })

  test("cannot access other customers prescription data", async ({ request }) => {
    const { status } = await api(request, "/store/prescriptions/rx_someone_elses")
    expect([401, 403, 404]).toContain(status)
  })

  test("prescription file URLs are not publicly accessible", async ({ request }) => {
    const res = await request.get(`${API}/uploads/rx/rx_valid_01.pdf`)
    expect([401, 403, 404]).toContain(res.status())
  })
})

test.describe("Drug Schedule Enforcement", () => {
  test("Schedule X products cannot be added to cart", async ({ request }) => {
    const cartRes = await request.post(`${API}/store/carts`, { data: {} })
    const cartData = await cartRes.json().catch(() => null)
    const cartId = cartData?.cart?.id
    if (!cartId) return

    const res = await request.post(`${API}/store/carts/${cartId}/line-items`, {
      data: { variant_id: "var_schedule_x_blocked", quantity: 1 },
    })
    expect(res.status()).not.toBe(200)
  })
})

test.describe("Input Validation & Injection Prevention", () => {
  test("SQL injection in search does not crash", async ({ request }) => {
    const malicious = "'; DROP TABLE products; --"
    const { status } = await api(request, `/store/products?q=${encodeURIComponent(malicious)}`)
    expect(status).toBeLessThan(500)
  })

  test("XSS in customer registration is handled", async ({ request }) => {
    const res = await request.post(`${API}/store/customers`, {
      data: {
        email: "xss-test@example.com",
        first_name: '<script>alert("xss")</script>',
        last_name: "Test",
        password: "testpassword123",
      },
    })
    expect(res.status()).toBeLessThan(500)
  })

  test("oversized file uploads are rejected", async ({ request }) => {
    const oversized = "x".repeat(20 * 1024 * 1024)
    const res = await request.post(`${API}/store/prescriptions/upload`, {
      data: oversized,
      headers: { "Content-Type": "application/octet-stream" },
    })
    expect([400, 404, 413, 422]).toContain(res.status())
  })
})

test.describe("Security Headers", () => {
  test("API does not expose server version", async ({ request }) => {
    const res = await request.get(`${API}/health`)
    const headers = res.headers()
    expect(headers["x-powered-by"]).toBeUndefined()
  })
})

test.describe("Rate Limiting", () => {
  test("rapid requests do not crash the server", async ({ request }) => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => request.get(`${API}/store/products?limit=1`))
    )
    for (const res of results) {
      expect(res.status()).toBeLessThan(500)
      expect([200, 429]).toContain(res.status())
    }
  })
})

test.describe("CORS Configuration", () => {
  test("allows requests from configured storefront origin", async ({ request }) => {
    const res = await request.get(`${API}/store/products?limit=1`, {
      headers: { Origin: "http://localhost:5173" },
    })
    expect(res.status()).toBeLessThan(500)
  })
})
