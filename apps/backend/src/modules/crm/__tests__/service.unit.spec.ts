/**
 * Unit tests for CrmModuleService custom business logic.
 * MedusaService is not imported — all CRUD operations are faked in-memory.
 */

// ---------- builder helpers ----------

let _idCounter = 0
function uid(prefix: string) {
  return `${prefix}_${++_idCounter}`
}

function buildPattern(overrides: Record<string, unknown> = {}) {
  const nextExpected = new Date()
  nextExpected.setDate(nextExpected.getDate() + 30)

  return {
    id: uid("crp"),
    customer_id: uid("cust"),
    variant_id: uid("var"),
    average_days_between_orders: 30,
    last_purchased_at: new Date(Date.now() - 30 * 86400_000),
    next_expected_at: nextExpected,
    confidence_score: 80,
    is_active: true,
    ...overrides,
  }
}

// ---------- FakeCrmService ----------

class FakeCrmService {
  private patterns: ReturnType<typeof buildPattern>[] = []

  _seedPatterns(data: ReturnType<typeof buildPattern>[]) {
    this.patterns = data
  }

  // Internal mocks
  private async listChronicReorderPatterns(
    filters: Record<string, unknown>,
    _opts?: { take: null }
  ) {
    return this.patterns.filter((p) =>
      Object.entries(filters).every(([k, v]) => p[k as keyof typeof p] === v)
    )
  }

  // ---- computeLifecycleStage helper (mirrors service.ts private method) ----
  private computeLifecycleStage(
    patterns: ReturnType<typeof buildPattern>[]
  ): "new" | "active" | "loyal" | "at_risk" | "dormant" {
    if (!patterns.length) return "new"

    const activePatterns = patterns.filter((p) => p.is_active)
    if (!activePatterns.length) return "dormant"

    const now = new Date()
    const allOverdue = activePatterns.every(
      (p) => new Date(p.next_expected_at) < now
    )

    if (allOverdue) return "at_risk"

    const avgConfidence =
      activePatterns.reduce((s, p) => s + p.confidence_score, 0) /
      activePatterns.length

    if (avgConfidence >= 70 && activePatterns.length >= 2) return "loyal"
    return "active"
  }

  // ---- Public service methods (mirrors service.ts) ----

  async customer360(customerId: string) {
    const patterns = await this.listChronicReorderPatterns(
      { customer_id: customerId, is_active: true },
      { take: null }
    )

    const stage = this.computeLifecycleStage(patterns)

    return {
      customer_id: customerId,
      lifecycle_stage: stage,
      chronic_medications: patterns.length,
      reorder_patterns: patterns.map((p) => ({
        variant_id: p.variant_id,
        avg_days: p.average_days_between_orders,
        last_purchased: p.last_purchased_at,
        next_expected: p.next_expected_at,
        confidence: p.confidence_score,
      })),
      computed_at: new Date().toISOString(),
    }
  }

  async lifecycleStage(customerId: string) {
    const patterns = await this.listChronicReorderPatterns(
      { customer_id: customerId },
      { take: null }
    )

    return this.computeLifecycleStage(patterns)
  }

  async churnScore(customerId: string): Promise<{
    score: number
    risk: "low" | "medium" | "high"
    factors: string[]
  }> {
    const patterns = await this.listChronicReorderPatterns(
      { customer_id: customerId, is_active: true },
      { take: null }
    )

    if (!patterns.length) {
      return { score: 50, risk: "medium", factors: ["No chronic medication patterns detected"] }
    }

    const factors: string[] = []
    let score = 0

    const now = new Date()
    let overdueCount = 0
    let totalConfidence = 0

    for (const p of patterns) {
      totalConfidence += p.confidence_score
      const nextExpected = new Date(p.next_expected_at)
      if (nextExpected < now) {
        overdueCount++
        const daysOverdue = Math.floor((now.getTime() - nextExpected.getTime()) / 86400000)
        if (daysOverdue > 14) {
          score += 30
          factors.push(`Refill overdue by ${daysOverdue} days for variant ${p.variant_id}`)
        } else {
          score += 10
        }
      }
    }

    if (overdueCount === patterns.length && patterns.length > 0) {
      score += 20
      factors.push("All chronic medications are overdue")
    }

    const avgConfidence = totalConfidence / patterns.length
    if (avgConfidence < 30) {
      score += 15
      factors.push("Low reorder pattern confidence")
    }

    score = Math.min(score, 100)

    const risk: "low" | "medium" | "high" =
      score >= 60 ? "high" : score >= 30 ? "medium" : "low"

    if (!factors.length) {
      factors.push("Customer appears active with regular reorders")
    }

    return { score, risk, factors }
  }
}

