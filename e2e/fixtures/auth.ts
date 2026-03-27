import { type Page } from "@playwright/test"
import { TEST_CUSTOMER, TEST_ADMIN, COUNTRY_CODE, BACKEND_URL } from "./test-data"

/**
 * Log in as the E2E test customer via the storefront login page.
 * Waits for the redirect to the account dashboard before returning.
 */
export async function loginAsCustomer(page: Page) {
  await page.goto(`/${COUNTRY_CODE}/account/login`)
  await page.waitForLoadState("networkidle")

  // Support both name= and data-testid= selectors in the login form
  const emailInput = page.locator('[name="email"], [data-testid="email"]').first()
  const passwordInput = page.locator('[name="password"], [data-testid="password"]').first()

  await emailInput.fill(TEST_CUSTOMER.email)
  await passwordInput.fill(TEST_CUSTOMER.password)
  await page.locator('[type="submit"], [data-testid="submit"]').first().click()

  await page.waitForURL(`**/${COUNTRY_CODE}/account**`, { timeout: 15_000 })
}

/**
 * Log in as the admin user via the Medusa admin login page.
 * Waits for the redirect into the admin UI before returning.
 */
export async function loginAsAdmin(page: Page) {
  await page.goto("/admin/login")
  await page.waitForLoadState("networkidle")

  await page.locator('[name="email"]').fill(TEST_ADMIN.email)
  await page.locator('[name="password"]').fill(TEST_ADMIN.password)
  await page.locator('[type="submit"]').click()

  await page.waitForURL("**/admin/**", { timeout: 15_000 })
}
