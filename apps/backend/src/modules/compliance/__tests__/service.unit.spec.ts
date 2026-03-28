/**
 * Unit tests for ComplianceModuleService custom business logic.
 * MedusaService is not imported — all CRUD operations are faked in-memory.
 */

// ---------- builder helpers ----------

let _idCounter = 0
function uid(prefix: string) {
  return `${prefix}_${++_idCounter}`
}

function buildOverrideRequest(overrides: Record<string, unknown> = {}) {
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 24)

  return {
    id: uid("ovr"),
    override_type: "schedule_h_dispensing",
    target_entity_type: "order",
    target_entity_id: uid("ord"),
    requested_by: uid("user"),
    requested_by_role: "pharmacist",
    justification: "Patient urgently requires medication as prescribed by Dr. Sharma for acute condition.",
    patient_impact: null,
    risk_assessment: "Low risk — standard Rx drug dispensing",
    supporting_doc_url: null,
    requires_dual_auth: false,
    status: "pending_primary",
    valid_for_hours: 24,
    expires_at: expiresAt,
    primary_approver_id: null,
    primary_approved_at: null,
    secondary_approver_id: null,
    secondary_approved_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function buildH1Entry(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("h1"),
    entry_date: new Date(),
    patient_name: "Ravi Kumar",
    patient_address: "123 MG Road, Pune",
    patient_age: 45,
    prescriber_name: "Dr. Mehta",
    prescriber_reg_no: "MH-DOC-001",
    drug_name: "Alprazolam 0.25mg",
    brand_name: "Restyl",
    batch_number: "ALP-001",
    quantity_dispensed: 10,
    dispensing_pharmacist: "Anita Sharma",
    pharmacist_reg_no: "MH-PH-123",
    order_item_id: uid("oi"),
    ...overrides,
  }
}

function buildPharmacyLicense(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("lic"),
    license_number: "LIC-MH-001",
    license_type: "retail",
    valid_from: new Date("2024-01-01"),
    valid_until: new Date("2027-01-01"),
    is_active: true,
    ...overrides,
  }
}

// ---------- FakeComplianceService ----------

class FakeComplianceService {
  private overrides: ReturnType<typeof buildOverrideRequest>[] = []
  private h1Entries: ReturnType<typeof buildH1Entry>[] = []
  private licenses: ReturnType<typeof buildPharmacyLicense>[] = []
  private phiLogs: unknown[] = []

  _seedOverrides(data: ReturnType<typeof buildOverrideRequest>[]) {
    this.overrides = data
  }
  _seedH1Entries(data: ReturnType<typeof buildH1Entry>[]) {
    this.h1Entries = data
  }
  _seedLicenses(data: ReturnType<typeof buildPharmacyLicense>[]) {
    this.licenses = data
  }

  // Internal mocks
  private async retrieveOverrideRequest(id: string) {
    const r = this.overrides.find((o) => o.id === id)
    if (!r) throw new Error(`OverrideRequest ${id} not found`)
    return r
  }

  private async createOverrideRequests(data: Record<string, unknown>) {
    const r = buildOverrideRequest(data)
    this.overrides.push(r)
    return r
  }

  private async updateOverrideRequests(data: Record<string, unknown>) {
    const idx = this.overrides.findIndex((o) => o.id === data.id)
    if (idx === -1) throw new Error(`OverrideRequest ${data.id} not found`)
    this.overrides[idx] = { ...this.overrides[idx], ...data }
    return this.overrides[idx]
  }

  private async listH1RegisterEntries(
    filters: Record<string, unknown>,
    _opts?: { take: null }
  ) {
    return this.h1Entries.filter((e) =>
      Object.entries(filters).every(([k, v]) => e[k as keyof typeof e] === v)
    )
  }

  private async listPharmacyLicenses(
    filters: Record<string, unknown>,
    _opts?: { take: null }
  ) {
    return this.licenses.filter((l) =>
      Object.entries(filters).every(([k, v]) => l[k as keyof typeof l] === v)
    )
  }

  private async listPhiAuditLogs(_filters: Record<string, unknown>, _opts?: { take: number }) {
    return this.phiLogs
  }

  private async listOverrideRequests(_filters: Record<string, unknown>, _opts?: { take: null }) {
    return this.overrides
  }

