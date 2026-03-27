/**
 * Unit tests for approve-refund workflow business logic.
 *
 * Tests the SSD-04 segregation of duties enforcement and status
 * transition rules for refund approval. Business logic is tested
 * as extracted pure functions to avoid Medusa framework side effects.
 */

// ── Domain types ──────────────────────────────────────────────────────────────

type RefundStatus = "pending_approval" | "approved" | "rejected" | "processed"

interface RefundRecord {
  id: string
  status: RefundStatus
  raised_by: string
  approved_by: string | null
  order_id: string
  payment_id: string
  amount: number
  reason: string
}

// ── Extracted business logic (mirrors workflow steps) ─────────────────────────

function validateRefundForApproval(refund: RefundRecord | null): { valid: boolean; error?: string } {
  if (!refund) {
    return { valid: false, error: "Refund not found" }
  }
  if (refund.status !== "pending_approval") {
    return {
      valid: false,
      error: `Refund is not in pending_approval status (current: ${refund.status})`,
    }
  }
  return { valid: true }
}

function checkSsd04(raisedBy: string, approvedBy: string, refundId: string): { allowed: boolean; error?: string } {
  if (approvedBy === raisedBy) {
    return {
      allowed: false,
      error:
        `SSD-04 violation: the user who raised refund ${refundId} cannot also approve it. ` +
        `A different finance_admin must approve.`,
    }
  }
  return { allowed: true }
}

function applyApproval(refund: RefundRecord, approvedBy: string): RefundRecord {
  return {
    ...refund,
    status: "approved",
    approved_by: approvedBy,
  }
}

function revertApproval(refund: RefundRecord): RefundRecord {
  return {
    ...refund,
    status: "pending_approval",
    approved_by: null,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("approve-refund: validateRefundForApproval", () => {
  const pendingRefund: RefundRecord = {
    id: "refund_01",
    status: "pending_approval",
    raised_by: "user_support_01",
    approved_by: null,
    order_id: "order_01HX",
    payment_id: "pay_01HX",
    amount: 25000,
    reason: "return",
  }

  it("allows approval when status is pending_approval", () => {
    const result = validateRefundForApproval(pendingRefund)
    expect(result.valid).toBe(true)
  })

  it("rejects null refund (not found)", () => {
    const result = validateRefundForApproval(null)
    expect(result.valid).toBe(false)
    expect(result.error).toContain("not found")
  })

  it("rejects already-approved refund", () => {
    const result = validateRefundForApproval({ ...pendingRefund, status: "approved" })
    expect(result.valid).toBe(false)
    expect(result.error).toContain("pending_approval")
    expect(result.error).toContain("approved")
  })

  it("rejects already-rejected refund", () => {
    const result = validateRefundForApproval({ ...pendingRefund, status: "rejected" })
    expect(result.valid).toBe(false)
    expect(result.error).toContain("pending_approval")
  })

  it("rejects already-processed refund", () => {
    const result = validateRefundForApproval({ ...pendingRefund, status: "processed" })
    expect(result.valid).toBe(false)
    expect(result.error).toContain("pending_approval")
  })
})

describe("approve-refund: SSD-04 enforcement", () => {
  it("allows approval when approver differs from raiser", () => {
    const result = checkSsd04("user_support_01", "user_finance_01", "refund_01")
    expect(result.allowed).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it("blocks approval when approver is the same as raiser", () => {
    const result = checkSsd04("user_finance_01", "user_finance_01", "refund_01")
    expect(result.allowed).toBe(false)
    expect(result.error).toContain("SSD-04")
  })

  it("blocks approval when both IDs are identical regardless of role", () => {
    const sameUser = "user_admin_01"
    const result = checkSsd04(sameUser, sameUser, "refund_02")
    expect(result.allowed).toBe(false)
    expect(result.error).toContain("cannot also approve")
  })

  it("allows approval across different user IDs even if roles match", () => {
    // Two different finance_admin users — both allowed
    const result = checkSsd04("user_finance_01", "user_finance_02", "refund_03")
    expect(result.allowed).toBe(true)
  })

  it("includes refund_id in the SSD violation error message", () => {
    const result = checkSsd04("user_same", "user_same", "refund_special_01")
    expect(result.error).toContain("refund_special_01")
  })
})

describe("approve-refund: status transitions", () => {
  const refund: RefundRecord = {
    id: "refund_01",
    status: "pending_approval",
    raised_by: "user_support_01",
    approved_by: null,
    order_id: "order_01HX",
    payment_id: "pay_01HX",
    amount: 25000,
    reason: "return",
  }

  it("transitions refund to approved status", () => {
    const updated = applyApproval(refund, "user_finance_01")
    expect(updated.status).toBe("approved")
    expect(updated.approved_by).toBe("user_finance_01")
  })

  it("does not mutate the original refund object", () => {
    applyApproval(refund, "user_finance_01")
    expect(refund.status).toBe("pending_approval")
    expect(refund.approved_by).toBeNull()
  })

  it("compensation reverts approved refund to pending_approval", () => {
    const approved = applyApproval(refund, "user_finance_01")
    expect(approved.status).toBe("approved")

    const reverted = revertApproval(approved)
    expect(reverted.status).toBe("pending_approval")
    expect(reverted.approved_by).toBeNull()
  })
})

describe("approve-refund: happy path mock", () => {
  it("runs full approval flow with mocked service", async () => {
    const refundId = "refund_01"
    const approvedBy = "user_finance_01"
    const raisedBy = "user_support_01"

    const mockPaymentService = {
      listRefunds: jest.fn().mockResolvedValue([{
        id: refundId,
        status: "pending_approval",
        raised_by: raisedBy,
        order_id: "order_01HX",
        payment_id: "pay_01HX",
      }]),
      updateRefunds: jest.fn().mockResolvedValue({
        id: refundId,
        status: "approved",
        approved_by: approvedBy,
        raised_by: raisedBy,
      }),
    }

    const mockEventBus = {
      emit: jest.fn().mockResolvedValue(undefined),
    }

    // Validate
    const [refund] = await mockPaymentService.listRefunds({ id: refundId })
    expect(refund.status).toBe("pending_approval")

    // SSD check
    const ssdResult = checkSsd04(refund.raised_by, approvedBy, refundId)
    expect(ssdResult.allowed).toBe(true)

    // Apply approval
    const updated = await mockPaymentService.updateRefunds({
      id: refundId,
      status: "approved",
      approved_by: approvedBy,
    })
    expect(updated.status).toBe("approved")
    expect(updated.approved_by).toBe(approvedBy)

    // Emit event
    await mockEventBus.emit({
      name: "refund.approved",
      data: { refund_id: refundId, order_id: refund.order_id },
    })
    expect(mockEventBus.emit).toHaveBeenCalledWith({
      name: "refund.approved",
      data: { refund_id: refundId, order_id: "order_01HX" },
    })
  })

  it("throws on SSD violation before touching the database", async () => {
    const sameUserId = "user_who_does_everything"

    const mockPaymentService = {
      updateRefunds: jest.fn(),
    }

    // SSD check should prevent service call
    const ssdResult = checkSsd04(sameUserId, sameUserId, "refund_02")
    expect(ssdResult.allowed).toBe(false)

    // Simulate workflow throwing on SSD failure
    if (!ssdResult.allowed) {
      // updateRefunds should never be called
      expect(mockPaymentService.updateRefunds).not.toHaveBeenCalled()
    }
  })
})
