/**
 * Visual Regression Tests — screenshot comparison to catch unintended UI changes.
 *
 * First run:   pnpm test:visual          (creates baseline snapshots)
 * Check runs:  pnpm test:visual:check    (compares against baselines)
 */
import { test, expect } from "@playwright/test"
import { STOREFRONT_URL, COUNTRY_CODE } from "./fixtures/test-data"

const STORE = STOREFRONT_URL

async function waitForStable(page: any) {
  await page.waitForLoadState("networkidle")
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(500)
}

test.describe("Visual Regression — Homepage", () => {
  test("hero section", async ({ page }) => {
    await page.goto(`${STORE}/${COUNTRY_CODE}`)
    await waitForStable(page)

    await expect(page).toHaveScreenshot("homepage-hero.png", {
      fullPage: false,
      maxDiffPixelRatio: 0.02,
    })
  })

  test("full homepage", async ({ page }) => {
    await page.goto(`${STORE}/${COUNTRY_CODE}`)
    await waitForStable(page)

    await expect(page).toHaveScreenshot("homepage-full.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    })
  })
})

test.describe("Visual Regression — Store Page", () => {
  test("product listing page", async ({ page }) => {
    await page.goto(`${STORE}/${COUNTRY_CODE}/store`)
    await waitForStable(page)

    await expect(page).toHaveScreenshot("store-listing.png", {
      fullPage: false,
      maxDiffPixelRatio: 0.02,
    })
  })
})

test.describe("Visual Regression — Navigation", () => {
  test("navbar default state", async ({ page }) => {
    await page.goto(`${STORE}/${COUNTRY_CODE}`)
    await waitForStable(page)

    const nav = page.locator("nav").first()
    await expect(nav).toHaveScreenshot("navbar-default.png")
  })

  test("navbar scrolled state", async ({ page }) => {
    await page.goto(`${STORE}/${COUNTRY_CODE}`)
    await waitForStable(page)

    await page.evaluate(() => window.scrollBy(0, 300))
    await page.waitForTimeout(500)

    const nav = page.locator("nav").first()
    await expect(nav).toHaveScreenshot("navbar-scrolled.png")
  })
})

test.describe("Visual Regression — Footer", () => {
  test("footer layout", async ({ page }) => {
    await page.goto(`${STORE}/${COUNTRY_CODE}`)
    await waitForStable(page)

    const footer = page.locator("footer").first()
    await footer.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)

    await expect(footer).toHaveScreenshot("footer.png")
  })
})

test.describe("Visual Regression — Mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test("homepage mobile", async ({ page }) => {
    await page.goto(`${STORE}/${COUNTRY_CODE}`)
    await waitForStable(page)

    await expect(page).toHaveScreenshot("homepage-mobile.png", {
      fullPage: false,
      maxDiffPixelRatio: 0.03,
    })
  })
})
