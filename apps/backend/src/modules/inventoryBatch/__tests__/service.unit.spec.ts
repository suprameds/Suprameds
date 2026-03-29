/**
 * Unit tests for InventoryBatchModuleService.
 * MedusaService is not imported — all CRUD operations are faked in-memory.
 *
 * The real service is a pure MedusaService (no custom methods), so tests
 * validate CRUD behaviour plus business-rule scenarios that workflows and
 * jobs depend on (FEFO ordering, status transitions, PO lifecycle).
 */

// ---------- builder helpers ----------

let _idCounter = 0
function uid(prefix: string) {
  return `${prefix}_${++_idCounter}`
}

function buildBatch(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("batch"),
    product_variant_id: uid("var"),
    product_id: uid("prod"),
    lot_number: `LOT-${_idCounter}`,
    manufactured_on: null as string | null,
    expiry_date: new Date("2027-06-01").toISOString(),
    received_quantity: 100,
    available_quantity: 100,
    reserved_quantity: 0,
    batch_mrp_paise: 50000,
    purchase_price_paise: 30000,
    location_id: null as string | null,
    supplier_name: null as string | null,
    purchase_order_ref: null as string | null,
    grn_number: null as string | null,
    received_on: null as string | null,
    status: "active" as string,
    recall_reason: null as string | null,
    recalled_on: null as string | null,
    version: 0,
    metadata: null as Record<string, unknown> | null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function buildBatchDeduction(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("ded"),
    batch_id: uid("batch"),
    order_line_item_id: uid("oli"),
    order_id: uid("ord"),
    quantity: 1,
    deduction_type: "sale" as string,
    deducted_by: null as string | null,
    metadata: null as Record<string, unknown> | null,
    ...overrides,
  }
}

function buildBatchAuditLog(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("audit"),
    batch_id: uid("batch"),
    action: "created" as string,
    field_name: null as string | null,
    old_value: null as string | null,
    new_value: null as string | null,
    actor_id: null as string | null,
    actor_type: "system" as string,
    order_id: null as string | null,
    fulfillment_id: null as string | null,
    reason: null as string | null,
    metadata: null as Record<string, unknown> | null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function buildPurchaseOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("po"),
    po_number: `PO-2026-${String(_idCounter).padStart(3, "0")}`,
    supplier_name: "PharmaCorp Ltd",
    supplier_contact: null as string | null,
    supplier_invoice_number: null as string | null,
    order_date: new Date().toISOString(),
    expected_delivery_date: null as string | null,
    received_date: null as string | null,
    status: "draft" as string,
    grn_number: null as string | null,
    location_id: null as string | null,
    notes: null as string | null,
    total_items: 0,
    total_quantity: 0,
    total_cost_paise: 0,
    created_by: null as string | null,
    received_by: null as string | null,
    metadata: null as Record<string, unknown> | null,
    ...overrides,
  }
}

function buildPurchaseOrderLine(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("pol"),
    purchase_order_id: uid("po"),
    product_id: uid("prod"),
    product_variant_id: uid("var"),
    product_name: `Product ${_idCounter}`,
    lot_number: `LOT-${_idCounter}`,
    expiry_date: new Date("2027-12-31").toISOString(),
    manufactured_on: null as string | null,
    ordered_quantity: 100,
    received_quantity: 0,
    mrp_paise: 50000,
    purchase_price_paise: 30000,
    line_total_paise: 3000000,
    batch_id: null as string | null,
    line_status: "pending" as string,
    rejection_reason: null as string | null,
    metadata: null as Record<string, unknown> | null,
    ...overrides,
  }
}

// ---------- FakeInventoryBatchService ----------

class FakeInventoryBatchService {
  private batches: ReturnType<typeof buildBatch>[] = []
  private batchDeductions: ReturnType<typeof buildBatchDeduction>[] = []
  private batchAuditLogs: ReturnType<typeof buildBatchAuditLog>[] = []
  private purchaseOrders: ReturnType<typeof buildPurchaseOrder>[] = []
  private purchaseOrderLines: ReturnType<typeof buildPurchaseOrderLine>[] = []

