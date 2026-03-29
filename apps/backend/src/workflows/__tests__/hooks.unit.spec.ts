/**
 * Unit tests for compliance hooks — Schedule X block and Rx compliance
 * validation (validate-cart-rx-compliance.ts, schedule-x-block-add-to-cart.ts).
 *
 * Tests extracted pure functions that mirror the hook behavior:
 *   isScheduleXProduct()       — NDPS Act 1985 absolute prohibition
 *   requiresPrescription()     — H/H1 schedule classification
 *   validateCartCompliance()   — full cart drug compliance check
 *   validateNoRxDiscounts()    — no promotions on Rx drugs
 *
 * Business logic is tested without Medusa framework dependencies.
 */

// -- Domain types -------------------------------------------------------

type DrugSchedule = "X" | "H" | "H1" | "OTC" | null

type DrugProduct = {
  product_id: string
  schedule: DrugSchedule
  is_narcotic: boolean
  generic_name: string
}

type CartItem = {
  product_id: string
  title: string
  variant_id: string
  quantity: number
  discount_total: number
  metadata: Record<string, any> | null
}

type PrescriptionStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "expired"

type Prescription = {
  id: string
  customer_id: string
  status: PrescriptionStatus
  product_ids: string[]
}

type ComplianceResult = {
  valid: boolean
  errors: string[]
}

// -- Extracted business logic (mirrors hook behavior) -------------------

/**
 * Returns true if the drug is a Schedule X substance or narcotic.
 * NDPS Act 1985: absolute prohibition on online sale.
 */
function isScheduleXProduct(drug: DrugProduct): boolean {
  return drug.schedule === "X" || drug.is_narcotic
}

/**
 * Returns true if the drug requires a prescription (Schedule H or H1).
 */
function requiresPrescription(drug: DrugProduct): boolean {
  return drug.schedule === "H" || drug.schedule === "H1"
}

/**
 * Validates all items in the cart against drug compliance rules.
 * Checks Schedule X block, Rx requirement, and prescription matching.
 *
 * @param items        - Cart line items
 * @param drugLookup   - Map of product_id -> DrugProduct
 * @param prescriptions - Approved prescriptions available for this customer
 */
