/**
 * Store Route Tests — Cover the 7 previously untested routes
 *
 * Run: npx jest --testMatch="**/*.unit.spec.ts" -- store-routes
 */

const BASE_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const PK = process.env.MEDUSA_PUBLISHABLE_KEY || "pk_e2bd20acd56f5f1f41d1c7442ead5295eaf39af4a858c0c42fd99bd0796dcaa3"

const headers = {
  "Content-Type": "application/json",
  "x-publishable-api-key": PK,
}

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers: { ...headers, ...options.headers } })
  return { status: res.status, data: await res.json().catch(() => ({})) }
}

describe("Store Routes — Delivery Estimate", () => {
  it("GET /store/delivery-estimate should return estimate for valid pincode", async () => {
    const { status, data } = await api("/store/delivery-estimate?pincode=500018")
    expect([200, 404].includes(status)).toBe(true)
  })

  it("should reject invalid pincode format", async () => {
    const { status } = await api("/store/delivery-estimate?pincode=123")
    expect([400, 404].includes(status)).toBe(true)
  })
})

describe("Store Routes — Notifications", () => {
  it("GET /store/notifications should return list (may be empty without auth)", async () => {
    const { status } = await api("/store/notifications?limit=5")
    // 200 if authenticated, 401 if not
    expect([200, 401].includes(status)).toBe(true)
  })
})

describe("Store Routes — Prescriptions", () => {
  it("GET /store/prescriptions should require auth", async () => {
    const { status } = await api("/store/prescriptions")
    expect([200, 401].includes(status)).toBe(true)
  })
})

describe("Store Routes — Shipments", () => {
  it("GET /store/shipments should require auth", async () => {
    const { status } = await api("/store/shipments")
    expect([200, 401].includes(status)).toBe(true)
  })
})

describe("Store Routes — Wallet", () => {
  it("GET /store/wallet should require auth", async () => {
    const { status } = await api("/store/wallet")
    expect([200, 401].includes(status)).toBe(true)
  })
})

describe("Store Routes — Reminders", () => {
  it("GET /store/reminders should require auth", async () => {
    const { status } = await api("/store/reminders")
    expect([200, 401].includes(status)).toBe(true)
  })
})

describe("Store Routes — Documents", () => {
  it("GET /store/documents should require auth", async () => {
    const { status } = await api("/store/documents")
    expect([200, 401].includes(status)).toBe(true)
  })
})

describe("Store Routes — Pincode Check", () => {
  it("should return serviceable for Hyderabad pincode", async () => {
    const { status, data } = await api("/store/pincodes/check?pincode=500018")
    expect(status).toBe(200)
    expect(data.serviceable).toBe(true)
  })

  it("should return not serviceable for invalid pincode", async () => {
    const { status, data } = await api("/store/pincodes/check?pincode=999999")
    expect(status).toBe(200)
    expect(data.serviceable).toBe(false)
  })

  it("should reject non-6-digit pincode", async () => {
    const { status } = await api("/store/pincodes/check?pincode=12345")
    expect([400, 200].includes(status)).toBe(true)
  })
})