  // ---- Public service methods (mirrors service.ts) ----

  async runChecklist(data: {
    order_id: string
    checks: Array<{ rule: string; passed: boolean; details?: string }>
  }) {
    const allPassed = data.checks.every((c) => c.passed)
    const failures = data.checks.filter((c) => !c.passed)

    return {
      order_id: data.order_id,
      passed: allPassed,
      total_checks: data.checks.length,
      passed_checks: data.checks.length - failures.length,
      failed_checks: failures.length,
      failures: failures.map((f) => ({ rule: f.rule, details: f.details })),
      checked_at: new Date().toISOString(),
    }
  }

  async exportH1Register(dateRange: { from: Date; to: Date }) {
    const entries = await this.listH1RegisterEntries({}, { take: null })

    const filtered = entries.filter((e) => {
      const d = new Date(e.entry_date)
      return d >= dateRange.from && d <= dateRange.to
    })

    return {
      period: {
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString(),
      },
      total_entries: filtered.length,
      entries: filtered.map((e) => ({
        entry_date: e.entry_date,
        patient_name: e.patient_name,
        patient_address: e.patient_address,
        patient_age: e.patient_age,
        prescriber_name: e.prescriber_name,
        prescriber_reg_no: e.prescriber_reg_no,
        drug_name: e.drug_name,
        brand_name: e.brand_name,
        batch_number: e.batch_number,
        quantity_dispensed: e.quantity_dispensed,
        dispensing_pharmacist: e.dispensing_pharmacist,
        pharmacist_reg_no: e.pharmacist_reg_no,
      })),
      exported_at: new Date().toISOString(),
    }
  }

  async generateRecallReport(batchNumber: string) {
    const entries = await this.listH1RegisterEntries({ batch_number: batchNumber }, { take: null })

    return {
      batch_number: batchNumber,
      affected_dispenses: entries.length,
      patients_affected: new Set(entries.map((e) => e.patient_name)).size,
      entries: entries.map((e) => ({
        entry_date: e.entry_date,
        patient_name: e.patient_name,
        patient_address: e.patient_address,
        drug_name: e.drug_name,
        quantity_dispensed: e.quantity_dispensed,
        order_item_id: e.order_item_id,
      })),
      generated_at: new Date().toISOString(),
    }
  }

  async exportGstr1(period: { month: number; year: number }) {
    return {
      period: `${period.year}-${String(period.month).padStart(2, "0")}`,
      gstin: process.env.PHARMACY_GSTIN ?? "NOT_SET",
      status: "draft",
      sections: {
        b2b: { invoice_count: 0, taxable_value: 0, total_gst: 0 },
        b2c_large: { invoice_count: 0, taxable_value: 0, total_gst: 0 },
        b2c_small: { invoice_count: 0, taxable_value: 0, total_gst: 0 },
        credit_debit_notes: { count: 0, total: 0 },
        nil_rated_exempt: { value: 0 },
      },
      generated_at: new Date().toISOString(),
    }
  }

  async createOverrideRequest(data: {
    override_type: string
    target_entity_type: string
    target_entity_id: string
    requested_by: string
    requested_by_role: string
    justification: string
    patient_impact?: string
    risk_assessment: string
    supporting_doc_url?: string
    requires_dual_auth?: boolean
    valid_for_hours?: number
  }) {
    if (data.justification.length < 50) {
      throw new Error("Override justification must be at least 50 characters")
    }

    const validHours = data.valid_for_hours ?? 24
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + validHours)

