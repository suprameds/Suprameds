/**
 * Unit tests for CodModuleService custom business logic.
 * MedusaService is not imported — all CRUD operations are faked in-memory.
 */

// ---------- constants (mirrored from service) ----------

const COD_TIMEOUT_MS = 30 * 60 * 1000

// ---------- builder helpers ----------

let _idCounter = 0
function uid(prefix: string) {
  return `${prefix}_${++_idCounter}`
}

function buildCodOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("cod"),
    order_id: uid("ord"),
    cod_amount: 500,
    surcharge_amount: 49,
    confirmation_required: true,
    status: "pending_confirmation" as string,
    confirmed_at: null as Date | null,
    phone_verified: false,
    customer_phone: "+919876543210",
    confirmation_attempts: 0,
    metadata: null as Record<string, unknown> | null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function buildCodCustomerScore(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("score"),
    customer_id: uid("cust"),
    total_cod_orders: 0,
    cod_rto_count: 0,
    cod_rto_rate: 0,
    consecutive_rtos: 0,
    cod_eligible: true,
    cod_limit: 1000,
    last_evaluated_at: null as Date | null,
    ...overrides,
  }
}

// ---------- FakeCodService ----------

class FakeCodService {
  private codOrders: ReturnType<typeof buildCodOrder>[] = []
  private codCustomerScores: ReturnType<typeof buildCodCustomerScore>[] = []

  _seedCodOrders(data: ReturnType<typeof buildCodOrder>[]) {
    this.codOrders = data
  }
  _seedCodCustomerScores(data: ReturnType<typeof buildCodCustomerScore>[]) {
    this.codCustomerScores = data
  }

  // ---- CRUD: CodOrders ----
  private async createCodOrders(data: Record<string, unknown>) {
    const o = buildCodOrder(data)
    this.codOrders.push(o)
    return o
  }
  private async retrieveCodOrder(id: string) {
    const o = this.codOrders.find((o) => o.id === id)
    if (!o) throw new Error(`CodOrder ${id} not found`)
    return o
  }
  private async listCodOrders(
    filters: Record<string, unknown> = {},
    _opts?: { take?: number | null }
  ) {
    return this.codOrders.filter((o) =>
      Object.entries(filters).every(([k, v]) => o[k as keyof typeof o] === v)
    )
  }
  private async updateCodOrders(data: Record<string, unknown>) {
    const idx = this.codOrders.findIndex((o) => o.id === data.id)
    if (idx === -1) throw new Error(`CodOrder ${data.id} not found`)
    this.codOrders[idx] = { ...this.codOrders[idx], ...data } as ReturnType<typeof buildCodOrder>
    return this.codOrders[idx]
  }

  // ---- CRUD: CodCustomerScores ----
  private async createCodCustomerScores(data: Record<string, unknown>) {
    const s = buildCodCustomerScore(data)
    this.codCustomerScores.push(s)
    return s
  }
  private async listCodCustomerScores(
    filters: Record<string, unknown> = {},
    _opts?: { take?: number | null }
  ) {
    return this.codCustomerScores.filter((s) =>
      Object.entries(filters).every(([k, v]) => s[k as keyof typeof s] === v)
    )
  }
  private async updateCodCustomerScores(data: Record<string, unknown>) {
    const idx = this.codCustomerScores.findIndex((s) => s.id === data.id)
    if (idx === -1) throw new Error(`CodCustomerScore ${data.id} not found`)
    this.codCustomerScores[idx] = {
      ...this.codCustomerScores[idx],
      ...data,
    } as ReturnType<typeof buildCodCustomerScore>
    return this.codCustomerScores[idx]
  }

  // ---- Public methods (mirror service.ts exactly) ----

  async confirmOrder(
    codOrderId: string,
    phoneVerified: boolean = false
  ): Promise<any> {
    const existing = await this.retrieveCodOrder(codOrderId)

    if (existing.status !== "pending_confirmation") {
      throw new Error(
        `COD order ${codOrderId} cannot be confirmed — current status: ${existing.status}`
      )
    }

    return this.updateCodOrders({
      id: codOrderId,
      status: "confirmed",
      confirmed_at: new Date(),
      phone_verified: phoneVerified,
    })
  }

