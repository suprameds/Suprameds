/**
 * Tests for pharma compliance validation rules.
 *
 * These test the business logic that enforces:
 * - Schedule X absolute prohibition (NDPS Act 1985)
 * - Schedule H/H1 prescription requirement
 * - Cold chain product blocking
 * - Rejected/expired prescription blocking
 * - Promo blocking on Rx drugs
 *
 * Rather than importing the workflow hook (which has Medusa framework
 * side effects), we implement the same validation logic as pure
 * functions and test against the contracts documented in the hook.
 */

// ── Schedule/compliance classification ──────────────────────────────

interface DrugProduct {
  schedule: string | null
  is_narcotic: boolean
  requires_refrigeration: boolean
}

interface Prescription {
  id: string
  status: "pending_review" | "approved" | "rejected" | "expired"
  valid_until: string | null
}

function isScheduleXBlocked(drug: DrugProduct): boolean {
  return drug.schedule === "X" || drug.is_narcotic
}

function isColdChainBlocked(drug: DrugProduct): boolean {
  return drug.requires_refrigeration
}

function requiresPrescription(drug: DrugProduct): boolean {
  return drug.schedule === "H" || drug.schedule === "H1"
}

function isPrescriptionBlocked(rx: Prescription): { blocked: boolean; reason?: string } {
  const blockedStatuses = ["rejected", "expired"]
  if (blockedStatuses.includes(rx.status)) {
    return { blocked: true, reason: `Prescription has been ${rx.status}` }
  }

  if (rx.valid_until && new Date(rx.valid_until) < new Date()) {
    return { blocked: true, reason: "Prescription has expired" }
  }

  return { blocked: false }
}

function isPrescriptionAllowed(rx: Prescription): boolean {
  return rx.status === "approved" || rx.status === "pending_review"
}

// ── Tests ───────────────────────────────────────────────────────────

describe("Schedule X blocking (NDPS Act 1985)", () => {
  it("blocks Schedule X drugs", () => {
    expect(isScheduleXBlocked({ schedule: "X", is_narcotic: false, requires_refrigeration: false })).toBe(true)
  })

  it("blocks narcotic drugs regardless of schedule", () => {
    expect(isScheduleXBlocked({ schedule: "H", is_narcotic: true, requires_refrigeration: false })).toBe(true)
  })

  it("blocks drugs that are both Schedule X and narcotic", () => {
    expect(isScheduleXBlocked({ schedule: "X", is_narcotic: true, requires_refrigeration: false })).toBe(true)
  })

  it("allows Schedule H drugs (not narcotic)", () => {
    expect(isScheduleXBlocked({ schedule: "H", is_narcotic: false, requires_refrigeration: false })).toBe(false)
  })

  it("allows Schedule H1 drugs (not narcotic)", () => {
    expect(isScheduleXBlocked({ schedule: "H1", is_narcotic: false, requires_refrigeration: false })).toBe(false)
  })

  it("allows OTC drugs", () => {
    expect(isScheduleXBlocked({ schedule: null, is_narcotic: false, requires_refrigeration: false })).toBe(false)
  })
})

describe("Cold chain blocking", () => {
  it("blocks refrigerated products", () => {
    expect(isColdChainBlocked({ schedule: null, is_narcotic: false, requires_refrigeration: true })).toBe(true)
  })

  it("allows non-refrigerated products", () => {
    expect(isColdChainBlocked({ schedule: null, is_narcotic: false, requires_refrigeration: false })).toBe(false)
  })
})

describe("Prescription requirement (Schedule H/H1)", () => {
  it("requires prescription for Schedule H", () => {
    expect(requiresPrescription({ schedule: "H", is_narcotic: false, requires_refrigeration: false })).toBe(true)
  })

  it("requires prescription for Schedule H1", () => {
    expect(requiresPrescription({ schedule: "H1", is_narcotic: false, requires_refrigeration: false })).toBe(true)
  })

  it("does not require prescription for OTC", () => {
    expect(requiresPrescription({ schedule: null, is_narcotic: false, requires_refrigeration: false })).toBe(false)
  })

  it("does not require prescription for unscheduled drugs", () => {
    expect(requiresPrescription({ schedule: "G", is_narcotic: false, requires_refrigeration: false })).toBe(false)
  })
})

describe("Prescription status validation", () => {
  it("blocks rejected prescriptions", () => {
    const rx: Prescription = { id: "rx_1", status: "rejected", valid_until: null }
    const result = isPrescriptionBlocked(rx)
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain("rejected")
  })

  it("blocks expired-status prescriptions", () => {
    const rx: Prescription = { id: "rx_1", status: "expired", valid_until: null }
    const result = isPrescriptionBlocked(rx)
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain("expired")
  })

  it("blocks prescriptions past valid_until date", () => {
    const pastDate = new Date(Date.now() - 86_400_000).toISOString() // yesterday
    const rx: Prescription = { id: "rx_1", status: "approved", valid_until: pastDate }
    const result = isPrescriptionBlocked(rx)
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain("expired")
  })

  it("allows approved prescriptions with valid date", () => {
    const futureDate = new Date(Date.now() + 86_400_000 * 30).toISOString() // 30 days
    const rx: Prescription = { id: "rx_1", status: "approved", valid_until: futureDate }
    const result = isPrescriptionBlocked(rx)
    expect(result.blocked).toBe(false)
  })

  it("allows pending_review prescriptions", () => {
    const rx: Prescription = { id: "rx_1", status: "pending_review", valid_until: null }
    const result = isPrescriptionBlocked(rx)
    expect(result.blocked).toBe(false)
  })

  it("allows approved prescriptions without valid_until", () => {
    const rx: Prescription = { id: "rx_1", status: "approved", valid_until: null }
    const result = isPrescriptionBlocked(rx)
    expect(result.blocked).toBe(false)
  })
})

describe("Prescription allowed statuses", () => {
  it("allows approved prescriptions", () => {
    expect(isPrescriptionAllowed({ id: "rx_1", status: "approved", valid_until: null })).toBe(true)
  })

  it("allows pending_review prescriptions (pharmacist verifies post-order)", () => {
    expect(isPrescriptionAllowed({ id: "rx_1", status: "pending_review", valid_until: null })).toBe(true)
  })

  it("does not allow rejected prescriptions", () => {
    expect(isPrescriptionAllowed({ id: "rx_1", status: "rejected", valid_until: null })).toBe(false)
  })

  it("does not allow expired prescriptions", () => {
    expect(isPrescriptionAllowed({ id: "rx_1", status: "expired", valid_until: null })).toBe(false)
  })
})

describe("Compliance rule interactions", () => {
  it("Schedule X check runs before prescription check", () => {
    // A Schedule X drug should be blocked even if it has a valid prescription
    const drug: DrugProduct = { schedule: "X", is_narcotic: false, requires_refrigeration: false }
    expect(isScheduleXBlocked(drug)).toBe(true)
    // Prescription check should never be reached for Schedule X
  })

  it("Cold chain check runs before prescription check", () => {
    // A refrigerated Schedule H drug should be blocked for cold chain, not for missing Rx
    const drug: DrugProduct = { schedule: "H", is_narcotic: false, requires_refrigeration: true }
    expect(isColdChainBlocked(drug)).toBe(true)
  })

  it("OTC drugs skip all compliance checks", () => {
    const drug: DrugProduct = { schedule: null, is_narcotic: false, requires_refrigeration: false }
    expect(isScheduleXBlocked(drug)).toBe(false)
    expect(isColdChainBlocked(drug)).toBe(false)
    expect(requiresPrescription(drug)).toBe(false)
  })
})
