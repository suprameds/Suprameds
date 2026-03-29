/**
 * Unit tests for complete-cart workflow business logic.
 *
 * Tests the validateCartForCheckout() pure function that consolidates
 * all pre-checkout validation: cart readiness (items, shipping, email),
 * Schedule X blocking (NDPS Act 1985), Rx compliance (H/H1 prescription
 * requirement), and no-discount rule on prescription drugs.
 *
 * Business logic is extracted as pure functions to avoid Medusa
 * framework side effects — mirrors the workflow steps in complete-cart.ts
 * and the validate hook in validate-cart-rx-compliance.ts.
 */

// -- Domain types -------------------------------------------------------

type DrugSchedule = "X" | "H" | "H1" | "OTC" | null

type CartItem = {
  product_id: string
  title: string
  variant_id: string
  quantity: number
  discount_total: number
  metadata: Record<string, any> | null
}

type Cart = {
  id: string
  email: string | null
  items: CartItem[]
  shipping_methods: Array<{ id: string }>
  discount_total: number
  metadata: Record<string, any> | null
}

type DrugInfo = {
  product_id: string
  generic_name: string
  schedule: DrugSchedule
  is_narcotic: boolean
}

type ValidationResult = {
  valid: boolean
  errors: string[]
}

// -- Extracted business logic -------------------------------------------

/**
 * Consolidated cart validation for checkout. Returns all errors at once
 * so the customer can fix multiple issues in a single pass.
 */
function validateCartForCheckout(
  cart: Cart | null,
  drugLookup: Map<string, DrugInfo>
): ValidationResult {
  const errors: string[] = []

  // ── Cart readiness ──────────────────────────────────────────────────
  if (!cart) {
    return { valid: false, errors: ["Cart not found"] }
  }
  if (!cart.items || cart.items.length === 0) {
    errors.push("Cart is empty")
  }
  if (!cart.shipping_methods || cart.shipping_methods.length === 0) {
    errors.push("No shipping method selected")
  }
  if (!cart.email) {
    errors.push("Customer email is required")
  }

  // Short-circuit: if cart structure is invalid, skip drug checks
  if (errors.length > 0) {
    return { valid: false, errors }
  }

  // ── Drug compliance checks per item ─────────────────────────────────
  for (const item of cart.items) {
    const drug = drugLookup.get(item.product_id)
    if (!drug) continue // non-pharma item, skip

    // NDPS Act 1985: Schedule X / narcotic absolute prohibition
    if (drug.schedule === "X" || drug.is_narcotic) {
      errors.push(
        `Schedule X drug "${item.title}" cannot be sold online (NDPS Act, 1985)`
      )
      continue // no need to check prescription for a blocked drug
    }

    // Rx compliance: H/H1 requires approved prescription
    if (drug.schedule === "H" || drug.schedule === "H1") {
      const prescriptionId = item.metadata?.prescription_id
      if (!prescriptionId) {
        errors.push(
          `Schedule ${drug.schedule} drug "${item.title}" requires an approved prescription`
        )
      }
    }

    // No-discount rule: promotions cannot be applied to Rx drugs
    if (
      (drug.schedule === "H" || drug.schedule === "H1") &&
      item.discount_total > 0
    ) {
      errors.push(
        `Discounts cannot be applied to prescription drug "${item.title}" (regulatory requirement)`
      )
    }
  }

  return { valid: errors.length === 0, errors }
}

// -- Test fixtures ------------------------------------------------------

function makeCart(overrides: Partial<Cart> = {}): Cart {
  return {
    id: "cart_01",
    email: "customer@example.com",
    items: [
      {
        product_id: "prod_otc_01",
        title: "Paracetamol 500mg",
        variant_id: "var_01",
        quantity: 2,
        discount_total: 0,
        metadata: null,
      },
    ],
    shipping_methods: [{ id: "sm_01" }],
    discount_total: 0,
    metadata: null,
    ...overrides,
  }
}

function makeDrugLookup(
  entries: Array<{
    product_id: string
    schedule: DrugSchedule
    is_narcotic?: boolean
  }>
): Map<string, DrugInfo> {
  const map = new Map<string, DrugInfo>()
  for (const e of entries) {
    map.set(e.product_id, {
      product_id: e.product_id,
      generic_name: `Drug ${e.product_id}`,
      schedule: e.schedule,
      is_narcotic: e.is_narcotic ?? false,
    })
  }
  return map
}

const EMPTY_DRUGS = makeDrugLookup([])

// -- Tests --------------------------------------------------------------