  async autoCancelExpired(): Promise<string[]> {
    const cutoff = new Date(Date.now() - COD_TIMEOUT_MS)
    const cancelledIds: string[] = []

    const pending = await this.listCodOrders(
      {
        status: "pending_confirmation",
        confirmation_required: true,
      },
      { take: null }
    )

    for (const codOrder of pending as any[]) {
      const createdAt = new Date(codOrder.created_at)
      if (createdAt < cutoff) {
        await this.updateCodOrders({ id: codOrder.id, status: "cancelled" })
        cancelledIds.push(codOrder.id)
      }
    }

    return cancelledIds
  }

  async scoreCustomer(
    customerId: string,
    outcome: "delivered" | "rto"
  ): Promise<any> {
    let [score] = (await this.listCodCustomerScores(
      { customer_id: customerId },
      { take: 1 }
    )) as any[]

    if (!score) {
      score = await this.createCodCustomerScores({
        customer_id: customerId,
        total_cod_orders: 0,
        cod_rto_count: 0,
        cod_rto_rate: 0,
        consecutive_rtos: 0,
        cod_eligible: true,
        cod_limit: 1000,
      })
    }

    const totalOrders = score.total_cod_orders + 1
    let rtoCount = score.cod_rto_count
    let consecutiveRtos = score.consecutive_rtos

    if (outcome === "rto") {
      rtoCount++
      consecutiveRtos++
    } else {
      consecutiveRtos = 0
    }

    const rtoRate = totalOrders > 0 ? rtoCount / totalOrders : 0

    let codEligible = true
    let codLimit = 1000

    if (consecutiveRtos >= 2) {
      codEligible = false
      codLimit = 0
    } else if (rtoCount >= 1) {
      codLimit = 500
    }

    return this.updateCodCustomerScores({
      id: score.id,
      total_cod_orders: totalOrders,
      cod_rto_count: rtoCount,
      cod_rto_rate: rtoRate,
      consecutive_rtos: consecutiveRtos,
      cod_eligible: codEligible,
      cod_limit: codLimit,
      last_evaluated_at: new Date(),
    })
  }

  async handleRto(codOrderId: string, customerId: string): Promise<void> {
    await this.updateCodOrders({ id: codOrderId, status: "rto" })
    await this.scoreCustomer(customerId, "rto")
  }

  async recordAttempt(codOrderId: string): Promise<any> {
    const existing = await this.retrieveCodOrder(codOrderId)
    return this.updateCodOrders({
      id: codOrderId,
      confirmation_attempts: (existing as any).confirmation_attempts + 1,
    })
  }

  // Expose internals
  _getCodOrders() { return this.codOrders }
  _getCodCustomerScores() { return this.codCustomerScores }
}

// ---------- tests ----------

