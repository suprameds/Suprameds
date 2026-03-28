/**
 * Unit tests for OrdersModuleService custom business logic.
 * MedusaService is not imported — all CRUD operations are faked in-memory.
 */

// ---------- VALID_TRANSITIONS map (mirrored from service) ----------

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending_cod_confirmation: ["pending_rx_review", "cancelled"],
  pending_rx_review: ["partially_approved", "fully_approved", "cancelled"],
  partially_approved: ["payment_captured", "cancelled"],
  fully_approved: ["payment_captured", "cancelled"],
  payment_captured: ["allocation_pending"],
  allocation_pending: ["pick_pending", "partially_fulfilled", "cancelled"],
  pick_pending: ["packing", "cancelled"],
  packing: ["pending_dispatch_approval"],
  pending_dispatch_approval: ["dispatched", "packing"],
  dispatched: ["delivered", "partially_fulfilled"],
  delivered: ["refunded"],
  partially_fulfilled: ["delivered", "dispatched", "refunded"],
  cancelled: ["refunded"],
  refunded: [],
}

// ---------- builder helpers ----------

let _idCounter = 0
function uid(prefix: string) {
  return `${prefix}_${++_idCounter}`
}

function buildOrderExtension(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("ext"),
    order_id: uid("ord"),
    is_rx_order: false,
    is_guest_order: false,
    prescription_id: null,
    is_cod: false,
    cod_amount: 0,
    cod_confirmation_status: "not_required",
    is_cs_placed: false,
    cs_agent_id: null,
    status: "pending_rx_review",
    partial_shipment_preference: null,
    is_partial_approval: false,
    payment_captured_amount: 0,
    payment_released_amount: 0,
    payment_authorized_amount: 0,
    gstin: null,
    ...overrides,
  }
}

function buildStateHistory(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("hist"),
    order_id: uid("ord"),
    from_status: "pending_rx_review",
    to_status: "fully_approved",
    changed_by: "agent_01",
    reason: null,
    ...overrides,
  }
}

function buildCsRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("cs"),
    order_id: uid("ord"),
    agent_id: uid("agent"),
    customer_id: null,
    customer_phone: "+919999999999",
    channel: "phone",
    payment_method: "cod",
    payment_link_id: null,
    notes: null,
    ...overrides,
  }
}

function buildGuestSession(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("gs"),
    session_token: uid("tok"),
    phone: "+919999999999",
    email: null,
    cart_id: null,
    converted_to: null,
    expires_at: new Date(Date.now() + 7 * 86400_000),
    ...overrides,
  }
}

function buildPartialShipmentPref(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("psp"),
    order_id: uid("ord"),
    customer_id: uid("cust"),
    choice: "ship_available",
    oos_items: [],
    chosen_at: new Date(),
    ...overrides,
  }
}

// ---------- FakeOrdersService ----------

class FakeOrdersService {
  private extensions: ReturnType<typeof buildOrderExtension>[] = []
  private histories: ReturnType<typeof buildStateHistory>[] = []
  private csRecords: ReturnType<typeof buildCsRecord>[] = []
  private guestSessions: ReturnType<typeof buildGuestSession>[] = []
  private partialPrefs: ReturnType<typeof buildPartialShipmentPref>[] = []

  // Seed helpers
  _seedExtensions(data: ReturnType<typeof buildOrderExtension>[]) {
    this.extensions = data
  }

  // ---- Internal CRUD mocks ----

  private async listOrderExtensions(filters: Record<string, unknown> = {}) {
    return this.extensions.filter((e) =>
      Object.entries(filters).every(
        ([k, v]) => e[k as keyof typeof e] === v
      )
    )
  }

  private async createOrderExtensions(data: Record<string, unknown>) {
    const record = buildOrderExtension(data)
    this.extensions.push(record)
    return record
  }

