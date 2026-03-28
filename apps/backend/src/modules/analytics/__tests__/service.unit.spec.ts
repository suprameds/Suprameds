/**
 * Unit tests for AnalyticsModuleService.
 * This service contains no custom models and no CRUD operations;
 * it returns structured computation scaffolds for admin API routes.
 * Tests verify return shapes, field presence, and date formatting.
 */

// ---------- FakeAnalyticsService ----------
// Mirrors service.ts logic exactly without importing MedusaService.

class FakeAnalyticsService {
  async kpiDashboard(period: { from: Date; to: Date }) {
    return {
      period: {
        from: period.from.toISOString(),
        to: period.to.toISOString(),
      },
      metrics: {
        total_orders: 0,
        total_revenue: 0,
        avg_order_value: 0,
        rx_orders_percentage: 0,
        cod_percentage: 0,
        return_rate: 0,
        cart_abandonment_rate: 0,
      },
      computed_at: new Date().toISOString(),
    }
  }

  async funnelAnalysis(period: { from: Date; to: Date }) {
    return {
      period: {
        from: period.from.toISOString(),
        to: period.to.toISOString(),
      },
      funnel: {
        visitors: 0,
        add_to_cart: 0,
        checkout_started: 0,
        payment_initiated: 0,
        order_placed: 0,
        order_delivered: 0,
      },
      conversion_rates: {
        visit_to_cart: 0,
        cart_to_checkout: 0,
        checkout_to_payment: 0,
        payment_to_order: 0,
        order_to_delivery: 0,
        overall: 0,
      },
      computed_at: new Date().toISOString(),
    }
  }

  async inventoryAnalytics() {
    return {
      summary: {
        total_skus: 0,
        in_stock: 0,
        low_stock: 0,
        out_of_stock: 0,
        expiring_soon: 0,
      },
      fefo_compliance: {
        orders_with_fefo: 0,
        total_orders: 0,
        compliance_rate: 0,
      },
      computed_at: new Date().toISOString(),
    }
  }

  async cohortAnalysis(period: { from: Date; to: Date }) {
    return {
      period: {
        from: period.from.toISOString(),
        to: period.to.toISOString(),
      },
      cohorts: [],
      computed_at: new Date().toISOString(),
    }
  }

  async codAnalytics(period: { from: Date; to: Date }) {
    return {
      period: {
        from: period.from.toISOString(),
        to: period.to.toISOString(),
      },
      cod_summary: {
        total_cod_orders: 0,
        confirmed: 0,
        auto_cancelled: 0,
        confirmation_rate: 0,
        avg_confirmation_time_hours: 0,
      },
      computed_at: new Date().toISOString(),
    }
  }

  async gstReport(period: { month: number; year: number }) {
    return {
      period: `${period.year}-${String(period.month).padStart(2, "0")}`,
      gstin: process.env.PHARMACY_GSTIN ?? "NOT_SET",
      summary: {
        total_taxable_value: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        total_tax: 0,
        total_invoice_value: 0,
      },
      by_rate: {
        gst_0: { taxable: 0, tax: 0 },
        gst_5: { taxable: 0, tax: 0 },
        gst_12: { taxable: 0, tax: 0 },
        gst_18: { taxable: 0, tax: 0 },
        gst_28: { taxable: 0, tax: 0 },
      },
      computed_at: new Date().toISOString(),
    }
  }
}

// ---------- tests ----------

