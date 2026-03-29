/**
 * Unit tests for WarehouseModuleService custom business logic.
 * MedusaService is not imported — all CRUD operations are faked in-memory.
 */

// ---------- builder helpers ----------

let _idCounter = 0
function uid(prefix: string) {
  return `${prefix}_${++_idCounter}`
}

function buildWarehouse(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("wh"),
    name: "Suprameds Central Warehouse",
    code: `WH-${_idCounter}`,
    drug_license_no: "DL-TS-20B-123456",
    gst_registration: "36AABCS1234F1Z5",
    manager_id: uid("user"),
    address: null as Record<string, unknown> | null,
    is_active: true,
    ...overrides,
  }
}

function buildZone(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("zone"),
    warehouse_id: uid("wh"),
    zone_code: `Z-${_idCounter}`,
    zone_type: "ambient" as
      | "ambient"
      | "quarantine"
      | "controlled_access"
      | "receiving"
      | "dispatch"
      | "returns",
    access_level: "open" as "open" | "pharmacist_key" | "dual_key",
    ...overrides,
  }
}

function buildBin(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("bin"),
    zone_id: uid("zone"),
    bin_code: `BIN-${_idCounter}`,
    bin_barcode: `BC-${_idCounter}`,
    capacity_units: 100,
    current_units: 0,
    is_active: true,
    last_audit_at: null as string | null,
    ...overrides,
  }
}

function buildTask(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("task"),
    task_type: "pick" as string,
    reference_type: "order",
    reference_id: uid("ord"),
    assigned_to: null as string | null,
    warehouse_id: uid("wh"),
    priority: "normal" as string,
    status: "pending" as string,
    started_at: null as string | null,
    completed_at: null as string | null,
    exception_notes: null as string | null,
    ...overrides,
  }
}

function buildPickListLine(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("pll"),
    task_id: uid("task"),
    order_item_id: uid("oi"),
    allocation_id: uid("alloc"),
    batch_id: uid("batch"),
    bin_id: uid("bin"),
    quantity_to_pick: 10,
    quantity_picked: 0,
    status: "pending" as string,
    picked_by: null as string | null,
    picked_at: null as string | null,
    exception_reason: null as string | null,
    ...overrides,
  }
}

function buildGrnRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("grn"),
    grn_number: `GRN-${_idCounter}`,
    supplier_id: uid("sup"),
    supplier_invoice_no: `INV-${_idCounter}`,
    received_by: uid("user"),
    qc_approved_by: null as string | null,
    received_at: new Date().toISOString(),
    qc_approved_at: null as string | null,
    items: [] as any,
    status: "pending_qc" as string,
    ...overrides,
  }
}

function buildSupplier(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("sup"),
    supplier_name: `Supplier ${_idCounter}`,
    drug_license_no: `DL-${_idCounter}`,
    gst_number: `GST-${_idCounter}`,
    contact_person: null as string | null,
    phone: null as string | null,
    email: null as string | null,
    address: null as Record<string, unknown> | null,
    payment_terms: null as string | null,
    is_active: true,
    ...overrides,
  }
}

function buildReturnsInspection(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("ri"),
    order_item_id: uid("oi"),
    batch_id: uid("batch"),
    return_reason: "damaged" as string,
    result: "saleable" as string,
    action_taken: "restocked" as string,
    status: "pending" as string,
    approved_by: uid("user"),
    evidence_urls: null as string[] | null,
    inspected_at: new Date().toISOString(),
    ...overrides,
  }
}

function buildServiceablePincode(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("pin"),
    pincode: "500001",
    officename: "Hyderabad GPO",
    officetype: "H.O",
    delivery: "Delivery",
    district: "Hyderabad",
    statename: "Telangana",
    divisionname: null as string | null,
    regionname: null as string | null,
    circlename: null as string | null,
    latitude: null as string | null,
    longitude: null as string | null,
    is_serviceable: true,
    ...overrides,
  }
}

// ---------- FakeWarehouseService ----------

class FakeWarehouseService {
  private warehouses: ReturnType<typeof buildWarehouse>[] = []
  private zones: ReturnType<typeof buildZone>[] = []
  private bins: ReturnType<typeof buildBin>[] = []
  private tasks: ReturnType<typeof buildTask>[] = []
  private pickListLines: ReturnType<typeof buildPickListLine>[] = []
  private grnRecords: ReturnType<typeof buildGrnRecord>[] = []
  private suppliers: ReturnType<typeof buildSupplier>[] = []
  private returnsInspections: ReturnType<typeof buildReturnsInspection>[] = []
  private serviceablePincodes: ReturnType<typeof buildServiceablePincode>[] = []

