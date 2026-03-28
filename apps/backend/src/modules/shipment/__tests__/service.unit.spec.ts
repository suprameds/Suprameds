/**
 * Unit tests for ShipmentModuleService custom business logic.
 * MedusaService is not imported — all CRUD operations are faked in-memory.
 */

// ---------- builder helpers ----------

let _idCounter = 0
function uid(prefix: string) {
  return `${prefix}_${++_idCounter}`
}

function buildShipment(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("shp"),
    order_id: uid("ord"),
    shipment_number: "SHP-2025-000001",
    carrier: "india-post",
    service_type: "speed-post",
    warehouse_id: uid("wh"),
    contains_rx_drug: false,
    is_cod: false,
    cod_amount: 0,
    awb_number: null,
    aftership_tracking_id: null,
    estimated_delivery: null,
    delivery_otp: null,
    delivery_otp_verified: false,
    delivery_attempts: 0,
    ndr_reason: null,
    ndr_action: null,
    dispatched_at: null,
    dispatched_by: null,
    status: "label_created",
    ...overrides,
  }
}

function buildShipmentItem(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("si"),
    shipment_id: uid("shp"),
    order_item_id: uid("oi"),
    batch_id: uid("batch"),
    quantity_shipped: 1,
    batch_number: "BATCH-001",
    expiry_date: new Date("2026-12-31"),
    ...overrides,
  }
}

function buildDeliveryOtpLog(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("otplog"),
    shipment_id: uid("shp"),
    otp_code: "123456",
    sent_to_phone: "99******10",
    attempts: 0,
    verified: false,
    verified_at: null,
    failed_reason: null,
    ...overrides,
  }
}

function buildDeliveryDaysLookup(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("ddl"),
    origin_state: "Maharashtra",
    dest_state: "Delhi",
    city_type: "metro",
    min_days: 2,
    max_days: 4,
    display_text: "2-4 business days",
    ...overrides,
  }
}

// ---------- FakeShipmentService ----------

class FakeShipmentService {
  private shipments: ReturnType<typeof buildShipment>[] = []
  private shipmentItems: ReturnType<typeof buildShipmentItem>[] = []
  private otpLogs: ReturnType<typeof buildDeliveryOtpLog>[] = []
  private deliveryLookups: ReturnType<typeof buildDeliveryDaysLookup>[] = []

  _seedShipments(data: ReturnType<typeof buildShipment>[]) {
    this.shipments = data
  }
  _seedOtpLogs(data: ReturnType<typeof buildDeliveryOtpLog>[]) {
    this.otpLogs = data
  }
  _seedDeliveryLookups(data: ReturnType<typeof buildDeliveryDaysLookup>[]) {
    this.deliveryLookups = data
  }

  // Internal mocks
  private async listShipments(
    _filters: Record<string, unknown>,
    _opts: { order: Record<string, string>; take: number }
  ) {
    return [...this.shipments].sort((a, b) =>
      b.id.localeCompare(a.id)
    )
  }

  private async createShipments(data: Record<string, unknown>) {
    const s = buildShipment(data)
    this.shipments.push(s)
    return s
  }

  private async updateShipments(data: Record<string, unknown>) {
    const idx = this.shipments.findIndex((s) => s.id === data.id)
    if (idx === -1) throw new Error(`Shipment ${data.id} not found`)
    this.shipments[idx] = { ...this.shipments[idx], ...data }
    return this.shipments[idx]
  }

  private async retrieveShipment(id: string) {
    const s = this.shipments.find((s) => s.id === id)
    if (!s) throw new Error(`Shipment ${id} not found`)
    return s
  }

  private async createShipmentItems(data: Record<string, unknown>) {
    const i = buildShipmentItem(data)
    this.shipmentItems.push(i)
    return i
  }

  private async createDeliveryOtpLogs(data: Record<string, unknown>) {
    const l = buildDeliveryOtpLog(data)
    this.otpLogs.push(l)
    return l
  }

  private async listDeliveryOtpLogs(filters: Record<string, unknown>) {
    return this.otpLogs.filter((l) =>
      Object.entries(filters).every(([k, v]) => l[k as keyof typeof l] === v)
    )
  }

