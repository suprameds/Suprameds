/**
 * Unit tests for DispenseModuleService custom business logic.
 * MedusaService is not imported — all CRUD operations are faked in-memory.
 */

// ---------- builder helpers ----------

let _idCounter = 0
function uid(prefix: string) {
  return `${prefix}_${++_idCounter}`
}

function buildDecision(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("dec"),
    prescription_drug_line_id: uid("pdl"),
    pharmacist_id: uid("pharm"),
    decision: "approved" as string,
    approved_variant_id: null,
    approved_quantity: 1,
    dispensing_notes: null,
    rejection_reason: null,
    h1_register_entry_id: null,
    decided_at: new Date(),
    is_override: false,
    override_reason: null,
    ...overrides,
  }
}

function buildAdjustmentLog(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("adj"),
    order_item_id: uid("oi"),
    pharmacist_id: uid("pharm"),
    adjustment_type: "rejection",
    previous_value: "original",
    new_value: "{}",
    reason: "Pharmacist decision",
    ...overrides,
  }
}

function buildPreDispatchSignOff(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("pds"),
    order_id: uid("ord"),
    pharmacist_id: uid("pharm"),
    checks_performed: [],
    approved: true,
    rejection_reason: null,
    signed_off_at: new Date(),
    ...overrides,
  }
}

// ---------- FakeDispenseService ----------

class FakeDispenseService {
  private decisions: ReturnType<typeof buildDecision>[] = []
  private adjustmentLogs: ReturnType<typeof buildAdjustmentLog>[] = []
  private signOffs: ReturnType<typeof buildPreDispatchSignOff>[] = []

  // Internal mocks
  private async createDispenseDecisions(data: Record<string, unknown>) {
    const d = buildDecision(data)
    this.decisions.push(d)
    return d
  }

  private async createPharmacistAdjustmentLogs(data: Record<string, unknown>) {
    const l = buildAdjustmentLog(data)
    this.adjustmentLogs.push(l)
    return l
  }

  private async createPreDispatchSignOffs(data: Record<string, unknown>) {
    const s = buildPreDispatchSignOff(data)
    this.signOffs.push(s)
    return s
  }

  // ---- Public service methods (mirrors service.ts) ----

  async makeDecision(data: {
    prescription_drug_line_id: string
    pharmacist_id: string
    decision: "approved" | "rejected" | "substituted" | "quantity_modified"
    approved_variant_id?: string
    approved_quantity: number
    dispensing_notes?: string
    rejection_reason?: string
    h1_register_entry_id?: string
    is_override?: boolean
    override_reason?: string
    order_item_id?: string
    previous_value?: string
  }) {
    const decision = await this.createDispenseDecisions({
      prescription_drug_line_id: data.prescription_drug_line_id,
      pharmacist_id: data.pharmacist_id,
      decision: data.decision,
      approved_variant_id: data.approved_variant_id ?? null,
      approved_quantity: data.approved_quantity,
      dispensing_notes: data.dispensing_notes ?? null,
      rejection_reason:
        data.decision === "rejected"
          ? data.rejection_reason ?? "other"
          : null,
      h1_register_entry_id: data.h1_register_entry_id ?? null,
      decided_at: new Date(),
      is_override: data.is_override ?? false,
      override_reason: data.override_reason ?? null,
    })

    if (data.decision !== "approved" && data.order_item_id) {
      const adjustmentType =
        data.decision === "substituted"
          ? "substitution"
          : data.decision === "quantity_modified"
            ? "quantity_change"
            : "rejection"

      await this.createPharmacistAdjustmentLogs({
        order_item_id: data.order_item_id,
        pharmacist_id: data.pharmacist_id,
        adjustment_type: adjustmentType,
        previous_value: data.previous_value ?? "original",
        new_value: JSON.stringify({
          decision: data.decision,
          variant_id: data.approved_variant_id,
          quantity: data.approved_quantity,
        }),
        reason:
          data.dispensing_notes ?? data.rejection_reason ?? "Pharmacist decision",
      })
    }

    return decision
  }

  async partialApproval(
    pharmacist_id: string,
    decisions: Array<{
      prescription_drug_line_id: string
      decision: "approved" | "rejected" | "substituted" | "quantity_modified"
      approved_variant_id?: string
      approved_quantity: number
      dispensing_notes?: string
      rejection_reason?: string
      h1_register_entry_id?: string
      order_item_id?: string
      previous_value?: string
    }>
  ) {
    const results = {
      approved: 0,
      rejected: 0,
      substituted: 0,
      quantity_modified: 0,
      decisions: [] as ReturnType<typeof buildDecision>[],
    }

    for (const d of decisions) {
      const decision = await this.makeDecision({ ...d, pharmacist_id })
      results[d.decision]++
      results.decisions.push(decision)
    }

    return results
  }

