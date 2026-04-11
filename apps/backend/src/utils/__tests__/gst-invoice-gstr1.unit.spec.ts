import { calculateLineGst, isIntraState } from "../gst-invoice"

describe("GSTR-1 classification helpers", () => {
  describe("isIntraState", () => {
    it("returns true for same state", () => {
      expect(isIntraState("Telangana", "Telangana")).toBe(true)
    })

    it("is case-insensitive", () => {
      expect(isIntraState("Telangana", "telangana")).toBe(true)
      expect(isIntraState("TELANGANA", "telangana")).toBe(true)
    })

    it("returns false for different states", () => {
      expect(isIntraState("Telangana", "Maharashtra")).toBe(false)
      expect(isIntraState("Telangana", "Tamil Nadu")).toBe(false)
    })

    it("returns true for empty buyer state (defaults intra-state)", () => {
      expect(isIntraState("Telangana", "")).toBe(true)
    })

    it("trims whitespace", () => {
      expect(isIntraState("Telangana", "  Telangana  ")).toBe(true)
    })
  })

  describe("calculateLineGst — GSTR-1 tax split", () => {
    it("splits CGST+SGST for intra-state", () => {
      const result = calculateLineGst({
        quantity: 10,
        unit_selling_price: 100,
        gst_rate: 5,
        intra_state: true,
      })
      expect(result.igst).toBe(0)
      expect(result.cgst).toBeGreaterThan(0)
      expect(result.sgst).toBeGreaterThan(0)
      expect(result.cgst + result.sgst).toBeCloseTo(
        result.line_total - result.taxable_value,
        1
      )
    })

    it("uses IGST for inter-state", () => {
      const result = calculateLineGst({
        quantity: 10,
        unit_selling_price: 100,
        gst_rate: 5,
        intra_state: false,
      })
      expect(result.cgst).toBe(0)
      expect(result.sgst).toBe(0)
      expect(result.igst).toBeGreaterThan(0)
      expect(result.igst).toBeCloseTo(
        result.line_total - result.taxable_value,
        1
      )
    })

    it("handles 0% GST rate (nil-rated)", () => {
      const result = calculateLineGst({
        quantity: 5,
        unit_selling_price: 200,
        gst_rate: 0,
        intra_state: true,
      })
      expect(result.cgst).toBe(0)
      expect(result.sgst).toBe(0)
      expect(result.igst).toBe(0)
      expect(result.taxable_value).toBe(1000)
      expect(result.line_total).toBe(1000)
    })

    it("back-calculates tax-inclusive correctly at 5%", () => {
      // ₹105 inclusive at 5% → taxable = 100, GST = 5
      const result = calculateLineGst({
        quantity: 1,
        unit_selling_price: 105,
        gst_rate: 5,
        intra_state: true,
        tax_inclusive: true,
      })
      expect(result.taxable_value).toBe(100)
      expect(result.cgst + result.sgst).toBe(5)
    })

    it("back-calculates tax-inclusive correctly at 12%", () => {
      // ₹112 inclusive at 12% → taxable = 100, GST = 12
      const result = calculateLineGst({
        quantity: 1,
        unit_selling_price: 112,
        gst_rate: 12,
        intra_state: false,
        tax_inclusive: true,
      })
      expect(result.taxable_value).toBe(100)
      expect(result.igst).toBe(12)
    })
  })

  describe("B2C classification logic", () => {
    // B2C Large = inter-state invoice EXCEEDING ₹2,50,000
    it("classifies inter-state >2.5L as B2C Large", () => {
      const orderTotal = 300000 // ₹3,00,000
      const isInterState = true
      const isB2cLarge = isInterState && orderTotal > 250000
      expect(isB2cLarge).toBe(true)
    })

    it("classifies inter-state exactly at 2.5L as B2C Small (threshold is exceeding)", () => {
      const orderTotal = 250000
      const isInterState = true
      const isB2cLarge = isInterState && orderTotal > 250000
      expect(isB2cLarge).toBe(false)
    })

    it("classifies intra-state any amount as B2C Small", () => {
      const orderTotal = 500000
      const isInterState = false
      const isB2cLarge = isInterState && orderTotal > 250000
      expect(isB2cLarge).toBe(false)
    })

    it("classifies inter-state <2.5L as B2C Small", () => {
      const orderTotal = 100000
      const isInterState = true
      const isB2cLarge = isInterState && orderTotal > 250000
      expect(isB2cLarge).toBe(false)
    })
  })

  describe("HSN aggregation logic", () => {
    it("groups items by HSN code + rate", () => {
      const items = [
        { hsn_code: "30049099", gst_rate: 5, taxable_value: 100, cgst: 2.5, sgst: 2.5, igst: 0 },
        { hsn_code: "30049099", gst_rate: 5, taxable_value: 200, cgst: 5, sgst: 5, igst: 0 },
        { hsn_code: "30049060", gst_rate: 12, taxable_value: 150, cgst: 9, sgst: 9, igst: 0 },
      ]

      const hsnMap = new Map<string, { taxable_value: number; count: number }>()
      for (const item of items) {
        const key = `${item.hsn_code}:${item.gst_rate}`
        const existing = hsnMap.get(key)
        if (existing) {
          existing.taxable_value += item.taxable_value
          existing.count++
        } else {
          hsnMap.set(key, { taxable_value: item.taxable_value, count: 1 })
        }
      }

      expect(hsnMap.get("30049099:5")?.taxable_value).toBe(300)
      expect(hsnMap.get("30049099:5")?.count).toBe(2)
      expect(hsnMap.get("30049060:12")?.taxable_value).toBe(150)
      expect(hsnMap.get("30049060:12")?.count).toBe(1)
    })

    it("uses fallback HSN 30049099 for missing codes", () => {
      const rawHsn = ""
      const hsnCode = rawHsn ? rawHsn : "30049099"
      expect(hsnCode).toBe("30049099")
    })
  })

  describe("validation logic", () => {
    it("flags empty buyer state", () => {
      const buyerState = ""
      const issues: string[] = []
      if (!buyerState) {
        issues.push("Empty buyer state, defaulting to intra-state")
      }
      expect(issues).toHaveLength(1)
    })

    it("flags zero-amount line items", () => {
      const unitPrice = 0
      const quantity = 5
      const isZero = unitPrice <= 0 || quantity <= 0
      expect(isZero).toBe(true)
    })

    it("does not flag valid line items", () => {
      const unitPrice = 100
      const quantity = 5
      const isZero = unitPrice <= 0 || quantity <= 0
      expect(isZero).toBe(false)
    })
  })
})
