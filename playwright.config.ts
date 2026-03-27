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
    { name: "chromium", use: { browserName: "chromium" } },
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
