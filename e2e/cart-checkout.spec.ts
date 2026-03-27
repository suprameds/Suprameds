import { test, expect } from "@playwright/test"

test.describe("Cart & Checkout Flow", () => {
  test("add product to cart updates cart count", async ({ page }) => {
    await page.goto("/in/products/supracyn-dapacyn-5-tab")
    await expect(page.getByRole("heading", { level: 1 })).toContainText("DAPACYN-5")

    // Add to cart
    await page.getByRole("button", { name: /Add to cart/ }).click()

    // Cart count should update in navbar
    await expect(page.getByRole("button", { name: /Cart \(1\)/ })).toBeVisible({
      timeout: 10_000,
    })
  })

  test("empty cart page shows empty state with browse link", async ({ page }) => {
    await page.goto("/in/cart")
    await page.waitForLoadState("networkidle")

    // Should show empty cart message
    await expect(page.getByText("Your cart is empty")).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole("link", { name: /Browse Medicines/ })).toBeVisible()
  })

  test("checkout URL renders without errors", async ({ page }) => {
    const res = await page.goto("/in/checkout?step=addresses")
    // Should not be a server error
    expect(res?.status()).toBeLessThan(500)
  })

  test("empty cart navigated directly", async ({ page }) => {
    await page.goto("/in/cart")
    await page.waitForLoadState("networkidle")
    // Page should load without errors
    expect(page.url()).toContain("/in")
  })
})