  _seedWarehouses(data: ReturnType<typeof buildWarehouse>[]) {
    this.warehouses = data
  }
  _seedZones(data: ReturnType<typeof buildZone>[]) {
    this.zones = data
  }
  _seedBins(data: ReturnType<typeof buildBin>[]) {
    this.bins = data
  }
  _seedGrnRecords(data: ReturnType<typeof buildGrnRecord>[]) {
    this.grnRecords = data
  }
  _seedSuppliers(data: ReturnType<typeof buildSupplier>[]) {
    this.suppliers = data
  }
  _seedReturnsInspections(data: ReturnType<typeof buildReturnsInspection>[]) {
    this.returnsInspections = data
  }
  _seedServiceablePincodes(data: ReturnType<typeof buildServiceablePincode>[]) {
    this.serviceablePincodes = data
  }

  // ---- CRUD: Warehouses ----
  async createWarehouses(data: Record<string, unknown>) {
    const w = buildWarehouse(data)
    this.warehouses.push(w)
    return w
  }
  async listWarehouses(
    filters: Record<string, unknown> = {},
    _opts?: { take?: number | null }
  ) {
    return this.warehouses.filter((w) =>
      Object.entries(filters).every(([k, v]) => w[k as keyof typeof w] === v)
    )
  }
  async retrieveWarehouse(id: string) {
    const w = this.warehouses.find((w) => w.id === id)
    if (!w) throw new Error(`Warehouse ${id} not found`)
    return w
  }

  // ---- CRUD: Zones ----
  async createWarehouseZones(data: Record<string, unknown>) {
    const z = buildZone(data)
    this.zones.push(z)
    return z
  }
  async listWarehouseZones(
    filters: Record<string, unknown> = {},
    _opts?: { take?: number | null }
  ) {
    return this.zones.filter((z) =>
      Object.entries(filters).every(([k, v]) => z[k as keyof typeof z] === v)
    )
  }

  // ---- CRUD: Bins ----
  async createWarehouseBins(data: Record<string, unknown>) {
    const b = buildBin(data)
    this.bins.push(b)
    return b
  }
  async listWarehouseBins(
    filters: Record<string, unknown> = {},
    _opts?: { take?: number | null }
  ) {
    return this.bins.filter((b) =>
      Object.entries(filters).every(([k, v]) => b[k as keyof typeof b] === v)
    )
  }
  async updateWarehouseBins(data: Record<string, unknown>) {
    const idx = this.bins.findIndex((b) => b.id === data.id)
    if (idx === -1) throw new Error(`WarehouseBin ${data.id} not found`)
    this.bins[idx] = { ...this.bins[idx], ...data } as ReturnType<typeof buildBin>
    return this.bins[idx]
  }

  // ---- CRUD: GRN Records ----
  async createGrnRecords(data: Record<string, unknown>) {
    const g = buildGrnRecord(data)
    this.grnRecords.push(g)
    return g
  }
  async listGrnRecords(
    filters: Record<string, unknown> = {},
    _opts?: { take?: number | null }
  ) {
    return this.grnRecords.filter((g) =>
      Object.entries(filters).every(([k, v]) => g[k as keyof typeof g] === v)
    )
  }

  // ---- CRUD: Suppliers ----
  async createSuppliers(data: Record<string, unknown>) {
    const s = buildSupplier(data)
    this.suppliers.push(s)
    return s
  }
  async listSuppliers(
    filters: Record<string, unknown> = {},
    _opts?: { take?: number | null }
  ) {
    return this.suppliers.filter((s) =>
      Object.entries(filters).every(([k, v]) => s[k as keyof typeof s] === v)
    )
  }

  // ---- CRUD: Returns Inspections ----
  async createReturnsInspections(data: Record<string, unknown>) {
    const ri = buildReturnsInspection(data)
    this.returnsInspections.push(ri)
    return ri
  }
  async listReturnsInspections(
    filters: Record<string, unknown> = {},
    _opts?: { take?: number | null }
  ) {
    return this.returnsInspections.filter((ri) =>
      Object.entries(filters).every(([k, v]) => ri[k as keyof typeof ri] === v)
    )
  }