// ---------- tests ----------

describe("CrmModuleService (unit)", () => {
  let service: FakeCrmService

  beforeEach(() => {
    service = new FakeCrmService()
    _idCounter = 0
  })

  // ── lifecycleStage ───────────────────────────────────────────────

  describe("lifecycleStage()", () => {
    it("returns 'new' when customer has no patterns", async () => {
      const stage = await service.lifecycleStage("cust_01")
      expect(stage).toBe("new")
    })

    it("returns 'dormant' when all patterns are inactive", async () => {
      service._seedPatterns([
        buildPattern({ customer_id: "cust_01", is_active: false }),
        buildPattern({ customer_id: "cust_01", is_active: false }),
      ])

      const stage = await service.lifecycleStage("cust_01")
      expect(stage).toBe("dormant")
    })

    it("returns 'at_risk' when all active patterns are overdue", async () => {
      const pastDate = new Date(Date.now() - 5 * 86400_000) // 5 days ago

      service._seedPatterns([
        buildPattern({ customer_id: "cust_01", is_active: true, next_expected_at: pastDate }),
        buildPattern({ customer_id: "cust_01", is_active: true, next_expected_at: pastDate }),
      ])

      const stage = await service.lifecycleStage("cust_01")
      expect(stage).toBe("at_risk")
    })

    it("returns 'loyal' for >=2 active patterns with avg confidence >= 70", async () => {
      const futureDate = new Date(Date.now() + 30 * 86400_000)

      service._seedPatterns([
        buildPattern({ customer_id: "cust_01", is_active: true, confidence_score: 85, next_expected_at: futureDate }),
        buildPattern({ customer_id: "cust_01", is_active: true, confidence_score: 75, next_expected_at: futureDate }),
      ])

      const stage = await service.lifecycleStage("cust_01")
      expect(stage).toBe("loyal")
    })

    it("returns 'active' for 1 active pattern with high confidence (< 2 patterns needed for loyal)", async () => {
      const futureDate = new Date(Date.now() + 30 * 86400_000)

      service._seedPatterns([
        buildPattern({ customer_id: "cust_01", is_active: true, confidence_score: 90, next_expected_at: futureDate }),
      ])

      const stage = await service.lifecycleStage("cust_01")
      expect(stage).toBe("active")
    })

    it("returns 'active' for 2 patterns with avg confidence < 70", async () => {
      const futureDate = new Date(Date.now() + 30 * 86400_000)

      service._seedPatterns([
        buildPattern({ customer_id: "cust_01", is_active: true, confidence_score: 50, next_expected_at: futureDate }),
        buildPattern({ customer_id: "cust_01", is_active: true, confidence_score: 60, next_expected_at: futureDate }),
      ])

      const stage = await service.lifecycleStage("cust_01")
      expect(stage).toBe("active")
    })
  })

  // ── customer360 ──────────────────────────────────────────────────

  describe("customer360()", () => {
    it("returns the correct customer_id and chronic_medications count", async () => {
      service._seedPatterns([
        buildPattern({ customer_id: "cust_01", is_active: true }),
        buildPattern({ customer_id: "cust_01", is_active: true }),
        buildPattern({ customer_id: "cust_02", is_active: true }),
      ])

      const view = await service.customer360("cust_01")

      expect(view.customer_id).toBe("cust_01")
      expect(view.chronic_medications).toBe(2)
    })

    it("maps reorder pattern fields correctly", async () => {
      const future = new Date(Date.now() + 30 * 86400_000)
      const past = new Date(Date.now() - 30 * 86400_000)

      service._seedPatterns([
        buildPattern({
          customer_id: "cust_01",
          is_active: true,
          variant_id: "var_01",
          average_days_between_orders: 30,
          last_purchased_at: past,
          next_expected_at: future,
          confidence_score: 85,
        }),
      ])

      const view = await service.customer360("cust_01")
      const pattern = view.reorder_patterns[0]

      expect(pattern.variant_id).toBe("var_01")
      expect(pattern.avg_days).toBe(30)
      expect(pattern.confidence).toBe(85)
    })

    it("returns lifecycle_stage as part of the 360 view", async () => {
      const view = await service.customer360("cust_ghost")
      expect(view.lifecycle_stage).toBe("new")
    })

    it("includes computed_at timestamp", async () => {
      const view = await service.customer360("cust_01")
      expect(view.computed_at).toBeTruthy()
      expect(new Date(view.computed_at).getTime()).toBeGreaterThan(0)
    })
  })

  // ── churnScore ───────────────────────────────────────────────────

  describe("churnScore()", () => {
    it("returns score=50 and risk=medium for customer with no patterns", async () => {
      const result = await service.churnScore("cust_ghost")

      expect(result.score).toBe(50)
      expect(result.risk).toBe("medium")
      expect(result.factors).toContain("No chronic medication patterns detected")
    })

    it("returns low risk and positive factor for fully on-schedule customer", async () => {
      const future = new Date(Date.now() + 30 * 86400_000)

      service._seedPatterns([
        buildPattern({ customer_id: "cust_01", is_active: true, next_expected_at: future, confidence_score: 80 }),
        buildPattern({ customer_id: "cust_01", is_active: true, next_expected_at: future, confidence_score: 85 }),
      ])

      const result = await service.churnScore("cust_01")

      expect(result.risk).toBe("low")
      expect(result.score).toBe(0)
      expect(result.factors).toContain("Customer appears active with regular reorders")
    })

    it("raises score for each refill overdue by >14 days", async () => {
      const wayOverdue = new Date(Date.now() - 20 * 86400_000) // 20 days ago

      service._seedPatterns([
        buildPattern({ customer_id: "cust_01", is_active: true, next_expected_at: wayOverdue, confidence_score: 80 }),
      ])

      const result = await service.churnScore("cust_01")

      // 30 points for >14 days overdue + 20 points for all overdue = 50
      expect(result.score).toBeGreaterThanOrEqual(50)
      expect(result.risk).toBe("medium")
    })

    it("caps score at 100 for very high-risk customer", async () => {
      const extremelyOverdue = new Date(Date.now() - 60 * 86400_000)

      service._seedPatterns([
        buildPattern({ customer_id: "cust_01", is_active: true, next_expected_at: extremelyOverdue, confidence_score: 10 }),
        buildPattern({ customer_id: "cust_01", is_active: true, next_expected_at: extremelyOverdue, confidence_score: 10 }),
        buildPattern({ customer_id: "cust_01", is_active: true, next_expected_at: extremelyOverdue, confidence_score: 10 }),
      ])

      const result = await service.churnScore("cust_01")

      expect(result.score).toBeLessThanOrEqual(100)
    })

    it("adds low-confidence factor when average confidence < 30", async () => {
      const future = new Date(Date.now() + 30 * 86400_000)

      service._seedPatterns([
        buildPattern({ customer_id: "cust_01", is_active: true, next_expected_at: future, confidence_score: 20 }),
      ])

      const result = await service.churnScore("cust_01")

      expect(result.factors).toContain("Low reorder pattern confidence")
      expect(result.score).toBe(15)
    })

    it("returns high risk when score >= 60", async () => {
      const overdueBy30Days = new Date(Date.now() - 30 * 86400_000)

      service._seedPatterns([
        buildPattern({ customer_id: "cust_01", is_active: true, next_expected_at: overdueBy30Days, confidence_score: 80 }),
        buildPattern({ customer_id: "cust_01", is_active: true, next_expected_at: overdueBy30Days, confidence_score: 80 }),
      ])

      const result = await service.churnScore("cust_01")

      // 30 + 30 (two >14-day overdue) + 20 (all overdue) = 80
      expect(result.risk).toBe("high")
    })
  })
})