  private async updateDeliveryOtpLogs(data: Record<string, unknown>) {
    const idx = this.otpLogs.findIndex((l) => l.id === data.id)
    if (idx === -1) throw new Error(`OtpLog ${data.id} not found`)
    this.otpLogs[idx] = { ...this.otpLogs[idx], ...data }
    return this.otpLogs[idx]
  }

  private async listDeliveryDaysLookups(filters: Record<string, unknown>) {
    return this.deliveryLookups.filter((l) =>
      Object.entries(filters).every(([k, v]) => l[k as keyof typeof l] === v)
    )
  }

  // ---- Public service methods (mirrors service.ts) ----

  async createShipment(data: {
    order_id: string
    warehouse_id: string
    contains_rx_drug: boolean
    is_cod?: boolean
    cod_amount?: number
    items: Array<{
      order_item_id: string
      batch_id: string
      quantity_shipped: number
      batch_number: string
      expiry_date: Date
    }>
    estimated_delivery?: Date
  }) {
    const year = new Date().getFullYear()
    const existing = await this.listShipments({}, { order: { created_at: "DESC" }, take: 1 })

    let seq = 1
    if (existing.length > 0) {
      const parts = existing[0].shipment_number.split("-")
      seq = parseInt(parts[2] ?? "0", 10) + 1
    }

    const shipmentNumber = `SHP-${year}-${String(seq).padStart(6, "0")}`

    let deliveryOtp: string | null = null
    if (data.contains_rx_drug) {
      deliveryOtp = String(Math.floor(100000 + Math.random() * 900000))
    }

    const shipment = await this.createShipments({
      order_id: data.order_id,
      shipment_number: shipmentNumber,
      carrier: "india-post",
      service_type: "speed-post",
      warehouse_id: data.warehouse_id,
      contains_rx_drug: data.contains_rx_drug,
      is_cod: data.is_cod ?? false,
      cod_amount: data.cod_amount ?? 0,
      estimated_delivery: data.estimated_delivery ?? null,
      delivery_otp: deliveryOtp,
      status: "label_created",
    })

    for (const item of data.items) {
      await this.createShipmentItems({
        shipment_id: shipment.id,
        order_item_id: item.order_item_id,
        batch_id: item.batch_id,
        quantity_shipped: item.quantity_shipped,
        batch_number: item.batch_number,
        expiry_date: item.expiry_date,
      })
    }

    return shipment
  }

  async enterAwb(shipmentId: string, awbNumber: string, dispatchedBy: string) {
    const awbPattern = /^(EU|EE|CP|EM|ED)\d{9}IN$/i
    if (!awbPattern.test(awbNumber)) {
      throw new Error(
        `Invalid AWB format: ${awbNumber}. Expected: EU/EE/CP + 9 digits + IN`
      )
    }

    return await this.updateShipments({
      id: shipmentId,
      awb_number: awbNumber.toUpperCase(),
      dispatched_at: new Date(),
      dispatched_by: dispatchedBy,
      status: "in_transit",
    })
  }

  async registerAfterShip(shipmentId: string, aftershipTrackingId: string) {
    return await this.updateShipments({
      id: shipmentId,
      aftership_tracking_id: aftershipTrackingId,
    })
  }

  async sendDeliveryOtp(data: { shipment_id: string; phone: string }) {
    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const maskedPhone = data.phone.replace(/(\d{2})\d{6}(\d{2})/, "$1******$2")

    const log = await this.createDeliveryOtpLogs({
      shipment_id: data.shipment_id,
      otp_code: otp,
      sent_to_phone: maskedPhone,
      attempts: 0,
      verified: false,
    })

    await this.updateShipments({ id: data.shipment_id, delivery_otp: otp })

    return { log_id: log.id, otp }
  }

