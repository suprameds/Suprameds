import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { PAYMENT_MODULE } from "../../modules/payment"
import { INVENTORY_BATCH_MODULE } from "../../modules/inventoryBatch"
import { NOTIFICATION_MODULE } from "../../modules/notification"
import { PHARMA_MODULE } from "../../modules/pharma"
import { LOYALTY_MODULE } from "../../modules/loyalty"

// ─── Types ─────────────────────────────────────────────────────────

type ItemCondition = "sealed" | "damaged" | "wrong_item" | "expired"

type ReturnLineItem = {
  line_item_id: string
  quantity_returned: number
  condition: ItemCondition
  accepted: boolean
}

type InspectReturnInput = {
  return_id: string
  order_id: string
  inspector_id: string
  inspection_result: "approved" | "rejected" | "partial"
  items: ReturnLineItem[]
}

type InspectedItem = ReturnLineItem & {
  product_id: string | null
  variant_id: string | null
  schedule: string | null
  unit_price: number
  acceptance_reason: string
}

// ─── Step 1: Validate return request exists ────────────────────────

export const validateReturnStep = createStep(
  "validate-return-step",
  async (input: { return_id: string; order_id: string }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any

    // Verify the return exists in Medusa core
    const { data: returns } = await query.graph({
      entity: "return",
      fields: ["id", "status", "order_id"],
      filters: { id: input.return_id },
    }) as any

    const returnReq = (returns as any[])?.[0]

    if (!returnReq) {
      throw new Error(`Return request ${input.return_id} not found`)
    }

    if (returnReq.order_id !== input.order_id) {
      throw new Error(
        `Return ${input.return_id} does not belong to order ${input.order_id}`
      )
    }

    logger.info(
      `[inspect-return] Validated return ${input.return_id} for order ${input.order_id}, status: ${returnReq.status}`
    )

    return new StepResponse({ returnRequest: returnReq })
  }
)

// ─── Step 2: Inspect items against pharma return rules ─────────────

export const inspectItemsStep = createStep(
  "inspect-items-step",
  async (
    input: { order_id: string; items: ReturnLineItem[] },
    { container }
  ) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
    const pharmaService = container.resolve(PHARMA_MODULE) as any
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any

    // Fetch order line items to get product/variant info and prices
    const { data: orderData } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "items.id",
        "items.product_id",
        "items.variant_id",
        "items.unit_price",
        "items.quantity",
      ],
      filters: { id: input.order_id },
    }) as any

    const order = (orderData as any[])?.[0]
    if (!order) throw new Error(`Order ${input.order_id} not found`)

    const lineItemMap = new Map<string, any>()
    for (const item of order.items ?? []) {
      lineItemMap.set(item.id, item)
    }

    // Look up drug schedule for each product
    const productIds = [
      ...new Set(
        (order.items ?? [])
          .map((i: any) => i.product_id)
          .filter(Boolean)
      ),
    ]

    const drugMap = new Map<string, any>()
    if (productIds.length) {
      const drugs = await pharmaService.listDrugProducts(
        { product_id: productIds },
        {}
      )
      for (const drug of drugs) {
        drugMap.set(drug.product_id, drug)
      }
    }

    // Apply pharma return acceptance rules per item
    const inspectedItems: InspectedItem[] = []
    let acceptedCount = 0
    let rejectedCount = 0

    for (const item of input.items) {
      const lineItem = lineItemMap.get(item.line_item_id)
      if (!lineItem) {
        throw new Error(`Line item ${item.line_item_id} not found in order`)
      }

      const drug = drugMap.get(lineItem.product_id)
      const schedule = drug?.schedule ?? "OTC"

      // Determine acceptance based on pharma rules:
      //   - Damaged goods: always accept (our fault / transit damage)
      //   - Wrong item dispatched: always accept
      //   - Expired product: always accept (should never have been dispatched)
      //   - Sealed/unopened Rx (H/H1): accept (can be restocked)
      //   - Opened Rx: REJECT (dispensed medicines cannot be returned per CDSCO rules)
      //   - OTC sealed or within return window: accept
      let accepted = false
      let reason = ""

      switch (item.condition) {
        case "damaged":
          accepted = true
          reason = "Transit damage — accepted regardless of drug schedule"
          break

        case "wrong_item":
          accepted = true
          reason = "Wrong item dispatched — accepted for replacement/refund"
          break

        case "expired":
          accepted = true
          reason = "Expired product dispatched — quality failure, accepted"
          break

        case "sealed":
          if (schedule === "H" || schedule === "H1") {
            // Rx drugs: only accept if genuinely sealed (inspector confirms)
            accepted = true
            reason = `Schedule ${schedule} drug returned sealed — accepted for restock`
          } else {
            // OTC: accept sealed returns within policy
            accepted = true
            reason = "OTC drug returned sealed — accepted"
          }
          break

        default:
          accepted = false
          reason = `Unknown condition "${item.condition}" — rejected`
      }

      // Inspector can override to reject even if rules say accept
      if (!item.accepted) {
        accepted = false
        reason = "Inspector manually rejected this item"
      }

      if (accepted) acceptedCount++
      else rejectedCount++

      inspectedItems.push({
        ...item,
        accepted,
        product_id: lineItem.product_id,
        variant_id: lineItem.variant_id,
        schedule,
        unit_price: Number(lineItem.unit_price) || 0,
        acceptance_reason: reason,
      })
    }

    logger.info(
      `[inspect-return] Inspection complete: ${acceptedCount} accepted, ${rejectedCount} rejected`
    )

    return new StepResponse({ inspectedItems, acceptedCount, rejectedCount })
  }
)

