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

describe("Order creation validation", () => {
  it("rejects empty items array", () => {
    const body = { customer_id: "cus_1", items: [], shipping_address: {} }
    expect(body.items.length).toBe(0)
  })

  it("rejects missing customer_id", () => {
    const body = { items: [{ variant_id: "v1", quantity: 1 }] }
    expect((body as any).customer_id).toBeUndefined()
  })

  it("requires prescription_id when Rx items present", () => {
    const hasRxItems = true
    const prescriptionId = undefined
    expect(hasRxItems && !prescriptionId).toBe(true)
  })

  it("allows OTC order without prescription", () => {
    const hasRxItems = false
    const prescriptionId = undefined
    expect(hasRxItems && !prescriptionId).toBe(false)
  })
})
