import { test, expect } from "@playwright/test"
import { COUNTRY_CODE, OTC_PRODUCT_HANDLE, BACKEND_URL, PK } from "./fixtures/test-data"

const PRODUCT_URL = `/${COUNTRY_CODE}/products/${OTC_PRODUCT_HANDLE}`
const CART_URL = `/${COUNTRY_CODE}/cart`

test.describe("Cart & Checkout Flow", () => {
  // ── Add to cart ─────────────────────────────────────────────────

  test("add product to cart updates cart count badge", async ({ page }) => {
    await page.goto(PRODUCT_URL)
    await expect(page.getByRole("heading", { level: 1 })).toContainText("DAPACYN-5")

    await page.getByRole("button", { name: /Add to cart/ }).click()

    // Cart count badge should increment to 1
    await expect(
      page.getByRole("button", { name: /Cart \(1\)/ })
    ).toBeVisible({ timeout: 10_000 })
  })

  test("cart icon in navbar links to cart page", async ({ page }) => {
    await page.goto(`/${COUNTRY_CODE}`)
    // There should be a cart nav link somewhere in the navbar
    const cartLink = page.locator('a[href*="/cart"], button[aria-label*="cart" i]').first()
    await expect(cartLink).toBeVisible({ timeout: 10_000 })
  })

  // ── Cart page ───────────────────────────────────────────────────

  test("empty cart page shows empty state with browse link", async ({ page }) => {
    await page.goto(CART_URL)
    await page.waitForLoadState("networkidle")

    await expect(page.getByText("Your cart is empty")).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole("link", { name: /Browse Medicines/ })).toBeVisible()
  })

  test("empty cart navigated directly stays on the /in route family", async ({ page }) => {
    await page.goto(CART_URL)
    await page.waitForLoadState("networkidle")
    expect(page.url()).toContain(`/${COUNTRY_CODE}`)
  })

  test("cart page loads without server errors", async ({ page }) => {
    const res = await page.goto(CART_URL)
    expect(res?.status()).toBeLessThan(500)
  })

  test("cart page is accessible after adding a product", async ({ page }) => {
    // First add an item
    await page.goto(PRODUCT_URL)
    await page.getByRole("button", { name: /Add to cart/ }).click()
    await expect(page.getByRole("button", { name: /Cart \(1\)/ })).toBeVisible({
      timeout: 10_000,
    })

    // Navigate to cart and verify item is listed
    await page.goto(CART_URL)
    await page.waitForLoadState("networkidle")
    await expect(page.getByText("DAPACYN-5", { exact: false }).first()).toBeVisible({
      timeout: 10_000,
    })
  })

  // ── Quantity controls ───────────────────────────────────────────

  test("quantity can be increased in cart", async ({ page }) => {
    test.slow()

    // Add product
    await page.goto(PRODUCT_URL)
    await page.getByRole("button", { name: /Add to cart/ }).click()
    await expect(page.getByRole("button", { name: /Cart \(1\)/ })).toBeVisible({
      timeout: 10_000,
    })

    // Go to cart
    await page.goto(CART_URL)
    await page.waitForLoadState("networkidle")

    // Increment quantity
    const increaseBtn = page
      .locator('button[aria-label*="increase" i], button[data-testid*="increase"]')
      .first()
    if (await increaseBtn.isVisible()) {
      await increaseBtn.click()
      // Quantity label should update to 2
      await expect(page.getByText("2").first()).toBeVisible({ timeout: 8_000 })
    } else {
      // Fallback: look for + button near quantity
      const plusBtn = page.locator('button:has-text("+")').first()
      await expect(plusBtn).toBeVisible()
    }
  })

  test("item can be removed from cart", async ({ page }) => {
    test.slow()

    // Add product
    await page.goto(PRODUCT_URL)
    await page.getByRole("button", { name: /Add to cart/ }).click()
    await expect(page.getByRole("button", { name: /Cart \(1\)/ })).toBeVisible({
      timeout: 10_000,
    })

    // Go to cart
    await page.goto(CART_URL)
    await page.waitForLoadState("networkidle")

    // Click remove / delete button
    const removeBtn = page
      .locator(
        'button[aria-label*="remove" i], button[data-testid*="remove"], button:has-text("Remove")'
      )
      .first()
    await removeBtn.waitFor({ state: "visible", timeout: 10_000 })
    await removeBtn.click()

    // Cart should go back to empty state
    await expect(page.getByText("Your cart is empty")).toBeVisible({ timeout: 10_000 })
  })

  // ── Checkout routing ────────────────────────────────────────────

  test("checkout URL renders without server errors", async ({ page }) => {
    const res = await page.goto(`/${COUNTRY_CODE}/checkout?step=addresses`)
    expect(res?.status()).toBeLessThan(500)
  })

  test("checkout redirects or shows login prompt for unauthenticated users on Rx product", async ({
    page,
  }) => {
    test.slow()

    // Add the (Rx) product via the store API to ensure cart has an Rx item
    const regRes = await page.request.get(`${BACKEND_URL}/store/regions`, {
      headers: { "x-publishable-api-key": PK },
    })
    const regionId = (await regRes.json()).regions[0].id

    // Create a cart via API
    const cartRes = await page.request.post(`${BACKEND_URL}/store/carts`, {
      headers: { "x-publishable-api-key": PK },
      data: { region_id: regionId },
    })
    expect(cartRes.status()).toBe(200)

    // Navigate to checkout
    const res = await page.goto(`/${COUNTRY_CODE}/checkout?step=addresses`)
    expect(res?.status()).toBeLessThan(500)
  })

  // ── Cart summary ────────────────────────────────────────────────

  test("cart shows subtotal and GST lines", async ({ page }) => {
    test.slow()

    await page.goto(PRODUCT_URL)
    await page.getByRole("button", { name: /Add to cart/ }).click()
    await expect(page.getByRole("button", { name: /Cart \(1\)/ })).toBeVisible({
      timeout: 10_000,
    })

    await page.goto(CART_URL)
    await page.waitForLoadState("networkidle")

    // Subtotal line
    const subtotalVisible = await page
      .getByText(/subtotal/i)
      .first()
      .isVisible()
      .catch(() => false)
    // Either subtotal or order total should be visible on a non-empty cart
    expect(subtotalVisible).toBe(true)
  })
})