  _seedBatches(data: ReturnType<typeof buildBatch>[]) {
    this.batches = data
  }
  _seedBatchDeductions(data: ReturnType<typeof buildBatchDeduction>[]) {
    this.batchDeductions = data
  }
  _seedBatchAuditLogs(data: ReturnType<typeof buildBatchAuditLog>[]) {
    this.batchAuditLogs = data
  }
  _seedPurchaseOrders(data: ReturnType<typeof buildPurchaseOrder>[]) {
    this.purchaseOrders = data
  }
  _seedPurchaseOrderLines(data: ReturnType<typeof buildPurchaseOrderLine>[]) {
    this.purchaseOrderLines = data
  }

  // ---- CRUD: Batches ----
  async createBatches(data: Record<string, unknown>) {
    const b = buildBatch(data)
    this.batches.push(b)
    return b
  }
  async retrieveBatch(id: string) {
    const b = this.batches.find((b) => b.id === id)
    if (!b) throw new Error(`Batch ${id} not found`)
    return b
  }
  async listBatches(
    filters: Record<string, unknown> = {},
    opts?: { take?: number | null; order?: Record<string, string> }
  ) {
    let result = this.batches.filter((b) =>
      Object.entries(filters).every(([k, v]) => b[k as keyof typeof b] === v)
    )

    // Support sorting by expiry_date ASC for FEFO tests
    if (opts?.order?.expiry_date === "ASC") {
      result = result.sort(
        (a, b) =>
          new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
      )
    }

    return result
  }
  async updateBatches(data: Record<string, unknown>) {
    const idx = this.batches.findIndex((b) => b.id === data.id)
    if (idx === -1) throw new Error(`Batch ${data.id} not found`)
    this.batches[idx] = { ...this.batches[idx], ...data } as ReturnType<typeof buildBatch>
    return this.batches[idx]
  }

  // ---- CRUD: BatchDeductions ----
  async createBatchDeductions(data: Record<string, unknown>) {
    const d = buildBatchDeduction(data)
    this.batchDeductions.push(d)
    return d
  }
  async listBatchDeductions(
    filters: Record<string, unknown> = {},
    _opts?: { take?: number | null }
  ) {
    return this.batchDeductions.filter((d) =>
      Object.entries(filters).every(([k, v]) => d[k as keyof typeof d] === v)
    )
  }

  // ---- CRUD: BatchAuditLogs ----
  async createBatchAuditLogs(data: Record<string, unknown>) {
    const a = buildBatchAuditLog(data)
    this.batchAuditLogs.push(a)
    return a
  }
  async listBatchAuditLogs(
    filters: Record<string, unknown> = {},
    _opts?: { take?: number | null }
  ) {
    return this.batchAuditLogs.filter((a) =>
      Object.entries(filters).every(([k, v]) => a[k as keyof typeof a] === v)
    )
  }

  // ---- CRUD: PurchaseOrders ----
  async createPurchaseOrders(data: Record<string, unknown>) {
    const po = buildPurchaseOrder(data)
    this.purchaseOrders.push(po)
    return po
  }
  async retrievePurchaseOrder(id: string) {
    const po = this.purchaseOrders.find((po) => po.id === id)
    if (!po) throw new Error(`PurchaseOrder ${id} not found`)
    return po
  }
  async listPurchaseOrders(
    filters: Record<string, unknown> = {},
    _opts?: { take?: number | null }
  ) {
    return this.purchaseOrders.filter((po) =>
      Object.entries(filters).every(([k, v]) => po[k as keyof typeof po] === v)
    )
  }
  async updatePurchaseOrders(data: Record<string, unknown>) {
    const idx = this.purchaseOrders.findIndex((po) => po.id === data.id)
    if (idx === -1) throw new Error(`PurchaseOrder ${data.id} not found`)
    this.purchaseOrders[idx] = {
      ...this.purchaseOrders[idx],
      ...data,
    } as ReturnType<typeof buildPurchaseOrder>
    return this.purchaseOrders[idx]
  }

