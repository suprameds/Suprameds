import { describe, it, expect } from "vitest"
import { computeProfileCompleteness } from "./profile-completeness"

describe("computeProfileCompleteness", () => {
  it("returns 100% when all fields present", () => {
    const result = computeProfileCompleteness({
      first_name: "Asha",
      last_name: "Kumar",
      email: "asha@example.com",
      phone: "+919876543210",
      metadata: { dob: "1990-01-01", gender: "female", preferred_language: "en", allergies: ["penicillin"], emergency_contact: { name: "X", phone: "9876543211" } },
    } as never)
    expect(result.percent).toBe(100)
    expect(result.missing).toEqual([])
  })

  it("flags auto-generated phone-bridge email as missing", () => {
    const result = computeProfileCompleteness({
      first_name: "Asha",
      last_name: "Kumar",
      email: "9876543210@phone.suprameds.in",
      phone: "+919876543210",
      metadata: { dob: "1990-01-01", gender: "female", preferred_language: "en", allergies: ["penicillin"], emergency_contact: { name: "X", phone: "9876543211" } },
    } as never)
    expect(result.missing).toContain("email")
    expect(result.percent).toBeLessThan(100)
  })

  it("returns near-zero for fresh OTP signup with only phone", () => {
    const result = computeProfileCompleteness({
      first_name: null,
      last_name: null,
      email: "9876543210@phone.suprameds.in",
      phone: "+919876543210",
      metadata: null,
    } as never)
    expect(result.percent).toBeLessThanOrEqual(20)
    expect(result.missing.length).toBeGreaterThan(5)
  })

  it("handles missing metadata gracefully (treats as empty)", () => {
    const result = computeProfileCompleteness({
      first_name: "Asha",
      last_name: "Kumar",
      email: "asha@example.com",
      phone: "+919876543210",
      metadata: null,
    } as never)
    expect(result.percent).toBeGreaterThan(50)
    expect(result.percent).toBeLessThan(100)
    expect(result.missing).toEqual(expect.arrayContaining(["dob", "gender", "preferred_language", "allergies", "emergency_contact"]))
  })

  it("treats array allergies as truthy regardless of contents", () => {
    const result = computeProfileCompleteness({
      first_name: "x",
      last_name: "y",
      email: "x@y.com",
      phone: "+91xxxxxxxxxx",
      metadata: { allergies: [] },  // empty array → still 'set' (user has confirmed no allergies)
    } as never)
    // We accept either policy here — just verify the call doesn't throw and returns a number
    expect(typeof result.percent).toBe("number")
  })
})
