/**
 * Unit tests for PaymentModuleService custom business logic.
 * MedusaService is not imported — all CRUD operations are faked in-memory.
 */

// ---------- builder helpers ----------

let _idCounter = 0
function uid(prefix: string) {
  return `${prefix}_${++_idCounter}`
}

function buildPaymentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("pay"),
    order_id: uid("ord"),
    gateway: "razorpay" as "razorpay" | "stripe" | "cod",
    gateway_payment_id: null,
    payment_method: "upi",
    authorized_amount: 1000,
    captured_amount: 0,
    released_amount: 0,
    refunded_amount: 0,
    status: "authorized" as string,
    captured_at: null,
    metadata: null,
    ...overrides,
  }
}

function buildRefund(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("ref"),
    payment_id: uid("pay"),
    order_id: uid("ord"),
    raised_by: uid("user"),
    approved_by: null,
    reason: "customer_request",
    amount: 500,
    status: "pending_approval",
    gateway_refund_id: null,
    processed_at: null,
    ...overrides,
  }
}

function buildSupplyMemo(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("memo"),
    memo_number: `EPHM-2025-000001`,
    order_id: uid("ord"),
    shipment_id: null,
    customer_name: "Test Patient",
    customer_address: "123 Test St",
    prescription_ref: null,
    pharmacist_name: "Dr. Test",
    pharmacist_reg: "MH-1234",
    pharmacy_license: "LIC-5678",
    items: [],
    total_mrp: 0,
    total_discount: 0,
    total_gst: 0,
    total_payable: 0,
    payment_mode: "upi",
    generated_at: new Date(),
    ...overrides,
  }
}

// ---------- FakePaymentService ----------

class FakePaymentService {
  private records: ReturnType<typeof buildPaymentRecord>[] = []
  private refunds: ReturnType<typeof buildRefund>[] = []
  private memos: ReturnType<typeof buildSupplyMemo>[] = []

  _seedRecords(data: ReturnType<typeof buildPaymentRecord>[]) {
    this.records = data
  }
  _seedMemos(data: ReturnType<typeof buildSupplyMemo>[]) {
    this.memos = data
  }

  // Internal mocks
  private async retrievePaymentRecord(id: string) {
    const r = this.records.find((r) => r.id === id)
    if (!r) throw new Error(`PaymentRecord ${id} not found`)
    return r
  }

  private async createPaymentRecords(data: Record<string, unknown>) {
    const r = buildPaymentRecord(data)
    this.records.push(r)
    return r
  }

  private async updatePaymentRecords(data: Record<string, unknown>) {
    const idx = this.records.findIndex((r) => r.id === data.id)
    if (idx === -1) throw new Error(`PaymentRecord ${data.id} not found`)
    this.records[idx] = { ...this.records[idx], ...data }
    return this.records[idx]
  }

  private async createRefunds(data: Record<string, unknown>) {
    const r = buildRefund(data)
    this.refunds.push(r)
    return r
  }

  private async listSupplyMemoes(
    _filters: Record<string, unknown>,
    _opts: { order: Record<string, string>; take: number }
  ) {
    return [...this.memos].sort((a, b) =>
      (b.generated_at as Date).getTime() - (a.generated_at as Date).getTime()
    )
  }

  private async createSupplyMemoes(data: Record<string, unknown>) {
    const m = buildSupplyMemo(data)
    this.memos.push(m)
    return m
  }

  // ---- Public service methods (mirrors service.ts) ----

  async authorizeFull(data: {
    order_id: string
    gateway: "razorpay" | "stripe" | "cod"
    gateway_payment_id?: string
    payment_method: string
    amount: number
  }) {
    return await this.createPaymentRecords({
      order_id: data.order_id,
      gateway: data.gateway,
      gateway_payment_id: data.gateway_payment_id ?? null,
      payment_method: data.payment_method,
      authorized_amount: data.amount,
      captured_amount: 0,
      released_amount: 0,
      refunded_amount: 0,
      status: data.gateway === "cod" ? "cod_pending" : "authorized",
    })
  }

  async captureApproved(paymentId: string, amount: number) {
    const record = await this.retrievePaymentRecord(paymentId)
    const available =
      record.authorized_amount - record.captured_amount - record.released_amount

    if (amount > available) {
      throw new Error(`Cannot capture ${amount}: only ${available} available`)
    }

    const newCaptured = record.captured_amount + amount
    const isFullySettled =
      newCaptured + record.released_amount >= record.authorized_amount

    return await this.updatePaymentRecords({
      id: paymentId,
      captured_amount: newCaptured,
      captured_at: new Date(),
      status: isFullySettled ? "fully_captured" : "partially_captured",
    })
  }

