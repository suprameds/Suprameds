import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { PAYMENT_MODULE } from "../../modules/payment"

type RaiseRefundInput = {
  order_id: string
  payment_id: string
  reason: string
  amount: number
  raised_by: string
  items?: Array<{ line_item_id: string; quantity: number; reason?: string }>
}

/**
 * Validates that the required order_id is present before raising a refund.
 */
export const validateOrderStep = createStep(
  "validate-order-step",
  async (input: { order_id: string; payment_id: string; amount: number }, { container }) => {
    if (!input.order_id) {
      throw new Error("order_id is required to raise a refund")
    }
    if (!input.payment_id) {
      throw new Error("payment_id is required to raise a refund")
    }
    if (!input.amount || input.amount <= 0) {
      throw new Error("amount must be a positive number")
    }
    return new StepResponse({ valid: true })
  }
)

/**
 * Creates a PharmaRefund record in pending_approval state.
 * Compensation deletes the record if a later step fails.
 */
export const createRefundRecordStep = createStep(
  "create-refund-record-step",
  async (
    input: {
      order_id: string
      payment_id: string
      reason: string
      amount: number
      raised_by: string
      items?: Array<{ line_item_id: string; quantity: number; reason?: string }>
    },
    { container }
  ) => {
    const paymentService = container.resolve(PAYMENT_MODULE) as any

    const refund = await paymentService.createRefunds({
      order_id: input.order_id,
      payment_id: input.payment_id,
      reason: input.reason,
      amount: input.amount,
      raised_by: input.raised_by,
      status: "pending_approval",
      metadata: input.items ? { items: input.items } : null,
    })

    return new StepResponse(refund, refund.id)
  },
  // Compensation: delete the refund record if a later step rolls back
  async (refundId: string, { container }) => {
    if (!refundId) return
    const paymentService = container.resolve(PAYMENT_MODULE) as any
    try {
      await paymentService.deleteRefunds(refundId)
    } catch {
      // Best-effort compensation
    }
  }
)

/**
 * Emits the refund.raised event for downstream subscribers (e.g., finance_admin notification).
 */
export const emitRefundRaisedStep = createStep(
  "emit-refund-raised-step",
  async (data: { refund_id: string; order_id: string }, { container }) => {
    const eventBus = container.resolve(Modules.EVENT_BUS) as any
    await eventBus.emit({
      name: "refund.raised",
      data: {
        refund_id: data.refund_id,
        order_id: data.order_id,
      },
    })
    return new StepResponse(null)
  }
)

/**
 * RaiseRefundWorkflow — support_agent raises a refund request.
 * Creates a PharmaRefund in pending_approval status and notifies finance_admin.
 */
export const RaiseRefundWorkflow = createWorkflow(
  "raise-refund-workflow",
  (input: RaiseRefundInput) => {
    // Step 1: Validate required fields
    validateOrderStep({
      order_id: input.order_id,
      payment_id: input.payment_id,
      amount: input.amount,
    })

    // Step 2: Create the refund record
    const refund = createRefundRecordStep({
      order_id: input.order_id,
      payment_id: input.payment_id,
      reason: input.reason,
      amount: input.amount,
      raised_by: input.raised_by,
      items: input.items,
    }) as any

    // Step 3: Emit event to notify finance team
    emitRefundRaisedStep({
      refund_id: refund.id,
      order_id: input.order_id,
    })

    return new WorkflowResponse(refund)
  }
)
