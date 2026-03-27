import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules, MedusaError } from "@medusajs/framework/utils"
import { PAYMENT_MODULE } from "../../modules/payment"

type ApproveRefundInput = {
  refund_id: string
  approved_by: string
}

/**
 * Fetches the refund and validates it is in pending_approval status.
 * Returns the refund record for downstream steps.
 */
export const validateRefundStep = createStep(
  "validate-refund-step",
  async (input: { refund_id: string }, { container }) => {
    const paymentService = container.resolve(PAYMENT_MODULE) as any

    const [refund] = await paymentService.listRefunds(
      { id: input.refund_id },
      { select: ["id", "status", "raised_by", "order_id", "payment_id"] }
    )

    if (!refund) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Refund ${input.refund_id} not found`
      )
    }

    if (refund.status !== "pending_approval") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Refund ${input.refund_id} is not in pending_approval status (current: ${refund.status})`
      )
    }

    return new StepResponse(refund)
  }
)

/**
 * SSD-04 enforcement: the finance_admin approving the refund must not be
 * the same user who raised it (raised_by on the refund record).
 */
export const enforceSsdStep = createStep(
  "enforce-ssd-step",
  async (
    input: { approved_by: string; raised_by: string; refund_id: string },
    { container }
  ) => {
    if (input.approved_by === input.raised_by) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `SSD-04 violation: the user who raised refund ${input.refund_id} cannot also approve it. ` +
          `A different finance_admin must approve.`
      )
    }
    return new StepResponse({ ssd_passed: true })
  }
)

/**
 * Updates the refund record to approved status.
 * Compensation reverts status to pending_approval if a later step fails.
 */
export const updateRefundApprovalStep = createStep(
  "update-refund-approval-step",
  async (
    input: { refund_id: string; approved_by: string },
    { container }
  ) => {
    const paymentService = container.resolve(PAYMENT_MODULE) as any

    const updated = await paymentService.updateRefunds({
      id: input.refund_id,
      status: "approved",
      approved_by: input.approved_by,
    })

    return new StepResponse(updated, input.refund_id)
  },
  // Compensation: revert to pending_approval if a later step rolls back
  async (refundId: string, { container }) => {
    if (!refundId) return
    const paymentService = container.resolve(PAYMENT_MODULE) as any
    try {
      await paymentService.updateRefunds({
        id: refundId,
        status: "pending_approval",
        approved_by: null,
      })
    } catch {
      // Best-effort compensation
    }
  }
)

/**
 * Emits the refund.approved event for downstream subscribers.
 */
export const emitRefundApprovedStep = createStep(
  "emit-refund-approved-step",
  async (data: { refund_id: string; order_id: string }, { container }) => {
    const eventBus = container.resolve(Modules.EVENT_BUS) as any
    await eventBus.emit({
      name: "refund.approved",
      data: {
        refund_id: data.refund_id,
        order_id: data.order_id,
      },
    })
    return new StepResponse(null)
  }
)

/**
 * ApproveRefundWorkflow — finance_admin approves a pending refund.
 * Enforces SSD-04: approver must differ from the raiser.
 */
export const ApproveRefundWorkflow = createWorkflow(
  "approve-refund-workflow",
  (input: ApproveRefundInput) => {
    // Step 1: Validate refund exists and is in pending_approval
    const refund = validateRefundStep({ refund_id: input.refund_id }) as any

    // Step 2: SSD-04 — approve and raise must be different users
    enforceSsdStep({
      approved_by: input.approved_by,
      raised_by: refund.raised_by,
      refund_id: input.refund_id,
    })

    // Step 3: Persist the approval
    const updated = updateRefundApprovalStep({
      refund_id: input.refund_id,
      approved_by: input.approved_by,
    }) as any

    // Step 4: Emit event for downstream processing
    emitRefundApprovedStep({
      refund_id: input.refund_id,
      order_id: refund.order_id,
    })

    return new WorkflowResponse(updated)
  }
)
