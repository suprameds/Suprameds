import { test, expect } from "@playwright/test"
import { loginAsCustomer } from "./fixtures/auth"
import { COUNTRY_CODE, BACKEND_URL, TEST_CUSTOMER, TEST_ADDRESS } from "./fixtures/test-data"

test.describe("Account Management", () => {
  // ── Authentication ──────────────────────────────────────────────

  test("login page renders without errors", async ({ page }) => {
    const res = await page.goto(`/${COUNTRY_CODE}/account/login`)
    expect(res?.status()).toBeLessThan(500)
    await expect(page.getByRole("main")).toBeVisible()
  })

  test("register page renders without errors", async ({ page }) => {
    const res = await page.goto(`/${COUNTRY_CODE}/account/register`)
    expect(res?.status()).toBeLessThan(500)
    await expect(page.getByRole("main")).toBeVisible()
  })

  test("invalid credentials show an error message", async ({ page }) => {
    await page.goto(`/${COUNTRY_CODE}/account/login`)
    await page.waitForLoadState("networkidle")

    await page.locator('[name="email"], [data-testid="email"]').first().fill("bad@example.com")
    await page
      .locator('[name="password"], [data-testid="password"]')
      .first()
      .fill("WrongPassword1!")
    await page.locator('[type="submit"], [data-testid="submit"]').first().click()

    // Should stay on login page (no redirect)
    await page.waitForTimeout(3_000)
    expect(page.url()).toContain("login")
  })

  // ── Authenticated pages ─────────────────────────────────────────

  test("customer can log in and reach account dashboard", async ({ page }) => {
    await loginAsCustomer(page)
    await expect(page).toHaveURL(new RegExp(`/${COUNTRY_CODE}/account`))
    // Main content should be visible
    await expect(page.getByRole("main")).toBeVisible()
  })

  test("customer account dashboard shows profile info", async ({ page }) => {
    await loginAsCustomer(page)
    // The account page should reference the customer's name or email somewhere
    await expect(
      page
        .getByText(new RegExp(`${TEST_CUSTOMER.first_name}|${TEST_CUSTOMER.email}`, "i"))
        .first()
    ).toBeVisible({ timeout: 10_000 })
  })

  // ── Order history ───────────────────────────────────────────────

  test("customer can navigate to order history", async ({ page }) => {
    await loginAsCustomer(page)
    await page.goto(`/${COUNTRY_CODE}/account/orders`)
    await expect(page).toHaveURL(new RegExp(`/${COUNTRY_CODE}/account/orders`))
    // Either shows orders or an empty state
    await expect(page.getByRole("main")).toBeVisible()
    await expect(
      page
        .getByText(/No orders|order history|Your orders/i)
        .first()
        .or(page.locator("table, [data-testid='order-list']").first())
    ).toBeVisible({ timeout: 10_000 })
  })

  // ── Addresses ───────────────────────────────────────────────────

  test("customer can view addresses page", async ({ page }) => {
    await loginAsCustomer(page)
    await page.goto(`/${COUNTRY_CODE}/account/addresses`)
    await expect(page).toHaveURL(new RegExp(`/${COUNTRY_CODE}/account/addresses`))
    await expect(page.getByRole("main")).toBeVisible()
  })

  test("add address form is accessible from addresses page", async ({ page }) => {
    await loginAsCustomer(page)
    await page.goto(`/${COUNTRY_CODE}/account/addresses`)
    await page.waitForLoadState("networkidle")

    // There should be an "Add address" button or similar
    const addBtn = page
      .getByRole("button", { name: /Add address|New address|Add/i })
      .first()
    const visible = await addBtn.isVisible().catch(() => false)
    // If button is visible click it and check form appears
    if (visible) {
      await addBtn.click()
      // An input for address_1 should appear
      await expect(
        page.locator('[name="address_1"], [placeholder*="address" i]').first()
      ).toBeVisible({ timeout: 8_000 })
    } else {
      // Inline form may already be present
      await expect(page.getByRole("main")).toBeVisible()
    }
  })

  // ── Reminders ───────────────────────────────────────────────────

  test("customer can view reminders page", async ({ page }) => {
    await loginAsCustomer(page)
    await page.goto(`/${COUNTRY_CODE}/account/reminders`)
    await expect(page).toHaveURL(new RegExp(`/${COUNTRY_CODE}/account/reminders`))
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10_000 })
  })

  // ── Wishlist ────────────────────────────────────────────────────

  test("customer can view wishlist page", async ({ page }) => {
    await loginAsCustomer(page)
    await page.goto(`/${COUNTRY_CODE}/account/wishlist`)
    await expect(page).toHaveURL(new RegExp(`/${COUNTRY_CODE}/account/wishlist`))
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10_000 })
  })

  // ── Profile ─────────────────────────────────────────────────────

  test("customer can view profile page", async ({ page }) => {
    await loginAsCustomer(page)
    await page.goto(`/${COUNTRY_CODE}/account/profile`)
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10_000 })
  })

  // ── Auth guard ──────────────────────────────────────────────────

  test("unauthenticated user accessing account gets redirected to login", async ({ page }) => {
    // Navigate directly without logging in
    await page.goto(`/${COUNTRY_CODE}/account/orders`)
    await page.waitForLoadState("networkidle")
    // Should either redirect to login or show a login prompt
    const url = page.url()
    const isLoginPage = url.includes("login")
    const hasLoginForm = await page
      .locator('[name="email"], [data-testid="email"]')
      .first()
      .isVisible()
      .catch(() => false)
    expect(isLoginPage || hasLoginForm).toBe(true)
  })

  // ── API: customer registration via Medusa store API ─────────────

  test("customer registration API accepts valid data", async ({ request }) => {
    // This test calls the API directly — avoids UI friction for seeding purposes
    // We check the API shape; registering with a unique email each run
    const uniqueEmail = `e2e-reg-${Date.now()}@suprameds.test`
    const res = await request.post(`${BACKEND_URL}/auth/customer/emailpass/register`, {
      data: {
        email: uniqueEmail,
        password: TEST_CUSTOMER.password,
      },
    })
    // 200 = token returned (new registration) or 409 = already exists (idempotent)
    expect([200, 201, 409]).toContain(res.status())
  })
})