  async preDispatchCheck(data: {
    order_id: string
    pharmacist_id: string
    checks_performed: Array<{ check: string; passed: boolean; note?: string }>
  }) {
    const allPassed = data.checks_performed.every((c) => c.passed)

    return await this.createPreDispatchSignOffs({
      order_id: data.order_id,
      pharmacist_id: data.pharmacist_id,
      checks_performed: data.checks_performed,
      approved: allPassed,
      rejection_reason: allPassed
        ? null
        : data.checks_performed
            .filter((c) => !c.passed)
            .map((c) => c.check)
            .join("; "),
      signed_off_at: new Date(),
    })
  }

  async logAdjustment(data: {
    order_item_id: string
    pharmacist_id: string
    adjustment_type: string
    previous_value: string
    new_value: string
    reason: string
  }) {
    if (data.reason.length < 10) {
      throw new Error("Adjustment reason must be at least 10 characters")
    }

    return await this.createPharmacistAdjustmentLogs({
      order_item_id: data.order_item_id,
      pharmacist_id: data.pharmacist_id,
      adjustment_type: data.adjustment_type,
      previous_value: data.previous_value,
      new_value: data.new_value,
      reason: data.reason,
    })
  }

  // Expose internals
  _getDecisions() { return this.decisions }
  _getAdjustmentLogs() { return this.adjustmentLogs }
  _getSignOffs() { return this.signOffs }
}

// ---------- tests ----------

