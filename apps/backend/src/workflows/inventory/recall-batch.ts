import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { INVENTORY_BATCH_MODULE } from "../../modules/inventoryBatch"
import { NOTIFICATION_MODULE } from "../../modules/notification"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type RecallBatchInput = {
  batch_id: string
  recall_reason: string
  recall_authority: string
  recalled_by_user_id: string
}

type AffectedOrder = {
  order_id: string
  order_line_item_id: string
  quantity: number
}

type RecallResult = {
  batch_id: string
  lot_number: string
  product_variant_id: string
  previous_status: string
  affected_orders: AffectedOrder[]
  recalled_at: string
}

/* ------------------------------------------------------------------ */
/*  Step 1: Validate batch exists and is not already recalled          */
/* ------------------------------------------------------------------ */

const validateBatchStep = createStep(
  "recall-validate-batch-step",
  async (input: RecallBatchInput, { container }) => {
    const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any
    const logger = container.resolve("logger") as any

    logger.info(`[recall] Validating batch ${input.batch_id}`)

    let batch: any
    try {
      batch = await batchService.retrieveBatch(input.batch_id, {
        relations: ["deductions"],
      })
    } catch {
      throw new Error(`Batch ${input.batch_id} not found`)
    }

    if (batch.status === "recalled") {
      throw new Error(
        `Batch ${batch.lot_number} is already recalled (recalled on ${batch.recalled_on})`
      )
    }

    logger.info(
      `[recall] Batch ${batch.lot_number} validated — ` +
        `current status: ${batch.status}, qty: ${batch.available_quantity}`
    )

    return new StepResponse(batch)
  }
)

/* ------------------------------------------------------------------ */
/*  Step 2: Quarantine the batch — set status to 'recalled'            */
/* ------------------------------------------------------------------ */

const quarantineBatchStep = createStep(
  "recall-quarantine-batch-step",
  async (
    input: {
      batch: any
      recall_reason: string
      recall_authority: string
      recalled_by_user_id: string
    },
    { container }
  ) => {
    const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any
    const logger = container.resolve("logger") as any

    const previousStatus = input.batch.status
    const previousAvailableQty = Number(input.batch.available_quantity)
    const recalledOn = new Date().toISOString()

    await batchService.updateBatches({
      id: input.batch.id,
      status: "recalled",
      available_quantity: 0,
      recall_reason: input.recall_reason,
      recalled_on: recalledOn,
      metadata: {
        ...(input.batch.metadata || {}),
        recall_authority: input.recall_authority,
        recalled_by: input.recalled_by_user_id,
        previous_status: previousStatus,
        previous_available_quantity: previousAvailableQty,
      },
    })

    logger.warn(
      `[recall] Batch ${input.batch.lot_number} quarantined: ` +
        `${previousStatus} → recalled (qty zeroed from ${previousAvailableQty})`
    )

    // Compensation payload to restore batch if workflow rolls back
    const compensation = {
      batch_id: input.batch.id,
      previous_status: previousStatus,
      previous_available_quantity: previousAvailableQty,
      previous_metadata: input.batch.metadata,
    }

    return new StepResponse(
      { batch_id: input.batch.id, recalled_on: recalledOn, previous_status: previousStatus },
      compensation
    )
  },
  // Rollback: restore the batch to its previous state
  async (compensation, { container }) => {
    if (!compensation) return

    const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any
    const logger = container.resolve("logger") as any

    logger.info(
      `[recall] Rolling back batch ${compensation.batch_id} to status ${compensation.previous_status}`
    )

    await batchService.updateBatches({
      id: compensation.batch_id,
      status: compensation.previous_status,
      available_quantity: compensation.previous_available_quantity,
      recall_reason: null,
      recalled_on: null,
      metadata: compensation.previous_metadata,
    })
  }
)

/* ------------------------------------------------------------------ */
/*  Step 3: Find orders that received stock from this batch            */
/* ------------------------------------------------------------------ */