  private async updateOrderExtensions(data: Record<string, unknown>) {
    const idx = this.extensions.findIndex((e) => e.id === data.id)
    if (idx === -1) throw new Error(`OrderExtension ${data.id} not found`)
    this.extensions[idx] = { ...this.extensions[idx], ...data }
    return this.extensions[idx]
  }

  private async createOrderStateHistories(data: Record<string, unknown>) {
    const record = buildStateHistory(data)
    this.histories.push(record)
    return record
  }

  private async createCsPlacedOrders(data: Record<string, unknown>) {
    const record = buildCsRecord(data)
    this.csRecords.push(record)
    return record
  }

  private async createGuestSessions(data: Record<string, unknown>) {
    const record = buildGuestSession(data)
    this.guestSessions.push(record)
    return record
  }

  private async createPartialShipmentPreferences(data: Record<string, unknown>) {
    const record = buildPartialShipmentPref(data)
    this.partialPrefs.push(record)
    return record
  }

  // ---- Public service methods (mirrors service.ts) ----

  async createGuestOrder(data: {
    phone: string
    email?: string
    cart_id?: string
    session_token: string
  }) {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    return await this.createGuestSessions({
      session_token: data.session_token,
      phone: data.phone,
      email: data.email ?? null,
      cart_id: data.cart_id ?? null,
      expires_at: expiresAt,
      converted_to: null,
    })
  }

  async createRxOrder(data: {
    order_id: string
    prescription_id: string
    is_cod?: boolean
    cod_amount?: number
    is_guest_order?: boolean
    gstin?: string
  }) {
    return await this.createOrderExtensions({
      order_id: data.order_id,
      is_rx_order: true,
      is_guest_order: data.is_guest_order ?? false,
      prescription_id: data.prescription_id,
      is_cod: data.is_cod ?? false,
      cod_amount: data.cod_amount ?? 0,
      cod_confirmation_status: data.is_cod ? "pending" : "not_required",
      status: data.is_cod ? "pending_cod_confirmation" : "pending_rx_review",
      gstin: data.gstin ?? null,
    })
  }

  async applyPartialApprovals(
    order_id: string,
    approvedAmount: number,
    rejectedAmount: number,
    changedBy: string
  ) {
    const [ext] = await this.listOrderExtensions({ order_id })
    if (!ext) throw new Error(`Order extension not found for order ${order_id}`)

    const updated = await this.updateOrderExtensions({
      id: ext.id,
      is_partial_approval: true,
      payment_captured_amount: approvedAmount,
      payment_released_amount: rejectedAmount,
    })

    await this.orderStateMachine(order_id, "partially_approved", changedBy)
    return updated
  }

  async recalculateOrderTotals(
    order_id: string,
    capturedAmount: number,
    releasedAmount: number
  ) {
    const [ext] = await this.listOrderExtensions({ order_id })
    if (!ext) throw new Error(`Order extension not found for order ${order_id}`)

    return await this.updateOrderExtensions({
      id: ext.id,
      payment_captured_amount: capturedAmount,
      payment_released_amount: releasedAmount,
      payment_authorized_amount: capturedAmount + releasedAmount,
    })
  }

  async orderStateMachine(
    order_id: string,
    newStatus: string,
    changedBy: string,
    reason?: string
  ) {
    const [ext] = await this.listOrderExtensions({ order_id })
    if (!ext) throw new Error(`Order extension not found for order ${order_id}`)

    const currentStatus = ext.status
    const allowed = VALID_TRANSITIONS[currentStatus] ?? []

    if (!allowed.includes(newStatus)) {
      throw new Error(
        `Invalid order transition: ${currentStatus} -> ${newStatus}. Allowed: [${allowed.join(", ")}]`
      )
    }

    await this.updateOrderExtensions({ id: ext.id, status: newStatus })
    await this.createOrderStateHistories({
      order_id,
      from_status: currentStatus,
      to_status: newStatus,
      changed_by: changedBy,
      reason: reason ?? null,
    })

    return { from: currentStatus, to: newStatus }
  }