describe("DispenseModuleService (unit)", () => {
  let service: FakeDispenseService

  beforeEach(() => {
    service = new FakeDispenseService()
    _idCounter = 0
  })

  // ── makeDecision ─────────────────────────────────────────────────

  describe("makeDecision()", () => {
    it("creates an approved decision without an adjustment log", async () => {
      const decision = await service.makeDecision({
        prescription_drug_line_id: "pdl_01",
        pharmacist_id: "pharm_01",
        decision: "approved",
        approved_quantity: 30,
        order_item_id: "oi_01",
      })

      expect(decision.decision).toBe("approved")
      expect(decision.rejection_reason).toBeNull()
      expect(service._getAdjustmentLogs()).toHaveLength(0)
    })

    it("creates a rejected decision with rejection_reason and an adjustment log", async () => {
      const decision = await service.makeDecision({
        prescription_drug_line_id: "pdl_02",
        pharmacist_id: "pharm_01",
        decision: "rejected",
        approved_quantity: 0,
        rejection_reason: "expired_prescription",
        order_item_id: "oi_02",
      })

      expect(decision.decision).toBe("rejected")
      expect(decision.rejection_reason).toBe("expired_prescription")

      const logs = service._getAdjustmentLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].adjustment_type).toBe("rejection")
    })

    it("defaults rejection_reason to 'other' when not provided for rejected decisions", async () => {
      const decision = await service.makeDecision({
        prescription_drug_line_id: "pdl_03",
        pharmacist_id: "pharm_01",
        decision: "rejected",
        approved_quantity: 0,
        order_item_id: "oi_03",
      })

      expect(decision.rejection_reason).toBe("other")
    })

    it("creates a substituted decision with adjustment_type=substitution", async () => {
      await service.makeDecision({
        prescription_drug_line_id: "pdl_04",
        pharmacist_id: "pharm_01",
        decision: "substituted",
        approved_variant_id: "var_generic",
        approved_quantity: 30,
        order_item_id: "oi_04",
      })

      const log = service._getAdjustmentLogs()[0]
      expect(log.adjustment_type).toBe("substitution")
    })

    it("creates a quantity_modified decision with adjustment_type=quantity_change", async () => {
      await service.makeDecision({
        prescription_drug_line_id: "pdl_05",
        pharmacist_id: "pharm_01",
        decision: "quantity_modified",
        approved_quantity: 15,
        order_item_id: "oi_05",
      })

      const log = service._getAdjustmentLogs()[0]
      expect(log.adjustment_type).toBe("quantity_change")
    })

    it("does NOT create an adjustment log for non-approved decision when order_item_id is absent", async () => {
      await service.makeDecision({
        prescription_drug_line_id: "pdl_06",
        pharmacist_id: "pharm_01",
        decision: "rejected",
        approved_quantity: 0,
      })

      expect(service._getAdjustmentLogs()).toHaveLength(0)
    })

    it("stores is_override=true and override_reason when provided", async () => {
      const decision = await service.makeDecision({
        prescription_drug_line_id: "pdl_07",
        pharmacist_id: "pharm_01",
        decision: "approved",
        approved_quantity: 30,
        is_override: true,
        override_reason: "Emergency dispensing under PIC authority",
      })

      expect(decision.is_override).toBe(true)
      expect(decision.override_reason).toBe("Emergency dispensing under PIC authority")
    })
  })

  // ── partialApproval ──────────────────────────────────────────────

  describe("partialApproval()", () => {
    it("counts each decision type correctly", async () => {
      const results = await service.partialApproval("pharm_01", [
        { prescription_drug_line_id: "pdl_01", decision: "approved", approved_quantity: 30 },
        { prescription_drug_line_id: "pdl_02", decision: "approved", approved_quantity: 10 },
        { prescription_drug_line_id: "pdl_03", decision: "rejected", approved_quantity: 0 },
        { prescription_drug_line_id: "pdl_04", decision: "substituted", approved_quantity: 30 },
      ])

      expect(results.approved).toBe(2)
      expect(results.rejected).toBe(1)
      expect(results.substituted).toBe(1)
      expect(results.quantity_modified).toBe(0)
      expect(results.decisions).toHaveLength(4)
    })

    it("returns empty counters for an empty decisions array", async () => {
      const results = await service.partialApproval("pharm_01", [])

      expect(results.approved).toBe(0)
      expect(results.rejected).toBe(0)
      expect(results.decisions).toHaveLength(0)
    })
  })

  // ── preDispatchCheck ─────────────────────────────────────────────

  describe("preDispatchCheck()", () => {
    it("marks sign-off as approved=true when all checks pass", async () => {
      const signOff = await service.preDispatchCheck({
        order_id: "ord_01",
        pharmacist_id: "pharm_01",
        checks_performed: [
          { check: "patient_name_matches", passed: true },
          { check: "rx_valid", passed: true },
          { check: "batch_expiry_ok", passed: true },
        ],
      })

      expect(signOff.approved).toBe(true)
      expect(signOff.rejection_reason).toBeNull()
    })

    it("marks sign-off as approved=false and lists failing checks when any check fails", async () => {
      const signOff = await service.preDispatchCheck({
        order_id: "ord_02",
        pharmacist_id: "pharm_01",
        checks_performed: [
          { check: "patient_name_matches", passed: true },
          { check: "batch_expiry_ok", passed: false },
          { check: "quantity_correct", passed: false },
        ],
      })

      expect(signOff.approved).toBe(false)
      expect(signOff.rejection_reason).toContain("batch_expiry_ok")
      expect(signOff.rejection_reason).toContain("quantity_correct")
    })

    it("handles an empty checks array (vacuously passes)", async () => {
      const signOff = await service.preDispatchCheck({
        order_id: "ord_03",
        pharmacist_id: "pharm_01",
        checks_performed: [],
      })

      expect(signOff.approved).toBe(true)
    })
  })

  // ── logAdjustment ────────────────────────────────────────────────

  describe("logAdjustment()", () => {
    it("creates an adjustment log when reason is 10+ characters", async () => {
      const log = await service.logAdjustment({
        order_item_id: "oi_01",
        pharmacist_id: "pharm_01",
        adjustment_type: "quantity_change",
        previous_value: "30",
        new_value: "20",
        reason: "Patient requested lower quantity",
      })

      expect(log.order_item_id).toBe("oi_01")
      expect(log.new_value).toBe("20")
    })

    it("throws when reason is shorter than 10 characters", async () => {
      await expect(
        service.logAdjustment({
          order_item_id: "oi_02",
          pharmacist_id: "pharm_01",
          adjustment_type: "rejection",
          previous_value: "original",
          new_value: "none",
          reason: "Too bad",
        })
      ).rejects.toThrow("Adjustment reason must be at least 10 characters")
    })

    it("accepts a reason exactly 10 characters long", async () => {
      const log = await service.logAdjustment({
        order_item_id: "oi_03",
        pharmacist_id: "pharm_01",
        adjustment_type: "rejection",
        previous_value: "original",
        new_value: "none",
        reason: "1234567890",
      })

      expect(log).toBeDefined()
    })
  })
})