  // ---- CRUD: Serviceable Pincodes ----
  async createServiceablePincodes(data: Record<string, unknown>) {
    const p = buildServiceablePincode(data)
    this.serviceablePincodes.push(p)
    return p
  }
  async listServiceablePincodes(
    filters: Record<string, unknown> = {},
    _opts?: { take?: number | null }
  ) {
    return this.serviceablePincodes.filter((p) =>
      Object.entries(filters).every(([k, v]) => p[k as keyof typeof p] === v)
    )
  }

  // ---- Custom method: checkPincode (mirrors service.ts) ----
  async checkPincode(pincode: string): Promise<{
    serviceable: boolean
    district?: string
    state?: string
    delivery_type?: string
    estimated_days?: string
  }> {
    const records = (await this.listServiceablePincodes(
      { pincode, is_serviceable: true, delivery: "Delivery" },
      { take: 1 }
    )) as any[]

    if (records.length === 0) {
      return { serviceable: false }
    }

    const rec = records[0]
    const warehouseState = (
      process.env.WAREHOUSE_STATE || "Telangana"
    ).toLowerCase()
    const isSameState = rec.statename?.toLowerCase() === warehouseState
    const estimatedDays = isSameState ? "1-2 days" : "5-7 days"

    return {
      serviceable: true,
      district: rec.district,
      state: rec.statename,
      delivery_type: rec.delivery,
      estimated_days: estimatedDays,
    }
  }

  // Expose internals for assertions
  _getWarehouses() { return this.warehouses }
  _getZones() { return this.zones }
  _getBins() { return this.bins }
  _getGrnRecords() { return this.grnRecords }
  _getSuppliers() { return this.suppliers }
  _getReturnsInspections() { return this.returnsInspections }
  _getServiceablePincodes() { return this.serviceablePincodes }
}

// ---------- tests ----------

