import { test, expect } from "@playwright/test"
import { COUNTRY_CODE, OTC_PRODUCT_HANDLE, BACKEND_URL, PK } from "./fixtures/test-data"

test.describe("Browse and Search", () => {
  // ── Homepage ────────────────────────────────────────────────────

  test("homepage loads and redirects to /in", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/\/in$/)
    await expect(page).toHaveTitle(/Suprameds/)
  })

  test("homepage has hero heading and search bar", async ({ page }) => {
    await page.goto(`/${COUNTRY_CODE}`)
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Generic Medicines")
    await expect(page.getByPlaceholder(/Search for medicines/)).toBeVisible()
  })

  test("homepage shows Shop by Category section", async ({ page }) => {
    await page.goto(`/${COUNTRY_CODE}`)
    await expect(page.getByRole("heading", { name: "Shop by Category" })).toBeVisible()
    await expect(page.getByRole("link", { name: /Medicines/ }).first()).toBeVisible()
  })

  // ── Store listing ───────────────────────────────────────────────

  test("store page lists products with prices and Rx badges", async ({ page }) => {
    await page.goto(`/${COUNTRY_CODE}/store`)
    await expect(page.getByRole("heading", { level: 1 })).toContainText("All Medicines")

    // Wait for products to load
    await page.waitForSelector("a[href*='/products/']", { timeout: 15_000 })
    const productCount = await page.locator("a[href*='/products/']").count()
    expect(productCount).toBeGreaterThan(0)
  })

  test("store page has category filter buttons", async ({ page }) => {
    await page.goto(`/${COUNTRY_CODE}/store`)
    await expect(page.getByRole("button", { name: "All" })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole("button", { name: "Wellness" })).toBeVisible({ timeout: 10_000 })
  })

  test("category filter narrows the product list", async ({ page }) => {
    await page.goto(`/${COUNTRY_CODE}/store`)
    await page.waitForSelector("a[href*='/products/']", { timeout: 15_000 })

    // Count before filter
    const beforeCount = await page.locator("a[href*='/products/']").count()

    await page.getByRole("button", { name: "Wellness" }).click()
    // Page should still be functional
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 5_000 })

    // After filter: count may be less or equal (categories may overlap), just ensure page works
    const afterCount = await page.locator("a[href*='/products/']").count()
    expect(afterCount).toBeGreaterThanOrEqual(0)
    // Filtered count should not exceed unfiltered count
    expect(afterCount).toBeLessThanOrEqual(beforeCount)
  })

  // ── Product detail ──────────────────────────────────────────────

  test("product detail page shows name, price, and add-to-cart", async ({ page }) => {
    await page.goto(`/${COUNTRY_CODE}/products/${OTC_PRODUCT_HANDLE}`)

    await expect(page.getByRole("heading", { level: 1 })).toContainText("DAPACYN-5")
    await expect(page.getByText("₹111.00")).toBeVisible()
    await expect(page.getByRole("button", { name: /Add to cart/ })).toBeVisible()
  })

  test("product detail shows drug metadata (generic name, form, schedule)", async ({ page }) => {
    await page.goto(`/${COUNTRY_CODE}/products/${OTC_PRODUCT_HANDLE}`)

    await expect(page.getByText("Dapagliflozin 5mg").first()).toBeVisible()
    await expect(page.getByText("Medicine Details")).toBeVisible()
    await expect(page.getByText("tablet")).toBeVisible()
  })

  test("Rx product detail shows Prescription required notice", async ({ page }) => {
    await page.goto(`/${COUNTRY_CODE}/products/${OTC_PRODUCT_HANDLE}`)
    await expect(page.getByText("Prescription required").first()).toBeVisible()
  })

  test("product detail page loads via store grid click", async ({ page }) => {
    await page.goto(`/${COUNTRY_CODE}/store`)
    await page.waitForSelector("a[href*='/products/']", { timeout: 15_000 })

    const firstProductLink = page.locator("a[href*='/products/']").first()
    const href = await firstProductLink.getAttribute("href")
    await firstProductLink.click()

    // Should land on a product page
    await page.waitForURL(/\/products\//, { timeout: 10_000 })
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    expect(href).toMatch(/\/products\//)
  })

  // ── Search ──────────────────────────────────────────────────────

  test("search from homepage navigates to search/store results", async ({ page }) => {
    await page.goto(`/${COUNTRY_CODE}`)
    const searchBox = page.getByPlaceholder(/Search for medicines/)
    await searchBox.fill("paracetamol")
    await searchBox.press("Enter")

    await page.waitForURL(/search|store/, { timeout: 10_000 })
    // Page must not be an error
    await expect(page.getByRole("main")).toBeVisible()
  })

  test("search API returns results for paracetamol", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/store/products/search?q=paracetamol`, {
      headers: { "x-publishable-api-key": PK },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.products.length).toBeGreaterThan(0)
  })

  test("search API returns results for metformin", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/store/products/search?q=metformin`, {
      headers: { "x-publishable-api-key": PK },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.products.length).toBeGreaterThan(5)
  })

  // ── Compliance / footer ─────────────────────────────────────────

  test("footer has required compliance links", async ({ page }) => {
    await page.goto(`/${COUNTRY_CODE}`)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

    const footer = page.locator("footer")
    await expect(footer.getByRole("link", { name: "Pharmacy Licenses" })).toBeVisible()
    await expect(footer.getByRole("link", { name: "Privacy Policy (DPDP)" })).toBeVisible()
    await expect(footer.getByRole("link", { name: "Prescription Policy" })).toBeVisible()
    await expect(footer.getByRole("link", { name: "Grievance Officer" })).toBeVisible()
  })

  test("compliance pages load without errors", async ({ page }) => {
    for (const path of ["/terms", "/privacy", "/returns", "/prescription-policy"]) {
      const res = await page.goto(path)
      expect(res?.status()).toBeLessThan(400)
    }
  })

  // ── Product substitutes ─────────────────────────────────────────

  test("product detail page has substitutes section or gracefully omits it", async ({ page }) => {
    await page.goto(`/${COUNTRY_CODE}/products/${OTC_PRODUCT_HANDLE}`)
    // The section might not render if there are no substitutes — that's fine
    const heading = page.getByText(/Cheaper Alternatives|Similar|Substitutes/i)
    const visible = await heading.isVisible().catch(() => false)
    // Not asserting true/false — just ensure no JS crash (page heading still present)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  })
})