const findAffectedOrdersStep = createStep(
  "recall-find-affected-orders-step",
  async (input: { batch_id: string }, { container }) => {
    const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any
    const logger = container.resolve("logger") as any

    // Fetch all deductions for this batch — each links to an order
    const deductions = await batchService.listBatchDeductions(
      { batch_id: input.batch_id },
      { take: null }
    )

    const affectedOrders: AffectedOrder[] = deductions.map((d: any) => ({
      order_id: d.order_id,
      order_line_item_id: d.order_line_item_id,
      quantity: d.quantity,
    }))

    // Deduplicate order IDs for logging
    const uniqueOrderIds = [...new Set(affectedOrders.map((o) => o.order_id))]

    logger.info(
      `[recall] Found ${affectedOrders.length} deductions across ` +
        `${uniqueOrderIds.length} unique orders for batch ${input.batch_id}`
    )

    return new StepResponse(affectedOrders)
  }
)

/* ------------------------------------------------------------------ */
/*  Step 4: Flag affected orders with recall metadata                  */
/* ------------------------------------------------------------------ */

const flagAffectedOrdersStep = createStep(
  "recall-flag-affected-orders-step",
  async (
    input: {
      affected_orders: AffectedOrder[]
      batch_id: string
      recall_reason: string
      lot_number: string
    },
    { container }
  ) => {
    const orderService = container.resolve(Modules.ORDER) as any
    const logger = container.resolve("logger") as any

    const uniqueOrderIds = [...new Set(input.affected_orders.map((o) => o.order_id))]
    const flaggedOrderIds: string[] = []

    for (const orderId of uniqueOrderIds) {
      try {
        const order = await orderService.retrieveOrder(orderId)

        // Append recall flag to the order's metadata
        const existingMeta = (order.metadata as Record<string, any>) || {}
        const existingRecalls = (existingMeta.recall_flags as any[]) || []

        existingRecalls.push({
          batch_id: input.batch_id,
          lot_number: input.lot_number,
          recall_reason: input.recall_reason,
          flagged_at: new Date().toISOString(),
        })

        await orderService.updateOrders(orderId, {
          metadata: {
            ...existingMeta,
            recall_flagged: true,
            recall_flags: existingRecalls,
          },
        })

        flaggedOrderIds.push(orderId)

        logger.warn(`[recall] Flagged order ${orderId} for batch recall ${input.batch_id}`)
      } catch (err: any) {
        // Non-fatal — continue flagging other orders
        logger.error(
          `[recall] Failed to flag order ${orderId}: ${err.message}`
        )
      }
    }

    logger.info(
      `[recall] Flagged ${flaggedOrderIds.length}/${uniqueOrderIds.length} orders`
    )

    return new StepResponse(flaggedOrderIds, flaggedOrderIds)
  },
  // Rollback: remove recall flags from orders
  async (flaggedOrderIds, { container }) => {
    if (!flaggedOrderIds?.length) return

    const orderService = container.resolve(Modules.ORDER) as any
    const logger = container.resolve("logger") as any

    for (const orderId of flaggedOrderIds) {
      try {
        const order = await orderService.retrieveOrder(orderId)
        const meta = (order.metadata as Record<string, any>) || {}

        // Remove the last recall flag entry (the one we just added)
        const flags = (meta.recall_flags as any[]) || []
        flags.pop()

        await orderService.updateOrders(orderId, {
          metadata: {
            ...meta,
            recall_flagged: flags.length > 0,
            recall_flags: flags,
          },
        })
      } catch (err: any) {
        logger.error(
          `[recall] Compensation failed removing flag from order ${orderId}: ${err.message}`
        )
      }
    }
  }
)

/* ------------------------------------------------------------------ */
/*  Step 5: Create internal admin notifications                        */
/* ------------------------------------------------------------------ */

