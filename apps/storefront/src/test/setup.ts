import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

afterEach(() => {
  cleanup()
})

// Stub import.meta.env for tests
vi.stubGlobal("import.meta", {
  env: { DEV: true, VITE_MEDUSA_BACKEND_URL: "http://localhost:9000" },
})

// Suppress "not wrapped in act" warnings in test output
const originalConsoleError = console.error
console.error = (...args: unknown[]) => {
  const msg = typeof args[0] === "string" ? args[0] : ""
  if (msg.includes("act(")) return
  originalConsoleError(...args)
}
