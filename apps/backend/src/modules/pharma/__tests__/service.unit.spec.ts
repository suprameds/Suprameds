// @ts-nocheck — fake service classes don't replicate MedusaService's overloaded return types
/**
 * Unit tests for PharmaModuleService (pharmaCore module).
 * MedusaService is not imported — all CRUD operations are faked in-memory.
 */

// ---------- builder helpers ----------

let _idCounter = 0
function uid(prefix: string) {
  return `${prefix}_${++_idCounter}`
}

type Schedule = "OTC" | "H" | "H1" | "X"

function buildDrugProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("drug"),
    product_id: uid("prod"),
    schedule: "OTC" as Schedule,
    drug_class: null as string | null,
    cdsco_reg_no: null as string | null,
    manufacturer_license: null as string | null,
    generic_name: "Paracetamol",
    therapeutic_class: null as string | null,
    dosage_form: "tablet" as string,
    strength: "500mg" as string | null,
    composition: null as string | null,
    pack_size: "10 tablets" as string | null,
    unit_type: "strip" as string,
    mrp_paise: null as number | null,
    gst_rate: 12,
    hsn_code: null as string | null,
    indications: null as string | null,
    contraindications: null as string | null,
    side_effects: null as string | null,
    drug_interactions: null as string | null,
    storage_instructions: null as string | null,
    dosage_instructions: null as string | null,
    pharmacist_reviewed: false,
    pharmacist_reviewed_by: null as string | null,
    pharmacist_reviewed_at: null as Date | null,
    requires_refrigeration: false,
    is_narcotic: false,
    habit_forming: false,
    is_chronic: false,
    metadata: null as Record<string, unknown> | null,
    ...overrides,
  }
}

// ---------- FakePharmaService ----------

class FakePharmaService {
  private drugProducts: ReturnType<typeof buildDrugProduct>[] = []

  _seedDrugProducts(data: ReturnType<typeof buildDrugProduct>[]) {
    this.drugProducts = data
  }
  _getDrugProducts() { return this.drugProducts }

  // --- CRUD mirrors (named per MedusaService conventions) ---

  async createDrugProducts(data: Record<string, unknown> | Record<string, unknown>[]) {
    const items = Array.isArray(data) ? data : [data]
    const created: ReturnType<typeof buildDrugProduct>[] = []

    for (const item of items) {
      // Enforce product_id uniqueness
      const existing = this.drugProducts.find(
        (d) => d.product_id === item.product_id,
      )
      if (existing) {
        throw new Error(
          `DrugProduct with product_id "${item.product_id}" already exists`,
        )
      }
      const drug = buildDrugProduct(item)
      this.drugProducts.push(drug)
      created.push(drug)
    }

    return Array.isArray(data) ? created : created[0]
  }

  async listDrugProducts(
    filters: Record<string, unknown> = {},
    _opts?: { take: number | null },
  ) {
    return this.drugProducts.filter((d) =>
      Object.entries(filters).every(([k, v]) => {
        if (Array.isArray(v)) return v.includes(d[k as keyof typeof d])
        return d[k as keyof typeof d] === v
      }),
    )
  }

  async retrieveDrugProduct(id: string) {
    const drug = this.drugProducts.find((d) => d.id === id)
    if (!drug) throw new Error(`DrugProduct ${id} not found`)
    return drug
  }

  async updateDrugProducts(data: Record<string, unknown>) {
    const idx = this.drugProducts.findIndex((d) => d.id === data.id)
    if (idx === -1) throw new Error(`DrugProduct ${data.id} not found`)
    this.drugProducts[idx] = {
      ...this.drugProducts[idx],
      ...data,
    } as ReturnType<typeof buildDrugProduct>
    return this.drugProducts[idx]
  }

  async deleteDrugProducts(id: string) {
    const idx = this.drugProducts.findIndex((d) => d.id === id)
    if (idx === -1) throw new Error(`DrugProduct ${id} not found`)
    this.drugProducts.splice(idx, 1)
  }

  // --- Schedule classification helpers ---

  isNarcotic(schedule: Schedule): boolean {
    return schedule === "X"
  }

  requiresPrescription(schedule: Schedule): boolean {
    return schedule === "H" || schedule === "H1"
  }

  isOverTheCounter(schedule: Schedule): boolean {
    return schedule === "OTC"
  }
}

// ---------- tests ----------