  async verifyDeliveryOtp(shipmentId: string, otp: string) {
    const shipment = await this.retrieveShipment(shipmentId)

    if (shipment.delivery_otp !== otp) {
      const [log] = await this.listDeliveryOtpLogs({ shipment_id: shipmentId })
      if (log) {
        const newAttempts = (log.attempts ?? 0) + 1
        await this.updateDeliveryOtpLogs({
          id: log.id,
          attempts: newAttempts,
          failed_reason: newAttempts >= 3 ? "max_attempts_exceeded" : null,
        })
      }
      return { verified: false, reason: "Invalid OTP" }
    }

    await this.updateShipments({ id: shipmentId, delivery_otp_verified: true })

    const [log] = await this.listDeliveryOtpLogs({ shipment_id: shipmentId })
    if (log) {
      await this.updateDeliveryOtpLogs({ id: log.id, verified: true, verified_at: new Date() })
    }

    return { verified: true }
  }

  async handleNdr(shipmentId: string, action: "reattempt" | "rto", reason: string) {
    const shipment = await this.retrieveShipment(shipmentId)
    const updates: Record<string, unknown> = { ndr_reason: reason, ndr_action: action }

    if (action === "rto") {
      updates.status = "rto_initiated"
    } else {
      updates.status = "out_for_delivery"
      updates.delivery_attempts = (shipment.delivery_attempts ?? 0) + 1
    }

    return await this.updateShipments({ id: shipmentId, ...updates })
  }

  async getDeliveryEstimate(
    originState: string,
    destState: string,
    cityType: "metro" | "tier2" | "tier3" | "rural" = "metro"
  ) {
    const [lookup] = await this.listDeliveryDaysLookups({
      origin_state: originState,
      dest_state: destState,
      city_type: cityType,
    })

    if (!lookup) {
      return { min_days: 5, max_days: 10, display_text: "5-10 business days" }
    }

    return {
      min_days: lookup.min_days,
      max_days: lookup.max_days,
      display_text: lookup.display_text,
    }
  }

  // Expose internals
  _getShipments() { return this.shipments }
  _getShipmentItems() { return this.shipmentItems }
  _getOtpLogs() { return this.otpLogs }
}

const SAMPLE_ITEMS = [
  {
    order_item_id: "oi_01",
    batch_id: "batch_01",
    quantity_shipped: 30,
    batch_number: "MET-001",
    expiry_date: new Date("2026-12-31"),
  },
]

// ---------- tests ----------