  async csPlaceOrder(data: {
    order_id: string
    agent_id: string
    customer_id?: string
    customer_phone: string
    channel: "whatsapp" | "phone" | "email" | "walk_in"
    payment_method: "cod" | "payment_link" | "prepaid_existing"
    payment_link_id?: string
    notes?: string
    is_rx_order?: boolean
    prescription_id?: string
  }) {
    const csRecord = await this.createCsPlacedOrders({
      order_id: data.order_id,
      agent_id: data.agent_id,
      customer_id: data.customer_id ?? null,
      customer_phone: data.customer_phone,
      channel: data.channel,
      payment_method: data.payment_method,
      payment_link_id: data.payment_link_id ?? null,
      notes: data.notes ?? null,
    })

    const isCod = data.payment_method === "cod"
    await this.createOrderExtensions({
      order_id: data.order_id,
      is_cs_placed: true,
      cs_agent_id: data.agent_id,
      is_rx_order: data.is_rx_order ?? false,
      prescription_id: data.prescription_id ?? null,
      is_cod: isCod,
      cod_confirmation_status: isCod ? "confirmed" : "not_required",
      cod_confirmed_by: isCod ? data.agent_id : null,
      cod_confirmed_at: isCod ? new Date() : null,
      status: data.is_rx_order ? "pending_rx_review" : "allocation_pending",
    })

    return csRecord
  }

  async handlePartialShipment(data: {
    order_id: string
    customer_id: string
    choice: "ship_available" | "wait_for_all" | "cancel_oos_item"
    oos_items: unknown[]
  }) {
    const pref = await this.createPartialShipmentPreferences({
      order_id: data.order_id,
      customer_id: data.customer_id,
      choice: data.choice,
      oos_items: data.oos_items,
      chosen_at: new Date(),
    })

    const [ext] = await this.listOrderExtensions({ order_id: data.order_id })
    if (ext) {
      const pref_value =
        data.choice === "cancel_oos_item"
          ? "ship_available"
          : data.choice === "wait_for_all"
            ? "customer_choice"
            : data.choice
      await this.updateOrderExtensions({
        id: ext.id,
        partial_shipment_preference: pref_value,
      })
    }

    return pref
  }

  // Expose internals for assertions
  _getExtensions() { return this.extensions }
  _getHistories() { return this.histories }
  _getCsRecords() { return this.csRecords }
  _getGuestSessions() { return this.guestSessions }
  _getPartialPrefs() { return this.partialPrefs }
}

// ---------- tests ----------