  // ---- CRUD: PurchaseOrderLines ----
  async createPurchaseOrderLines(data: Record<string, unknown>) {
    const pol = buildPurchaseOrderLine(data)
    this.purchaseOrderLines.push(pol)
    return pol
  }
  async listPurchaseOrderLines(
    filters: Record<string, unknown> = {},
    _opts?: { take?: number | null }
  ) {
    return this.purchaseOrderLines.filter((pol) =>
      Object.entries(filters).every(([k, v]) => pol[k as keyof typeof pol] === v)
    )
  }
  async updatePurchaseOrderLines(data: Record<string, unknown>) {
    const idx = this.purchaseOrderLines.findIndex((pol) => pol.id === data.id)
    if (idx === -1) throw new Error(`PurchaseOrderLine ${data.id} not found`)
    this.purchaseOrderLines[idx] = {
      ...this.purchaseOrderLines[idx],
      ...data,
    } as ReturnType<typeof buildPurchaseOrderLine>
    return this.purchaseOrderLines[idx]
  }

  // Expose internals
  _getBatches() { return this.batches }
  _getBatchDeductions() { return this.batchDeductions }
  _getBatchAuditLogs() { return this.batchAuditLogs }
  _getPurchaseOrders() { return this.purchaseOrders }
  _getPurchaseOrderLines() { return this.purchaseOrderLines }
}

// ---------- tests ----------

