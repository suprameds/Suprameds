// @ts-nocheck — fake service classes don't replicate MedusaService's overloaded return types
/**
 * Unit tests for PrescriptionModuleService (pharmaPrescription module).
 * MedusaService is not imported — all CRUD operations are faked in-memory.
 */

// ---------- builder helpers ----------

let _idCounter = 0
function uid(prefix: string) {
  return `${prefix}_${++_idCounter}`
}

type PrescriptionStatus = "pending_review" | "approved" | "rejected" | "expired" | "used"

function buildPrescription(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("rx"),
    customer_id: uid("cust") as string | null,
    guest_phone: null as string | null,
    file_key: "uploads/rx/test.jpg",
    file_url: null as string | null,
    original_filename: "test.jpg" as string | null,
    mime_type: "image/jpeg" as string | null,
    file_size_bytes: 512_000 as number | null,
    status: "pending_review" as PrescriptionStatus,
    reviewed_by: null as string | null,
    reviewed_at: null as Date | null,
    rejection_reason: null as string | null,
    doctor_name: null as string | null,
    doctor_reg_no: null as string | null,
    patient_name: null as string | null,
    prescribed_on: null as Date | null,
    valid_until: null as Date | null,
    fully_dispensed: false,
    pharmacist_notes: null as string | null,
    metadata: null as Record<string, unknown> | null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function buildPrescriptionLine(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("rxline"),
    prescription_id: "rx_01",
    product_variant_id: uid("variant"),
    product_id: uid("prod"),
    approved_quantity: 1,
    dispensed_quantity: 0,
    max_refills: null as number | null,
    refills_used: 0,
    metadata: null as Record<string, unknown> | null,
    ...overrides,
  }
}

// ---------- Valid status transitions ----------

const VALID_TRANSITIONS: Record<PrescriptionStatus, PrescriptionStatus[]> = {
  pending_review: ["approved", "rejected"],
  approved: ["expired", "used"],
  rejected: [], // terminal
  expired: [], // terminal
  used: [], // terminal
}

// ---------- FakePrescriptionService ----------

class FakePrescriptionService {
  private prescriptions: ReturnType<typeof buildPrescription>[] = []
  private prescriptionLines: ReturnType<typeof buildPrescriptionLine>[] = []

  _seedPrescriptions(data: ReturnType<typeof buildPrescription>[]) {
    this.prescriptions = data
  }
  _seedPrescriptionLines(data: ReturnType<typeof buildPrescriptionLine>[]) {
    this.prescriptionLines = data
  }
  _getPrescriptions() { return this.prescriptions }
  _getPrescriptionLines() { return this.prescriptionLines }

  // --- Prescriptions CRUD ---

  async createPrescriptions(data: Record<string, unknown> | Record<string, unknown>[]) {
    const items = Array.isArray(data) ? data : [data]
    const created: ReturnType<typeof buildPrescription>[] = []

    for (const item of items) {
      // Force status to pending_review on creation
      const rx = buildPrescription({ ...item, status: "pending_review" })
      this.prescriptions.push(rx)
      created.push(rx)
    }

    return Array.isArray(data) ? created : created[0]
  }

  async listPrescriptions(
    filters: Record<string, unknown> = {},
    _opts?: { take: number | null },
  ) {
    return this.prescriptions.filter((rx) =>
      Object.entries(filters).every(([k, v]) => {
        if (Array.isArray(v)) return v.includes(rx[k as keyof typeof rx])
        return rx[k as keyof typeof rx] === v
      }),
    )
  }

  async retrievePrescription(id: string) {
    const rx = this.prescriptions.find((r) => r.id === id)
    if (!rx) throw new Error(`Prescription ${id} not found`)
    return rx
  }