function validateCartCompliance(
  items: CartItem[],
  drugLookup: Map<string, DrugProduct>,
  prescriptions: Prescription[]
): ComplianceResult {
  const errors: string[] = []

  for (const item of items) {
    const drug = drugLookup.get(item.product_id)
    if (!drug) continue // non-pharma item, skip

    // Rule 1: Schedule X absolute prohibition
    if (isScheduleXProduct(drug)) {
      errors.push(
        `"${item.title}" is a Schedule X/narcotic substance and cannot be sold online (NDPS Act, 1985)`
      )
      continue
    }

    // Rule 2: H/H1 requires approved prescription
    if (requiresPrescription(drug)) {
      const matchingRx = prescriptions.find(
        (rx) =>
          rx.status === "approved" &&
          rx.product_ids.includes(item.product_id)
      )
      if (!matchingRx) {
        errors.push(
          `Schedule ${drug.schedule} drug "${item.title}" requires an approved prescription`
        )
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validates that no discounts/promotions are applied to Rx drugs.
 * Returns the list of Rx items that have impermissible discounts.
 */
function validateNoRxDiscounts(
  items: CartItem[],
  drugLookup: Map<string, DrugProduct>
): ComplianceResult {
  const errors: string[] = []

  for (const item of items) {
    const drug = drugLookup.get(item.product_id)
    if (!drug) continue

    if (requiresPrescription(drug) && item.discount_total > 0) {
      errors.push(
        `Discounts cannot be applied to prescription drug "${item.title}" (regulatory requirement)`
      )
    }
  }

  return { valid: errors.length === 0, errors }
}

// -- Helpers ------------------------------------------------------------

function makeDrug(
  overrides: Partial<DrugProduct> & { product_id: string }
): DrugProduct {
  return {
    generic_name: "Test Drug",
    schedule: "OTC",
    is_narcotic: false,
    ...overrides,
  }
}

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    product_id: "prod_01",
    title: "Test Medicine",
    variant_id: "var_01",
    quantity: 1,
    discount_total: 0,
    metadata: null,
    ...overrides,
  }
}

function makeRx(
  overrides: Partial<Prescription> & { id: string }
): Prescription {
  return {
    customer_id: "cus_01",
    status: "approved",
    product_ids: [],
    ...overrides,
  }
}

// -- Tests --------------------------------------------------------------

describe("isScheduleXProduct", () => {
  it("returns true for schedule X", () => {
    const drug = makeDrug({ product_id: "p1", schedule: "X" })
    expect(isScheduleXProduct(drug)).toBe(true)
  })

  it("returns true for narcotic flag regardless of schedule", () => {
    const drug = makeDrug({
      product_id: "p1",
      schedule: "H",
      is_narcotic: true,
    })
    expect(isScheduleXProduct(drug)).toBe(true)
  })

  it("returns true when both schedule X and narcotic flag are set", () => {
    const drug = makeDrug({
      product_id: "p1",
      schedule: "X",
      is_narcotic: true,
    })
    expect(isScheduleXProduct(drug)).toBe(true)
  })

  it("returns false for Schedule H (not narcotic)", () => {
    const drug = makeDrug({ product_id: "p1", schedule: "H" })
    expect(isScheduleXProduct(drug)).toBe(false)
  })

  it("returns false for Schedule H1 (not narcotic)", () => {
    const drug = makeDrug({ product_id: "p1", schedule: "H1" })
    expect(isScheduleXProduct(drug)).toBe(false)
  })

  it("returns false for OTC drugs", () => {
    const drug = makeDrug({ product_id: "p1", schedule: "OTC" })
    expect(isScheduleXProduct(drug)).toBe(false)
  })

  it("returns false for null schedule (unclassified)", () => {
    const drug = makeDrug({ product_id: "p1", schedule: null })
    expect(isScheduleXProduct(drug)).toBe(false)
  })
})

describe("requiresPrescription", () => {
  it("returns true for Schedule H", () => {
    const drug = makeDrug({ product_id: "p1", schedule: "H" })
    expect(requiresPrescription(drug)).toBe(true)
  })

  it("returns true for Schedule H1", () => {
    const drug = makeDrug({ product_id: "p1", schedule: "H1" })
    expect(requiresPrescription(drug)).toBe(true)
  })

  it("returns false for Schedule X (different enforcement path)", () => {
    const drug = makeDrug({ product_id: "p1", schedule: "X" })
    expect(requiresPrescription(drug)).toBe(false)
  })

  it("returns false for OTC", () => {
    const drug = makeDrug({ product_id: "p1", schedule: "OTC" })
    expect(requiresPrescription(drug)).toBe(false)
  })

  it("returns false for null schedule", () => {
    const drug = makeDrug({ product_id: "p1", schedule: null })
    expect(requiresPrescription(drug)).toBe(false)
  })
})

describe("validateCartCompliance", () => {
  const otcDrug = makeDrug({ product_id: "prod_otc", schedule: "OTC" })
  const hDrug = makeDrug({
    product_id: "prod_h",
    schedule: "H",
    generic_name: "Amoxicillin",
  })
  const h1Drug = makeDrug({
    product_id: "prod_h1",
    schedule: "H1",
    generic_name: "Alprazolam",
  })
  const xDrug = makeDrug({
    product_id: "prod_x",
    schedule: "X",
    generic_name: "Morphine",
  })

  it("all OTC items: valid", () => {
    const items = [makeItem({ product_id: "prod_otc", title: "Crocin" })]
    const drugs = new Map([["prod_otc", otcDrug]])
    const result = validateCartCompliance(items, drugs, [])
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("H item with matching approved Rx: valid", () => {
    const items = [
      makeItem({ product_id: "prod_h", title: "Amoxicillin 250mg" }),
    ]
    const drugs = new Map([["prod_h", hDrug]])
    const rx = makeRx({
      id: "rx_01",
      status: "approved",
      product_ids: ["prod_h"],
    })
    const result = validateCartCompliance(items, drugs, [rx])
    expect(result.valid).toBe(true)
  })

  it("H item without Rx: invalid with message", () => {
    const items = [
      makeItem({ product_id: "prod_h", title: "Amoxicillin 250mg" }),
    ]
    const drugs = new Map([["prod_h", hDrug]])
    const result = validateCartCompliance(items, drugs, [])
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("prescription")
    expect(result.errors[0]).toContain("Amoxicillin")
  })

  it("H1 item with matching approved Rx: valid", () => {
    const items = [
      makeItem({ product_id: "prod_h1", title: "Alprazolam 0.5mg" }),
    ]
    const drugs = new Map([["prod_h1", h1Drug]])
    const rx = makeRx({
      id: "rx_02",
      status: "approved",
      product_ids: ["prod_h1"],
    })
    const result = validateCartCompliance(items, drugs, [rx])
    expect(result.valid).toBe(true)
  })

  it("H1 item without Rx: invalid (same rules as H)", () => {
    const items = [
      makeItem({ product_id: "prod_h1", title: "Alprazolam 0.5mg" }),
    ]
    const drugs = new Map([["prod_h1", h1Drug]])
    const result = validateCartCompliance(items, drugs, [])
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("H1")
  })

  it("X item: always invalid regardless of Rx", () => {
    const items = [
      makeItem({ product_id: "prod_x", title: "Morphine Sulfate" }),
    ]
    const drugs = new Map([["prod_x", xDrug]])
    // Even with a matching prescription, Schedule X is blocked
    const rx = makeRx({
      id: "rx_03",
      status: "approved",
      product_ids: ["prod_x"],
    })
    const result = validateCartCompliance(items, drugs, [rx])
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("NDPS Act")
  })

  it("mixed cart: OTC + H with matching Rx: valid", () => {
    const items = [
      makeItem({ product_id: "prod_otc", title: "Crocin" }),
      makeItem({ product_id: "prod_h", title: "Amoxicillin 250mg" }),
    ]
    const drugs = new Map([
      ["prod_otc", otcDrug],
      ["prod_h", hDrug],
    ])
    const rx = makeRx({
      id: "rx_01",
      status: "approved",
      product_ids: ["prod_h"],
    })
    const result = validateCartCompliance(items, drugs, [rx])
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("mixed cart: OTC + H without Rx: invalid", () => {
    const items = [
      makeItem({ product_id: "prod_otc", title: "Crocin" }),
      makeItem({ product_id: "prod_h", title: "Amoxicillin 250mg" }),
    ]
    const drugs = new Map([
      ["prod_otc", otcDrug],
      ["prod_h", hDrug],
    ])
    const result = validateCartCompliance(items, drugs, [])
    expect(result.valid).toBe(false)
    // Only the H item is flagged, not the OTC item
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain("Amoxicillin")
  })

  it("non-pharma items (not in drug lookup) pass silently", () => {
    const items = [
      makeItem({ product_id: "prod_mask", title: "N95 Face Mask" }),
    ]
    const drugs = new Map<string, DrugProduct>()
    const result = validateCartCompliance(items, drugs, [])
    expect(result.valid).toBe(true)
  })

  it("H item with pending_review Rx is invalid (only approved counts)", () => {
    const items = [
      makeItem({ product_id: "prod_h", title: "Amoxicillin 250mg" }),
    ]
    const drugs = new Map([["prod_h", hDrug]])
    const rx = makeRx({
      id: "rx_01",
      status: "pending_review" as PrescriptionStatus,
      product_ids: ["prod_h"],
    })
    const result = validateCartCompliance(items, drugs, [rx])
    expect(result.valid).toBe(false)
  })
})

describe("validateNoRxDiscounts", () => {
  const otcDrug = makeDrug({ product_id: "prod_otc", schedule: "OTC" })
  const hDrug = makeDrug({ product_id: "prod_h", schedule: "H" })
  const h1Drug = makeDrug({ product_id: "prod_h1", schedule: "H1" })

  it("OTC items with promotions: valid", () => {
    const items = [
      makeItem({
        product_id: "prod_otc",
        title: "Crocin",
        discount_total: 30,
      }),
    ]
    const drugs = new Map([["prod_otc", otcDrug]])
    const result = validateNoRxDiscounts(items, drugs)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("Schedule H item with discount: invalid", () => {
    const items = [
      makeItem({
        product_id: "prod_h",
        title: "Amoxicillin 250mg",
        discount_total: 100,
      }),
    ]
    const drugs = new Map([["prod_h", hDrug]])
    const result = validateNoRxDiscounts(items, drugs)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("Discounts cannot")
    expect(result.errors[0]).toContain("Amoxicillin")
  })

  it("Schedule H1 item with discount: invalid", () => {
    const items = [
      makeItem({
        product_id: "prod_h1",
        title: "Alprazolam 0.5mg",
        discount_total: 50,
      }),
    ]
    const drugs = new Map([["prod_h1", h1Drug]])
    const result = validateNoRxDiscounts(items, drugs)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("Discounts cannot")
  })

  it("Rx item with zero discount: valid (no promotion applied)", () => {
    const items = [
      makeItem({
        product_id: "prod_h",
        title: "Amoxicillin 250mg",
        discount_total: 0,
      }),
    ]
    const drugs = new Map([["prod_h", hDrug]])
    const result = validateNoRxDiscounts(items, drugs)
    expect(result.valid).toBe(true)
  })

  it("mixed cart: only Rx items with discounts are flagged", () => {
    const items = [
      makeItem({
        product_id: "prod_otc",
        title: "Crocin",
        discount_total: 30,
      }),
      makeItem({
        product_id: "prod_h",
        title: "Amoxicillin 250mg",
        discount_total: 50,
      }),
    ]
    const drugs = new Map([
      ["prod_otc", otcDrug],
      ["prod_h", hDrug],
    ])
    const result = validateNoRxDiscounts(items, drugs)
    expect(result.valid).toBe(false)
    // Only the Rx item is in the errors
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain("Amoxicillin")
    // OTC item is not flagged even though it has a discount
  })

  it("non-pharma items with discounts pass silently", () => {
    const items = [
      makeItem({
        product_id: "prod_mask",
        title: "N95 Mask",
        discount_total: 10,
      }),
    ]
    const drugs = new Map<string, DrugProduct>()
    const result = validateNoRxDiscounts(items, drugs)
    expect(result.valid).toBe(true)
  })
})

describe("hooks: full compliance flow integration", () => {
  it("validates a compliant mixed cart (OTC + H with Rx, no Rx discounts)", () => {
    const otcDrug = makeDrug({ product_id: "prod_otc", schedule: "OTC" })
    const hDrug = makeDrug({ product_id: "prod_h", schedule: "H" })
    const drugs = new Map([
      ["prod_otc", otcDrug],
      ["prod_h", hDrug],
    ])

    const items = [
      makeItem({
        product_id: "prod_otc",
        title: "Crocin",
        discount_total: 20,
      }),
      makeItem({
        product_id: "prod_h",
        title: "Amoxicillin 250mg",
        discount_total: 0,
      }),
    ]

    const rx = makeRx({
      id: "rx_01",
      status: "approved",
      product_ids: ["prod_h"],
    })

    // Step 1: Schedule X check (per item)
    for (const item of items) {
      const drug = drugs.get(item.product_id)
      if (drug) {
        expect(isScheduleXProduct(drug)).toBe(false)
      }
    }

    // Step 2: Cart compliance (Rx requirement)
    const compliance = validateCartCompliance(items, drugs, [rx])
    expect(compliance.valid).toBe(true)

    // Step 3: No-discount rule
    const discountCheck = validateNoRxDiscounts(items, drugs)
    expect(discountCheck.valid).toBe(true)
  })

  it("rejects cart that sneaks a Schedule X item alongside OTC items", () => {
    const otcDrug = makeDrug({ product_id: "prod_otc", schedule: "OTC" })
    const xDrug = makeDrug({ product_id: "prod_x", schedule: "X" })
    const drugs = new Map([
      ["prod_otc", otcDrug],
      ["prod_x", xDrug],
    ])

    const items = [
      makeItem({ product_id: "prod_otc", title: "Crocin" }),
      makeItem({ product_id: "prod_x", title: "Morphine Sulfate" }),
    ]

    const compliance = validateCartCompliance(items, drugs, [])
    expect(compliance.valid).toBe(false)
    expect(compliance.errors[0]).toContain("NDPS Act")
    expect(compliance.errors[0]).toContain("Morphine")
  })
})