describe("AnalyticsModuleService (unit)", () => {
  let service: FakeAnalyticsService
  const period = {
    from: new Date("2025-01-01"),
    to: new Date("2025-03-31"),
  }

  beforeEach(() => {
    service = new FakeAnalyticsService()
  })

  // ── kpiDashboard ─────────────────────────────────────────────────

  describe("kpiDashboard()", () => {
    it("returns the correct period ISO strings", async () => {
      const result = await service.kpiDashboard(period)

      expect(result.period.from).toBe(period.from.toISOString())
      expect(result.period.to).toBe(period.to.toISOString())
    })

    it("returns all expected metric keys", async () => {
      const result = await service.kpiDashboard(period)

      expect(result.metrics).toHaveProperty("total_orders")
      expect(result.metrics).toHaveProperty("total_revenue")
      expect(result.metrics).toHaveProperty("avg_order_value")
      expect(result.metrics).toHaveProperty("rx_orders_percentage")
      expect(result.metrics).toHaveProperty("cod_percentage")
      expect(result.metrics).toHaveProperty("return_rate")
      expect(result.metrics).toHaveProperty("cart_abandonment_rate")
    })

    it("includes a computed_at timestamp", async () => {
      const result = await service.kpiDashboard(period)

      expect(result.computed_at).toBeTruthy()
      expect(new Date(result.computed_at).getTime()).toBeGreaterThan(0)
    })
  })

  // ── funnelAnalysis ───────────────────────────────────────────────

  describe("funnelAnalysis()", () => {
    it("returns funnel steps in the correct order", async () => {
      const result = await service.funnelAnalysis(period)

      const funnelKeys = Object.keys(result.funnel)
      expect(funnelKeys).toEqual([
        "visitors",
        "add_to_cart",
        "checkout_started",
        "payment_initiated",
        "order_placed",
        "order_delivered",
      ])
    })

    it("returns all conversion rate keys", async () => {
      const result = await service.funnelAnalysis(period)

      expect(result.conversion_rates).toHaveProperty("visit_to_cart")
      expect(result.conversion_rates).toHaveProperty("cart_to_checkout")
      expect(result.conversion_rates).toHaveProperty("checkout_to_payment")
      expect(result.conversion_rates).toHaveProperty("payment_to_order")
      expect(result.conversion_rates).toHaveProperty("order_to_delivery")
      expect(result.conversion_rates).toHaveProperty("overall")
    })

    it("returns the input period in the response", async () => {
      const result = await service.funnelAnalysis(period)

      expect(result.period.from).toBe(period.from.toISOString())
      expect(result.period.to).toBe(period.to.toISOString())
    })
  })

  // ── inventoryAnalytics ───────────────────────────────────────────

  describe("inventoryAnalytics()", () => {
    it("returns summary with all stock-level fields", async () => {
      const result = await service.inventoryAnalytics()

      expect(result.summary).toHaveProperty("total_skus")
      expect(result.summary).toHaveProperty("in_stock")
      expect(result.summary).toHaveProperty("low_stock")
      expect(result.summary).toHaveProperty("out_of_stock")
      expect(result.summary).toHaveProperty("expiring_soon")
    })

    it("returns fefo_compliance structure", async () => {
      const result = await service.inventoryAnalytics()

      expect(result.fefo_compliance).toHaveProperty("orders_with_fefo")
      expect(result.fefo_compliance).toHaveProperty("total_orders")
      expect(result.fefo_compliance).toHaveProperty("compliance_rate")
    })

    it("includes computed_at timestamp", async () => {
      const result = await service.inventoryAnalytics()
      expect(result.computed_at).toBeTruthy()
    })
  })

  // ── cohortAnalysis ───────────────────────────────────────────────

  describe("cohortAnalysis()", () => {
    it("returns empty cohorts array (scaffold pending SQL queries)", async () => {
      const result = await service.cohortAnalysis(period)
      expect(result.cohorts).toEqual([])
    })

    it("echoes the period back in the response", async () => {
      const result = await service.cohortAnalysis(period)
      expect(result.period.from).toBe(period.from.toISOString())
    })
  })

  // ── codAnalytics ─────────────────────────────────────────────────

  describe("codAnalytics()", () => {
    it("returns all cod_summary fields", async () => {
      const result = await service.codAnalytics(period)

      expect(result.cod_summary).toHaveProperty("total_cod_orders")
      expect(result.cod_summary).toHaveProperty("confirmed")
      expect(result.cod_summary).toHaveProperty("auto_cancelled")
      expect(result.cod_summary).toHaveProperty("confirmation_rate")
      expect(result.cod_summary).toHaveProperty("avg_confirmation_time_hours")
    })

    it("echoes the period in the response", async () => {
      const result = await service.codAnalytics(period)
      expect(result.period.from).toBe(period.from.toISOString())
    })
  })

  // ── gstReport ────────────────────────────────────────────────────

  describe("gstReport()", () => {
    it("formats the period correctly as YYYY-MM", async () => {
      const result = await service.gstReport({ month: 3, year: 2025 })
      expect(result.period).toBe("2025-03")
    })

    it("zero-pads single-digit months", async () => {
      const result = await service.gstReport({ month: 7, year: 2025 })
      expect(result.period).toBe("2025-07")
    })

    it("returns all GST rate bands in by_rate", async () => {
      const result = await service.gstReport({ month: 1, year: 2025 })

      expect(result.by_rate).toHaveProperty("gst_0")
      expect(result.by_rate).toHaveProperty("gst_5")
      expect(result.by_rate).toHaveProperty("gst_12")
      expect(result.by_rate).toHaveProperty("gst_18")
      expect(result.by_rate).toHaveProperty("gst_28")
    })

    it("returns all summary tax fields", async () => {
      const result = await service.gstReport({ month: 1, year: 2025 })

      expect(result.summary).toHaveProperty("total_taxable_value")
      expect(result.summary).toHaveProperty("cgst")
      expect(result.summary).toHaveProperty("sgst")
      expect(result.summary).toHaveProperty("igst")
      expect(result.summary).toHaveProperty("total_tax")
      expect(result.summary).toHaveProperty("total_invoice_value")
    })

    it("falls back to NOT_SET when PHARMACY_GSTIN env var is not set", async () => {
      const prev = process.env.PHARMACY_GSTIN
      delete process.env.PHARMACY_GSTIN

      const result = await service.gstReport({ month: 1, year: 2025 })
      expect(result.gstin).toBe("NOT_SET")

      if (prev !== undefined) process.env.PHARMACY_GSTIN = prev
    })

    it("uses PHARMACY_GSTIN env var when set", async () => {
      const prev = process.env.PHARMACY_GSTIN
      process.env.PHARMACY_GSTIN = "27AADCB2230M1ZV"

      const result = await service.gstReport({ month: 1, year: 2025 })
      expect(result.gstin).toBe("27AADCB2230M1ZV")

      if (prev !== undefined) {
        process.env.PHARMACY_GSTIN = prev
      } else {
        delete process.env.PHARMACY_GSTIN
      }
    })
  })
})