  async updatePrescriptions(data: Record<string, unknown>) {
    const idx = this.prescriptions.findIndex((r) => r.id === data.id)
    if (idx === -1) throw new Error(`Prescription ${data.id} not found`)

    const current = this.prescriptions[idx]

    // Enforce status transitions if status is being changed
    if (data.status && data.status !== current.status) {
      const allowed = VALID_TRANSITIONS[current.status]
      if (!allowed.includes(data.status as PrescriptionStatus)) {
        throw new Error(
          `Invalid status transition: ${current.status} -> ${data.status}`,
        )
      }
    }

    this.prescriptions[idx] = {
      ...current,
      ...data,
    } as ReturnType<typeof buildPrescription>
    return this.prescriptions[idx]
  }

  // --- PrescriptionLine CRUD ---

  async createPrescriptionLines(data: Record<string, unknown> | Record<string, unknown>[]) {
    const items = Array.isArray(data) ? data : [data]
    const created: ReturnType<typeof buildPrescriptionLine>[] = []

    for (const item of items) {
      // Validate prescription exists
      const rx = this.prescriptions.find((r) => r.id === item.prescription_id)
      if (!rx) {
        throw new Error(`Prescription ${item.prescription_id} not found`)
      }

      const line = buildPrescriptionLine(item)
      this.prescriptionLines.push(line)
      created.push(line)
    }

    return Array.isArray(data) ? created : created[0]
  }

  async listPrescriptionLines(
    filters: Record<string, unknown> = {},
    _opts?: { take: number | null },
  ) {
    return this.prescriptionLines.filter((l) =>
      Object.entries(filters).every(([k, v]) => l[k as keyof typeof l] === v),
    )
  }

  async updatePrescriptionLines(data: Record<string, unknown>) {
    const idx = this.prescriptionLines.findIndex((l) => l.id === data.id)
    if (idx === -1) throw new Error(`PrescriptionLine ${data.id} not found`)

    const current = this.prescriptionLines[idx]

    // Enforce dispensed_quantity cannot exceed approved_quantity
    if (
      typeof data.dispensed_quantity === "number" &&
      data.dispensed_quantity > current.approved_quantity
    ) {
      throw new Error(
        `Dispensed quantity (${data.dispensed_quantity}) cannot exceed approved quantity (${current.approved_quantity})`,
      )
    }

    this.prescriptionLines[idx] = {
      ...current,
      ...data,
    } as ReturnType<typeof buildPrescriptionLine>
    return this.prescriptionLines[idx]
  }

  // --- Business logic helpers ---

  isExpired(rx: ReturnType<typeof buildPrescription>): boolean {
    if (!rx.valid_until) return false
    return new Date(rx.valid_until) < new Date()
  }

  isOlderThanMonths(rx: ReturnType<typeof buildPrescription>, months: number): boolean {
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - months)
    return new Date(rx.created_at) < cutoff
  }
}

// ---------- tests ----------

