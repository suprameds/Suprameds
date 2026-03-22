import { createOrderFulfillmentWorkflow } from "@medusajs/medusa/core-flows"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { INVENTORY_BATCH_MODULE } from "../../modules/inventoryBatch"
import { PHARMA_MODULE } from "../../modules/pharma"
import { validateFulfillmentMrp } from "../../utils/fulfillment-mrp-check"

const LOG_PREFIX = "[fulfillment-hook]"

/**
 * Hook: runs after a fulfillment is created for an order.
 *
 * 1. Performs FEFO allocation — picks batches (earliest expiry first)
 *    and creates BatchDeduction records for traceability.
 * 2. Validates that the selling price ≤ batch MRP for every allocated
 *    batch (DPCO compliance). If violated, throws to roll back the
 *    fulfillment.
 *
 * If this hook throws, Medusa's workflow engine compensates all prior
 * steps — the fulfillment is cancelled automatically.
 */
createOrderFulfillmentWorkflow.hooks.fulfillmentCreated(
  async ({ fulfillment, additional_data }, { container }) => {
    const logger = container.resolve("logger") as any

    if (!fulfillment?.order_id) {
      logger.info(`${LOG_PREFIX} No order_id on fulfillment — skipping`)
      return
    }

    const orderId = fulfillment.order_id
    logger.info(`${LOG_PREFIX} Processing fulfillment for order ${orderId}`)

    // Retrieve full order with items and pricing
    let order: any
    try {
      const orderService = container.resolve(Modules.ORDER) as any
      order = await orderService.retrieveOrder(orderId, {
        relations: ["items", "items.variant"],
      })
    } catch (err: any) {
      logger.warn(
        `${LOG_PREFIX} Could not retrieve order ${orderId}: ${err?.message} — skipping FEFO`
      )
      return
    }

    if (!order?.items?.length) {
      logger.info(`${LOG_PREFIX} Order ${orderId} has no items — skipping`)
      return
    }

    const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any
    const pharmaService = container.resolve(PHARMA_MODULE) as any

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const allocations: Array<{
      line_item_id: string
      batch_id: string
      unit_price_paise: number
      quantity: number
    }> = []
    const warnings: string[] = []

    // FEFO allocation per line item
    for (const item of order.items) {
      const variantId = item.variant_id || item.variant?.id
      if (!variantId) continue

      let batches: any[]
      try {
        batches = await batchService.listBatches(
          { product_variant_id: variantId, status: "active" },
          { order: { expiry_date: "ASC" }, take: null }
        )
      } catch {
        logger.warn(
          `${LOG_PREFIX} Could not list batches for variant ${variantId}`
        )
        continue
      }

      if (!batches?.length) continue

      // Filter out expired and zero-qty batches
      const eligible = batches.filter((b: any) => {
        const exp = new Date(b.expiry_date)
        exp.setHours(0, 0, 0, 0)
        return exp >= today && Number(b.available_quantity) > 0
      })

      if (!eligible.length) continue

      // Unit price in paise (Medusa stores in whole units)
      const unitPricePaise = Number(item.unit_price || 0) * 100
      let remaining = Number(item.quantity)

      for (const batch of eligible) {
        if (remaining <= 0) break

        const availQty = Number(batch.available_quantity)
        const batchMrp =
          batch.batch_mrp_paise != null ? Number(batch.batch_mrp_paise) : null

        // MRP ceiling check — skip batch if selling above MRP
        if (batchMrp !== null && unitPricePaise > batchMrp) {
          warnings.push(
            `Batch ${batch.lot_number} skipped: price ₹${(unitPricePaise / 100).toFixed(2)} > MRP ₹${(batchMrp / 100).toFixed(2)}`
          )
          continue
        }

        const allocQty = Math.min(availQty, remaining)
        const newAvail = availQty - allocQty

        // Create deduction record for traceability
        await batchService.createBatchDeductions({
          batch_id: batch.id,
          order_line_item_id: item.id,
          order_id: orderId,
          quantity: allocQty,
          deduction_type: "sale",
        })

        // Decrement batch stock
        const updatePayload: Record<string, any> = {
          id: batch.id,
          available_quantity: newAvail,
        }
        if (newAvail === 0) updatePayload.status = "depleted"
        await batchService.updateBatches(updatePayload)

        allocations.push({
          line_item_id: item.id,
          batch_id: batch.id,
          unit_price_paise: unitPricePaise,
          quantity: allocQty,
        })

        remaining -= allocQty
        logger.info(
          `${LOG_PREFIX} Allocated ${allocQty} × ${batch.lot_number} ` +
            `(exp ${new Date(batch.expiry_date).toISOString().slice(0, 10)}) ` +
            `for order ${orderId}`
        )
      }

      if (remaining > 0) {
        logger.warn(
          `${LOG_PREFIX} Insufficient stock for variant ${variantId}: ` +
            `need ${item.quantity}, short by ${remaining}`
        )
      }
    }

    if (warnings.length) {
      logger.warn(
        `${LOG_PREFIX} ${warnings.length} batch(es) skipped due to MRP ceiling`
      )
    }

    // Final MRP validation on all allocated batches
    if (allocations.length > 0) {
      const mrpResult = await validateFulfillmentMrp(container, allocations)

      if (!mrpResult.valid) {
        const violationSummary = mrpResult.violations
          .map((v) => v.message)
          .join("; ")
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Fulfillment blocked — MRP violation(s): ${violationSummary}`
        )
      }
    }

    logger.info(
      `${LOG_PREFIX} FEFO allocation complete for order ${orderId}: ` +
        `${allocations.length} batch allocation(s)`
    )
  }
)