// ─── Step 3: Create refund record for accepted items ───────────────

export const processRefundStep = createStep(
  "process-refund-step",
  async (
    input: {
      order_id: string
      inspector_id: string
      inspectedItems: InspectedItem[]
    },
    { container }
  ) => {
    const paymentService = container.resolve(PAYMENT_MODULE) as any
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any

    const acceptedItems = input.inspectedItems.filter((i) => i.accepted)
    if (acceptedItems.length === 0) {
      logger.info("[inspect-return] No accepted items — skipping refund")
      return new StepResponse({ refund: null, refundAmount: 0 })
    }

    // Calculate refund amount: sum of (unit_price × quantity_returned) for accepted items
    const refundAmount = acceptedItems.reduce(
      (sum, item) => sum + item.unit_price * item.quantity_returned,
      0
    )

    const refund = await paymentService.createRefunds({
      payment_id: "return_refund",
      order_id: input.order_id,
      raised_by: input.inspector_id,
      reason: "return",
      amount: refundAmount,
      status: "pending_approval",
      metadata: {
        return_items: acceptedItems.map((i) => ({
          line_item_id: i.line_item_id,
          quantity: i.quantity_returned,
          condition: i.condition,
          reason: i.acceptance_reason,
        })),
      },
    })

    logger.info(
      `[inspect-return] Refund created: ${refund.id}, amount: ₹${refundAmount}`
    )

    return new StepResponse(
      { refund, refundAmount },
      refund.id
    )
  },
  // Compensation: delete the refund if the workflow rolls back
  async (refundId, { container }) => {
    if (!refundId) return
    const paymentService = container.resolve(PAYMENT_MODULE) as any
    try {
      await paymentService.deleteRefunds(refundId)
    } catch {
      // Best-effort compensation
    }
  }
)

// ─── Step 4: Restock sealed items back into inventory batches ──────

export const restockStep = createStep(
  "restock-step",
  async (input: { inspectedItems: InspectedItem[]; order_id: string }, { container }) => {
    const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any

    // Only restock items that are sealed (intact packaging, can go back on shelf)
    const restockable = input.inspectedItems.filter(
      (i) => i.accepted && i.condition === "sealed"
    )

    if (restockable.length === 0) {
      logger.info("[inspect-return] No sealed items to restock")
      return new StepResponse({ restockedCount: 0, restockedItems: [] })
    }

    const restockedItems: Array<{ batch_id: string; quantity: number }> = []

    for (const item of restockable) {
      // Find the original batch deduction for this order line item
      const deductions = await batchService.listBatchDeductions(
        {
          order_id: input.order_id,
          order_line_item_id: item.line_item_id,
          deduction_type: "sale",
        },
        { relations: ["batch"], order: { created_at: "DESC" } }
      )

      let remainingQty = item.quantity_returned

      for (const deduction of deductions) {
        if (remainingQty <= 0) break

        const batch = deduction.batch
        if (!batch || batch.status !== "active") continue

        const qtyToRestore = Math.min(remainingQty, deduction.quantity)

        // Increase available_quantity on the batch
        await batchService.updateBatches({ id: batch.id,
          available_quantity: Number(batch.available_quantity) + qtyToRestore,
        })

        // Create a return deduction (negative) for audit trail
        await batchService.createBatchDeductions({
          batch: batch.id,
          order_line_item_id: item.line_item_id,
          order_id: input.order_id,
          quantity: -qtyToRestore,
          deduction_type: "return",
        })

        restockedItems.push({ batch_id: batch.id, quantity: qtyToRestore })
        remainingQty -= qtyToRestore
      }

      if (remainingQty > 0) {
        logger.warn(
          `[inspect-return] Could not fully restock item ${item.line_item_id}: ` +
            `${remainingQty} units unmatched to original batches`
        )
      }
    }

    logger.info(
      `[inspect-return] Restocked ${restockedItems.length} batch entries`
    )

    return new StepResponse({
      restockedCount: restockedItems.length,
      restockedItems,
    })
  }
)

