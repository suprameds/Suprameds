import { stateNameToCode, getSellerStateCode, VALID_STATE_CODES } from "../gst-state-codes"

describe("gst-state-codes", () => {
  describe("stateNameToCode", () => {
    it("returns correct code for exact state name", () => {
      expect(stateNameToCode("Telangana")).toBe("36")
      expect(stateNameToCode("Maharashtra")).toBe("27")
      expect(stateNameToCode("Tamil Nadu")).toBe("33")
      expect(stateNameToCode("Delhi")).toBe("07")
    })

    it("is case-insensitive", () => {
      expect(stateNameToCode("telangana")).toBe("36")
      expect(stateNameToCode("TELANGANA")).toBe("36")
      expect(stateNameToCode("Telangana")).toBe("36")
    })

    it("trims whitespace", () => {
      expect(stateNameToCode("  Telangana  ")).toBe("36")
    })

    it("returns null for unknown state", () => {
      expect(stateNameToCode("Atlantis")).toBeNull()
      expect(stateNameToCode("Unknown State")).toBeNull()
    })

    it("returns null for empty/null/undefined", () => {
      expect(stateNameToCode("")).toBeNull()
      expect(stateNameToCode(null)).toBeNull()
      expect(stateNameToCode(undefined)).toBeNull()
      expect(stateNameToCode("   ")).toBeNull()
    })

    it("resolves city aliases", () => {
      expect(stateNameToCode("Hyderabad")).toBe("36")
      expect(stateNameToCode("Mumbai")).toBe("27")
      expect(stateNameToCode("Chennai")).toBe("33")
      expect(stateNameToCode("Kolkata")).toBe("19")
    })

    it("resolves state abbreviations", () => {
      expect(stateNameToCode("TS")).toBe("36")
      expect(stateNameToCode("MH")).toBe("27")
      expect(stateNameToCode("TN")).toBe("33")
    })
  })

  describe("getSellerStateCode", () => {
    it("defaults to Telangana (36)", () => {
      const original = process.env.WAREHOUSE_STATE
      delete process.env.WAREHOUSE_STATE
      expect(getSellerStateCode()).toBe("36")
      if (original) process.env.WAREHOUSE_STATE = original
    })
  })

  describe("VALID_STATE_CODES", () => {
    it("contains expected codes", () => {
      expect(VALID_STATE_CODES.has("36")).toBe(true) // Telangana
      expect(VALID_STATE_CODES.has("27")).toBe(true) // Maharashtra
      expect(VALID_STATE_CODES.has("99")).toBe(false)
    })
  })
})