const notifyRecallStep = createStep(
  "recall-notify-step",
  async (
    input: {
      batch_id: string
      lot_number: string
      product_variant_id: string
      recall_reason: string
      recall_authority: string
      affected_order_count: number
    },
    { container }
  ) => {
    const notificationService = container.resolve(NOTIFICATION_MODULE) as any
    const logger = container.resolve("logger") as any

    const notification = await notificationService.createInternalNotifications({
      user_id: "system",
      role_scope: "pharmacist",
      type: "batch_recall",
      title: `BATCH RECALL — ${input.lot_number}`,
      body:
        `Batch ${input.lot_number} (variant ${input.product_variant_id}) has been recalled ` +
        `by ${input.recall_authority}. Reason: ${input.recall_reason}. ` +
        `${input.affected_order_count} order(s) affected.`,
      reference_type: "batch",
      reference_id: input.batch_id,
    })

    logger.info(
      `[recall] Internal notification created: ${notification.id}`
    )

    return new StepResponse(notification.id, notification.id)
  },
  // Rollback: delete the notification
  async (notificationId, { container }) => {
    if (!notificationId) return

    const notificationService = container.resolve(NOTIFICATION_MODULE) as any
    try {
      await notificationService.deleteInternalNotifications(notificationId)
    } catch {
      // Best effort — non-critical
    }
  }
)

/* ------------------------------------------------------------------ */
/*  Step 6: Emit the batch.recalled event for other subscribers        */
/* ------------------------------------------------------------------ */

const emitRecallEventStep = createStep(
  "recall-emit-event-step",
  async (
    input: RecallResult,
    { container }
  ) => {
    const eventBus = container.resolve(Modules.EVENT_BUS) as any
    const logger = container.resolve("logger") as any

    await eventBus.emit({
      name: "batch.recalled",
      data: {
        batch_id: input.batch_id,
        lot_number: input.lot_number,
        product_variant_id: input.product_variant_id,
        affected_order_ids: [
          ...new Set(input.affected_orders.map((o) => o.order_id)),
        ],
        recalled_at: input.recalled_at,
      },
    })

    logger.info(`[recall] Emitted batch.recalled event for ${input.batch_id}`)

    return new StepResponse({ emitted: true })
  }
)

/* ------------------------------------------------------------------ */
/*  Workflow: recall-batch                                             */
/* ------------------------------------------------------------------ */

export const recallBatchWorkflow = createWorkflow(
  "recall-batch-workflow",
  (input: RecallBatchInput) => {
    // Step 1 — validate
    const batch = validateBatchStep(input)

    // Step 2 — quarantine
    const quarantineResult = quarantineBatchStep({
      batch,
      recall_reason: input.recall_reason,
      recall_authority: input.recall_authority,
      recalled_by_user_id: input.recalled_by_user_id,
    })

    // Step 3 — find affected orders
    const affectedOrders = findAffectedOrdersStep({
      batch_id: input.batch_id,
    })

    // Step 4 — flag those orders
    flagAffectedOrdersStep({
      affected_orders: affectedOrders,
      batch_id: input.batch_id,
      recall_reason: input.recall_reason,
      lot_number: batch.lot_number,
    })

    // Step 5 — notify admins
    notifyRecallStep({
      batch_id: input.batch_id,
      lot_number: batch.lot_number,
      product_variant_id: batch.product_variant_id,
      recall_reason: input.recall_reason,
      recall_authority: input.recall_authority,
      affected_order_count: affectedOrders.length,
    })

    // Step 6 — emit event for downstream subscribers
    const result: RecallResult = {
      batch_id: input.batch_id,
      lot_number: batch.lot_number,
      product_variant_id: batch.product_variant_id,
      previous_status: quarantineResult.previous_status,
      affected_orders: affectedOrders,
      recalled_at: quarantineResult.recalled_on,
    }

    emitRecallEventStep(result)

    return new WorkflowResponse(result)
  }
)

export type { RecallBatchInput, RecallResult, AffectedOrder }