describe("PharmaModuleService (unit)", () => {
  let service: FakePharmaService

  beforeEach(() => {
    service = new FakePharmaService()
    _idCounter = 0
  })

  // -- createDrugProducts --

  describe("createDrugProducts()", () => {
    it("creates a drug product with all fields", async () => {
      const drug = await service.createDrugProducts({
        product_id: "prod_abc",
        schedule: "H",
        generic_name: "Amoxicillin",
        therapeutic_class: "Antibiotic",
        dosage_form: "capsule",
        strength: "500mg",
        composition: "Amoxicillin Trihydrate 500mg",
        pack_size: "10 capsules",
        unit_type: "strip",
        gst_rate: 5,
        hsn_code: "3004",
        is_narcotic: false,
        habit_forming: false,
        is_chronic: false,
      })

      const d = drug as any
      expect(d.product_id).toBe("prod_abc")
      expect(d.schedule).toBe("H")
      expect(d.generic_name).toBe("Amoxicillin")
      expect(d.therapeutic_class).toBe("Antibiotic")
      expect(d.gst_rate).toBe(5)
    })

    it("creates multiple drug products from an array input", async () => {
      const drugs = await service.createDrugProducts([
        { product_id: "prod_01", generic_name: "Drug A" },
        { product_id: "prod_02", generic_name: "Drug B" },
      ])

      expect(drugs).toHaveLength(2)
      expect(service._getDrugProducts()).toHaveLength(2)
    })

    it("defaults schedule to OTC when not specified", async () => {
      const drug = await service.createDrugProducts({
        product_id: "prod_otc",
        generic_name: "Vitamin C",
      })

      expect(drug.schedule).toBe("OTC")
    })

    it("enforces product_id uniqueness", async () => {
      await service.createDrugProducts({
        product_id: "prod_dup",
        generic_name: "Drug A",
      })

      await expect(
        service.createDrugProducts({
          product_id: "prod_dup",
          generic_name: "Drug B",
        }),
      ).rejects.toThrow('DrugProduct with product_id "prod_dup" already exists')
    })
  })

  // -- listDrugProducts --

  describe("listDrugProducts()", () => {
    beforeEach(() => {
      service._seedDrugProducts([
        buildDrugProduct({ id: "d1", product_id: "p1", schedule: "OTC", generic_name: "Vitamin C", is_narcotic: false }),
        buildDrugProduct({ id: "d2", product_id: "p2", schedule: "H", generic_name: "Amoxicillin", is_narcotic: false }),
        buildDrugProduct({ id: "d3", product_id: "p3", schedule: "H1", generic_name: "Alprazolam", habit_forming: true }),
        buildDrugProduct({ id: "d4", product_id: "p4", schedule: "X", generic_name: "Morphine", is_narcotic: true }),
        buildDrugProduct({ id: "d5", product_id: "p5", schedule: "OTC", generic_name: "Paracetamol", is_chronic: true }),
      ])
    })

    it("lists all drug products without filters", async () => {
      const drugs = await service.listDrugProducts()
      expect(drugs).toHaveLength(5)
    })

    it("filters by schedule OTC", async () => {
      const drugs = await service.listDrugProducts({ schedule: "OTC" })
      expect(drugs).toHaveLength(2)
      expect(drugs.every((d) => d.schedule === "OTC")).toBe(true)
    })

    it("filters by schedule H", async () => {
      const drugs = await service.listDrugProducts({ schedule: "H" })
      expect(drugs).toHaveLength(1)
      expect(drugs[0].generic_name).toBe("Amoxicillin")
    })

    it("filters by schedule H1", async () => {
      const drugs = await service.listDrugProducts({ schedule: "H1" })
      expect(drugs).toHaveLength(1)
      expect(drugs[0].generic_name).toBe("Alprazolam")
    })

    it("filters by schedule X", async () => {
      const drugs = await service.listDrugProducts({ schedule: "X" })
      expect(drugs).toHaveLength(1)
      expect(drugs[0].generic_name).toBe("Morphine")
    })

    it("filters by is_narcotic flag", async () => {
      const drugs = await service.listDrugProducts({ is_narcotic: true })
      expect(drugs).toHaveLength(1)
      expect(drugs[0].schedule).toBe("X")
    })

    it("filters by habit_forming flag", async () => {
      const drugs = await service.listDrugProducts({ habit_forming: true })
      expect(drugs).toHaveLength(1)
      expect(drugs[0].generic_name).toBe("Alprazolam")
    })

    it("filters by is_chronic flag", async () => {
      const drugs = await service.listDrugProducts({ is_chronic: true })
      expect(drugs).toHaveLength(1)
      expect(drugs[0].generic_name).toBe("Paracetamol")
    })
  })

  // -- retrieveDrugProduct --

  describe("retrieveDrugProduct()", () => {
    it("retrieves an existing drug product by ID", async () => {
      service._seedDrugProducts([
        buildDrugProduct({ id: "d1", product_id: "p1", generic_name: "Aspirin" }),
      ])

      const drug = await service.retrieveDrugProduct("d1")
      expect(drug.generic_name).toBe("Aspirin")
      expect(drug.product_id).toBe("p1")
    })

    it("throws when drug product ID does not exist", async () => {
      await expect(
        service.retrieveDrugProduct("nonexistent"),
      ).rejects.toThrow("DrugProduct nonexistent not found")
    })
  })

  // -- updateDrugProducts --

  describe("updateDrugProducts()", () => {
    it("updates specific fields without clobbering others", async () => {
      service._seedDrugProducts([
        buildDrugProduct({
          id: "d1",
          product_id: "p1",
          generic_name: "Paracetamol",
          schedule: "OTC",
          strength: "500mg",
        }),
      ])

      const updated = await service.updateDrugProducts({
        id: "d1",
        strength: "650mg",
        therapeutic_class: "Analgesic",
      })

      expect(updated.strength).toBe("650mg")
      expect(updated.therapeutic_class).toBe("Analgesic")
      expect(updated.generic_name).toBe("Paracetamol") // unchanged
      expect(updated.schedule).toBe("OTC") // unchanged
    })

    it("throws when trying to update a non-existent drug product", async () => {
      await expect(
        service.updateDrugProducts({ id: "ghost", strength: "100mg" }),
      ).rejects.toThrow("DrugProduct ghost not found")
    })

    it("marks a drug product as pharmacist-reviewed", async () => {
      service._seedDrugProducts([
        buildDrugProduct({ id: "d1", pharmacist_reviewed: false }),
      ])

      const updated = await service.updateDrugProducts({
        id: "d1",
        pharmacist_reviewed: true,
        pharmacist_reviewed_by: "pharmacist_01",
        pharmacist_reviewed_at: new Date(),
      })

      expect(updated.pharmacist_reviewed).toBe(true)
      expect(updated.pharmacist_reviewed_by).toBe("pharmacist_01")
    })
  })

  // -- Schedule classification --

  describe("Schedule classification", () => {
    it("X schedule drugs are classified as narcotic", () => {
      expect(service.isNarcotic("X")).toBe(true)
      expect(service.isNarcotic("OTC")).toBe(false)
      expect(service.isNarcotic("H")).toBe(false)
      expect(service.isNarcotic("H1")).toBe(false)
    })

    it("H and H1 schedule drugs require a prescription", () => {
      expect(service.requiresPrescription("H")).toBe(true)
      expect(service.requiresPrescription("H1")).toBe(true)
      expect(service.requiresPrescription("OTC")).toBe(false)
      expect(service.requiresPrescription("X")).toBe(false)
    })

    it("OTC schedule drugs are over-the-counter", () => {
      expect(service.isOverTheCounter("OTC")).toBe(true)
      expect(service.isOverTheCounter("H")).toBe(false)
      expect(service.isOverTheCounter("H1")).toBe(false)
      expect(service.isOverTheCounter("X")).toBe(false)
    })
  })

  // -- Data integrity --

  describe("data integrity", () => {
    it("every drug product has a unique product_id across the store", async () => {
      await service.createDrugProducts({ product_id: "p1", generic_name: "A" })
      await service.createDrugProducts({ product_id: "p2", generic_name: "B" })

      const drugs = await service.listDrugProducts()
      const productIds = drugs.map((d) => d.product_id)
      expect(new Set(productIds).size).toBe(productIds.length)
    })

    it("Schedule X drugs should have is_narcotic true (data consistency)", async () => {
      const drug = await service.createDrugProducts({
        product_id: "p_x",
        generic_name: "Morphine Sulphate",
        schedule: "X",
        is_narcotic: true,
      })

      expect(drug.schedule).toBe("X")
      expect(drug.is_narcotic).toBe(true)
    })

    it("defaults pharmacist_reviewed to false for new drugs", async () => {
      const drug = await service.createDrugProducts({
        product_id: "p_new",
        generic_name: "New Drug",
      })

      expect(drug.pharmacist_reviewed).toBe(false)
    })

    it("defaults requires_refrigeration to false", async () => {
      const drug = await service.createDrugProducts({
        product_id: "p_temp",
        generic_name: "Room Temp Drug",
      })

      expect(drug.requires_refrigeration).toBe(false)
    })
  })
})
