import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // ─── DEFAULT E2E (desktop) ───
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },

    // ─── SMOKE TESTS (<60s deploy gate) ───
    {
      name: "smoke",
      testMatch: "smoke.spec.ts",
      use: { browserName: "chromium" },
      timeout: 15_000,
    },

    // ─── SECURITY TESTS ───
    {
      name: "security",
      testMatch: "security.spec.ts",
      use: { browserName: "chromium" },
      timeout: 15_000,
    },

    // ─── ACCESSIBILITY AUDIT (WCAG 2.1 AA) ───
    {
      name: "a11y",
      testMatch: "a11y.spec.ts",
      use: { browserName: "chromium" },
      timeout: 30_000,
    },

    // ─── VISUAL REGRESSION ───
    {
      name: "visual",
      testMatch: "visual.spec.ts",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
      },
      timeout: 30_000,
      expect: {
        toHaveScreenshot: {
          maxDiffPixelRatio: 0.01,
          threshold: 0.2,
        },
      },
    },

    // ─── MOBILE E2E (Pixel 7) ───
    {
      name: "mobile",
      testMatch: ["storefront-browse.spec.ts", "cart-checkout.spec.ts"],
      use: { ...devices["Pixel 7"] },
    },

    // ─── MOBILE E2E (iPhone 14) ───
    {
      name: "iphone",
      testMatch: ["storefront-browse.spec.ts", "cart-checkout.spec.ts"],
      use: { ...devices["iPhone 14"] },
    },
  ],

  webServer: process.env.CI
    ? [
        {
          command: "cd apps/backend && pnpm medusa start",
          url: "http://localhost:9000/health",
          reuseExistingServer: false,
          timeout: 120_000,
        },
        {
          command: "cd apps/storefront && pnpm preview",
          url: "http://localhost:5173",
          reuseExistingServer: false,
          timeout: 60_000,
        },
      ]
    : undefined,
})