    return await this.createOverrideRequests({
      override_type: data.override_type,
      target_entity_type: data.target_entity_type,
      target_entity_id: data.target_entity_id,
      requested_by: data.requested_by,
      requested_by_role: data.requested_by_role,
      justification: data.justification,
      patient_impact: data.patient_impact ?? null,
      risk_assessment: data.risk_assessment,
      supporting_doc_url: data.supporting_doc_url ?? null,
      requires_dual_auth: data.requires_dual_auth ?? false,
      status: "pending_primary",
      valid_for_hours: validHours,
      expires_at: expiresAt,
    })
  }

  async approveOverride(
    overrideId: string,
    approverId: string,
    isPrimary: boolean
  ) {
    const override = await this.retrieveOverrideRequest(overrideId)

    if (override.requested_by === approverId) {
      throw new Error("SSD violation: approver cannot be the same as requester")
    }

    if (new Date() > new Date(override.expires_at)) {
      await this.updateOverrideRequests({ id: overrideId, status: "expired" })
      throw new Error("Override request has expired")
    }

    if (isPrimary) {
      if (override.status !== "pending_primary") {
        throw new Error(
          `Cannot approve: status is ${override.status}, expected pending_primary`
        )
      }

      const nextStatus = override.requires_dual_auth ? "pending_secondary" : "approved"

      return await this.updateOverrideRequests({
        id: overrideId,
        primary_approver_id: approverId,
        primary_approved_at: new Date(),
        status: nextStatus,
      })
    } else {
      if (override.status !== "pending_secondary") {
        throw new Error(
          `Cannot approve: status is ${override.status}, expected pending_secondary`
        )
      }

      if (override.primary_approver_id === approverId) {
        throw new Error(
          "SSD violation: secondary approver must differ from primary approver"
        )
      }

      return await this.updateOverrideRequests({
        id: overrideId,
        secondary_approver_id: approverId,
        secondary_approved_at: new Date(),
        status: "approved",
      })
    }
  }

  // Expose internals
  _getOverrides() { return this.overrides }
}

const LONG_JUSTIFICATION =
  "Patient requires emergency dispensing of Schedule H drug. Prescriber verified via phone. Risk assessed as acceptable by PIC."

// ---------- tests ----------