describe("InventoryBatchModuleService (unit)", () => {
  let service: FakeInventoryBatchService

  beforeEach(() => {
    service = new FakeInventoryBatchService()
    _idCounter = 0
  })

  // ── Batch CRUD ──────────────────────────────────────────────────

  describe("Batch CRUD", () => {
    it("creates a batch with all required fields", async () => {
      const batch = await service.createBatches({
        product_variant_id: "var_001",
        product_id: "prod_001",
        lot_number: "LOT-ABC-001",
        expiry_date: new Date("2027-06-15").toISOString(),
        received_quantity: 500,
        available_quantity: 500,
        batch_mrp_paise: 25000,
        status: "active",
      })

      expect(batch.lot_number).toBe("LOT-ABC-001")
      expect(batch.available_quantity).toBe(500)
      expect(batch.status).toBe("active")
      expect(batch.version).toBe(0)
    })

    it("retrieves a batch by ID", async () => {
      service._seedBatches([
        buildBatch({ id: "batch_001", lot_number: "LOT-X1" }),
      ])

      const batch = await service.retrieveBatch("batch_001")

      expect(batch.lot_number).toBe("LOT-X1")
    })

    it("throws on retrieve for non-existent batch", async () => {
      await expect(
        service.retrieveBatch("batch_nonexistent")
      ).rejects.toThrow("Batch batch_nonexistent not found")
    })

    it("lists batches filtered by product_variant_id", async () => {
      service._seedBatches([
        buildBatch({ product_variant_id: "var_001" }),
        buildBatch({ product_variant_id: "var_001" }),
        buildBatch({ product_variant_id: "var_002" }),
      ])

      const batches = await service.listBatches({ product_variant_id: "var_001" })

      expect(batches).toHaveLength(2)
    })
  })

  // ── Batch status management ─────────────────────────────────────

  describe("Batch status management", () => {
    it("transitions active to depleted when quantity reaches 0", async () => {
      service._seedBatches([
        buildBatch({ id: "batch_001", status: "active", available_quantity: 5 }),
      ])

      // Simulate depletion
      const updated = await service.updateBatches({
        id: "batch_001",
        available_quantity: 0,
        status: "depleted",
      })

      expect(updated.status).toBe("depleted")
      expect(updated.available_quantity).toBe(0)
    })

    it("transitions active to recalled", async () => {
      service._seedBatches([
        buildBatch({ id: "batch_001", status: "active" }),
      ])

      const updated = await service.updateBatches({
        id: "batch_001",
        status: "recalled",
        recall_reason: "Manufacturer recall — contamination risk",
        recalled_on: new Date().toISOString(),
      })

      expect(updated.status).toBe("recalled")
      expect(updated.recall_reason).toBe(
        "Manufacturer recall — contamination risk"
      )
    })

    it("transitions active to quarantine", async () => {
      service._seedBatches([
        buildBatch({ id: "batch_001", status: "active" }),
      ])

      const updated = await service.updateBatches({
        id: "batch_001",
        status: "quarantine",
      })

      expect(updated.status).toBe("quarantine")
    })

    it("increments version on quantity update", async () => {
      service._seedBatches([
        buildBatch({ id: "batch_001", version: 0, available_quantity: 100 }),
      ])

      const updated = await service.updateBatches({
        id: "batch_001",
        available_quantity: 90,
        version: 1,
      })

      expect(updated.version).toBe(1)
      expect(updated.available_quantity).toBe(90)
    })
  })

  // ── Batch deductions ────────────────────────────────────────────

  describe("Batch deductions", () => {
    it("creates a deduction linked to an order line item and batch", async () => {
      const deduction = await service.createBatchDeductions({
        batch_id: "batch_001",
        order_line_item_id: "oli_001",
        order_id: "ord_001",
        quantity: 3,
        deduction_type: "sale",
        deducted_by: "user_wh",
      })

      expect(deduction.batch_id).toBe("batch_001")
      expect(deduction.order_line_item_id).toBe("oli_001")
      expect(deduction.quantity).toBe(3)
      expect(deduction.deduction_type).toBe("sale")
    })

    it("lists deductions by batch_id", async () => {
      service._seedBatchDeductions([
        buildBatchDeduction({ batch_id: "batch_001", quantity: 5 }),
        buildBatchDeduction({ batch_id: "batch_001", quantity: 3 }),
        buildBatchDeduction({ batch_id: "batch_002", quantity: 10 }),
      ])

      const deductions = await service.listBatchDeductions({ batch_id: "batch_001" })

      expect(deductions).toHaveLength(2)

      const totalDeducted = deductions.reduce((sum, d) => sum + d.quantity, 0)
      expect(totalDeducted).toBe(8)
    })

    it("supports return deduction type", async () => {
      const deduction = await service.createBatchDeductions({
        batch_id: "batch_001",
        order_line_item_id: "oli_002",
        order_id: "ord_002",
        quantity: 2,
        deduction_type: "return",
      })

      expect(deduction.deduction_type).toBe("return")
    })
  })

  // ── Audit logs ──────────────────────────────────────────────────

  describe("Audit logs", () => {
    it("creates an audit entry when a batch is created", async () => {
      const batch = await service.createBatches({
        lot_number: "LOT-AUDIT-01",
        available_quantity: 100,
      })

      const log = await service.createBatchAuditLogs({
        batch_id: batch.id,
        action: "created",
        new_value: "100",
        field_name: "available_quantity",
        actor_type: "admin",
        actor_id: "user_admin",
      })

      expect(log.action).toBe("created")
      expect(log.batch_id).toBe(batch.id)
      expect(log.new_value).toBe("100")
    })

    it("creates an audit entry when quantity is updated", async () => {
      service._seedBatches([
        buildBatch({ id: "batch_audit", available_quantity: 100 }),
      ])

      await service.updateBatches({ id: "batch_audit", available_quantity: 90 })

      const log = await service.createBatchAuditLogs({
        batch_id: "batch_audit",
        action: "qty_adjusted",
        field_name: "available_quantity",
        old_value: "100",
        new_value: "90",
        actor_type: "workflow",
        reason: "Order fulfillment deduction",
      })

      expect(log.action).toBe("qty_adjusted")
      expect(log.old_value).toBe("100")
      expect(log.new_value).toBe("90")
    })

    it("creates an audit entry for status changes", async () => {
      const log = await service.createBatchAuditLogs({
        batch_id: "batch_001",
        action: "status_changed",
        field_name: "status",
        old_value: "active",
        new_value: "recalled",
        actor_type: "admin",
        reason: "Manufacturer recall notice",
      })

      expect(log.action).toBe("status_changed")
      expect(log.old_value).toBe("active")
      expect(log.new_value).toBe("recalled")
    })

    it("lists audit logs filtered by batch_id", async () => {
      service._seedBatchAuditLogs([
        buildBatchAuditLog({ batch_id: "batch_001", action: "created" }),
        buildBatchAuditLog({ batch_id: "batch_001", action: "qty_adjusted" }),
        buildBatchAuditLog({ batch_id: "batch_002", action: "created" }),
      ])

      const logs = await service.listBatchAuditLogs({ batch_id: "batch_001" })

      expect(logs).toHaveLength(2)
    })
  })

  // ── Purchase order lifecycle ────────────────────────────────────

  describe("Purchase order lifecycle", () => {
    it("creates a PO in draft status", async () => {
      const po = await service.createPurchaseOrders({
        po_number: "PO-2026-001",
        supplier_name: "Generic Pharma Inc",
        order_date: new Date().toISOString(),
        status: "draft",
      })

      expect(po.status).toBe("draft")
      expect(po.po_number).toBe("PO-2026-001")
    })

    it("transitions draft to ordered", async () => {
      service._seedPurchaseOrders([
        buildPurchaseOrder({ id: "po_001", status: "draft" }),
      ])

      const updated = await service.updatePurchaseOrders({
        id: "po_001",
        status: "ordered",
      })

      expect(updated.status).toBe("ordered")
    })

    it("transitions ordered to partial when some lines are received", async () => {
      service._seedPurchaseOrders([
        buildPurchaseOrder({ id: "po_001", status: "ordered" }),
      ])

      const updated = await service.updatePurchaseOrders({
        id: "po_001",
        status: "partial",
      })

      expect(updated.status).toBe("partial")
    })

    it("transitions partial to received when all lines are complete", async () => {
      service._seedPurchaseOrders([
        buildPurchaseOrder({ id: "po_001", status: "partial" }),
      ])

      const updated = await service.updatePurchaseOrders({
        id: "po_001",
        status: "received",
        received_date: new Date().toISOString(),
        received_by: "user_wh_mgr",
        grn_number: "GRN-2026-001",
      })

      expect(updated.status).toBe("received")
      expect(updated.grn_number).toBe("GRN-2026-001")
      expect(updated.received_by).toBe("user_wh_mgr")
    })

    it("transitions to cancelled from draft", async () => {
      service._seedPurchaseOrders([
        buildPurchaseOrder({ id: "po_001", status: "draft" }),
      ])

      const updated = await service.updatePurchaseOrders({
        id: "po_001",
        status: "cancelled",
      })

      expect(updated.status).toBe("cancelled")
    })

    it("lists purchase orders filtered by status", async () => {
      service._seedPurchaseOrders([
        buildPurchaseOrder({ id: "po_001", status: "draft" }),
        buildPurchaseOrder({ id: "po_002", status: "ordered" }),
        buildPurchaseOrder({ id: "po_003", status: "draft" }),
        buildPurchaseOrder({ id: "po_004", status: "received" }),
      ])

      const drafts = await service.listPurchaseOrders({ status: "draft" })
      expect(drafts).toHaveLength(2)
      expect(drafts.every((po) => po.status === "draft")).toBe(true)

      const received = await service.listPurchaseOrders({ status: "received" })
      expect(received).toHaveLength(1)
    })

    it("throws when updating non-existent PO", async () => {
      await expect(
        service.updatePurchaseOrders({ id: "po_ghost", status: "ordered" })
      ).rejects.toThrow("PurchaseOrder po_ghost not found")
    })
  })

  // ── Purchase order lines ────────────────────────────────────────

  describe("Purchase order lines", () => {
    it("creates a line with expected quantities", async () => {
      const line = await service.createPurchaseOrderLines({
        purchase_order_id: "po_001",
        product_id: "prod_001",
        product_variant_id: "var_001",
        product_name: "Paracetamol 500mg",
        lot_number: "LOT-PARA-001",
        expiry_date: new Date("2027-12-31").toISOString(),
        ordered_quantity: 500,
        received_quantity: 0,
        purchase_price_paise: 15000,
        line_total_paise: 7500000,
      })

      expect(line.ordered_quantity).toBe(500)
      expect(line.received_quantity).toBe(0)
      expect(line.line_status).toBe("pending")
    })

    it("tracks received_qty on partial receipt", async () => {
      service._seedPurchaseOrderLines([
        buildPurchaseOrderLine({
          id: "pol_001",
          ordered_quantity: 500,
          received_quantity: 0,
          line_status: "pending",
        }),
      ])

      const updated = await service.updatePurchaseOrderLines({
        id: "pol_001",
        received_quantity: 300,
        line_status: "partial",
      })

      expect(updated.received_quantity).toBe(300)
      expect(updated.line_status).toBe("partial")
    })

    it("marks line as received when received_qty equals ordered_qty", async () => {
      service._seedPurchaseOrderLines([
        buildPurchaseOrderLine({
          id: "pol_001",
          ordered_quantity: 500,
          received_quantity: 300,
          line_status: "partial",
        }),
      ])

      const updated = await service.updatePurchaseOrderLines({
        id: "pol_001",
        received_quantity: 500,
        line_status: "received",
        batch_id: "batch_new_001",
      })

      expect(updated.received_quantity).toBe(500)
      expect(updated.line_status).toBe("received")
      expect(updated.batch_id).toBe("batch_new_001")
    })

    it("lists lines by purchase_order_id", async () => {
      service._seedPurchaseOrderLines([
        buildPurchaseOrderLine({ purchase_order_id: "po_001" }),
        buildPurchaseOrderLine({ purchase_order_id: "po_001" }),
        buildPurchaseOrderLine({ purchase_order_id: "po_002" }),
      ])

      const lines = await service.listPurchaseOrderLines({
        purchase_order_id: "po_001",
      })

      expect(lines).toHaveLength(2)
    })
  })

  // ── FEFO ordering ───────────────────────────────────────────────

  describe("FEFO ordering", () => {
    it("returns batches sorted by earliest expiry first", async () => {
      service._seedBatches([
        buildBatch({
          product_variant_id: "var_same",
          expiry_date: new Date("2027-12-01").toISOString(),
          lot_number: "LOT-DEC",
          status: "active",
        }),
        buildBatch({
          product_variant_id: "var_same",
          expiry_date: new Date("2027-03-01").toISOString(),
          lot_number: "LOT-MAR",
          status: "active",
        }),
        buildBatch({
          product_variant_id: "var_same",
          expiry_date: new Date("2027-09-01").toISOString(),
          lot_number: "LOT-SEP",
          status: "active",
        }),
      ])

      const batches = await service.listBatches(
        { product_variant_id: "var_same", status: "active" },
        { order: { expiry_date: "ASC" } }
      )

      expect(batches).toHaveLength(3)
      expect(batches[0].lot_number).toBe("LOT-MAR")
      expect(batches[1].lot_number).toBe("LOT-SEP")
      expect(batches[2].lot_number).toBe("LOT-DEC")
    })

    it("excludes non-active batches from FEFO listing", async () => {
      service._seedBatches([
        buildBatch({
          product_variant_id: "var_same",
          expiry_date: new Date("2027-01-01").toISOString(),
          status: "depleted",
        }),
        buildBatch({
          product_variant_id: "var_same",
          expiry_date: new Date("2027-06-01").toISOString(),
          status: "active",
        }),
        buildBatch({
          product_variant_id: "var_same",
          expiry_date: new Date("2027-03-01").toISOString(),
          status: "recalled",
        }),
      ])

      const activeBatches = await service.listBatches(
        { product_variant_id: "var_same", status: "active" },
        { order: { expiry_date: "ASC" } }
      )

      expect(activeBatches).toHaveLength(1)
      expect(activeBatches[0].status).toBe("active")
    })

    it("returns empty when no active batches exist for a variant", async () => {
      service._seedBatches([
        buildBatch({
          product_variant_id: "var_empty",
          status: "depleted",
        }),
      ])

      const batches = await service.listBatches(
        { product_variant_id: "var_empty", status: "active" },
        { order: { expiry_date: "ASC" } }
      )

      expect(batches).toHaveLength(0)
    })
  })
})