describe("complete-cart: cart readiness validation", () => {
  it("passes with valid cart (items, shipping, email)", () => {
    const result = validateCartForCheckout(makeCart(), EMPTY_DRUGS)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("rejects null cart", () => {
    const result = validateCartForCheckout(null, EMPTY_DRUGS)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("Cart not found")
  })

  it("rejects empty cart (no items)", () => {
    const result = validateCartForCheckout(makeCart({ items: [] }), EMPTY_DRUGS)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("empty")
  })

  it("rejects cart without shipping method", () => {
    const result = validateCartForCheckout(
      makeCart({ shipping_methods: [] }),
      EMPTY_DRUGS
    )
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("shipping")
  })

  it("rejects cart without email", () => {
    const result = validateCartForCheckout(
      makeCart({ email: null }),
      EMPTY_DRUGS
    )
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("email")
  })
})

describe("complete-cart: Schedule X blocking (NDPS Act)", () => {
  it("blocks cart containing a Schedule X drug", () => {
    const cart = makeCart({
      items: [
        {
          product_id: "prod_x",
          title: "Morphine Sulfate",
          variant_id: "var_x",
          quantity: 1,
          discount_total: 0,
          metadata: null,
        },
      ],
    })
    const drugs = makeDrugLookup([{ product_id: "prod_x", schedule: "X" }])
    const result = validateCartForCheckout(cart, drugs)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("NDPS Act")
    expect(result.errors[0]).toContain("Morphine Sulfate")
  })

  it("blocks cart with narcotic drug even when schedule is not X", () => {
    const cart = makeCart({
      items: [
        {
          product_id: "prod_narc",
          title: "Codeine Phosphate",
          variant_id: "var_narc",
          quantity: 1,
          discount_total: 0,
          metadata: null,
        },
      ],
    })
    const drugs = makeDrugLookup([
      { product_id: "prod_narc", schedule: "H", is_narcotic: true },
    ])
    const result = validateCartForCheckout(cart, drugs)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("NDPS Act")
  })

  it("allows cart with only OTC products", () => {
    const cart = makeCart({
      items: [
        {
          product_id: "prod_otc",
          title: "Crocin",
          variant_id: "var_otc",
          quantity: 3,
          discount_total: 0,
          metadata: null,
        },
      ],
    })
    const drugs = makeDrugLookup([{ product_id: "prod_otc", schedule: "OTC" }])
    const result = validateCartForCheckout(cart, drugs)
    expect(result.valid).toBe(true)
  })

  it("allows cart with non-pharma items (not in drug lookup)", () => {
    const cart = makeCart({
      items: [
        {
          product_id: "prod_mask",
          title: "N95 Face Mask",
          variant_id: "var_mask",
          quantity: 5,
          discount_total: 0,
          metadata: null,
        },
      ],
    })
    const result = validateCartForCheckout(cart, EMPTY_DRUGS)
    expect(result.valid).toBe(true)
  })
})

describe("complete-cart: Rx compliance (H/H1 prescription requirement)", () => {
  it("Schedule H drug without prescription is blocked", () => {
    const cart = makeCart({
      items: [
        {
          product_id: "prod_h",
          title: "Amoxicillin 250mg",
          variant_id: "var_h",
          quantity: 1,
          discount_total: 0,
          metadata: null,
        },
      ],
    })
    const drugs = makeDrugLookup([{ product_id: "prod_h", schedule: "H" }])
    const result = validateCartForCheckout(cart, drugs)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("prescription")
    expect(result.errors[0]).toContain("Amoxicillin")
  })

  it("Schedule H1 drug without prescription is blocked", () => {
    const cart = makeCart({
      items: [
        {
          product_id: "prod_h1",
          title: "Alprazolam 0.5mg",
          variant_id: "var_h1",
          quantity: 1,
          discount_total: 0,
          metadata: null,
        },
      ],
    })
    const drugs = makeDrugLookup([{ product_id: "prod_h1", schedule: "H1" }])
    const result = validateCartForCheckout(cart, drugs)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("H1")
  })

  it("Schedule H drug with approved prescription passes", () => {
    const cart = makeCart({
      items: [
        {
          product_id: "prod_h",
          title: "Amoxicillin 250mg",
          variant_id: "var_h",
          quantity: 1,
          discount_total: 0,
          metadata: { prescription_id: "rx_01" },
        },
      ],
    })
    const drugs = makeDrugLookup([{ product_id: "prod_h", schedule: "H" }])
    const result = validateCartForCheckout(cart, drugs)
    expect(result.valid).toBe(true)
  })

  it("Schedule H1 drug with approved prescription passes", () => {
    const cart = makeCart({
      items: [
        {
          product_id: "prod_h1",
          title: "Alprazolam 0.5mg",
          variant_id: "var_h1",
          quantity: 1,
          discount_total: 0,
          metadata: { prescription_id: "rx_02" },
        },
      ],
    })
    const drugs = makeDrugLookup([{ product_id: "prod_h1", schedule: "H1" }])
    const result = validateCartForCheckout(cart, drugs)
    expect(result.valid).toBe(true)
  })

  it("OTC-only cart passes all compliance checks", () => {
    const cart = makeCart()
    const drugs = makeDrugLookup([
      { product_id: "prod_otc_01", schedule: "OTC" },
    ])
    const result = validateCartForCheckout(cart, drugs)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})

describe("complete-cart: no-discount rule on Rx drugs", () => {
  it("blocks promotions applied to Schedule H drug", () => {
    const cart = makeCart({
      items: [
        {
          product_id: "prod_h",
          title: "Amoxicillin 250mg",
          variant_id: "var_h",
          quantity: 1,
          discount_total: 100,
          metadata: { prescription_id: "rx_01" },
        },
      ],
      discount_total: 100,
    })
    const drugs = makeDrugLookup([{ product_id: "prod_h", schedule: "H" }])
    const result = validateCartForCheckout(cart, drugs)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes("Discounts cannot"))).toBe(true)
  })

  it("allows promotions on OTC drugs", () => {
    const cart = makeCart({
      items: [
        {
          product_id: "prod_otc",
          title: "Crocin Cold",
          variant_id: "var_otc",
          quantity: 2,
          discount_total: 50,
          metadata: null,
        },
      ],
      discount_total: 50,
    })
    const drugs = makeDrugLookup([{ product_id: "prod_otc", schedule: "OTC" }])
    const result = validateCartForCheckout(cart, drugs)
    expect(result.valid).toBe(true)
  })

  it("mixed cart: OTC discount allowed, Rx discount blocked", () => {
    const cart = makeCart({
      items: [
        {
          product_id: "prod_otc",
          title: "Crocin Cold",
          variant_id: "var_otc",
          quantity: 2,
          discount_total: 30,
          metadata: null,
        },
        {
          product_id: "prod_h",
          title: "Amoxicillin 250mg",
          variant_id: "var_h",
          quantity: 1,
          discount_total: 50,
          metadata: { prescription_id: "rx_01" },
        },
      ],
      discount_total: 80,
    })
    const drugs = makeDrugLookup([
      { product_id: "prod_otc", schedule: "OTC" },
      { product_id: "prod_h", schedule: "H" },
    ])
    const result = validateCartForCheckout(cart, drugs)
    expect(result.valid).toBe(false)
    // Only the Rx item triggers the discount error
    expect(result.errors.some((e) => e.includes("Amoxicillin"))).toBe(true)
    // OTC item discount is not flagged
    expect(result.errors.some((e) => e.includes("Crocin"))).toBe(false)
  })

  it("Rx drug with zero discount passes (no promotion applied)", () => {
    const cart = makeCart({
      items: [
        {
          product_id: "prod_h",
          title: "Amoxicillin 250mg",
          variant_id: "var_h",
          quantity: 1,
          discount_total: 0,
          metadata: { prescription_id: "rx_01" },
        },
      ],
    })
    const drugs = makeDrugLookup([{ product_id: "prod_h", schedule: "H" }])
    const result = validateCartForCheckout(cart, drugs)
    expect(result.valid).toBe(true)
  })
})

describe("complete-cart: happy path — full validation pipeline", () => {
  it("validates a compliant OTC-only cart through all steps", () => {
    const cart = makeCart()
    const drugs = makeDrugLookup([
      { product_id: "prod_otc_01", schedule: "OTC" },
    ])
    const result = validateCartForCheckout(cart, drugs)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it("validates a compliant mixed cart (OTC + H with Rx, no discounts on Rx)", () => {
    const cart = makeCart({
      items: [
        {
          product_id: "prod_otc",
          title: "Crocin Cold",
          variant_id: "var_otc",
          quantity: 2,
          discount_total: 20,
          metadata: null,
        },
        {
          product_id: "prod_h",
          title: "Amoxicillin 250mg",
          variant_id: "var_h",
          quantity: 1,
          discount_total: 0,
          metadata: { prescription_id: "rx_01" },
        },
      ],
      discount_total: 20,
    })
    const drugs = makeDrugLookup([
      { product_id: "prod_otc", schedule: "OTC" },
      { product_id: "prod_h", schedule: "H" },
    ])
    const result = validateCartForCheckout(cart, drugs)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })
})
