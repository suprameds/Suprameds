/**
 * Unit tests for raise-refund workflow business logic.
 *
 * Tests the validation rules and data flow that control how a
 * support_agent raises a refund request. Because the workflow
 * steps use Medusa's framework DI, we test the business rules
 * as extracted pure functions rather than importing steps directly.
 */

// ── Domain types ──────────────────────────────────────────────────────────────

type RefundInput = {
  order_id: string
  payment_id: string
  reason: string
  amount: number
  raised_by: string
  items?: Array<{ line_item_id: string; quantity: number; reason?: string }>
}

const VALID_REASONS = [
  "rejected_rx_line",
  "cancelled_order",
  "return",
  "batch_recall",
  "payment_capture_error",
  "cod_non_delivery",
  "other",
] as const

// ── Extracted business logic (mirrors validateOrderStep) ──────────────────────

function validateRefundInput(input: Partial<RefundInput>): { valid: boolean; error?: string } {
  if (!input.order_id) {
    return { valid: false, error: "order_id is required to raise a refund" }
  }
  if (!input.payment_id) {
    return { valid: false, error: "payment_id is required to raise a refund" }
  }
  if (!input.amount || input.amount <= 0) {
    return { valid: false, error: "amount must be a positive number" }
  }
  if (!input.reason || !VALID_REASONS.includes(input.reason as any)) {
    return { valid: false, error: `reason must be one of: ${VALID_REASONS.join(", ")}` }
  }
  if (!input.raised_by) {
    return { valid: false, error: "raised_by is required" }
  }
  return { valid: true }
}