describe("ComplianceModuleService (unit)", () => {
  let service: FakeComplianceService

  beforeEach(() => {
    service = new FakeComplianceService()
    _idCounter = 0
  })

  // ── createOverrideRequest ────────────────────────────────────────

  describe("createOverrideRequest()", () => {
    it("creates an override request with status=pending_primary", async () => {
      const req = await service.createOverrideRequest({
        override_type: "schedule_h_dispensing",
        target_entity_type: "order",
        target_entity_id: "ord_01",
        requested_by: "pharmacist_01",
        requested_by_role: "pharmacist",
        justification: LONG_JUSTIFICATION,
        risk_assessment: "Low risk",
      })

      expect(req.status).toBe("pending_primary")
      expect(req.requires_dual_auth).toBe(false)
    })

    it("throws when justification is shorter than 50 characters", async () => {
      await expect(
        service.createOverrideRequest({
          override_type: "schedule_h_dispensing",
          target_entity_type: "order",
          target_entity_id: "ord_01",
          requested_by: "pharmacist_01",
          requested_by_role: "pharmacist",
          justification: "Too short",
          risk_assessment: "Low risk",
        })
      ).rejects.toThrow("Override justification must be at least 50 characters")
    })

    it("accepts a justification of exactly 50 characters", async () => {
      const justification = "A".repeat(50)
      const req = await service.createOverrideRequest({
        override_type: "test",
        target_entity_type: "order",
        target_entity_id: "ord_01",
        requested_by: "pharmacist_01",
        requested_by_role: "pharmacist",
        justification,
        risk_assessment: "Low",
      })

      expect(req.status).toBe("pending_primary")
    })

    it("defaults valid_for_hours to 24", async () => {
      const before = Date.now()
      const req = await service.createOverrideRequest({
        override_type: "test",
        target_entity_type: "order",
        target_entity_id: "ord_01",
        requested_by: "pharm_01",
        requested_by_role: "pharmacist",
        justification: LONG_JUSTIFICATION,
        risk_assessment: "Low",
      })

      expect(req.valid_for_hours).toBe(24)
      const expiryMs = new Date(req.expires_at).getTime() - before
      const twentyFourHours = 24 * 60 * 60 * 1000
      expect(expiryMs).toBeGreaterThanOrEqual(twentyFourHours - 5000)
      expect(expiryMs).toBeLessThanOrEqual(twentyFourHours + 5000)
    })

    it("respects a custom valid_for_hours", async () => {
      const req = await service.createOverrideRequest({
        override_type: "test",
        target_entity_type: "order",
        target_entity_id: "ord_01",
        requested_by: "pharm_01",
        requested_by_role: "pharmacist",
        justification: LONG_JUSTIFICATION,
        risk_assessment: "Low",
        valid_for_hours: 72,
      })

      expect(req.valid_for_hours).toBe(72)
    })
  })

  // ── approveOverride ──────────────────────────────────────────────

  describe("approveOverride()", () => {
    it("approves a primary request and sets status=approved when dual_auth is not required", async () => {
      const ovr = buildOverrideRequest({
        id: "ovr_01",
        requested_by: "pharm_01",
        status: "pending_primary",
        requires_dual_auth: false,
      })
      service._seedOverrides([ovr])

      const updated = await service.approveOverride("ovr_01", "pic_01", true)

      expect(updated.status).toBe("approved")
      expect(updated.primary_approver_id).toBe("pic_01")
    })

    it("sets status=pending_secondary when dual_auth is required and primary approves", async () => {
      const ovr = buildOverrideRequest({
        id: "ovr_01",
        requested_by: "pharm_01",
        status: "pending_primary",
        requires_dual_auth: true,
      })
      service._seedOverrides([ovr])

      const updated = await service.approveOverride("ovr_01", "pic_01", true)

      expect(updated.status).toBe("pending_secondary")
    })

    it("completes dual-auth approval with secondary approver", async () => {
      const ovr = buildOverrideRequest({
        id: "ovr_01",
        requested_by: "pharm_01",
        status: "pending_secondary",
        requires_dual_auth: true,
        primary_approver_id: "pic_01",
      })
      service._seedOverrides([ovr])

      const updated = await service.approveOverride("ovr_01", "director_01", false)

      expect(updated.status).toBe("approved")
      expect(updated.secondary_approver_id).toBe("director_01")
    })

    it("throws SSD violation when approver is the same as requester", async () => {
      const ovr = buildOverrideRequest({
        id: "ovr_01",
        requested_by: "pharm_01",
        status: "pending_primary",
      })
      service._seedOverrides([ovr])

      await expect(
        service.approveOverride("ovr_01", "pharm_01", true)
      ).rejects.toThrow("SSD violation: approver cannot be the same as requester")
    })

    it("throws SSD violation when secondary approver is same as primary approver", async () => {
      const ovr = buildOverrideRequest({
        id: "ovr_01",
        requested_by: "pharm_01",
        status: "pending_secondary",
        primary_approver_id: "pic_01",
      })
      service._seedOverrides([ovr])

      await expect(
        service.approveOverride("ovr_01", "pic_01", false)
      ).rejects.toThrow("SSD violation: secondary approver must differ from primary approver")
    })

    it("throws and marks expired when override request has expired", async () => {
      const pastDate = new Date()
      pastDate.setHours(pastDate.getHours() - 1)

      const ovr = buildOverrideRequest({
        id: "ovr_01",
        requested_by: "pharm_01",
        status: "pending_primary",
        expires_at: pastDate,
      })
      service._seedOverrides([ovr])

      await expect(
        service.approveOverride("ovr_01", "pic_01", true)
      ).rejects.toThrow("Override request has expired")

      const updated = service._getOverrides().find((o) => o.id === "ovr_01")!
      expect(updated.status).toBe("expired")
    })

    it("throws when trying primary approval on a non-pending_primary request", async () => {
      const ovr = buildOverrideRequest({
        id: "ovr_01",
        requested_by: "pharm_01",
        status: "approved",
      })
      service._seedOverrides([ovr])

      await expect(
        service.approveOverride("ovr_01", "pic_01", true)
      ).rejects.toThrow("Cannot approve: status is approved, expected pending_primary")
    })
  })

  // ── runChecklist ─────────────────────────────────────────────────

  describe("runChecklist()", () => {
    it("returns passed=true when all checks pass", async () => {
      const result = await service.runChecklist({
        order_id: "ord_01",
        checks: [
          { rule: "schedule_x_check", passed: true },
          { rule: "rx_required_check", passed: true },
        ],
      })

      expect(result.passed).toBe(true)
      expect(result.failed_checks).toBe(0)
      expect(result.failures).toHaveLength(0)
    })

    it("returns passed=false and lists failures when any check fails", async () => {
      const result = await service.runChecklist({
        order_id: "ord_02",
        checks: [
          { rule: "schedule_x_check", passed: true },
          { rule: "discount_check", passed: false, details: "Promotion applied to Rx drug" },
        ],
      })

      expect(result.passed).toBe(false)
      expect(result.failed_checks).toBe(1)
      expect(result.failures[0].rule).toBe("discount_check")
      expect(result.failures[0].details).toBe("Promotion applied to Rx drug")
    })

    it("handles an empty checks array (vacuously passes)", async () => {
      const result = await service.runChecklist({ order_id: "ord_03", checks: [] })

      expect(result.passed).toBe(true)
      expect(result.total_checks).toBe(0)
    })
  })

  // ── exportH1Register ─────────────────────────────────────────────

  describe("exportH1Register()", () => {
    it("returns all entries within the date range", async () => {
      const jan = new Date("2025-01-15")
      const feb = new Date("2025-02-15")
      const march = new Date("2025-03-15")

      service._seedH1Entries([
        buildH1Entry({ entry_date: jan }),
        buildH1Entry({ entry_date: feb }),
        buildH1Entry({ entry_date: march }),
      ])

      const result = await service.exportH1Register({
        from: new Date("2025-01-01"),
        to: new Date("2025-02-28"),
      })

      expect(result.total_entries).toBe(2)
    })

    it("returns empty entries when no records fall in the range", async () => {
      service._seedH1Entries([
        buildH1Entry({ entry_date: new Date("2025-12-01") }),
      ])

      const result = await service.exportH1Register({
        from: new Date("2025-01-01"),
        to: new Date("2025-06-30"),
      })

      expect(result.total_entries).toBe(0)
    })

    it("includes all required fields in each exported entry", async () => {
      service._seedH1Entries([
        buildH1Entry({ entry_date: new Date("2025-03-01") }),
      ])

      const result = await service.exportH1Register({
        from: new Date("2025-01-01"),
        to: new Date("2025-12-31"),
      })

      const entry = result.entries[0]
      expect(entry).toHaveProperty("patient_name")
      expect(entry).toHaveProperty("drug_name")
      expect(entry).toHaveProperty("batch_number")
      expect(entry).toHaveProperty("quantity_dispensed")
      expect(entry).toHaveProperty("pharmacist_reg_no")
    })
  })

  // ── generateRecallReport ─────────────────────────────────────────

  describe("generateRecallReport()", () => {
    it("finds all dispenses for the given batch number", async () => {
      service._seedH1Entries([
        buildH1Entry({ batch_number: "BAD-BATCH-001", patient_name: "Patient A" }),
        buildH1Entry({ batch_number: "BAD-BATCH-001", patient_name: "Patient B" }),
        buildH1Entry({ batch_number: "OTHER-BATCH", patient_name: "Patient C" }),
      ])

      const report = await service.generateRecallReport("BAD-BATCH-001")

      expect(report.affected_dispenses).toBe(2)
      expect(report.patients_affected).toBe(2)
    })

    it("deduplicates patient count when same patient received multiple dispenses", async () => {
      service._seedH1Entries([
        buildH1Entry({ batch_number: "BAD-BATCH-002", patient_name: "Ravi Kumar" }),
        buildH1Entry({ batch_number: "BAD-BATCH-002", patient_name: "Ravi Kumar" }),
      ])

      const report = await service.generateRecallReport("BAD-BATCH-002")

      expect(report.affected_dispenses).toBe(2)
      expect(report.patients_affected).toBe(1)
    })

    it("returns empty report when batch number has no matches", async () => {
      const report = await service.generateRecallReport("UNKNOWN-BATCH")

      expect(report.affected_dispenses).toBe(0)
      expect(report.patients_affected).toBe(0)
    })
  })

  // ── exportGstr1 ──────────────────────────────────────────────────

  describe("exportGstr1()", () => {
    it("returns status=draft with all sections present", async () => {
      const result = await service.exportGstr1({ month: 3, year: 2025 })

      expect(result.status).toBe("draft")
      expect(result.period).toBe("2025-03")
      expect(result.sections).toHaveProperty("b2b")
      expect(result.sections).toHaveProperty("b2c_large")
      expect(result.sections).toHaveProperty("nil_rated_exempt")
    })

    it("zero-pads single-digit months", async () => {
      const result = await service.exportGstr1({ month: 7, year: 2025 })
      expect(result.period).toBe("2025-07")
    })
  })
})
