import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { COD_MODULE } from "../../modules/cod"
import { ORDERS_MODULE } from "../../modules/orders"

type ConfirmCodInput = {
  order_id: string
  confirmed: boolean
  phone_verified?: boolean
}

/**
 * Validates the COD order exists and is in a confirmable state.
 */
const validateCodOrderStep = createStep(
  "validate-cod-order-step",
  async (input: { order_id: string }, { container }) => {
    const codService = container.resolve(COD_MODULE) as any

    const [codOrder] = await codService.listCodOrders(
      { order_id: input.order_id },
      { take: 1 }
    )

    if (!codOrder) {
      throw new Error(`No COD record found for order ${input.order_id}`)
    }

    if (codOrder.status !== "pending_confirmation") {
      throw new Error(
        `COD order is not pending confirmation — current status: ${codOrder.status}`
      )
    }

    return new StepResponse(codOrder)
  }
)

/**
 * Confirms or cancels the COD order based on customer response.
 */
const updateCodStatusStep = createStep(
  "update-cod-status-step",
  async (
    input: {
      cod_order_id: string
      confirmed: boolean
      phone_verified: boolean
    },
    { container }
  ) => {
    const codService = container.resolve(COD_MODULE) as any

    if (input.confirmed) {
      const updated = await codService.confirmOrder(
        input.cod_order_id,
        input.phone_verified
      )
      return new StepResponse(updated, {
        cod_order_id: input.cod_order_id,
        previous_status: "pending_confirmation",
      })
    }

    // Customer declined — cancel the COD order
    const updated = await codService.updateCodOrders(input.cod_order_id, {
      status: "cancelled",
    })
    return new StepResponse(updated, {
      cod_order_id: input.cod_order_id,
      previous_status: "pending_confirmation",
    })
  },
  // Compensation: revert to pending_confirmation if workflow rolls back
  async (compensationData, { container }) => {
    if (!compensationData) return
    const codService = container.resolve(COD_MODULE) as any
    try {
      await codService.updateCodOrders(compensationData.cod_order_id, {
        status: compensationData.previous_status,
        confirmed_at: null,
      })
    } catch {
      // Best-effort rollback
    }
  }
)

/**
 * Transitions the pharmaOrder extension status based on COD confirmation.
 * confirmed → fully_approved, cancelled → cancelled
 */
const updateOrderExtensionStep = createStep(
  "update-order-extension-cod-step",
  async (
    input: { order_id: string; confirmed: boolean },
    { container }
  ) => {
    const orderService = container.resolve(ORDERS_MODULE) as any

    const [extension] = await orderService.listOrderExtensions(
      { order_id: input.order_id },
      { take: 1 }
    )

    if (!extension) return new StepResponse(null)

    const previousStatus = extension.status

    if (input.confirmed) {
      // Move past COD confirmation gate to Rx review (or fully_approved if OTC)
      const nextStatus = extension.is_rx_order
        ? "pending_rx_review"
        : "fully_approved"

      await orderService.updateOrderExtensions({
        id: extension.id,
        cod_confirmation_status: "confirmed",
        cod_confirmed_at: new Date(),
        status: nextStatus,
      })

      // Record state transition
      await orderService.createOrderStateHistorys({
        order_id: input.order_id,
        from_status: previousStatus,
        to_status: nextStatus,
        changed_by: "system:cod-confirmation",
        reason: "Customer confirmed COD order",
      })

      return new StepResponse({ transitioned: true, to: nextStatus })
    }

    // Customer declined — cancel
    await orderService.updateOrderExtensions({
      id: extension.id,
      cod_confirmation_status: "auto_cancelled",
      status: "cancelled",
      cancellation_reason: "Customer declined COD confirmation",
    })

    await orderService.createOrderStateHistorys({
      order_id: input.order_id,
      from_status: previousStatus,
      to_status: "cancelled",
      changed_by: "system:cod-confirmation",
      reason: "Customer declined COD confirmation",
    })

    return new StepResponse({ transitioned: true, to: "cancelled" })
  }
)

/**
 * Emits cod.confirmed or cod.cancelled event for downstream subscribers.
 */
const emitCodEventStep = createStep(
  "emit-cod-event-step",
  async (
    input: { order_id: string; confirmed: boolean; cod_order: any },
    { container }
  ) => {
    const eventBus = container.resolve(Modules.EVENT_BUS) as any

    const eventName = input.confirmed ? "cod.confirmed" : "cod.cancelled"
    await eventBus.emit({
      name: eventName,
      data: {
        order_id: input.order_id,
        cod_order_id: input.cod_order?.id,
        cod_amount: input.cod_order?.cod_amount,
      },
    })

    return new StepResponse(null)
  }
)

/**
 * ConfirmCodWorkflow — handles customer COD confirmation or rejection.
 *
 * Flow:
 *   1. Validate the COD record exists and is pending
 *   2. Update COD order status (confirmed / cancelled)
 *   3. Transition the pharmaOrder extension state machine
 *   4. Emit event for downstream processing (notifications, etc.)
 */
export const ConfirmCodWorkflow = createWorkflow(
  "confirm-cod-workflow",
  (input: ConfirmCodInput) => {
    const codOrder = validateCodOrderStep({
      order_id: input.order_id,
    }) as any

    const updatedCod = updateCodStatusStep({
      cod_order_id: codOrder.id,
      confirmed: input.confirmed,
      phone_verified: input.phone_verified ?? false,
    }) as any

    updateOrderExtensionStep({
      order_id: input.order_id,
      confirmed: input.confirmed,
    })

    emitCodEventStep({
      order_id: input.order_id,
      confirmed: input.confirmed,
      cod_order: updatedCod,
    })

    return new WorkflowResponse({
      cod_order: updatedCod,
      confirmed: input.confirmed,
    })
  }
)
