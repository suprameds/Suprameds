import { describe, it, expect } from "vitest"
import { isStripe, isManual, isPaytm, isRazorpay, getActivePaymentSession, isPaidWithGiftCard } from "@/lib/utils/checkout"
import type { HttpTypes } from "@medusajs/types"

describe("isStripe", () => {
  it("returns true for pp_stripe_ prefix", () => {
    expect(isStripe("pp_stripe_card")).toBe(true)
  })

  it("returns true for literal 'stripe'", () => {
    expect(isStripe("stripe")).toBe(true)
  })

  it("returns false for manual provider", () => {
    expect(isStripe("pp_system_default")).toBe(false)
  })

  it("returns undefined/false for undefined", () => {
    expect(isStripe(undefined)).toBeFalsy()
  })
})

describe("isManual", () => {
  it("returns true for pp_system_default", () => {
    expect(isManual("pp_system_default")).toBe(true)
  })

  it("returns true for pp_system_default_default", () => {
    expect(isManual("pp_system_default_default")).toBe(true)
  })

  it("returns true for literal 'manual'", () => {
    expect(isManual("manual")).toBe(true)
  })

  it("returns false for stripe", () => {
    expect(isManual("pp_stripe_card")).toBe(false)
  })

  it("returns false for razorpay", () => {
    expect(isManual("pp_razorpay_live")).toBe(false)
  })

  it("returns undefined/false for undefined", () => {
    expect(isManual(undefined)).toBeFalsy()
  })
})

describe("isPaytm", () => {
  it("returns true for pp_paytm_ prefix", () => {
    expect(isPaytm("pp_paytm_paytm")).toBe(true)
  })

  it("returns true for literal 'paytm'", () => {
    expect(isPaytm("paytm")).toBe(true)
  })

  it("returns false for manual", () => {
    expect(isPaytm("pp_system_default")).toBe(false)
  })

  it("returns false for razorpay", () => {
    expect(isPaytm("pp_razorpay_live")).toBe(false)
  })
})

describe("isRazorpay", () => {
  it("returns true for pp_razorpay_ prefix", () => {
    expect(isRazorpay("pp_razorpay_live")).toBe(true)
  })

  it("returns true for literal 'razorpay'", () => {
    expect(isRazorpay("razorpay")).toBe(true)
  })

  it("returns false for manual", () => {
    expect(isRazorpay("pp_system_default")).toBe(false)
  })
})

describe("getActivePaymentSession", () => {
  it("returns the pending session", () => {
    const cart = {
      payment_collection: {
        payment_sessions: [
          { id: "ps_1", provider_id: "pp_system_default", status: "pending", amount: 100 },
          { id: "ps_2", provider_id: "pp_stripe_card", status: "authorized", amount: 100 },
        ],
      },
    } as unknown as HttpTypes.StoreCart

    const session = getActivePaymentSession(cart)
    expect(session?.id).toBe("ps_1")
    expect(session?.status).toBe("pending")
  })

  it("returns undefined when no pending sessions", () => {
    const cart = {
      payment_collection: {
        payment_sessions: [
          { id: "ps_1", provider_id: "pp_stripe_card", status: "authorized", amount: 100 },
        ],
      },
    } as unknown as HttpTypes.StoreCart

    expect(getActivePaymentSession(cart)).toBeUndefined()
  })

  it("returns undefined when no payment_sessions at all", () => {
    const cart = {
      payment_collection: { payment_sessions: [] },
    } as unknown as HttpTypes.StoreCart

    expect(getActivePaymentSession(cart)).toBeUndefined()
  })

  it("returns undefined when payment_collection is missing", () => {
    const cart = {} as unknown as HttpTypes.StoreCart
    expect(getActivePaymentSession(cart)).toBeUndefined()
  })
})

describe("isPaidWithGiftCard", () => {
  it("returns true when total is 0 and gift_cards exist", () => {
    const cart = {
      gift_cards: [{ id: "gc_1" }],
      total: 0,
    } as unknown as HttpTypes.StoreCart

    expect(isPaidWithGiftCard(cart)).toBe(true)
  })

  it("returns false when total > 0", () => {
    const cart = {
      gift_cards: [{ id: "gc_1" }],
      total: 100,
    } as unknown as HttpTypes.StoreCart

    expect(isPaidWithGiftCard(cart)).toBe(false)
  })

  it("returns false when no gift cards", () => {
    const cart = {
      gift_cards: [],
      total: 0,
    } as unknown as HttpTypes.StoreCart

    expect(isPaidWithGiftCard(cart)).toBeFalsy()
  })
})