describe("CodModuleService (unit)", () => {
  let service: FakeCodService

  beforeEach(() => {
    service = new FakeCodService()
    _idCounter = 0
  })

  // ── confirmOrder ────────────────────────────────────────────────

  describe("confirmOrder()", () => {
    it("transitions from pending_confirmation to confirmed", async () => {
      service._seedCodOrders([
        buildCodOrder({ id: "cod_001", status: "pending_confirmation" }),
      ])

      const result = await service.confirmOrder("cod_001", true)

      expect(result.status).toBe("confirmed")
      expect(result.confirmed_at).toBeTruthy()
      expect(result.phone_verified).toBe(true)
    })

    it("sets phone_verified=false by default", async () => {
      service._seedCodOrders([
        buildCodOrder({ id: "cod_001", status: "pending_confirmation" }),
      ])

      const result = await service.confirmOrder("cod_001")

      expect(result.phone_verified).toBe(false)
    })

    it("throws when trying to confirm an already-confirmed order", async () => {
      service._seedCodOrders([
        buildCodOrder({ id: "cod_001", status: "confirmed" }),
      ])

      await expect(service.confirmOrder("cod_001")).rejects.toThrow(
        "COD order cod_001 cannot be confirmed — current status: confirmed"
      )
    })

    it("throws when trying to confirm a cancelled order", async () => {
      service._seedCodOrders([
        buildCodOrder({ id: "cod_001", status: "cancelled" }),
      ])

      await expect(service.confirmOrder("cod_001")).rejects.toThrow(
        "COD order cod_001 cannot be confirmed — current status: cancelled"
      )
    })

    it("throws when trying to confirm an rto order", async () => {
      service._seedCodOrders([
        buildCodOrder({ id: "cod_001", status: "rto" }),
      ])

      await expect(service.confirmOrder("cod_001")).rejects.toThrow(
        "current status: rto"
      )
    })
  })

  // ── autoCancelExpired ───────────────────────────────────────────

  describe("autoCancelExpired()", () => {
    it("cancels orders older than 30 minutes that are pending_confirmation", async () => {
      const oldDate = new Date(Date.now() - 31 * 60 * 1000).toISOString()

      service._seedCodOrders([
        buildCodOrder({
          id: "cod_old",
          status: "pending_confirmation",
          confirmation_required: true,
          created_at: oldDate,
        }),
      ])

      const cancelled = await service.autoCancelExpired()

      expect(cancelled).toEqual(["cod_old"])
      expect(service._getCodOrders()[0].status).toBe("cancelled")
    })

    it("does NOT cancel orders younger than 30 minutes", async () => {
      const recentDate = new Date(Date.now() - 10 * 60 * 1000).toISOString()

      service._seedCodOrders([
        buildCodOrder({
          id: "cod_recent",
          status: "pending_confirmation",
          confirmation_required: true,
          created_at: recentDate,
        }),
      ])

      const cancelled = await service.autoCancelExpired()

      expect(cancelled).toEqual([])
      expect(service._getCodOrders()[0].status).toBe("pending_confirmation")
    })

    it("does NOT cancel already-confirmed orders", async () => {
      const oldDate = new Date(Date.now() - 60 * 60 * 1000).toISOString()

      service._seedCodOrders([
        buildCodOrder({
          id: "cod_confirmed",
          status: "confirmed",
          confirmation_required: true,
          created_at: oldDate,
        }),
      ])

      const cancelled = await service.autoCancelExpired()

      expect(cancelled).toEqual([])
    })

    it("returns array of cancelled IDs when multiple orders expire", async () => {
      const oldDate = new Date(Date.now() - 45 * 60 * 1000).toISOString()

      service._seedCodOrders([
        buildCodOrder({ id: "cod_a", status: "pending_confirmation", confirmation_required: true, created_at: oldDate }),
        buildCodOrder({ id: "cod_b", status: "pending_confirmation", confirmation_required: true, created_at: oldDate }),
        buildCodOrder({ id: "cod_c", status: "confirmed", confirmation_required: true, created_at: oldDate }),
      ])

      const cancelled = await service.autoCancelExpired()

      expect(cancelled).toHaveLength(2)
      expect(cancelled).toContain("cod_a")
      expect(cancelled).toContain("cod_b")
    })

    it("does NOT cancel orders that do not require confirmation", async () => {
      const oldDate = new Date(Date.now() - 60 * 60 * 1000).toISOString()

      service._seedCodOrders([
        buildCodOrder({
          id: "cod_norequire",
          status: "pending_confirmation",
          confirmation_required: false,
          created_at: oldDate,
        }),
      ])

      const cancelled = await service.autoCancelExpired()

      expect(cancelled).toEqual([])
    })
  })

  // ── scoreCustomer ───────────────────────────────────────────────

  describe("scoreCustomer()", () => {
    it("creates a new score for a new customer with cod_limit=1000", async () => {
      const result = await service.scoreCustomer("cust_new", "delivered")

      expect(result.customer_id).toBe("cust_new")
      expect(result.cod_limit).toBe(1000)
      expect(result.cod_eligible).toBe(true)
      expect(result.total_cod_orders).toBe(1)
      expect(result.consecutive_rtos).toBe(0)
    })

    it("reduces cod_limit to 500 after 1 RTO", async () => {
      const result = await service.scoreCustomer("cust_rto1", "rto")

      expect(result.cod_limit).toBe(500)
      expect(result.cod_eligible).toBe(true)
      expect(result.cod_rto_count).toBe(1)
      expect(result.consecutive_rtos).toBe(1)
    })

    it("disables COD after 2 consecutive RTOs", async () => {
      // First RTO
      await service.scoreCustomer("cust_rto2", "rto")
      // Second consecutive RTO
      const result = await service.scoreCustomer("cust_rto2", "rto")

      expect(result.cod_eligible).toBe(false)
      expect(result.cod_limit).toBe(0)
      expect(result.consecutive_rtos).toBe(2)
    })

    it("resets consecutive_rtos to 0 after a delivery", async () => {
      // First RTO
      await service.scoreCustomer("cust_recover", "rto")
      // Then a delivery
      const result = await service.scoreCustomer("cust_recover", "delivered")

      expect(result.consecutive_rtos).toBe(0)
      // Still has 1 RTO total, so limit stays 500
      expect(result.cod_limit).toBe(500)
      expect(result.cod_eligible).toBe(true)
    })

    it("calculates rto_rate correctly", async () => {
      // 1 delivery
      await service.scoreCustomer("cust_rate", "delivered")
      // 1 RTO
      const result = await service.scoreCustomer("cust_rate", "rto")

      // 1 RTO out of 2 orders = 0.5
      expect(result.cod_rto_rate).toBe(0.5)
      expect(result.total_cod_orders).toBe(2)
    })

    it("keeps cod_eligible=true with 1 RTO followed by 1 delivery", async () => {
      await service.scoreCustomer("cust_mixed", "rto")
      const result = await service.scoreCustomer("cust_mixed", "delivered")

      expect(result.cod_eligible).toBe(true)
      expect(result.consecutive_rtos).toBe(0)
    })

    it("increments total_cod_orders correctly across multiple calls", async () => {
      await service.scoreCustomer("cust_multi", "delivered")
      await service.scoreCustomer("cust_multi", "delivered")
      const result = await service.scoreCustomer("cust_multi", "delivered")

      expect(result.total_cod_orders).toBe(3)
      expect(result.cod_rto_count).toBe(0)
      expect(result.cod_limit).toBe(1000)
    })
  })

  // ── handleRto ───────────────────────────────────────────────────

  describe("handleRto()", () => {
    it("updates COD order status to rto AND re-scores the customer", async () => {
      service._seedCodOrders([
        buildCodOrder({ id: "cod_rto", status: "dispatched" }),
      ])

      await service.handleRto("cod_rto", "cust_rto_handle")

      // Order status
      expect(service._getCodOrders()[0].status).toBe("rto")

      // Customer score updated
      const scores = service._getCodCustomerScores()
      expect(scores).toHaveLength(1)
      expect(scores[0].cod_rto_count).toBe(1)
      expect(scores[0].consecutive_rtos).toBe(1)
    })
  })

  // ── recordAttempt ───────────────────────────────────────────────

  describe("recordAttempt()", () => {
    it("increments confirmation_attempts from 0 to 1", async () => {
      service._seedCodOrders([
        buildCodOrder({ id: "cod_att", confirmation_attempts: 0 }),
      ])

      const result = await service.recordAttempt("cod_att")

      expect(result.confirmation_attempts).toBe(1)
    })

    it("increments confirmation_attempts from 2 to 3", async () => {
      service._seedCodOrders([
        buildCodOrder({ id: "cod_att", confirmation_attempts: 2 }),
      ])

      const result = await service.recordAttempt("cod_att")

      expect(result.confirmation_attempts).toBe(3)
    })

    it("throws for non-existent COD order", async () => {
      await expect(
        service.recordAttempt("cod_nonexistent")
      ).rejects.toThrow("CodOrder cod_nonexistent not found")
    })
  })
})