  async releaseRejected(paymentId: string, amount: number) {
    const record = await this.retrievePaymentRecord(paymentId)
    const available =
      record.authorized_amount - record.captured_amount - record.released_amount

    if (amount > available) {
      throw new Error(`Cannot release ${amount}: only ${available} available for release`)
    }

    const newReleased = record.released_amount + amount
    const isFullySettled =
      record.captured_amount + newReleased >= record.authorized_amount

    return await this.updatePaymentRecords({
      id: paymentId,
      released_amount: newReleased,
      status: isFullySettled
        ? record.captured_amount > 0
          ? "fully_captured"
          : "voided"
        : "partially_captured",
    })
  }

  async processRefund(data: {
    payment_id: string
    order_id: string
    raised_by: string
    reason: string
    amount: number
  }) {
    return await this.createRefunds({
      payment_id: data.payment_id,
      order_id: data.order_id,
      raised_by: data.raised_by,
      approved_by: null,
      reason: data.reason,
      amount: data.amount,
      status: "pending_approval",
      gateway_refund_id: null,
      processed_at: null,
    })
  }

  async generatePaymentLink(data: {
    order_id: string
    amount: number
    customer_phone: string
    expiry_minutes?: number
  }) {
    return await this.createPaymentRecords({
      order_id: data.order_id,
      gateway: "razorpay",
      gateway_payment_id: null,
      payment_method: "payment_link",
      authorized_amount: data.amount,
      status: "authorized",
      metadata: {
        type: "payment_link",
        customer_phone: data.customer_phone,
        expiry_minutes: data.expiry_minutes ?? 60,
        created_at: new Date().toISOString(),
      },
    })
  }

  async generateSupplyMemo(data: {
    order_id: string
    shipment_id?: string
    customer_name: string
    customer_address: string
    prescription_ref?: string
    pharmacist_name: string
    pharmacist_reg: string
    pharmacy_license: string
    items: Array<{
      drug_name: string
      batch_number: string
      expiry_date: string
      quantity: number
      mrp: number
      selling_price: number
      gst_percent: number
    }>
    payment_mode: string
  }) {
    let totalMrp = 0
    let totalDiscount = 0
    let totalGst = 0

    for (const item of data.items) {
      const mrpTotal = item.mrp * item.quantity
      const sellingTotal = item.selling_price * item.quantity
      totalMrp += mrpTotal
      totalDiscount += mrpTotal - sellingTotal
      totalGst += sellingTotal * (item.gst_percent / 100)
    }

    const totalPayable = totalMrp - totalDiscount + totalGst

    const year = new Date().getFullYear()
    const existing = await this.listSupplyMemoes(
      {},
      { order: { created_at: "DESC" }, take: 1 }
    )

    let seq = 1
    if (existing.length > 0) {
      const parts = existing[0].memo_number.split("-")
      seq = parseInt(parts[2] ?? "0", 10) + 1
    }

    const memoNumber = `EPHM-${year}-${String(seq).padStart(6, "0")}`

    return await this.createSupplyMemoes({
      memo_number: memoNumber,
      order_id: data.order_id,
      shipment_id: data.shipment_id ?? null,
      customer_name: data.customer_name,
      customer_address: data.customer_address,
      prescription_ref: data.prescription_ref ?? null,
      pharmacist_name: data.pharmacist_name,
      pharmacist_reg: data.pharmacist_reg,
      pharmacy_license: data.pharmacy_license,
      items: data.items,
      total_mrp: totalMrp,
      total_discount: totalDiscount,
      total_gst: totalGst,
      total_payable: totalPayable,
      payment_mode: data.payment_mode,
      generated_at: new Date(),
    })
  }

  // Expose internals
  _getRecords() { return this.records }
  _getRefunds() { return this.refunds }
  _getMemos() { return this.memos }
}

const MEMO_DEFAULTS = {
  customer_name: "Raj Kumar",
  customer_address: "B-12, Powai, Mumbai 400076",
  pharmacist_name: "Dr. Anita Sharma",
  pharmacist_reg: "MH-PH-1234",
  pharmacy_license: "LIC-MH-5678",
  payment_mode: "upi",
}

// ---------- tests ----------