// ─── Step 5: Reverse loyalty points for returned OTC items ──────────

export const reverseLoyaltyPointsStep = createStep(
  "reverse-loyalty-points-step",
  async (
    input: {
      order_id: string
      inspectedItems: InspectedItem[]
      refundAmount: number
    },
    { container }
  ) => {
    const loyaltyService = container.resolve(LOYALTY_MODULE) as any
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any

    // Only reverse points for accepted OTC items (Rx never earned points)
    const otcRefundAmount = input.inspectedItems
      .filter((i) => i.accepted && i.schedule !== "H" && i.schedule !== "H1" && i.schedule !== "X")
      .reduce((sum, i) => sum + i.unit_price * i.quantity_returned, 0)

    if (otcRefundAmount <= 0) {
      logger.info("[inspect-return] No OTC refund amount — no loyalty points to reverse")
      return new StepResponse({ reversed: 0 })
    }

    // Points earned at 1 point per rupee
    const pointsToReverse = Math.floor(otcRefundAmount)
    if (pointsToReverse <= 0) {
      return new StepResponse({ reversed: 0 })
    }

    // Find earn transactions for this order
    try {
      const earnTxns = await loyaltyService.listLoyaltyTransactions(
        { reference_type: "order", reference_id: input.order_id, type: "earn" },
        { take: 1 }
      )

      if (!earnTxns?.length) {
        logger.info("[inspect-return] No loyalty earn txns found for order — skipping")
        return new StepResponse({ reversed: 0 })
      }

      const accountId = earnTxns[0].account_id
      const [account] = await loyaltyService.listLoyaltyAccounts(
        { id: accountId },
        { take: 1 }
      )
      if (!account) {
        return new StepResponse({ reversed: 0 })
      }

      // Don't reverse more than the customer's current balance
      const actualReverse = Math.min(pointsToReverse, account.points_balance)
      if (actualReverse <= 0) {
        return new StepResponse({ reversed: 0 })
      }

      await loyaltyService.createLoyaltyTransactions({
        account_id: account.id,
        type: "burn",
        points: -actualReverse,
        reference_type: "order",
        reference_id: input.order_id,
        reason: `Return: ${actualReverse} points reversed for returned OTC items`,
      })

      await loyaltyService.updateLoyaltyAccounts({
        id: account.id,
        points_balance: account.points_balance - actualReverse,
      })

      logger.info(
        `[inspect-return] Reversed ${actualReverse} loyalty points for order ${input.order_id}`
      )

      return new StepResponse({ reversed: actualReverse })
    } catch (err: any) {
      // Non-fatal — don't block the return over loyalty points
      logger.warn(`[inspect-return] Loyalty reversal failed: ${err.message}`)
      return new StepResponse({ reversed: 0 })
    }
  }
)

// ─── Step 6: Notify customer about return outcome ──────────────────