describe("PrescriptionModuleService (unit)", () => {
  let service: FakePrescriptionService

  beforeEach(() => {
    service = new FakePrescriptionService()
    _idCounter = 0
  })

  // -- createPrescriptions --

  describe("createPrescriptions()", () => {
    it("creates a prescription with status pending_review", async () => {
      const rx = await service.createPrescriptions({
        customer_id: "cust_01",
        file_key: "uploads/rx/rx001.jpg",
        original_filename: "rx001.jpg",
        mime_type: "image/jpeg",
        file_size_bytes: 1_024_000,
      })

      expect(rx.status).toBe("pending_review")
      expect(rx.customer_id).toBe("cust_01")
      expect(rx.file_key).toBe("uploads/rx/rx001.jpg")
    })

    it("forces status to pending_review even if a different status is provided", async () => {
      const rx = await service.createPrescriptions({
        customer_id: "cust_01",
        file_key: "uploads/rx/rx002.jpg",
        status: "approved", // should be overridden
      })

      expect(rx.status).toBe("pending_review")
    })

    it("creates a guest prescription with guest_phone instead of customer_id", async () => {
      const rx = await service.createPrescriptions({
        customer_id: null,
        guest_phone: "+919876543210",
        file_key: "uploads/rx/guest.jpg",
      })

      expect(rx.customer_id).toBeNull()
      expect(rx.guest_phone).toBe("+919876543210")
    })

    it("creates multiple prescriptions from array input", async () => {
      const rxs = await service.createPrescriptions([
        { customer_id: "cust_01", file_key: "uploads/rx/a.jpg" },
        { customer_id: "cust_01", file_key: "uploads/rx/b.jpg" },
      ])

      expect(rxs).toHaveLength(2)
      expect(service._getPrescriptions()).toHaveLength(2)
    })

    it("defaults fully_dispensed to false", async () => {
      const rx = await service.createPrescriptions({
        customer_id: "cust_01",
        file_key: "uploads/rx/rx003.jpg",
      })

      expect(rx.fully_dispensed).toBe(false)
    })
  })

  // -- updatePrescriptions (status transitions) --

  describe("updatePrescriptions() — status transitions", () => {
    it("allows pending_review -> approved", async () => {
      service._seedPrescriptions([
        buildPrescription({ id: "rx_01", status: "pending_review" }),
      ])

      const updated = await service.updatePrescriptions({
        id: "rx_01",
        status: "approved",
        reviewed_by: "pharmacist_01",
        reviewed_at: new Date(),
        doctor_name: "Dr. Smith",
        doctor_reg_no: "MCI-12345",
        patient_name: "John Doe",
      })

      expect(updated.status).toBe("approved")
      expect(updated.reviewed_by).toBe("pharmacist_01")
      expect(updated.doctor_name).toBe("Dr. Smith")
    })

    it("allows pending_review -> rejected", async () => {
      service._seedPrescriptions([
        buildPrescription({ id: "rx_01", status: "pending_review" }),
      ])

      const updated = await service.updatePrescriptions({
        id: "rx_01",
        status: "rejected",
        reviewed_by: "pharmacist_01",
        reviewed_at: new Date(),
        rejection_reason: "Illegible prescription image",
      })

      expect(updated.status).toBe("rejected")
      expect(updated.rejection_reason).toBe("Illegible prescription image")
    })

    it("allows approved -> expired", async () => {
      service._seedPrescriptions([
        buildPrescription({ id: "rx_01", status: "approved" }),
      ])

      const updated = await service.updatePrescriptions({
        id: "rx_01",
        status: "expired",
      })

      expect(updated.status).toBe("expired")
    })

    it("allows approved -> used", async () => {
      service._seedPrescriptions([
        buildPrescription({ id: "rx_01", status: "approved" }),
      ])

      const updated = await service.updatePrescriptions({
        id: "rx_01",
        status: "used",
        fully_dispensed: true,
      })

      expect(updated.status).toBe("used")
      expect(updated.fully_dispensed).toBe(true)
    })

    it("rejects approved -> pending_review (invalid transition)", async () => {
      service._seedPrescriptions([
        buildPrescription({ id: "rx_01", status: "approved" }),
      ])

      await expect(
        service.updatePrescriptions({ id: "rx_01", status: "pending_review" }),
      ).rejects.toThrow("Invalid status transition: approved -> pending_review")
    })

    it("rejects rejected -> approved (terminal state)", async () => {
      service._seedPrescriptions([
        buildPrescription({ id: "rx_01", status: "rejected" }),
      ])

      await expect(
        service.updatePrescriptions({ id: "rx_01", status: "approved" }),
      ).rejects.toThrow("Invalid status transition: rejected -> approved")
    })

    it("rejects expired -> approved (terminal state)", async () => {
      service._seedPrescriptions([
        buildPrescription({ id: "rx_01", status: "expired" }),
      ])

      await expect(
        service.updatePrescriptions({ id: "rx_01", status: "approved" }),
      ).rejects.toThrow("Invalid status transition: expired -> approved")
    })

    it("allows non-status updates without transition validation", async () => {
      service._seedPrescriptions([
        buildPrescription({ id: "rx_01", status: "approved" }),
      ])

      const updated = await service.updatePrescriptions({
        id: "rx_01",
        pharmacist_notes: "Verified prescription authenticity",
      })

      expect(updated.pharmacist_notes).toBe("Verified prescription authenticity")
      expect(updated.status).toBe("approved") // unchanged
    })

    it("throws when prescription ID does not exist", async () => {
      await expect(
        service.updatePrescriptions({ id: "ghost", status: "approved" }),
      ).rejects.toThrow("Prescription ghost not found")
    })
  })

  // -- listPrescriptions --

  describe("listPrescriptions()", () => {
    beforeEach(() => {
      service._seedPrescriptions([
        buildPrescription({ id: "rx_01", customer_id: "cust_01", status: "pending_review" }),
        buildPrescription({ id: "rx_02", customer_id: "cust_01", status: "approved" }),
        buildPrescription({ id: "rx_03", customer_id: "cust_02", status: "approved" }),
        buildPrescription({ id: "rx_04", customer_id: "cust_01", status: "rejected" }),
        buildPrescription({ id: "rx_05", customer_id: "cust_02", status: "expired" }),
      ])
    })

    it("lists all prescriptions without filters", async () => {
      const rxs = await service.listPrescriptions()
      expect(rxs).toHaveLength(5)
    })

    it("filters by status", async () => {
      const approved = await service.listPrescriptions({ status: "approved" })
      expect(approved).toHaveLength(2)
      expect(approved.every((rx) => rx.status === "approved")).toBe(true)
    })

    it("filters by customer_id", async () => {
      const cust1 = await service.listPrescriptions({ customer_id: "cust_01" })
      expect(cust1).toHaveLength(3)
    })

    it("filters by both customer_id and status", async () => {
      const cust1Approved = await service.listPrescriptions({
        customer_id: "cust_01",
        status: "approved",
      })
      expect(cust1Approved).toHaveLength(1)
      expect(cust1Approved[0].id).toBe("rx_02")
    })

    it("returns empty array when no matches", async () => {
      const none = await service.listPrescriptions({ customer_id: "cust_ghost" })
      expect(none).toEqual([])
    })
  })

  // -- PrescriptionLine --

  describe("PrescriptionLine", () => {
    beforeEach(() => {
      service._seedPrescriptions([
        buildPrescription({ id: "rx_01", customer_id: "cust_01", status: "approved" }),
      ])
    })

    it("creates a line item linked to a prescription", async () => {
      const line = await service.createPrescriptionLines({
        prescription_id: "rx_01",
        product_variant_id: "var_01",
        product_id: "prod_01",
        approved_quantity: 30,
      })

      expect(line.prescription_id).toBe("rx_01")
      expect(line.product_variant_id).toBe("var_01")
      expect(line.approved_quantity).toBe(30)
      expect(line.dispensed_quantity).toBe(0)
    })

    it("throws when creating a line for a non-existent prescription", async () => {
      await expect(
        service.createPrescriptionLines({
          prescription_id: "rx_ghost",
          product_variant_id: "var_01",
          product_id: "prod_01",
        }),
      ).rejects.toThrow("Prescription rx_ghost not found")
    })

    it("tracks approved_qty vs dispensed_qty independently", async () => {
      const line = await service.createPrescriptionLines({
        prescription_id: "rx_01",
        product_variant_id: "var_01",
        product_id: "prod_01",
        approved_quantity: 30,
        dispensed_quantity: 0,
      })

      // Simulate partial dispensing
      const updated = await service.updatePrescriptionLines({
        id: line.id,
        dispensed_quantity: 10,
      })

      expect(updated.approved_quantity).toBe(30)
      expect(updated.dispensed_quantity).toBe(10)
    })

    it("rejects dispensing more than approved_quantity", async () => {
      const line = await service.createPrescriptionLines({
        prescription_id: "rx_01",
        product_variant_id: "var_01",
        product_id: "prod_01",
        approved_quantity: 10,
        dispensed_quantity: 0,
      })

      await expect(
        service.updatePrescriptionLines({
          id: line.id,
          dispensed_quantity: 15,
        }),
      ).rejects.toThrow(
        "Dispensed quantity (15) cannot exceed approved quantity (10)",
      )
    })

    it("allows dispensing exactly the approved_quantity", async () => {
      const line = await service.createPrescriptionLines({
        prescription_id: "rx_01",
        product_variant_id: "var_01",
        product_id: "prod_01",
        approved_quantity: 30,
      })

      const updated = await service.updatePrescriptionLines({
        id: line.id,
        dispensed_quantity: 30,
      })

      expect(updated.dispensed_quantity).toBe(30)
    })

    it("creates multiple lines for the same prescription", async () => {
      await service.createPrescriptionLines([
        { prescription_id: "rx_01", product_variant_id: "var_01", product_id: "prod_01", approved_quantity: 30 },
        { prescription_id: "rx_01", product_variant_id: "var_02", product_id: "prod_02", approved_quantity: 10 },
      ])

      const lines = await service.listPrescriptionLines({ prescription_id: "rx_01" })
      expect(lines).toHaveLength(2)
    })

    it("tracks refills_used against max_refills", async () => {
      const line = await service.createPrescriptionLines({
        prescription_id: "rx_01",
        product_variant_id: "var_01",
        product_id: "prod_01",
        approved_quantity: 30,
        max_refills: 3,
        refills_used: 0,
      })

      const afterRefill = await service.updatePrescriptionLines({
        id: line.id,
        refills_used: 1,
      })

      expect(afterRefill.max_refills).toBe(3)
      expect(afterRefill.refills_used).toBe(1)
    })

    it("defaults approved_quantity to 1 and dispensed_quantity to 0", async () => {
      const line = await service.createPrescriptionLines({
        prescription_id: "rx_01",
        product_variant_id: "var_01",
        product_id: "prod_01",
      })

      expect(line.approved_quantity).toBe(1)
      expect(line.dispensed_quantity).toBe(0)
    })
  })

  // -- Expiry logic --

  describe("expiry logic", () => {
    it("identifies a prescription as expired when valid_until is in the past", () => {
      const pastDate = new Date()
      pastDate.setMonth(pastDate.getMonth() - 1)

      const rx = buildPrescription({
        status: "approved",
        valid_until: pastDate,
      })

      expect(service.isExpired(rx)).toBe(true)
    })

    it("identifies a prescription as NOT expired when valid_until is in the future", () => {
      const futureDate = new Date()
      futureDate.setMonth(futureDate.getMonth() + 3)

      const rx = buildPrescription({
        status: "approved",
        valid_until: futureDate,
      })

      expect(service.isExpired(rx)).toBe(false)
    })

    it("returns false when valid_until is null (no expiry date set)", () => {
      const rx = buildPrescription({ status: "approved", valid_until: null })
      expect(service.isExpired(rx)).toBe(false)
    })

    it("prescriptions older than 6 months should be markable as expired", () => {
      const sevenMonthsAgo = new Date()
      sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7)

      const rx = buildPrescription({
        status: "approved",
        created_at: sevenMonthsAgo.toISOString(),
      })

      expect(service.isOlderThanMonths(rx, 6)).toBe(true)
    })

    it("prescriptions younger than 6 months should NOT be flagged", () => {
      const twoMonthsAgo = new Date()
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)

      const rx = buildPrescription({
        status: "approved",
        created_at: twoMonthsAgo.toISOString(),
      })

      expect(service.isOlderThanMonths(rx, 6)).toBe(false)
    })

    it("approved prescription with expired valid_until can transition to expired status", async () => {
      const pastDate = new Date()
      pastDate.setMonth(pastDate.getMonth() - 1)

      service._seedPrescriptions([
        buildPrescription({
          id: "rx_01",
          status: "approved",
          valid_until: pastDate,
        }),
      ])

      const rx = await service.retrievePrescription("rx_01")
      expect(service.isExpired(rx)).toBe(true)

      const updated = await service.updatePrescriptions({
        id: "rx_01",
        status: "expired",
      })
      expect(updated.status).toBe("expired")
    })
  })
})
