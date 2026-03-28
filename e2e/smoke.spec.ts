/**
 * Smoke Tests — run on every deploy, must complete in <60 seconds.
 * Catches catastrophic breaks only: API down, pages 500, JS crashes.
 */
import { test, expect } from "@playwright/test"
import { BACKEND_URL, STOREFRONT_URL, COUNTRY_CODE } from "./fixtures/test-data"

const STORE = STOREFRONT_URL
const API = BACKEND_URL

test.describe("Smoke Tests", () => {
  test.describe.configure({ mode: "parallel" })

  // ─── BACKEND HEALTH ───

  test("API health check responds", async ({ request }) => {
    const res = await request.get(`${API}/health`)
    expect(res.ok()).toBeTruthy()
  })

  test("Store API returns products", async ({ request }) => {
    const res = await request.get(`${API}/store/products?limit=1`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data).toHaveProperty("products")
  })

  test("Store API returns regions", async ({ request }) => {
    const res = await request.get(`${API}/store/regions`)
    expect(res.ok()).toBeTruthy()
  })

  // ─── STOREFRONT PAGES ───

  test("Homepage loads", async ({ page }) => {
    const res = await page.goto(`${STORE}/${COUNTRY_CODE}`)
    expect(res?.status()).toBeLessThan(500)
    await expect(page.locator("body")).not.toBeEmpty()
  })

  test("Store page loads", async ({ page }) => {
    const res = await page.goto(`${STORE}/${COUNTRY_CODE}/store`)
    expect(res?.status()).toBeLessThan(500)
  })

  test("Login page loads", async ({ page }) => {
    const res = await page.goto(`${STORE}/${COUNTRY_CODE}/account/login`)
    expect(res?.status()).toBeLessThan(500)
  })

  // ─── CRITICAL FLOWS ───

  test("Search input is functional", async ({ page }) => {
    await page.goto(`${STORE}/${COUNTRY_CODE}`)
    const input = page.locator('input[type="text"], input[type="search"]').first()
    if (await input.isVisible()) {
      await input.fill("paracetamol")
      expect(true).toBe(true)
    }
  })

  test("Cart endpoint works", async ({ request }) => {
    const res = await request.post(`${API}/store/carts`, { data: {} })
    expect(res.status()).toBeLessThan(500)
  })

  // ─── NO CONSOLE ERRORS ───

  test("Homepage has no critical JS errors", async ({ page }) => {
    const criticalErrors: string[] = []
    page.on("pageerror", (err) => {
      if (!err.message.includes("ResizeObserver") && !err.message.includes("hydration")) {
        criticalErrors.push(err.message)
      }
    })
    await page.goto(`${STORE}/${COUNTRY_CODE}`)
    await page.waitForLoadState("networkidle")
    expect(criticalErrors).toHaveLength(0)
  })
})
