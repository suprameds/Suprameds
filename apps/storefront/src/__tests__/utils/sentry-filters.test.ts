import { describe, it, expect } from "vitest"
import type { ErrorEvent, Exception } from "@sentry/react"
import { isExtensionNoise } from "@/lib/utils/sentry-filters"

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