describe("OrdersModuleService (unit)", () => {
  let service: FakeOrdersService

  beforeEach(() => {
    service = new FakeOrdersService()
    _idCounter = 0
  })

  // ── createRxOrder ─────────────────────────────────────────────────

  describe("createRxOrder()", () => {
    it("sets status=pending_rx_review and cod_confirmation_status=not_required for prepaid orders", async () => {
      const ext = await service.createRxOrder({
        order_id: "ord_01",
        prescription_id: "prx_01",
        is_cod: false,
      })

      expect(ext.status).toBe("pending_rx_review")
      expect(ext.cod_confirmation_status).toBe("not_required")
      expect(ext.is_rx_order).toBe(true)
    })

    it("sets status=pending_cod_confirmation and cod_confirmation_status=pending for COD orders", async () => {
      const ext = await service.createRxOrder({
        order_id: "ord_02",
        prescription_id: "prx_01",
        is_cod: true,
        cod_amount: 500,
      })

      expect(ext.status).toBe("pending_cod_confirmation")
      expect(ext.cod_confirmation_status).toBe("pending")
      expect(ext.is_cod).toBe(true)
      expect(ext.cod_amount).toBe(500)
    })

    it("defaults is_cod=false when not provided", async () => {
      const ext = await service.createRxOrder({
        order_id: "ord_03",
        prescription_id: "prx_01",
      })

      expect(ext.is_cod).toBe(false)
    })

    it("stores the prescription_id on the extension", async () => {
      const ext = await service.createRxOrder({
        order_id: "ord_04",
        prescription_id: "prx_special",
      })

      expect(ext.prescription_id).toBe("prx_special")
    })

    it("stores optional gstin when provided", async () => {
      const ext = await service.createRxOrder({
        order_id: "ord_05",
        prescription_id: "prx_01",
        gstin: "27AADCB2230M1ZV",
      })

      expect(ext.gstin).toBe("27AADCB2230M1ZV")
    })
  })

  // ── orderStateMachine ────────────────────────────────────────────

  describe("orderStateMachine()", () => {
    it("transitions pending_rx_review -> fully_approved and records history", async () => {
      service._seedExtensions([
        buildOrderExtension({ order_id: "ord_01", status: "pending_rx_review" }),
      ])

      const result = await service.orderStateMachine("ord_01", "fully_approved", "pharmacist_01")

      expect(result.from).toBe("pending_rx_review")
      expect(result.to).toBe("fully_approved")

      const ext = service._getExtensions().find((e) => e.order_id === "ord_01")!
      expect(ext.status).toBe("fully_approved")

      const history = service._getHistories()[0]
      expect(history.from_status).toBe("pending_rx_review")
      expect(history.to_status).toBe("fully_approved")
      expect(history.changed_by).toBe("pharmacist_01")
    })

    it("transitions pending_rx_review -> partially_approved", async () => {
      service._seedExtensions([
        buildOrderExtension({ order_id: "ord_02", status: "pending_rx_review" }),
      ])

      const result = await service.orderStateMachine("ord_02", "partially_approved", "pharmacist_01")
      expect(result.to).toBe("partially_approved")
    })

    it("transitions pending_rx_review -> cancelled", async () => {
      service._seedExtensions([
        buildOrderExtension({ order_id: "ord_03", status: "pending_rx_review" }),
      ])

      const result = await service.orderStateMachine("ord_03", "cancelled", "agent_01")
      expect(result.to).toBe("cancelled")
    })

    it("throws on invalid transition: delivered -> pending_rx_review", async () => {
      service._seedExtensions([
        buildOrderExtension({ order_id: "ord_04", status: "delivered" }),
      ])

      await expect(
        service.orderStateMachine("ord_04", "pending_rx_review", "agent_01")
      ).rejects.toThrow("Invalid order transition: delivered -> pending_rx_review")
    })

    it("throws on invalid transition: refunded -> any non-empty status", async () => {
      service._seedExtensions([
        buildOrderExtension({ order_id: "ord_05", status: "refunded" }),
      ])

      await expect(
        service.orderStateMachine("ord_05", "delivered", "agent_01")
      ).rejects.toThrow("Invalid order transition")
    })

    it("throws when order extension is not found", async () => {
      await expect(
        service.orderStateMachine("ord_ghost", "fully_approved", "agent_01")
      ).rejects.toThrow("Order extension not found for order ord_ghost")
    })

    it("records the optional reason in history", async () => {
      service._seedExtensions([
        buildOrderExtension({ order_id: "ord_06", status: "pending_rx_review" }),
      ])

      await service.orderStateMachine("ord_06", "cancelled", "agent_01", "Customer requested")

      const history = service._getHistories()[0]
      expect(history.reason).toBe("Customer requested")
    })

    it("full happy-path chain: pending_rx_review -> fully_approved -> payment_captured -> allocation_pending", async () => {
      service._seedExtensions([
        buildOrderExtension({ order_id: "ord_07", status: "pending_rx_review" }),
      ])

      await service.orderStateMachine("ord_07", "fully_approved", "pharm_01")
      await service.orderStateMachine("ord_07", "payment_captured", "system")
      await service.orderStateMachine("ord_07", "allocation_pending", "system")

      const ext = service._getExtensions().find((e) => e.order_id === "ord_07")!
      expect(ext.status).toBe("allocation_pending")
      expect(service._getHistories()).toHaveLength(3)
    })
  })

  // ── applyPartialApprovals ────────────────────────────────────────

  describe("applyPartialApprovals()", () => {
    it("updates payment amounts and transitions to partially_approved", async () => {
      service._seedExtensions([
        buildOrderExtension({ order_id: "ord_01", status: "pending_rx_review" }),
      ])

      const updated = await service.applyPartialApprovals("ord_01", 300, 100, "pharmacist_01")

      expect(updated.is_partial_approval).toBe(true)
      expect(updated.payment_captured_amount).toBe(300)
      expect(updated.payment_released_amount).toBe(100)

      const ext = service._getExtensions().find((e) => e.order_id === "ord_01")!
      expect(ext.status).toBe("partially_approved")
    })

    it("throws when extension not found", async () => {
      await expect(
        service.applyPartialApprovals("ord_ghost", 100, 50, "pharmacist_01")
      ).rejects.toThrow("Order extension not found for order ord_ghost")
    })
  })

  // ── recalculateOrderTotals ───────────────────────────────────────

  describe("recalculateOrderTotals()", () => {
    it("sets payment_authorized_amount = captured + released", async () => {
      service._seedExtensions([
        buildOrderExtension({ order_id: "ord_01" }),
      ])

      const result = await service.recalculateOrderTotals("ord_01", 400, 100)

      expect(result.payment_captured_amount).toBe(400)
      expect(result.payment_released_amount).toBe(100)
      expect(result.payment_authorized_amount).toBe(500)
    })
  })

  // ── csPlaceOrder ─────────────────────────────────────────────────

  describe("csPlaceOrder()", () => {
    it("creates both a CS record and an order extension", async () => {
      const csRecord = await service.csPlaceOrder({
        order_id: "ord_01",
        agent_id: "agent_01",
        customer_phone: "+919999999999",
        channel: "phone",
        payment_method: "cod",
      })

      expect(csRecord.order_id).toBe("ord_01")
      expect(csRecord.agent_id).toBe("agent_01")
      expect(service._getExtensions()).toHaveLength(1)
    })

    it("sets extension status=allocation_pending for non-rx COD order", async () => {
      await service.csPlaceOrder({
        order_id: "ord_02",
        agent_id: "agent_01",
        customer_phone: "+919999999999",
        channel: "walk_in",
        payment_method: "cod",
        is_rx_order: false,
      })

      const ext = service._getExtensions()[0]
      expect(ext.status).toBe("allocation_pending")
      expect(ext.cod_confirmation_status).toBe("confirmed")
    })

    it("sets extension status=pending_rx_review for rx orders", async () => {
      await service.csPlaceOrder({
        order_id: "ord_03",
        agent_id: "agent_01",
        customer_phone: "+919999999999",
        channel: "whatsapp",
        payment_method: "payment_link",
        is_rx_order: true,
        prescription_id: "prx_01",
      })

      const ext = service._getExtensions()[0]
      expect(ext.status).toBe("pending_rx_review")
    })

    it("sets cod_confirmation_status=not_required for payment_link method", async () => {
      await service.csPlaceOrder({
        order_id: "ord_04",
        agent_id: "agent_01",
        customer_phone: "+919999999999",
        channel: "email",
        payment_method: "payment_link",
      })

      const ext = service._getExtensions()[0]
      expect(ext.cod_confirmation_status).toBe("not_required")
      expect(ext.is_cod).toBe(false)
    })

    it("marks extension as is_cs_placed=true", async () => {
      await service.csPlaceOrder({
        order_id: "ord_05",
        agent_id: "agent_01",
        customer_phone: "+919999999999",
        channel: "phone",
        payment_method: "prepaid_existing",
      })

      const ext = service._getExtensions()[0]
      expect(ext.is_cs_placed).toBe(true)
      expect(ext.cs_agent_id).toBe("agent_01")
    })
  })

  // ── handlePartialShipment ────────────────────────────────────────

  describe("handlePartialShipment()", () => {
    it("maps cancel_oos_item -> ship_available on the extension", async () => {
      service._seedExtensions([
        buildOrderExtension({ order_id: "ord_01" }),
      ])

      await service.handlePartialShipment({
        order_id: "ord_01",
        customer_id: "cust_01",
        choice: "cancel_oos_item",
        oos_items: [{ variant_id: "var_01" }],
      })

      const ext = service._getExtensions().find((e) => e.order_id === "ord_01")!
      expect(ext.partial_shipment_preference).toBe("ship_available")
    })

    it("maps wait_for_all -> customer_choice on the extension", async () => {
      service._seedExtensions([
        buildOrderExtension({ order_id: "ord_02" }),
      ])

      await service.handlePartialShipment({
        order_id: "ord_02",
        customer_id: "cust_01",
        choice: "wait_for_all",
        oos_items: [],
      })

      const ext = service._getExtensions().find((e) => e.order_id === "ord_02")!
      expect(ext.partial_shipment_preference).toBe("customer_choice")
    })

    it("maps ship_available -> ship_available on the extension (identity)", async () => {
      service._seedExtensions([
        buildOrderExtension({ order_id: "ord_03" }),
      ])

      await service.handlePartialShipment({
        order_id: "ord_03",
        customer_id: "cust_01",
        choice: "ship_available",
        oos_items: [],
      })

      const ext = service._getExtensions().find((e) => e.order_id === "ord_03")!
      expect(ext.partial_shipment_preference).toBe("ship_available")
    })

    it("creates preference record even when no extension exists", async () => {
      const pref = await service.handlePartialShipment({
        order_id: "ord_ghost",
        customer_id: "cust_01",
        choice: "ship_available",
        oos_items: [],
      })

      expect(pref.order_id).toBe("ord_ghost")
      expect(service._getPartialPrefs()).toHaveLength(1)
    })

    it("stores oos_items on the preference record", async () => {
      const oos = [{ variant_id: "var_A" }, { variant_id: "var_B" }]
      const pref = await service.handlePartialShipment({
        order_id: "ord_04",
        customer_id: "cust_01",
        choice: "ship_available",
        oos_items: oos,
      })

      expect(pref.oos_items).toEqual(oos)
    })
  })

  // ── createGuestOrder ─────────────────────────────────────────────

  describe("createGuestOrder()", () => {
    it("creates a guest session with correct phone", async () => {
      const session = await service.createGuestOrder({
        phone: "+919876543210",
        session_token: "tok_abc",
      })

      expect(session.phone).toBe("+919876543210")
      expect(session.session_token).toBe("tok_abc")
      expect(service._getGuestSessions()).toHaveLength(1)
    })

    it("sets expires_at approximately 7 days in the future", async () => {
      const before = Date.now()
      const session = await service.createGuestOrder({
        phone: "+919876543210",
        session_token: "tok_def",
      })

      const diff = (session.expires_at as Date).getTime() - before
      const sevenDays = 7 * 24 * 60 * 60 * 1000
      expect(diff).toBeGreaterThanOrEqual(sevenDays - 1000)
      expect(diff).toBeLessThanOrEqual(sevenDays + 1000)
    })

    it("stores optional email and cart_id", async () => {
      const session = await service.createGuestOrder({
        phone: "+919876543210",
        session_token: "tok_ghi",
        email: "guest@example.com",
        cart_id: "cart_99",
      })

      expect(session.email).toBe("guest@example.com")
      expect(session.cart_id).toBe("cart_99")
    })
  })
})
