import { normalizePhone } from "../api/store/pharmacist/customers/lookup/route"

describe("normalizePhone", () => {
  it("strips +91 prefix", () => {
    expect(normalizePhone("+919876543210")).toBe("9876543210")
  })

  it("strips 91 prefix from 12-digit number", () => {
    expect(normalizePhone("919876543210")).toBe("9876543210")
  })

  it("keeps 10-digit number as is", () => {
    expect(normalizePhone("9876543210")).toBe("9876543210")
  })

  it("strips non-digit characters", () => {
    expect(normalizePhone("987-654-3210")).toBe("9876543210")
    expect(normalizePhone("987 654 3210")).toBe("9876543210")
    expect(normalizePhone("(987) 654-3210")).toBe("9876543210")
  })

  it("returns empty string for short input", () => {
    expect(normalizePhone("12345")).toBe("")
    expect(normalizePhone("")).toBe("")
    expect(normalizePhone("abc")).toBe("")
  })
})
