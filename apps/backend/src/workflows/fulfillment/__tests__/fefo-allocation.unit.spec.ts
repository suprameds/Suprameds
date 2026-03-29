/**
 * Unit tests for FEFO (First Expiry, First Out) allocation workflow.
 *
 * Tests the batch sorting, quantity deduction, multi-batch spanning,
 * MRP ceiling checks, and compensation (rollback) logic. Business
 * logic is tested as extracted pure functions to avoid Medusa DI.
 */

// -- Domain types (mirrors workflow) ------------------------------------

type BatchRecord = {
  id: string
  lot_number: string
  product_variant_id: string
  available_quantity: number
  batch_mrp_paise: number | null
  expiry_date: string // ISO date string
  status: "active" | "depleted"
}

type AllocationLineItem = {
  line_item_id: string
  product_id: string
  variant_id: string
  quantity: number
  unit_price_paise: number
}

type Allocation = {
  line_item_id: string
  batch_id: string
  lot_number: string
  quantity: number
  batch_mrp_paise: number | null
  expiry_date: string
}

type CompensationEntry = {
  batch_id: string
  quantity: number
  was_depleted: boolean
}

// -- Extracted business logic -------------------------------------------

/**
 * Sorts batches by expiry_date ascending (FEFO order).
 */
function sortBatchesFEFO(batches: BatchRecord[]): BatchRecord[] {
  return [...batches].sort(
    (a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
  )
}

/**
 * Filters out expired and zero-quantity batches.
 */
function filterEligibleBatches(batches: BatchRecord[], today: Date): BatchRecord[] {
  const todayStart = new Date(today)
  todayStart.setHours(0, 0, 0, 0)
  return batches.filter((b) => {
    const expiry = new Date(b.expiry_date)
    expiry.setHours(0, 0, 0, 0)
    return expiry >= todayStart && b.available_quantity > 0
  })
}

/**
 * Checks if selling price exceeds batch MRP (illegal in India).
 */
function checkMrpCeiling(
  unitPricePaise: number,
  batchMrpPaise: number | null
): { skip: boolean; warning?: string; lotNumber?: string } {
  if (batchMrpPaise === null) return { skip: false }
  if (unitPricePaise > batchMrpPaise) {
    return {
      skip: true,
      warning: `Selling price Rs${(unitPricePaise / 100).toFixed(2)} exceeds batch MRP Rs${(batchMrpPaise / 100).toFixed(2)}`,
    }
  }
  return { skip: false }
}

/**
 * Core FEFO allocation: walks sorted batches and allocates quantities.
 */
function allocateFEFO(
  eligibleBatches: BatchRecord[],
  needed: number,
  unitPricePaise: number
): {
  allocations: Array<{
    batch_id: string
    lot_number: string
    quantity: number
    batch_mrp_paise: number | null
    expiry_date: string
    was_depleted: boolean
    new_available: number
  }>
  warnings: string[]
  remaining: number
} {
  const allocations: Array<{
    batch_id: string
    lot_number: string
    quantity: number
    batch_mrp_paise: number | null
    expiry_date: string
    was_depleted: boolean
    new_available: number
  }> = []
  const warnings: string[] = []
  let remaining = needed

  for (const batch of eligibleBatches) {
    if (remaining <= 0) break

    const mrpCheck = checkMrpCeiling(unitPricePaise, batch.batch_mrp_paise)
    if (mrpCheck.skip) {
      warnings.push(mrpCheck.warning!)
      continue
    }

    const allocQty = Math.min(batch.available_quantity, remaining)
    const newAvailable = batch.available_quantity - allocQty
    const isDepleted = newAvailable === 0

    allocations.push({
      batch_id: batch.id,
      lot_number: batch.lot_number,
      quantity: allocQty,
      batch_mrp_paise: batch.batch_mrp_paise,
      expiry_date: batch.expiry_date,
      was_depleted: isDepleted,
      new_available: newAvailable,
    })

    remaining -= allocQty
  }

  return { allocations, warnings, remaining }
}

/**
 * Compensation: restores batch quantities and reactivates depleted batches.
 */
function computeRestorations(
  currentQuantities: Map<string, number>,
  compensationEntries: CompensationEntry[]
): Array<{ batch_id: string; restored_quantity: number; new_status: "active" | "depleted" }> {
  return compensationEntries.map((entry) => {
    const currentQty = currentQuantities.get(entry.batch_id) ?? 0
    return {
      batch_id: entry.batch_id,
      restored_quantity: currentQty + entry.quantity,
      new_status: entry.was_depleted ? "active" as const : "depleted" as const,
    }
  })
}

// -- Tests ---------------------------------------------------------------

describe("fefo-allocation: FEFO sort order", () => {
  const batches: BatchRecord[] = [
    { id: "b3", lot_number: "LOT-C", product_variant_id: "v1", available_quantity: 20, batch_mrp_paise: 5000, expiry_date: "2026-12-01", status: "active" },
    { id: "b1", lot_number: "LOT-A", product_variant_id: "v1", available_quantity: 50, batch_mrp_paise: 5000, expiry_date: "2026-06-01", status: "active" },
    { id: "b2", lot_number: "LOT-B", product_variant_id: "v1", available_quantity: 30, batch_mrp_paise: 5000, expiry_date: "2026-09-15", status: "active" },
  ]

  it("sorts batches by expiry_date ascending (earliest first)", () => {
    const sorted = sortBatchesFEFO(batches)
    expect(sorted[0].id).toBe("b1") // Jun 2026
    expect(sorted[1].id).toBe("b2") // Sep 2026
    expect(sorted[2].id).toBe("b3") // Dec 2026
  })

  it("does not mutate the original array", () => {
    const original = [...batches]
    sortBatchesFEFO(batches)
    expect(batches).toEqual(original)
  })

  it("handles single batch without error", () => {
    const sorted = sortBatchesFEFO([batches[0]])
    expect(sorted).toHaveLength(1)
  })

  it("handles empty array", () => {
    const sorted = sortBatchesFEFO([])
    expect(sorted).toHaveLength(0)
  })
})

describe("fefo-allocation: eligible batch filtering", () => {
  const today = new Date("2026-06-15")

  const batches: BatchRecord[] = [
    { id: "b1", lot_number: "LOT-A", product_variant_id: "v1", available_quantity: 50, batch_mrp_paise: 5000, expiry_date: "2026-06-01", status: "active" },  // expired
    { id: "b2", lot_number: "LOT-B", product_variant_id: "v1", available_quantity: 0, batch_mrp_paise: 5000, expiry_date: "2026-12-01", status: "active" },   // zero qty
    { id: "b3", lot_number: "LOT-C", product_variant_id: "v1", available_quantity: 30, batch_mrp_paise: 5000, expiry_date: "2026-12-01", status: "active" },  // eligible
    { id: "b4", lot_number: "LOT-D", product_variant_id: "v1", available_quantity: 10, batch_mrp_paise: 5000, expiry_date: "2026-06-15", status: "active" },  // expires today = eligible
  ]

  it("excludes expired batches", () => {
    const eligible = filterEligibleBatches(batches, today)
    expect(eligible.find((b) => b.id === "b1")).toBeUndefined()
  })

  it("excludes zero-quantity batches", () => {
    const eligible = filterEligibleBatches(batches, today)
    expect(eligible.find((b) => b.id === "b2")).toBeUndefined()
  })

  it("includes batches with future expiry and positive quantity", () => {
    const eligible = filterEligibleBatches(batches, today)
    expect(eligible.find((b) => b.id === "b3")).toBeDefined()
  })

  it("includes batches expiring today (expiry_date == today)", () => {
    const eligible = filterEligibleBatches(batches, today)
    expect(eligible.find((b) => b.id === "b4")).toBeDefined()
  })

  it("returns empty array when all batches are expired or depleted", () => {
    const allBad: BatchRecord[] = [
      { id: "b1", lot_number: "LOT-X", product_variant_id: "v1", available_quantity: 50, batch_mrp_paise: 5000, expiry_date: "2025-01-01", status: "active" },
      { id: "b2", lot_number: "LOT-Y", product_variant_id: "v1", available_quantity: 0, batch_mrp_paise: 5000, expiry_date: "2027-01-01", status: "active" },
    ]
    const eligible = filterEligibleBatches(allBad, today)
    expect(eligible).toHaveLength(0)
  })
})

describe("fefo-allocation: MRP ceiling check", () => {
  it("allows sale when selling price is below batch MRP", () => {
    const result = checkMrpCeiling(4000, 5000)
    expect(result.skip).toBe(false)
  })

  it("allows sale when selling price equals batch MRP", () => {
    const result = checkMrpCeiling(5000, 5000)
    expect(result.skip).toBe(false)
  })

  it("skips batch when selling price exceeds batch MRP", () => {
    const result = checkMrpCeiling(6000, 5000)
    expect(result.skip).toBe(true)
    expect(result.warning).toContain("exceeds")
  })

  it("does not skip when batch MRP is null (no MRP data)", () => {
    const result = checkMrpCeiling(6000, null)
    expect(result.skip).toBe(false)
  })
})

describe("fefo-allocation: quantity deduction logic", () => {
  const batches: BatchRecord[] = sortBatchesFEFO([
    { id: "b1", lot_number: "LOT-A", product_variant_id: "v1", available_quantity: 50, batch_mrp_paise: 5000, expiry_date: "2026-06-01", status: "active" },
    { id: "b2", lot_number: "LOT-B", product_variant_id: "v1", available_quantity: 80, batch_mrp_paise: 5000, expiry_date: "2026-09-01", status: "active" },
  ])

  it("deducts partial quantity from a batch (50 available, 30 needed)", () => {
    const { allocations, remaining } = allocateFEFO(batches, 30, 4000)
    expect(allocations).toHaveLength(1)
    expect(allocations[0].batch_id).toBe("b1")
    expect(allocations[0].quantity).toBe(30)
    expect(allocations[0].new_available).toBe(20)
    expect(allocations[0].was_depleted).toBe(false)
    expect(remaining).toBe(0)
  })

  it("depletes a batch when needed quantity equals available", () => {
    const { allocations } = allocateFEFO(batches, 50, 4000)
    expect(allocations[0].quantity).toBe(50)
    expect(allocations[0].new_available).toBe(0)
    expect(allocations[0].was_depleted).toBe(true)
  })

  it("spans multiple batches when one is insufficient", () => {
    const { allocations, remaining } = allocateFEFO(batches, 100, 4000)
    expect(allocations).toHaveLength(2)
    // First batch: take all 50
    expect(allocations[0].batch_id).toBe("b1")
    expect(allocations[0].quantity).toBe(50)
    expect(allocations[0].was_depleted).toBe(true)
    // Second batch: take remaining 50 from 80 available
    expect(allocations[1].batch_id).toBe("b2")
    expect(allocations[1].quantity).toBe(50)
    expect(allocations[1].new_available).toBe(30)
    expect(allocations[1].was_depleted).toBe(false)
    expect(remaining).toBe(0)
  })

  it("reports insufficient stock when total available < needed", () => {
    const { allocations, remaining } = allocateFEFO(batches, 200, 4000)
    // All 130 allocated, 70 remaining
    expect(allocations).toHaveLength(2)
    expect(remaining).toBe(70)
  })

  it("allocates nothing from empty batch list", () => {
    const { allocations, remaining } = allocateFEFO([], 30, 4000)
    expect(allocations).toHaveLength(0)
    expect(remaining).toBe(30)
  })
})

describe("fefo-allocation: MRP-violating batches are skipped during allocation", () => {
  const batches: BatchRecord[] = [
    { id: "b1", lot_number: "LOT-CHEAP", product_variant_id: "v1", available_quantity: 50, batch_mrp_paise: 3000, expiry_date: "2026-06-01", status: "active" },
    { id: "b2", lot_number: "LOT-OK", product_variant_id: "v1", available_quantity: 50, batch_mrp_paise: 5000, expiry_date: "2026-09-01", status: "active" },
  ]

  it("skips batch with MRP lower than selling price and uses next batch", () => {
    const { allocations, warnings } = allocateFEFO(batches, 30, 4000)
    // b1 has MRP 3000 but selling at 4000 — skipped
    expect(allocations).toHaveLength(1)
    expect(allocations[0].batch_id).toBe("b2")
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain("exceeds")
  })

  it("fails to allocate when ALL batches have MRP below selling price", () => {
    const lowMrpBatches: BatchRecord[] = [
      { id: "b1", lot_number: "LOT-1", product_variant_id: "v1", available_quantity: 50, batch_mrp_paise: 2000, expiry_date: "2026-06-01", status: "active" },
      { id: "b2", lot_number: "LOT-2", product_variant_id: "v1", available_quantity: 50, batch_mrp_paise: 2500, expiry_date: "2026-09-01", status: "active" },
    ]
    const { allocations, remaining, warnings } = allocateFEFO(lowMrpBatches, 30, 4000)
    expect(allocations).toHaveLength(0)
    expect(remaining).toBe(30)
    expect(warnings).toHaveLength(2)
  })
})

describe("fefo-allocation: compensation (rollback)", () => {
  it("restores deducted quantities to batches", () => {
    const currentQuantities = new Map<string, number>([
      ["b1", 0],  // was depleted
      ["b2", 30], // had 30 left after partial deduction
    ])

    const compensationEntries: CompensationEntry[] = [
      { batch_id: "b1", quantity: 50, was_depleted: true },
      { batch_id: "b2", quantity: 40, was_depleted: false },
    ]

    const restorations = computeRestorations(currentQuantities, compensationEntries)

    expect(restorations[0].batch_id).toBe("b1")
    expect(restorations[0].restored_quantity).toBe(50) // 0 + 50
    expect(restorations[0].new_status).toBe("active")  // was depleted -> active

    expect(restorations[1].batch_id).toBe("b2")
    expect(restorations[1].restored_quantity).toBe(70) // 30 + 40
  })

  it("handles empty compensation list", () => {
    const restorations = computeRestorations(new Map(), [])
    expect(restorations).toHaveLength(0)
  })
})

describe("fefo-allocation: happy path mock", () => {
  it("runs full allocation flow with mocked batch service", async () => {
    const mockBatchService = {
      listBatches: jest.fn().mockResolvedValue([
        { id: "b1", lot_number: "LOT-A", available_quantity: 60, batch_mrp_paise: 5000, expiry_date: "2026-06-01", status: "active" },
        { id: "b2", lot_number: "LOT-B", available_quantity: 80, batch_mrp_paise: 5000, expiry_date: "2026-09-01", status: "active" },
      ]),
      createBatchDeductions: jest.fn().mockImplementation((data: any) => ({
        id: `deduction_${data.batch_id}`,
        ...data,
      })),
      updateBatches: jest.fn().mockResolvedValue(undefined),
    }

    // 1. Fetch batches
    const batches = await mockBatchService.listBatches({
      product_variant_id: "v1",
      status: "active",
    })
    expect(batches).toHaveLength(2)

    // 2. Allocate using pure logic
    const { allocations, remaining } = allocateFEFO(
      batches.map((b: any) => ({ ...b, product_variant_id: "v1" })),
      100,
      4000
    )
    expect(remaining).toBe(0)
    expect(allocations).toHaveLength(2)

    // 3. Create deduction records
    for (const alloc of allocations) {
      const deduction = await mockBatchService.createBatchDeductions({
        batch_id: alloc.batch_id,
        order_line_item_id: "li_01",
        order_id: "order_01",
        quantity: alloc.quantity,
        deduction_type: "sale",
      })
      expect(deduction.id).toContain("deduction_")
    }

    // 4. Update batch quantities
    for (const alloc of allocations) {
      await mockBatchService.updateBatches({
        id: alloc.batch_id,
        available_quantity: alloc.new_available,
        ...(alloc.was_depleted ? { status: "depleted" } : {}),
      })
    }

    expect(mockBatchService.createBatchDeductions).toHaveBeenCalledTimes(2)
    expect(mockBatchService.updateBatches).toHaveBeenCalledTimes(2)
  })

  it("returns errors when no batches are available", async () => {
    const mockBatchService = {
      listBatches: jest.fn().mockResolvedValue([]),
    }

    const batches = await mockBatchService.listBatches({
      product_variant_id: "v1",
      status: "active",
    })

    const { allocations, remaining } = allocateFEFO(batches, 30, 4000)
    expect(allocations).toHaveLength(0)
    expect(remaining).toBe(30)
  })
})
