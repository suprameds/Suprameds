import { test, expect } from "@playwright/test"

test.describe("Storefront — Browsing", () => {
  test("homepage loads with hero and categories", async ({ page }) => {
    await page.goto("/")
    // Should redirect to /in
    await expect(page).toHaveURL(/\/in$/)
    await expect(page).toHaveTitle(/Suprameds/)

    // Hero section
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Generic Medicines")
    await expect(page.getByPlaceholder(/Search for medicines/)).toBeVisible()

    // Categories section
    await expect(page.getByRole("heading", { name: "Shop by Category" })).toBeVisible()
    await expect(page.getByRole("link", { name: /Medicines/ }).first()).toBeVisible()
  })

  test("store page lists products with prices and Rx badges", async ({ page }) => {
    await page.goto("/in/store")
    await expect(page.getByRole("heading", { level: 1 })).toContainText("All Medicines")

    // Wait for products to load, then check product cards
    await page.waitForSelector("a[href*='/products/']", { timeout: 15_000 })
    const productCount = await page.locator("a[href*='/products/']").count()
    expect(productCount).toBeGreaterThan(0)

    // Category filter buttons
    await expect(page.getByRole("button", { name: "All" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Wellness" })).toBeVisible()
  })

  test("product detail page shows drug info and add-to-cart", async ({ page }) => {
    await page.goto("/in/products/supracyn-dapacyn-5-tab")
    await expect(page.getByRole("heading", { level: 1 })).toContainText("DAPACYN-5")

    // Price displayed
    await expect(page.getByText("₹111.00")).toBeVisible()

    // Drug metadata
    await expect(page.getByText("Dapagliflozin 5mg").first()).toBeVisible()

    // Rx notice
    await expect(page.getByText("Prescription required").first()).toBeVisible()

    // Add to cart button
    await expect(page.getByRole("button", { name: /Add to cart/ })).toBeVisible()

    // Medicine Details section
    await expect(page.getByText("Medicine Details")).toBeVisible()
    await expect(page.getByText("tablet")).toBeVisible()
  })

  test("search works from homepage", async ({ page }) => {
    await page.goto("/in")
    const searchBox = page.getByPlaceholder(/Search for medicines/)
    await searchBox.fill("paracetamol")
    await searchBox.press("Enter")

    // Should navigate to search or show results
    await page.waitForURL(/search|store/)
  })

  test("category navigation works", async ({ page }) => {
    await page.goto("/in/store")
    await page.getByRole("button", { name: "Wellness" }).click()

    // Should filter products — page should still work
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  })

  test("footer has compliance info", async ({ page }) => {
    await page.goto("/in")

    // Scroll to footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

    // Check compliance links in the footer specifically
    const footer = page.locator("footer")
    await expect(footer.getByRole("link", { name: "Pharmacy Licenses" })).toBeVisible()
    await expect(footer.getByRole("link", { name: "Privacy Policy (DPDP)" })).toBeVisible()
    await expect(footer.getByRole("link", { name: "Prescription Policy" })).toBeVisible()
    await expect(footer.getByRole("link", { name: "Grievance Officer" })).toBeVisible()
  })

  test("compliance pages load", async ({ page }) => {
    for (const path of ["/terms", "/privacy", "/returns", "/prescription-policy"]) {
      const res = await page.goto(path)
      expect(res?.status()).toBeLessThan(400)
    }
  })
})