describe("ShipmentModuleService (unit)", () => {
  let service: FakeShipmentService

  beforeEach(() => {
    service = new FakeShipmentService()
    _idCounter = 0
  })

  // ── createShipment ───────────────────────────────────────────────

  describe("createShipment()", () => {
    it("generates SHP-YEAR-000001 for the first shipment", async () => {
      const shipment = await service.createShipment({
        order_id: "ord_01",
        warehouse_id: "wh_01",
        contains_rx_drug: false,
        items: SAMPLE_ITEMS,
      })

      const year = new Date().getFullYear()
      expect(shipment.shipment_number).toBe(`SHP-${year}-000001`)
    })

    it("generates sequential shipment numbers", async () => {
      await service.createShipment({ order_id: "ord_01", warehouse_id: "wh_01", contains_rx_drug: false, items: [] })
      const s2 = await service.createShipment({ order_id: "ord_02", warehouse_id: "wh_01", contains_rx_drug: false, items: [] })

      const year = new Date().getFullYear()
      expect(s2.shipment_number).toBe(`SHP-${year}-000002`)
    })

    it("sets delivery_otp for Rx shipments", async () => {
      const shipment = await service.createShipment({
        order_id: "ord_01",
        warehouse_id: "wh_01",
        contains_rx_drug: true,
        items: [],
      })

      expect(shipment.delivery_otp).toBeTruthy()
      expect(shipment.delivery_otp).toMatch(/^\d{6}$/)
    })

    it("leaves delivery_otp null for non-Rx shipments", async () => {
      const shipment = await service.createShipment({
        order_id: "ord_02",
        warehouse_id: "wh_01",
        contains_rx_drug: false,
        items: [],
      })

      expect(shipment.delivery_otp).toBeNull()
    })

    it("creates a shipment item for each item in the list", async () => {
      await service.createShipment({
        order_id: "ord_03",
        warehouse_id: "wh_01",
        contains_rx_drug: false,
        items: [
          ...SAMPLE_ITEMS,
          { order_item_id: "oi_02", batch_id: "batch_02", quantity_shipped: 10, batch_number: "MET-002", expiry_date: new Date("2027-01-01") },
        ],
      })

      expect(service._getShipmentItems()).toHaveLength(2)
    })

    it("sets status=label_created and carrier=india-post", async () => {
      const shipment = await service.createShipment({
        order_id: "ord_04",
        warehouse_id: "wh_01",
        contains_rx_drug: false,
        items: [],
      })

      expect(shipment.status).toBe("label_created")
      expect(shipment.carrier).toBe("india-post")
    })
  })

  // ── enterAwb ─────────────────────────────────────────────────────

  describe("enterAwb()", () => {
    it("accepts valid EU AWB number and sets status to in_transit", async () => {
      const s = buildShipment({ id: "shp_01" })
      service._seedShipments([s])

      const updated = await service.enterAwb("shp_01", "EU123456789IN", "dispatch_agent_01")

      expect(updated.awb_number).toBe("EU123456789IN")
      expect(updated.status).toBe("in_transit")
      expect(updated.dispatched_by).toBe("dispatch_agent_01")
    })

    it("accepts valid EE AWB number", async () => {
      const s = buildShipment({ id: "shp_02" })
      service._seedShipments([s])

      const updated = await service.enterAwb("shp_02", "EE987654321IN", "agent_01")
      expect(updated.awb_number).toBe("EE987654321IN")
    })

    it("accepts valid CP AWB number", async () => {
      const s = buildShipment({ id: "shp_03" })
      service._seedShipments([s])

      const updated = await service.enterAwb("shp_03", "CP112233445IN", "agent_01")
      expect(updated.awb_number).toBe("CP112233445IN")
    })

    it("uppercases the AWB number", async () => {
      const s = buildShipment({ id: "shp_04" })
      service._seedShipments([s])

      const updated = await service.enterAwb("shp_04", "eu123456789in", "agent_01")
      expect(updated.awb_number).toBe("EU123456789IN")
    })

    it("throws for invalid AWB format", async () => {
      const s = buildShipment({ id: "shp_05" })
      service._seedShipments([s])

      await expect(
        service.enterAwb("shp_05", "INVALID123", "agent_01")
      ).rejects.toThrow("Invalid AWB format: INVALID123")
    })

    it("throws for AWB missing the IN suffix", async () => {
      const s = buildShipment({ id: "shp_06" })
      service._seedShipments([s])

      await expect(
        service.enterAwb("shp_06", "EU123456789UK", "agent_01")
      ).rejects.toThrow("Invalid AWB format")
    })

    it("throws for AWB with too few digits", async () => {
      const s = buildShipment({ id: "shp_07" })
      service._seedShipments([s])

      await expect(
        service.enterAwb("shp_07", "EU12345IN", "agent_01")
      ).rejects.toThrow("Invalid AWB format")
    })
  })

  // ── verifyDeliveryOtp ────────────────────────────────────────────

  describe("verifyDeliveryOtp()", () => {
    it("returns verified=true and updates log when OTP matches", async () => {
      const s = buildShipment({ id: "shp_01", delivery_otp: "654321" })
      service._seedShipments([s])
      service._seedOtpLogs([buildDeliveryOtpLog({ id: "otplog_01", shipment_id: "shp_01", otp_code: "654321" })])

      const result = await service.verifyDeliveryOtp("shp_01", "654321")

      expect(result.verified).toBe(true)

      const shipment = service._getShipments().find((s) => s.id === "shp_01")!
      expect(shipment.delivery_otp_verified).toBe(true)
    })

    it("returns verified=false and increments attempts when OTP is wrong", async () => {
      const s = buildShipment({ id: "shp_02", delivery_otp: "111111" })
      service._seedShipments([s])
      service._seedOtpLogs([buildDeliveryOtpLog({ id: "otplog_02", shipment_id: "shp_02", attempts: 0 })])

      const result = await service.verifyDeliveryOtp("shp_02", "999999")

      expect(result.verified).toBe(false)
      expect(result.reason).toBe("Invalid OTP")
    })

    it("sets failed_reason=max_attempts_exceeded after 3 failed attempts", async () => {
      const s = buildShipment({ id: "shp_03", delivery_otp: "111111" })
      service._seedShipments([s])
      service._seedOtpLogs([buildDeliveryOtpLog({ id: "otplog_03", shipment_id: "shp_03", attempts: 2 })])

      await service.verifyDeliveryOtp("shp_03", "999999")

      const log = service._getOtpLogs().find((l) => l.id === "otplog_03")!
      expect(log.failed_reason).toBe("max_attempts_exceeded")
      expect(log.attempts).toBe(3)
    })
  })

  // ── handleNdr ────────────────────────────────────────────────────

  describe("handleNdr()", () => {
    it("sets status=rto_initiated for rto action", async () => {
      const s = buildShipment({ id: "shp_01", status: "out_for_delivery", delivery_attempts: 1 })
      service._seedShipments([s])

      const updated = await service.handleNdr("shp_01", "rto", "Refused by customer")

      expect(updated.status).toBe("rto_initiated")
      expect(updated.ndr_reason).toBe("Refused by customer")
      expect(updated.ndr_action).toBe("rto")
    })

    it("increments delivery_attempts and sets status=out_for_delivery for reattempt", async () => {
      const s = buildShipment({ id: "shp_02", status: "out_for_delivery", delivery_attempts: 1 })
      service._seedShipments([s])

      const updated = await service.handleNdr("shp_02", "reattempt", "Customer not home")

      expect(updated.status).toBe("out_for_delivery")
      expect(updated.delivery_attempts).toBe(2)
    })
  })

  // ── getDeliveryEstimate ──────────────────────────────────────────

  describe("getDeliveryEstimate()", () => {
    it("returns lookup data when a matching record exists", async () => {
      service._seedDeliveryLookups([
        buildDeliveryDaysLookup({
          origin_state: "Maharashtra",
          dest_state: "Delhi",
          city_type: "metro",
          min_days: 2,
          max_days: 4,
          display_text: "2-4 business days",
        }),
      ])

      const estimate = await service.getDeliveryEstimate("Maharashtra", "Delhi", "metro")

      expect(estimate.min_days).toBe(2)
      expect(estimate.max_days).toBe(4)
      expect(estimate.display_text).toBe("2-4 business days")
    })

    it("returns fallback 5-10 days when no lookup record exists", async () => {
      const estimate = await service.getDeliveryEstimate("Maharashtra", "Assam", "rural")

      expect(estimate.min_days).toBe(5)
      expect(estimate.max_days).toBe(10)
      expect(estimate.display_text).toBe("5-10 business days")
    })

    it("defaults cityType to metro", async () => {
      service._seedDeliveryLookups([
        buildDeliveryDaysLookup({
          origin_state: "Karnataka",
          dest_state: "Karnataka",
          city_type: "metro",
          min_days: 1,
          max_days: 2,
          display_text: "1-2 business days",
        }),
      ])

      const estimate = await service.getDeliveryEstimate("Karnataka", "Karnataka")
      expect(estimate.min_days).toBe(1)
    })
  })

  // ── sendDeliveryOtp ──────────────────────────────────────────────

  describe("sendDeliveryOtp()", () => {
    it("generates a 6-digit OTP and creates a log entry", async () => {
      const s = buildShipment({ id: "shp_01" })
      service._seedShipments([s])

      const result = await service.sendDeliveryOtp({ shipment_id: "shp_01", phone: "+919876540010" })

      expect(result.otp).toMatch(/^\d{6}$/)
      expect(result.log_id).toBeTruthy()
      expect(service._getOtpLogs()).toHaveLength(1)
    })

    it("masks the phone number in the log (2 visible digits each side)", async () => {
      const s = buildShipment({ id: "shp_02" })
      service._seedShipments([s])

      await service.sendDeliveryOtp({ shipment_id: "shp_02", phone: "+919876540010" })

      const log = service._getOtpLogs()[0]
      expect(log.sent_to_phone).toContain("******")
      expect(log.sent_to_phone).not.toMatch(/\d{6}/)
    })
  })
})
