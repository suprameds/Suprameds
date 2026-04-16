import { describe, it, expect } from "vitest"
import {
  FREE_DELIVERY_THRESHOLD,
  STANDARD_SHIPPING_CHARGE,
  isEligibleForFreeDelivery,
  calculateDeliveryRemaining,
} from "@/lib/utils/shipping"

describe("FREE_DELIVERY_THRESHOLD", () => {
  it("is 300 (INR)", () => {
    expect(FREE_DELIVERY_THRESHOLD).toBe(300)
  })
})

describe("STANDARD_SHIPPING_CHARGE", () => {
  it("is 50 (INR)", () => {
    expect(STANDARD_SHIPPING_CHARGE).toBe(50)
  })
})

describe("isEligibleForFreeDelivery", () => {
  it("returns true when subtotal equals threshold", () => {
    expect(isEligibleForFreeDelivery(300)).toBe(true)
  })

  it("returns true when subtotal exceeds threshold", () => {
    expect(isEligibleForFreeDelivery(500)).toBe(true)
  })

  it("returns false when subtotal is below threshold", () => {
    expect(isEligibleForFreeDelivery(299.99)).toBe(false)
  })

  it("returns false for zero", () => {
    expect(isEligibleForFreeDelivery(0)).toBe(false)
  })
})

describe("calculateDeliveryRemaining", () => {
  it("returns remaining amount to qualify", () => {
    expect(calculateDeliveryRemaining(200)).toBe(100)
  })

  it("returns 0 when already qualified", () => {
    expect(calculateDeliveryRemaining(300)).toBe(0)
  })

  it("returns 0 when over threshold", () => {
    expect(calculateDeliveryRemaining(500)).toBe(0)
  })

  it("returns full threshold when subtotal is 0", () => {
    expect(calculateDeliveryRemaining(0)).toBe(300)
  })
})