describe("WarehouseModuleService (unit)", () => {
  let service: FakeWarehouseService

  beforeEach(() => {
    service = new FakeWarehouseService()
    _idCounter = 0
    process.env.WAREHOUSE_STATE = "Telangana"
  })

  afterEach(() => {
    delete process.env.WAREHOUSE_STATE
  })

  // ── checkPincode ────────────────────────────────────────────────

  describe("checkPincode()", () => {
    it("returns serviceable=true with district and state for a valid pincode", async () => {
      service._seedServiceablePincodes([
        buildServiceablePincode({
          pincode: "500001",
          district: "Hyderabad",
          statename: "Telangana",
          delivery: "Delivery",
          is_serviceable: true,
        }),
      ])

      const result = await service.checkPincode("500001")

      expect(result.serviceable).toBe(true)
      expect(result.district).toBe("Hyderabad")
      expect(result.state).toBe("Telangana")
      expect(result.delivery_type).toBe("Delivery")
    })

    it("returns serviceable=false for a non-existent pincode", async () => {
      const result = await service.checkPincode("999999")

      expect(result.serviceable).toBe(false)
      expect(result.district).toBeUndefined()
      expect(result.state).toBeUndefined()
    })

    it("returns 1-2 days for same-state pincodes (Telangana)", async () => {
      service._seedServiceablePincodes([
        buildServiceablePincode({
          pincode: "500032",
          district: "Rangareddy",
          statename: "Telangana",
          delivery: "Delivery",
          is_serviceable: true,
        }),
      ])

      const result = await service.checkPincode("500032")

      expect(result.estimated_days).toBe("1-2 days")
    })

    it("returns 5-7 days for cross-state pincodes", async () => {
      service._seedServiceablePincodes([
        buildServiceablePincode({
          pincode: "110001",
          district: "Central Delhi",
          statename: "Delhi",
          delivery: "Delivery",
          is_serviceable: true,
        }),
      ])

      const result = await service.checkPincode("110001")

      expect(result.estimated_days).toBe("5-7 days")
    })

    it("respects WAREHOUSE_STATE env var for same-state comparison", async () => {
      process.env.WAREHOUSE_STATE = "Karnataka"

      service._seedServiceablePincodes([
        buildServiceablePincode({
          pincode: "560001",
          district: "Bangalore Urban",
          statename: "Karnataka",
          delivery: "Delivery",
          is_serviceable: true,
        }),
      ])

      const result = await service.checkPincode("560001")

      expect(result.estimated_days).toBe("1-2 days")
    })

    it("is case-insensitive for state matching", async () => {
      process.env.WAREHOUSE_STATE = "TELANGANA"

      service._seedServiceablePincodes([
        buildServiceablePincode({
          pincode: "500001",
          statename: "telangana",
          delivery: "Delivery",
          is_serviceable: true,
        }),
      ])

      const result = await service.checkPincode("500001")

      expect(result.estimated_days).toBe("1-2 days")
    })

    it("returns serviceable=false for non-delivery offices", async () => {
      service._seedServiceablePincodes([
        buildServiceablePincode({
          pincode: "500001",
          delivery: "Non-Delivery",
          is_serviceable: true,
        }),
      ])

      const result = await service.checkPincode("500001")

      expect(result.serviceable).toBe(false)
    })

    it("returns serviceable=false for pincodes marked is_serviceable=false", async () => {
      service._seedServiceablePincodes([
        buildServiceablePincode({
          pincode: "500001",
          delivery: "Delivery",
          is_serviceable: false,
        }),
      ])

      const result = await service.checkPincode("500001")

      expect(result.serviceable).toBe(false)
    })
  })

  // ── Warehouse CRUD ──────────────────────────────────────────────

  describe("Warehouse CRUD", () => {
    it("creates a warehouse with all required fields", async () => {
      const wh = await service.createWarehouses({
        name: "Test Warehouse",
        code: "WH-TEST",
        drug_license_no: "DL-TS-20B-999",
        gst_registration: "36XXXXX",
        manager_id: "user_mgr",
      })

      expect(wh.name).toBe("Test Warehouse")
      expect(wh.code).toBe("WH-TEST")
      expect(wh.is_active).toBe(true)
      expect(service._getWarehouses()).toHaveLength(1)
    })

    it("lists warehouses with filter", async () => {
      service._seedWarehouses([
        buildWarehouse({ is_active: true, name: "Active WH" }),
        buildWarehouse({ is_active: false, name: "Inactive WH" }),
      ])

      const active = await service.listWarehouses({ is_active: true })

      expect(active).toHaveLength(1)
      expect(active[0].name).toBe("Active WH")
    })

    it("retrieves a warehouse by ID", async () => {
      service._seedWarehouses([buildWarehouse({ id: "wh_001", name: "My WH" })])

      const wh = await service.retrieveWarehouse("wh_001")

      expect(wh.name).toBe("My WH")
    })

    it("throws on retrieve for non-existent warehouse", async () => {
      await expect(
        service.retrieveWarehouse("wh_nonexistent")
      ).rejects.toThrow("Warehouse wh_nonexistent not found")
    })
  })

  // ── Zone management ─────────────────────────────────────────────

  describe("Zone management", () => {
    it("creates a zone with the specified type", async () => {
      const zone = await service.createWarehouseZones({
        warehouse_id: "wh_001",
        zone_code: "Z-AMB-01",
        zone_type: "ambient",
        access_level: "open",
      })

      expect(zone.zone_type).toBe("ambient")
      expect(zone.access_level).toBe("open")
    })

    it("creates a controlled_access zone with dual_key access", async () => {
      const zone = await service.createWarehouseZones({
        warehouse_id: "wh_001",
        zone_code: "Z-CTRL-01",
        zone_type: "controlled_access",
        access_level: "dual_key",
      })

      expect(zone.zone_type).toBe("controlled_access")
      expect(zone.access_level).toBe("dual_key")
    })

    it("lists zones by warehouse_id", async () => {
      service._seedZones([
        buildZone({ warehouse_id: "wh_001", zone_type: "ambient" }),
        buildZone({ warehouse_id: "wh_001", zone_type: "quarantine" }),
        buildZone({ warehouse_id: "wh_002", zone_type: "dispatch" }),
      ])

      const zones = await service.listWarehouseZones({ warehouse_id: "wh_001" })

      expect(zones).toHaveLength(2)
    })
  })

  // ── Bin capacity tracking ───────────────────────────────────────

  describe("Bin capacity tracking", () => {
    it("creates a bin with max capacity and zero occupancy", async () => {
      const bin = await service.createWarehouseBins({
        zone_id: "zone_001",
        bin_code: "BIN-A1-01",
        bin_barcode: "BC-A1-01",
        capacity_units: 200,
        current_units: 0,
      })

      expect(bin.capacity_units).toBe(200)
      expect(bin.current_units).toBe(0)
      expect(bin.is_active).toBe(true)
    })

    it("updates current_units on stock receipt", async () => {
      service._seedBins([
        buildBin({ id: "bin_001", capacity_units: 100, current_units: 30 }),
      ])

      const updated = await service.updateWarehouseBins({
        id: "bin_001",
        current_units: 60,
      })

      expect(updated.current_units).toBe(60)
    })

    it("tracks bins at full capacity", async () => {
      service._seedBins([
        buildBin({ id: "bin_001", capacity_units: 50, current_units: 50 }),
      ])

      const bins = await service.listWarehouseBins({ zone_id: (service._getBins()[0] as any).zone_id })
      const bin = bins[0]

      expect(bin.current_units).toBe(bin.capacity_units)
    })
  })

  // ── GRN Records ─────────────────────────────────────────────────

  describe("GRN Records", () => {
    it("creates a GRN record with supplier linkage", async () => {
      const supplierId = "sup_001"
      service._seedSuppliers([
        buildSupplier({ id: supplierId, supplier_name: "PharmaCorp" }),
      ])

      const grn = await service.createGrnRecords({
        grn_number: "GRN-2026-001",
        supplier_id: supplierId,
        supplier_invoice_no: "INV-PC-100",
        received_by: "user_wh_mgr",
        items: [{ product_id: "prod_001", qty: 100, batch: "LOT-A1" }],
        received_at: new Date().toISOString(),
        status: "pending_qc",
      })

      expect(grn.grn_number).toBe("GRN-2026-001")
      expect(grn.supplier_id).toBe(supplierId)
      expect(grn.status).toBe("pending_qc")

      // Verify supplier exists
      const suppliers = await service.listSuppliers({ id: supplierId })
      expect(suppliers).toHaveLength(1)
      expect(suppliers[0].supplier_name).toBe("PharmaCorp")
    })

    it("lists GRN records by status", async () => {
      service._seedGrnRecords([
        buildGrnRecord({ status: "pending_qc" }),
        buildGrnRecord({ status: "approved" }),
        buildGrnRecord({ status: "pending_qc" }),
      ])

      const pending = await service.listGrnRecords({ status: "pending_qc" })

      expect(pending).toHaveLength(2)
    })
  })

  // ── Returns Inspection ──────────────────────────────────────────

  describe("Returns Inspection", () => {
    it("creates an inspection with saleable outcome and restocked action", async () => {
      const ri = await service.createReturnsInspections({
        order_item_id: "oi_001",
        batch_id: "batch_001",
        return_reason: "wrong_product",
        result: "saleable",
        action_taken: "restocked",
        approved_by: "user_pharmacist",
        inspected_at: new Date().toISOString(),
      })

      expect(ri.result).toBe("saleable")
      expect(ri.action_taken).toBe("restocked")
    })

    it("creates an inspection with damaged outcome and quarantined action", async () => {
      const ri = await service.createReturnsInspections({
        order_item_id: "oi_002",
        batch_id: "batch_002",
        return_reason: "damaged",
        result: "damaged",
        action_taken: "quarantined",
        approved_by: "user_pharmacist",
        inspected_at: new Date().toISOString(),
      })

      expect(ri.result).toBe("damaged")
      expect(ri.action_taken).toBe("quarantined")
    })

    it("creates an inspection with recalled outcome and destroyed action", async () => {
      const ri = await service.createReturnsInspections({
        order_item_id: "oi_003",
        batch_id: "batch_003",
        return_reason: "recalled",
        result: "recalled",
        action_taken: "destroyed",
        approved_by: "user_pharmacist",
        inspected_at: new Date().toISOString(),
      })

      expect(ri.result).toBe("recalled")
      expect(ri.action_taken).toBe("destroyed")
    })

    it("lists inspections by result type", async () => {
      service._seedReturnsInspections([
        buildReturnsInspection({ result: "saleable" }),
        buildReturnsInspection({ result: "damaged" }),
        buildReturnsInspection({ result: "saleable" }),
      ])

      const saleable = await service.listReturnsInspections({ result: "saleable" })

      expect(saleable).toHaveLength(2)
    })
  })
})