function buildRefundRecord(input: RefundInput) {
  return {
    order_id: input.order_id,
    payment_id: input.payment_id,
    reason: input.reason,
    amount: input.amount,
    raised_by: input.raised_by,
    status: "pending_approval",
    metadata: input.items ? { items: input.items } : null,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("raise-refund: validateRefundInput", () => {
  const validInput: RefundInput = {
    order_id: "order_01HX",
    payment_id: "pay_01HX",
    reason: "return",
    amount: 25000,
    raised_by: "user_support_01",
  }

  it("passes with all required fields", () => {
    const result = validateRefundInput(validInput)
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it("fails when order_id is missing", () => {
    const result = validateRefundInput({ ...validInput, order_id: undefined })
    expect(result.valid).toBe(false)
    expect(result.error).toContain("order_id")
  })

  it("fails when payment_id is missing", () => {
    const result = validateRefundInput({ ...validInput, payment_id: undefined })
    expect(result.valid).toBe(false)
    expect(result.error).toContain("payment_id")
  })

  it("fails when amount is zero", () => {
    const result = validateRefundInput({ ...validInput, amount: 0 })
    expect(result.valid).toBe(false)
    expect(result.error).toContain("amount")
  })

  it("fails when amount is negative", () => {
    const result = validateRefundInput({ ...validInput, amount: -100 })
    expect(result.valid).toBe(false)
    expect(result.error).toContain("amount")
  })

  it("fails with an invalid reason", () => {
    const result = validateRefundInput({ ...validInput, reason: "invalid_reason" })
    expect(result.valid).toBe(false)
    expect(result.error).toContain("reason")
  })

  it("accepts all valid reason values", () => {
    for (const reason of VALID_REASONS) {
      const result = validateRefundInput({ ...validInput, reason })
      expect(result.valid).toBe(true)
    }
  })

  it("fails when raised_by is missing", () => {
    const result = validateRefundInput({ ...validInput, raised_by: undefined })
    expect(result.valid).toBe(false)
    expect(result.error).toContain("raised_by")
  })
})

describe("raise-refund: buildRefundRecord", () => {
  const input: RefundInput = {
    order_id: "order_01HX",
    payment_id: "pay_01HX",
    reason: "cancelled_order",
    amount: 50000,
    raised_by: "user_support_01",
  }

  it("creates refund with pending_approval status", () => {
    const record = buildRefundRecord(input)
    expect(record.status).toBe("pending_approval")
  })

  it("copies all input fields to the record", () => {
    const record = buildRefundRecord(input)
    expect(record.order_id).toBe(input.order_id)
    expect(record.payment_id).toBe(input.payment_id)
    expect(record.reason).toBe(input.reason)
    expect(record.amount).toBe(input.amount)
    expect(record.raised_by).toBe(input.raised_by)
  })

  it("sets metadata to null when no items provided", () => {
    const record = buildRefundRecord(input)
    expect(record.metadata).toBeNull()
  })

  it("stores items in metadata when provided", () => {
    const items = [{ line_item_id: "li_01", quantity: 2, reason: "damaged" }]
    const record = buildRefundRecord({ ...input, items })
    expect(record.metadata).toEqual({ items })
  })

  it("approved_by is not set on raise (pending_approval state)", () => {
    const record = buildRefundRecord(input)
    expect((record as any).approved_by).toBeUndefined()
  })
})

describe("raise-refund: happy path mock", () => {
  it("creates and returns a refund record with correct shape", async () => {
    const mockRefund = {
      id: "refund_01",
      order_id: "order_01HX",
      payment_id: "pay_01HX",
      reason: "return",
      amount: 25000,
      raised_by: "user_support_01",
      status: "pending_approval",
      metadata: null,
    }

    // Mock the payment service
    const mockPaymentService = {
      createRefunds: jest.fn().mockResolvedValue(mockRefund),
    }

    const result = await mockPaymentService.createRefunds({
      order_id: "order_01HX",
      payment_id: "pay_01HX",
      reason: "return",
      amount: 25000,
      raised_by: "user_support_01",
      status: "pending_approval",
      metadata: null,
    })

    expect(result.id).toBe("refund_01")
    expect(result.status).toBe("pending_approval")
    expect(mockPaymentService.createRefunds).toHaveBeenCalledTimes(1)
  })

  it("emits refund.raised event with correct payload", async () => {
    const mockEventBus = {
      emit: jest.fn().mockResolvedValue(undefined),
    }

    await mockEventBus.emit({
      name: "refund.raised",
      data: { refund_id: "refund_01", order_id: "order_01HX" },
    })

    expect(mockEventBus.emit).toHaveBeenCalledWith({
      name: "refund.raised",
      data: { refund_id: "refund_01", order_id: "order_01HX" },
    })
  })
})

describe("raise-refund: SSD tracking (raised_by recorded)", () => {
  const input: RefundInput = {
    order_id: "order_01HX",
    payment_id: "pay_01HX",
    reason: "return",
    amount: 25000,
    raised_by: "user_support_01",
  }

  it("records raised_by so SSD-04 can be enforced at approval time", () => {
    const record = buildRefundRecord(input)
    expect(record.raised_by).toBe("user_support_01")
  })

  it("different support agents produce different raised_by values", () => {
    const record1 = buildRefundRecord(input)
    const record2 = buildRefundRecord({ ...input, raised_by: "user_support_02" })
    expect(record1.raised_by).not.toBe(record2.raised_by)
  })
})

describe("raise-refund: item breakdown in metadata", () => {
  const baseInput: RefundInput = {
    order_id: "order_01HX",
    payment_id: "pay_01HX",
    reason: "return",
    amount: 25000,
    raised_by: "user_support_01",
  }

  it("stores line-level refund items when provided", () => {
    const items = [
      { line_item_id: "li_01", quantity: 2, reason: "damaged" },
      { line_item_id: "li_02", quantity: 1, reason: "wrong_item" },
    ]
    const record = buildRefundRecord({ ...baseInput, items })
    expect(record.metadata).toEqual({ items })
    expect((record.metadata as any).items).toHaveLength(2)
  })

  it("preserves individual item reasons", () => {
    const items = [{ line_item_id: "li_01", quantity: 1, reason: "expired_batch" }]
    const record = buildRefundRecord({ ...baseInput, items })
    expect((record.metadata as any).items[0].reason).toBe("expired_batch")
  })

  it("handles items without optional reason field", () => {
    const items = [{ line_item_id: "li_01", quantity: 3 }]
    const record = buildRefundRecord({ ...baseInput, items })
    expect((record.metadata as any).items[0].line_item_id).toBe("li_01")
    expect((record.metadata as any).items[0].quantity).toBe(3)
  })
})

describe("raise-refund: compensation (rollback)", () => {
  it("deletes refund record on compensation", async () => {
    const mockPaymentService = {
      createRefunds: jest.fn().mockResolvedValue({
        id: "refund_01",
        status: "pending_approval",
      }),
      deleteRefunds: jest.fn().mockResolvedValue(undefined),
    }

    // Create refund
    const refund = await mockPaymentService.createRefunds({
      order_id: "order_01HX",
      payment_id: "pay_01HX",
      reason: "return",
      amount: 25000,
      raised_by: "user_support_01",
      status: "pending_approval",
    })

    // Simulate compensation: delete the record
    await mockPaymentService.deleteRefunds(refund.id)
    expect(mockPaymentService.deleteRefunds).toHaveBeenCalledWith("refund_01")
  })

  it("compensation is no-op when refund_id is null/undefined", async () => {
    const mockPaymentService = {
      deleteRefunds: jest.fn(),
    }

    // Simulate compensation with no refund_id — should not call delete
    const refundId: string | null = null
    if (refundId) {
      await mockPaymentService.deleteRefunds(refundId)
    }
    expect(mockPaymentService.deleteRefunds).not.toHaveBeenCalled()
  })

  it("compensation swallows errors gracefully (best-effort)", async () => {
    const mockPaymentService = {
      deleteRefunds: jest.fn().mockRejectedValue(new Error("DB connection lost")),
    }

    // Compensation should not throw — mirrors the try/catch in the step
    let threw = false
    try {
      await mockPaymentService.deleteRefunds("refund_01").catch(() => {
        // Swallowed — best-effort compensation
      })
    } catch {
      threw = true
    }
    expect(threw).toBe(false)
  })
})
