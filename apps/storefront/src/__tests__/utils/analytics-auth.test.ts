import { describe, it, expect, beforeEach, vi } from "vitest"

// Mock the ad-attribution module before importing analytics so the mock wins.
vi.mock("@/lib/utils/ad-attribution", () => ({
  getAdAttribution: vi.fn(() => ({
    gclid: "TEST_GCLID",
    utm_source: "google",
    utm_medium: "cpc",
    captured_at: 123,
  })),
}))

import { trackSignup, trackLogin } from "@/lib/utils/analytics"

describe("analytics auth events", () => {
  const gtagSpy = vi.fn()
  const fbqSpy = vi.fn()

  beforeEach(() => {
    gtagSpy.mockReset()
    fbqSpy.mockReset()
    window.gtag = gtagSpy as unknown as typeof window.gtag
    window.fbq = fbqSpy as unknown as typeof window.fbq
    window.dataLayer = []
  })

  describe("trackSignup", () => {
    it("fires GA4 sign_up with method and ad attribution", async () => {
      await trackSignup({ method: "email", userId: "cus_1" })
      const signupCall = gtagSpy.mock.calls.find((c) => c[0] === "event" && c[1] === "sign_up")
      expect(signupCall).toBeDefined()
      expect(signupCall![2]).toMatchObject({
        method: "email",
        user_id: "cus_1",
        gclid: "TEST_GCLID",
        utm_source: "google",
      })
    })

    it("fires Meta Pixel CompleteRegistration", async () => {
      await trackSignup({ method: "phone-otp" })
      expect(fbqSpy).toHaveBeenCalledWith("track", "CompleteRegistration", {
        registration_method: "phone-otp",
      })
    })

    it("pushes sign_up to dataLayer", async () => {
      await trackSignup({ method: "email-otp", userId: "cus_2" })
      const ev = window.dataLayer!.find((e: any) => e.event === "sign_up")
      expect(ev).toMatchObject({
        event: "sign_up",
        method: "email-otp",
        user_id: "cus_2",
        gclid: "TEST_GCLID",
      })
    })
  })

  describe("trackLogin", () => {
    it("fires GA4 login event with method and attribution", async () => {
      await trackLogin({ method: "email", userId: "cus_3" })
      const loginCall = gtagSpy.mock.calls.find((c) => c[0] === "event" && c[1] === "login")
      expect(loginCall).toBeDefined()
      expect(loginCall![2]).toMatchObject({
        method: "email",
        user_id: "cus_3",
        utm_medium: "cpc",
      })
    })

    it("does not fire Meta Pixel CompleteRegistration on login", async () => {
      await trackLogin({ method: "phone-otp" })
      expect(fbqSpy).not.toHaveBeenCalledWith(
        "track",
        "CompleteRegistration",
        expect.anything(),
      )
    })
  })
})