describe("PaymentModuleService (unit)", () => {
  let service: FakePaymentService

  beforeEach(() => {
    service = new FakePaymentService()
    _idCounter = 0
  })

  // ── authorizeFull ────────────────────────────────────────────────

  describe("authorizeFull()", () => {
    it("creates an authorized record for razorpay", async () => {
      const record = await service.authorizeFull({
        order_id: "ord_01",
        gateway: "razorpay",
        payment_method: "upi",
        amount: 1500,
      })

      expect(record.status).toBe("authorized")
      expect(record.authorized_amount).toBe(1500)
      expect(record.captured_amount).toBe(0)
    })

    it("sets status=cod_pending for COD gateway", async () => {
      const record = await service.authorizeFull({
        order_id: "ord_02",
        gateway: "cod",
        payment_method: "cash",
        amount: 800,
      })

      expect(record.status).toBe("cod_pending")
    })
  })

  // ── captureApproved ──────────────────────────────────────────────

  describe("captureApproved()", () => {
    it("captures the exact authorized amount and marks fully_captured", async () => {
      const r = buildPaymentRecord({ authorized_amount: 1000, captured_amount: 0, released_amount: 0 })
      service._seedRecords([r])

      const updated = await service.captureApproved(r.id, 1000)

      expect(updated.captured_amount).toBe(1000)
      expect(updated.status).toBe("fully_captured")
    })

    it("captures partial amount and marks partially_captured", async () => {
      const r = buildPaymentRecord({ authorized_amount: 1000, captured_amount: 0, released_amount: 0 })
      service._seedRecords([r])

      const updated = await service.captureApproved(r.id, 600)

      expect(updated.captured_amount).toBe(600)
      expect(updated.status).toBe("partially_captured")
    })

    it("throws when capture exceeds available balance", async () => {
      const r = buildPaymentRecord({ authorized_amount: 1000, captured_amount: 0, released_amount: 0 })
      service._seedRecords([r])

      await expect(service.captureApproved(r.id, 1001)).rejects.toThrow(
        "Cannot capture 1001: only 1000 available"
      )
    })

    it("accounts for already released amount in available balance", async () => {
      const r = buildPaymentRecord({ authorized_amount: 1000, captured_amount: 0, released_amount: 300 })
      service._seedRecords([r])

      await expect(service.captureApproved(r.id, 800)).rejects.toThrow(
        "Cannot capture 800: only 700 available"
      )
    })

    it("marks fully_captured when captured + released == authorized", async () => {
      const r = buildPaymentRecord({ authorized_amount: 1000, captured_amount: 0, released_amount: 400 })
      service._seedRecords([r])

      const updated = await service.captureApproved(r.id, 600)
      expect(updated.status).toBe("fully_captured")
    })
  })

  // ── releaseRejected ──────────────────────────────────────────────

  describe("releaseRejected()", () => {
    it("releases the full authorized amount when nothing was captured, marking voided", async () => {
      const r = buildPaymentRecord({ authorized_amount: 1000, captured_amount: 0, released_amount: 0 })
      service._seedRecords([r])

      const updated = await service.releaseRejected(r.id, 1000)

      expect(updated.released_amount).toBe(1000)
      expect(updated.status).toBe("voided")
    })

    it("marks fully_captured when captured > 0 and fully settled after release", async () => {
      const r = buildPaymentRecord({ authorized_amount: 1000, captured_amount: 600, released_amount: 0 })
      service._seedRecords([r])

      const updated = await service.releaseRejected(r.id, 400)

      expect(updated.status).toBe("fully_captured")
    })

    it("throws when release exceeds available balance", async () => {
      const r = buildPaymentRecord({ authorized_amount: 1000, captured_amount: 0, released_amount: 0 })
      service._seedRecords([r])

      await expect(service.releaseRejected(r.id, 1001)).rejects.toThrow(
        "Cannot release 1001: only 1000 available for release"
      )
    })

    it("prevents over-release when some amount already released", async () => {
      const r = buildPaymentRecord({ authorized_amount: 1000, captured_amount: 0, released_amount: 500 })
      service._seedRecords([r])

      await expect(service.releaseRejected(r.id, 600)).rejects.toThrow(
        "Cannot release 600: only 500 available for release"
      )
    })
  })

  // ── processRefund ────────────────────────────────────────────────

  describe("processRefund()", () => {
    it("creates a refund with pending_approval status", async () => {
      const refund = await service.processRefund({
        payment_id: "pay_01",
        order_id: "ord_01",
        raised_by: "customer_01",
        reason: "damaged_goods",
        amount: 300,
      })

      expect(refund.status).toBe("pending_approval")
      expect(refund.amount).toBe(300)
      expect(refund.approved_by).toBeNull()
      expect(refund.processed_at).toBeNull()
    })

    it("stores the reason and raising user", async () => {
      const refund = await service.processRefund({
        payment_id: "pay_02",
        order_id: "ord_02",
        raised_by: "agent_01",
        reason: "wrong_item",
        amount: 150,
      })

      expect(refund.reason).toBe("wrong_item")
      expect(refund.raised_by).toBe("agent_01")
    })
  })

  // ── generatePaymentLink ──────────────────────────────────────────

  describe("generatePaymentLink()", () => {
    it("creates a payment record with payment_link method", async () => {
      const record = await service.generatePaymentLink({
        order_id: "ord_01",
        amount: 2000,
        customer_phone: "+919876543210",
      })

      expect(record.payment_method).toBe("payment_link")
      expect(record.authorized_amount).toBe(2000)
      expect((record.metadata as any).type).toBe("payment_link")
    })

    it("defaults expiry_minutes to 60", async () => {
      const record = await service.generatePaymentLink({
        order_id: "ord_02",
        amount: 500,
        customer_phone: "+919876543210",
      })

      expect((record.metadata as any).expiry_minutes).toBe(60)
    })

    it("respects custom expiry_minutes", async () => {
      const record = await service.generatePaymentLink({
        order_id: "ord_03",
        amount: 500,
        customer_phone: "+919876543210",
        expiry_minutes: 30,
      })

      expect((record.metadata as any).expiry_minutes).toBe(30)
    })
  })

  // ── generateSupplyMemo ───────────────────────────────────────────

  describe("generateSupplyMemo()", () => {
    const baseItems = [
      {
        drug_name: "Metformin 500mg",
        batch_number: "MET-001",
        expiry_date: "2026-12-31",
        quantity: 30,
        mrp: 10,
        selling_price: 7,
        gst_percent: 12,
      },
    ]

    it("generates EPHM-YEAR-000001 for the very first memo", async () => {
      const memo = await service.generateSupplyMemo({
        ...MEMO_DEFAULTS,
        order_id: "ord_01",
        items: baseItems,
      })

      const year = new Date().getFullYear()
      expect(memo.memo_number).toBe(`EPHM-${year}-000001`)
    })

    it("generates sequential memo numbers (000001 then 000002)", async () => {
      await service.generateSupplyMemo({ ...MEMO_DEFAULTS, order_id: "ord_01", items: baseItems })
      const memo2 = await service.generateSupplyMemo({ ...MEMO_DEFAULTS, order_id: "ord_02", items: baseItems })

      const year = new Date().getFullYear()
      expect(memo2.memo_number).toBe(`EPHM-${year}-000002`)
    })

    it("computes totals correctly: totalMrp, totalDiscount, totalGst, totalPayable", async () => {
      const items = [
        { drug_name: "Drug A", batch_number: "B1", expiry_date: "2026-01-01", quantity: 2, mrp: 100, selling_price: 80, gst_percent: 5 },
        { drug_name: "Drug B", batch_number: "B2", expiry_date: "2026-01-01", quantity: 1, mrp: 50, selling_price: 50, gst_percent: 12 },
      ]

      const memo = await service.generateSupplyMemo({ ...MEMO_DEFAULTS, order_id: "ord_01", items })

      // totalMrp = 200 + 50 = 250
      expect(memo.total_mrp).toBe(250)
      // totalDiscount = (200-160) + (50-50) = 40
      expect(memo.total_discount).toBe(40)
      // totalGst = 160*0.05 + 50*0.12 = 8 + 6 = 14
      expect(memo.total_gst).toBeCloseTo(14)
      // totalPayable = mrp - discount + gst = 250 - 40 + 14 = 224
      expect(memo.total_payable).toBeCloseTo(224)
    })

    it("starts sequence after the last existing memo number", async () => {
      service._seedMemos([
        buildSupplyMemo({ memo_number: `EPHM-2025-000042`, generated_at: new Date() }),
      ])

      const memo = await service.generateSupplyMemo({ ...MEMO_DEFAULTS, order_id: "ord_01", items: baseItems })

      const year = new Date().getFullYear()
      expect(memo.memo_number).toBe(`EPHM-${year}-000043`)
    })

    it("zero-pads the sequence number to 6 digits", async () => {
      const memo = await service.generateSupplyMemo({ ...MEMO_DEFAULTS, order_id: "ord_01", items: baseItems })

      expect(memo.memo_number).toMatch(/EPHM-\d{4}-\d{6}/)
    })
  })
})
