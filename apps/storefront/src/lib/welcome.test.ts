import { describe, it, expect, beforeEach } from "vitest"
import { markFreshSignup, consumeFreshSignup } from "./welcome"

describe("welcome flag", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it("consumeFreshSignup returns false when flag was never set", () => {
    expect(consumeFreshSignup()).toBe(false)
  })

  it("markFreshSignup → consumeFreshSignup returns true exactly once", () => {
    markFreshSignup()
    expect(consumeFreshSignup()).toBe(true)
    // Subsequent calls within the same session must return false — this is
    // what stops a refresh of /welcome from re-rendering the screen after
    // the user has clicked through.
    expect(consumeFreshSignup()).toBe(false)
  })

  it("consume clears the underlying storage entry", () => {
    markFreshSignup()
    consumeFreshSignup()
    expect(window.sessionStorage.getItem("suprameds_welcome_pending_v1")).toBeNull()
  })

  it("does not throw when sessionStorage access fails", () => {
    // Simulate a browser/embedded webview where setItem throws (quota,
    // privacy mode). The welcome flow should silently degrade — the user
    // signs up successfully but skips the welcome screen.
    const original = window.sessionStorage.setItem
    window.sessionStorage.setItem = () => {
      throw new Error("QuotaExceededError")
    }
    expect(() => markFreshSignup()).not.toThrow()
    window.sessionStorage.setItem = original
  })
})