export const notifyCustomerStep = createStep(
  "notify-customer-step",
  async (
    input: {
      order_id: string
      acceptedCount: number
      rejectedCount: number
      refundAmount: number
    },
    { container }
  ) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any

    // Resolve customer_id from the order
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "customer_id", "email", "display_id"],
      filters: { id: input.order_id },
    }) as any

    const order = (orders as any[])?.[0]
    if (!order?.customer_id) {
      logger.warn("[inspect-return] No customer_id on order — skipping push notification")
      return new StepResponse({ notified: false })
    }

    // Emit event for downstream notification handler (push, SMS, email)
    const eventBus = container.resolve(Modules.EVENT_BUS) as any
    await eventBus.emit({
      name: "return.inspection_completed",
      data: {
        order_id: input.order_id,
        customer_id: order.customer_id,
        email: order.email,
        display_id: order.display_id,
        accepted_count: input.acceptedCount,
        rejected_count: input.rejectedCount,
        refund_amount: input.refundAmount,
      },
    })

    logger.info(
      `[inspect-return] Emitted return.inspection_completed for customer ${order.customer_id}`
    )

    return new StepResponse({ notified: true, customer_id: order.customer_id })
  }
)

// ─── Step 6: Emit return event for audit/analytics ─────────────────

export const emitReturnEventStep = createStep(
  "emit-return-event-step",
  async (
    input: {
      return_id: string
      order_id: string
      inspector_id: string
      inspection_result: string
      inspectedItems: InspectedItem[]
      refund_id: string | null
      refund_amount: number
    },
    { container }
  ) => {
    const eventBus = container.resolve(Modules.EVENT_BUS) as any

    await eventBus.emit({
      name: "return.inspected",
      data: {
        return_id: input.return_id,
        order_id: input.order_id,
        inspector_id: input.inspector_id,
        inspection_result: input.inspection_result,
        refund_id: input.refund_id,
        refund_amount: input.refund_amount,
        items: input.inspectedItems.map((i) => ({
          line_item_id: i.line_item_id,
          condition: i.condition,
          accepted: i.accepted,
          reason: i.acceptance_reason,
        })),
        inspected_at: new Date().toISOString(),
      },
    })

    return new StepResponse({ emitted: true })
  }
)

// ─── Workflow ──────────────────────────────────────────────────────

/**
 * InspectReturnWorkflow — warehouse inspector processes a physical return.
 *
 * Indian pharma rules:
 *   - Dispensed Rx medicines (opened) cannot be returned
 *   - Sealed, wrong item, damaged, or expired items can be returned
 *   - Sealed items are restocked into original batches (FEFO audit trail)
 *   - Refund record requires finance approval (SSD — inspector ≠ approver)
 */
export const InspectReturnWorkflow = createWorkflow(
  "inspect-return-workflow",
  (input: InspectReturnInput) => {
    // Step 1: Verify the return request exists and belongs to the order
    validateReturnStep({
      return_id: input.return_id,
      order_id: input.order_id,
    })

    // Step 2: Apply pharma return acceptance rules to each item
    const inspection = inspectItemsStep({
      order_id: input.order_id,
      items: input.items,
    }) as any

    // Step 3: Create a refund record for accepted items (pending finance approval)
    const refundResult = processRefundStep({
      order_id: input.order_id,
      inspector_id: input.inspector_id,
      inspectedItems: inspection.inspectedItems,
    }) as any

    // Step 4: Restock sealed items back into inventory batches
    restockStep({
      inspectedItems: inspection.inspectedItems,
      order_id: input.order_id,
    })

    // Step 5: Reverse loyalty points for returned OTC items
    reverseLoyaltyPointsStep({
      order_id: input.order_id,
      inspectedItems: inspection.inspectedItems,
      refundAmount: refundResult.refundAmount,
    })

    // Step 6: Notify the customer about the return outcome
    notifyCustomerStep({
      order_id: input.order_id,
      acceptedCount: inspection.acceptedCount,
      rejectedCount: inspection.rejectedCount,
      refundAmount: refundResult.refundAmount,
    })

    // Step 7: Emit audit event for analytics/compliance
    emitReturnEventStep({
      return_id: input.return_id,
      order_id: input.order_id,
      inspector_id: input.inspector_id,
      inspection_result: input.inspection_result,
      inspectedItems: inspection.inspectedItems,
      refund_id: refundResult.refund?.id ?? null,
      refund_amount: refundResult.refundAmount,
    })

    return new WorkflowResponse({
      return_id: input.return_id,
      inspection_result: input.inspection_result,
      accepted_count: inspection.acceptedCount,
      rejected_count: inspection.rejectedCount,
      refund_id: refundResult.refund?.id ?? null,
      refund_amount: refundResult.refundAmount,
      items: inspection.inspectedItems,
    })
  }
)
