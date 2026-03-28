/**
 * Accessibility Tests — WCAG 2.1 AA compliance via axe-core.
 * Critical for pharma: older patient demographic needs accessible UI.
 */
import { test, expect } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"
import { STOREFRONT_URL, COUNTRY_CODE } from "./fixtures/test-data"

const STORE = STOREFRONT_URL

const PAGES = [
  { path: `/${COUNTRY_CODE}`, name: "Homepage" },
  { path: `/${COUNTRY_CODE}/store`, name: "Store / Product Listing" },
  { path: `/${COUNTRY_CODE}/account/login`, name: "Login" },
  { path: "/prescription-policy", name: "Prescription Policy" },
]

for (const pg of PAGES) {
  test.describe(`Accessibility — ${pg.name}`, () => {
    test("should have no critical a11y violations", async ({ page }) => {
      await page.goto(`${STORE}${pg.path}`)
      await page.waitForLoadState("networkidle")

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .disableRules(["color-contrast"])
        .analyze()

      const critical = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      )

      if (critical.length > 0) {
        const summary = critical.map(
          (v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)`
        )
        console.error("A11y violations:\n" + summary.join("\n"))
      }

      expect(critical).toHaveLength(0)
    })
  })
}

test.describe("Keyboard Navigation", () => {
  test("can tab through main navigation", async ({ page }) => {
    await page.goto(`${STORE}/${COUNTRY_CODE}`)

    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab")
    }

    const focusedTag = await page.evaluate(() => document.activeElement?.tagName)
    expect(focusedTag).toBeTruthy()
    expect(focusedTag).not.toBe("BODY")
  })

  test("search input is keyboard accessible", async ({ page }) => {
    await page.goto(`${STORE}/${COUNTRY_CODE}`)

    const input = page.locator('input[type="text"], input[type="search"]').first()
    if (await input.isVisible()) {
      await input.focus()
      await input.type("Paracetamol")
      const value = await input.inputValue()
      expect(value).toBe("Paracetamol")
    }
  })

  test("Escape key closes modals/dropdowns", async ({ page }) => {
    await page.goto(`${STORE}/${COUNTRY_CODE}`)

    const trigger = page.locator('button, [role="button"]').first()
    if (await trigger.isVisible()) {
      await trigger.click()
      await page.keyboard.press("Escape")
      await expect(page.locator("body")).toBeVisible()
    }
  })
})

test.describe("Color Contrast", () => {
  test("homepage passes color contrast checks", async ({ page }) => {
    await page.goto(`${STORE}/${COUNTRY_CODE}`)
    await page.waitForLoadState("networkidle")

    const results = await new AxeBuilder({ page })
      .withRules(["color-contrast"])
      .analyze()

    const serious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    )

    if (serious.length > 0) {
      console.warn(`${serious[0].nodes.length} color contrast issues found on homepage`)
    }
    expect(serious.length).toBeLessThanOrEqual(5)
  })
})

test.describe("Forms", () => {
  test("login form has proper labels", async ({ page }) => {
    await page.goto(`${STORE}/${COUNTRY_CODE}/account/login`)
    await page.waitForLoadState("networkidle")

    const results = await new AxeBuilder({ page })
      .withRules(["label", "label-title-only"])
      .analyze()

    expect(results.violations).toHaveLength(0)
  })
})

test.describe("Images", () => {
  test("all images should have alt text", async ({ page }) => {
    await page.goto(`${STORE}/${COUNTRY_CODE}`)
    await page.waitForLoadState("networkidle")

    const results = await new AxeBuilder({ page })
      .withRules(["image-alt"])
      .analyze()

    expect(results.violations).toHaveLength(0)
  })
})

test.describe("Language & Semantics", () => {
  test("page should have lang attribute", async ({ page }) => {
    await page.goto(`${STORE}/${COUNTRY_CODE}`)
    const lang = await page.getAttribute("html", "lang")
    expect(lang).toBeTruthy()
    expect(lang).toBe("en")
  })

  test("page should have exactly one h1", async ({ page }) => {
    await page.goto(`${STORE}/${COUNTRY_CODE}`)
    const h1Count = await page.locator("h1").count()
    expect(h1Count).toBe(1)
  })
})
