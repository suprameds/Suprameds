import { describe, it, expect } from "vitest"
import type { ErrorEvent, Exception } from "@sentry/react"
import { isExtensionNoise, isZarazNoise } from "@/lib/utils/sentry-filters"

function makeEvent(exception: Exception): ErrorEvent {
  return { exception: { values: [exception] } } as ErrorEvent
}

describe("isExtensionNoise", () => {
  it("returns true for SUPRAMEDS-G shape: onerror with single page-HTML frame", () => {
    const event = makeEvent({
      type: "TypeError",
      value: "Cannot read properties of null (reading 'document')",
      mechanism: { type: "onerror", handled: false },
      stacktrace: {
        frames: [{ filename: "/prescription-policy", function: "c", lineno: 89, colno: 75 }],
      },
    })
    expect(isExtensionNoise(event)).toBe(true)
  })

  it("returns false when any frame is in a Vite asset chunk", () => {
    const event = makeEvent({
      type: "TypeError",
      value: "Cannot read properties of undefined",
      mechanism: { type: "onerror", handled: false },
      stacktrace: {
        frames: [
          { filename: "/assets/index-abc123.js", function: "renderRoute", lineno: 12, colno: 4 },
        ],
      },
    })
    expect(isExtensionNoise(event)).toBe(false)
  })

  it("returns false when mechanism is not onerror (e.g. React error boundary)", () => {
    const event = makeEvent({
      type: "TypeError",
      value: "boom",
      mechanism: { type: "generic", handled: true },
      stacktrace: { frames: [{ filename: "/some-route", function: "c" }] },
    })
    expect(isExtensionNoise(event)).toBe(false)
  })

  it("returns false when there is no exception", () => {
    expect(isExtensionNoise({} as ErrorEvent)).toBe(false)
  })

  it("returns false when stack frames are missing or empty", () => {
    const event = makeEvent({
      type: "TypeError",
      value: "boom",
      mechanism: { type: "onerror", handled: false },
      stacktrace: { frames: [] },
    })
    expect(isExtensionNoise(event)).toBe(false)
  })

  it("returns false when a frame has no filename", () => {
    const event = makeEvent({
      type: "TypeError",
      value: "boom",
      mechanism: { type: "onerror", handled: false },
      stacktrace: { frames: [{ function: "anon" }] },
    })
    expect(isExtensionNoise(event)).toBe(false)
  })

  it("returns false when a frame ends in .mjs (real ESM chunk)", () => {
    const event = makeEvent({
      type: "TypeError",
      value: "boom",
      mechanism: { type: "onerror", handled: false },
      stacktrace: {
        frames: [{ filename: "/build/entry-client.mjs", function: "x" }],
      },
    })
    expect(isExtensionNoise(event)).toBe(false)
  })
})

describe("isZarazNoise", () => {
  it("returns true for Zaraz circular-JSON unhandled rejection (SUPRAMEDS-J/P shape)", () => {
    const event = makeEvent({
      type: "TypeError",
      value: "Converting circular structure to JSON\n    --> starting at object with constructor 'HTMLAnchorElement'",
      mechanism: { type: "onunhandledrejection", handled: false },
      stacktrace: {
        frames: [
          { filename: "/assets/analytics-DcbJGzxu.js", function: "pushDataLayer" },
          { filename: "/cdn-cgi/zaraz/s.js", function: "zaraz._processDataLayer" },
          { filename: "/cdn-cgi/zaraz/s.js", function: "zaraz.track" },
        ],
      },
    })
    expect(isZarazNoise(event)).toBe(true)
  })

  it("returns false when circular JSON does not involve Zaraz", () => {
    const event = makeEvent({
      type: "TypeError",
      value: "Converting circular structure to JSON",
      mechanism: { type: "onunhandledrejection", handled: false },
      stacktrace: {
        frames: [{ filename: "/assets/main-abc.js", function: "serialize" }],
      },
    })
    expect(isZarazNoise(event)).toBe(false)
  })

  it("returns false when Zaraz frame is present but error is unrelated", () => {
    const event = makeEvent({
      type: "TypeError",
      value: "Cannot read properties of null",
      mechanism: { type: "onunhandledrejection", handled: false },
      stacktrace: {
        frames: [{ filename: "/cdn-cgi/zaraz/s.js", function: "zaraz.track" }],
      },
    })
    expect(isZarazNoise(event)).toBe(false)
  })

  it("returns false when there is no exception", () => {
    expect(isZarazNoise({} as ErrorEvent)).toBe(false)
  })
})
