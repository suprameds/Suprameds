import { test, expect } from "@playwright/test"

const BACKEND = "http://localhost:9000"
const PK = "pk_98c62c9c8422c640ebfe80804e087eaa8e90ae8b954979a25475247eed8b7c9d"

test.describe("Backend Health", () => {
  test("GET /health returns OK", async ({ request }) => {
    const res = await request.get(`${BACKEND}/health`)
    expect(res.status()).toBe(200)
    expect(await res.text()).toBe("OK")
  })

  test("store regions returns India (INR)", async ({ request }) => {
    const res = await request.get(`${BACKEND}/store/regions`, {
      headers: { "x-publishable-api-key": PK },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.regions).toHaveLength(1)
    expect(body.regions[0].name).toBe("India")
    expect(body.regions[0].currency_code).toBe("inr")
  })

  test("store products returns 54 items", async ({ request }) => {
    const res = await request.get(`${BACKEND}/store/products?limit=1`, {
      headers: { "x-publishable-api-key": PK },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(54)
  })

  test("store categories returns 24 categories", async ({ request }) => {
    const res = await request.get(`${BACKEND}/store/product-categories`, {
      headers: { "x-publishable-api-key": PK },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.product_categories.length).toBeGreaterThanOrEqual(20)
  })

  test("pincode check works for Hyderabad", async ({ request }) => {
    const res = await request.get(`${BACKEND}/store/pincodes/check?pincode=500072`, {
      headers: { "x-publishable-api-key": PK },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.serviceable).toBe(true)
    expect(body.state).toBe("TELANGANA")
  })

  test("search returns results for metformin", async ({ request }) => {
    const res = await request.get(`${BACKEND}/store/products/search?q=metformin`, {
      headers: { "x-publishable-api-key": PK },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.products.length).toBeGreaterThan(5)
  })

  test("pharma metadata returns drug schedule info", async ({ request }) => {
    const res = await request.get(
      `${BACKEND}/store/products/pharma?handle=supracyn-dapacyn-5-tab`,
      { headers: { "x-publishable-api-key": PK } }
    )
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.drug_product.schedule).toBe("H")
    expect(body.drug_product.generic_name).toContain("Dapagliflozin")
    expect(body.drug_product.gst_rate).toBe(12)
  })

  test("payment providers include Razorpay and system_default", async ({ request }) => {
    const regRes = await request.get(`${BACKEND}/store/regions`, {
      headers: { "x-publishable-api-key": PK },
    })
    const regionId = (await regRes.json()).regions[0].id

    const res = await request.get(
      `${BACKEND}/store/payment-providers?region_id=${regionId}`,
      { headers: { "x-publishable-api-key": PK } }
    )
    expect(res.status()).toBe(200)
    const body = await res.json()
    const ids = body.payment_providers.map((p: any) => p.id)
    expect(ids).toContain("pp_razorpay_razorpay")
    expect(ids).toContain("pp_system_default")
  })
})
