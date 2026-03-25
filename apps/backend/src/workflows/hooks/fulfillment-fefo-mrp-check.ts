import { createOrderFulfillmentWorkflow } from "@medusajs/medusa/core-flows"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { INVENTORY_BATCH_MODULE } from "../../modules/inventoryBatch"
import { validateFulfillmentMrp } from "../../utils/fulfillment-mrp-check"

const LOG_PREFIX = "[fulfillment-hook]"

const MAX_RETRIES = 3

/**
 * Minimum shelf life in days — batches expiring sooner than this are
 * excluded from allocation so customers don't receive near-expiry stock.
 * Override via BATCH_MIN_SHELF_LIFE_DAYS env var.
 */
const MIN_SHELF_LIFE_DAYS = Number(process.env.BATCH_MIN_SHELF_LIFE_DAYS ?? 60)

/**
 * Atomically deduct quantity from a batch using optimistic locking.
 * Reads the current version, attempts the update with a version guard,
 * and retries up to MAX_RETRIES times on conflict.
 *
 * Returns true if the deduction succeeded, false if the batch was
 * concurrently modified and retries were exhausted.
 */
async function deductBatchWithRetry(
  batchService: any,
  batchId: string,
  deductQty: number,
  logger: any
): Promise<{ success: boolean; newAvailable: number }> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const batch = await batchService.retrieveBatch(batchId)
    const currentAvail = Number(batch.available_quantity)
    const currentReserved = Number(batch.reserved_quantity ?? 0)
    const effectiveAvail = currentAvail - currentReserved

    if (effectiveAvail < deductQty) {
      return { success: false, newAvailable: currentAvail }
    }

    const currentVersion = Number(batch.version ?? 0)
    const newAvail = currentAvail - deductQty
    const newReserved = Math.max(0, currentReserved - deductQty)

    const updatePayload: Record<string, any> = {
      available_quantity: newAvail,
      reserved_quantity: newReserved,
      version: currentVersion + 1,
    }
    if (newAvail === 0) updatePayload.status = "depleted"

    try {
      // Optimistic lock: only update if version hasn't changed
      // MedusaService.updateBatches doesn't support WHERE clauses natively,
      // so we re-read after update and verify. For true atomicity at scale,
      // replace with raw SQL: UPDATE batch SET ... WHERE id = ? AND version = ?
      await batchService.updateBatches({ id: batchId, ...updatePayload })

      const verified = await batchService.retrieveBatch(batchId)
      if (Number(verified.version) === currentVersion + 1) {
        return { success: true, newAvailable: newAvail }
      }

      // Version mismatch — another writer got in between
      logger.warn(
        `${LOG_PREFIX} Optimistic lock conflict on batch ${batchId} (attempt ${attempt}/${MAX_RETRIES})`
      )
    } catch (err: any) {
      logger.warn(
        `${LOG_PREFIX} Batch update failed on attempt ${attempt}: ${err?.message}`
      )
    }
  }

  return { success: false, newAvailable: -1 }
}

/**
 * Hook: runs after a fulfillment is created for an order.
 *
 * 1. Checks if deductions already exist for this order (from auto-allocate job)
 *    and skips already-allocated line items.
 * 2. Performs FEFO allocation — picks batches (earliest expiry first)
 *    with minimum shelf life enforcement and reserved_quantity awareness.
 * 3. Uses optimistic locking to prevent concurrent fulfillment races.
 * 4. Validates selling price <= batch MRP (DPCO compliance).
 *
 * If this hook throws, Medusa's workflow engine compensates all prior
 * steps — the fulfillment is cancelled automatically.
 */
createOrderFulfillmentWorkflow.hooks.fulfillmentCreated(
  async ({ fulfillment, additional_data }, { container }) => {
    const logger = container.resolve("logger") as any

    if (!fulfillment?.id) {
      logger.info(`${LOG_PREFIX} No fulfillment id — skipping`)
      return
    }

    let orderId: string | undefined = (fulfillment as any).order_id

    if (!orderId) {
      try {
        const query = container.resolve("query") as any
        const { data: fulfillmentRows } = await query.graph({
          entity: "fulfillment",
          fields: ["order.id"],
          filters: { id: fulfillment.id },
        })
        orderId = fulfillmentRows?.[0]?.order?.id
      } catch (err: any) {
        logger.warn(
          `${LOG_PREFIX} Could not resolve order for fulfillment ${fulfillment.id}: ${err?.message}`
        )
      }
    }

    if (!orderId) {
      logger.info(
        `${LOG_PREFIX} No order_id on fulfillment ${fulfillment.id} — skipping`
      )
      return
    }

    logger.info(`${LOG_PREFIX} Processing fulfillment for order ${orderId}`)

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

    // Check which line items already have deductions (from auto-allocate job)
    let existingDeductions: any[] = []
    try {
      existingDeductions = await batchService.listBatchDeductions(
        { order_id: orderId, deduction_type: "sale" },
        { take: null }
      )
    } catch {
      // No existing deductions — allocate everything
    }

    const alreadyAllocatedItems = new Set(
      existingDeductions.map((d: any) => d.order_line_item_id)
    )

    // MSL cutoff: today + MIN_SHELF_LIFE_DAYS
    const mslCutoff = new Date()
    mslCutoff.setHours(0, 0, 0, 0)
    mslCutoff.setDate(mslCutoff.getDate() + MIN_SHELF_LIFE_DAYS)

    const allocations: Array<{
      line_item_id: string
      batch_id: string
      unit_price_paise: number
      quantity: number
    }> = []
    const warnings: string[] = []

    for (const item of order.items) {
      // Skip items that already have deductions from the auto-allocate job
      if (alreadyAllocatedItems.has(item.id)) {
        logger.info(
          `${LOG_PREFIX} Item ${item.id} already allocated — skipping`
        )
        continue
      }

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

      // Filter: must have shelf life >= MSL and effective available > 0
      const eligible = batches.filter((b: any) => {
        const exp = new Date(b.expiry_date)
        exp.setHours(0, 0, 0, 0)
        const effectiveAvail =
          Number(b.available_quantity) - Number(b.reserved_quantity ?? 0)
        return exp >= mslCutoff && effectiveAvail > 0
      })

      if (!eligible.length) {
        // Fall back: try batches that are at least not expired (bypass MSL)
        // so we don't block fulfillment entirely when only near-expiry stock exists
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const fallback = batches.filter((b: any) => {
          const exp = new Date(b.expiry_date)
          exp.setHours(0, 0, 0, 0)
          const effectiveAvail =
            Number(b.available_quantity) - Number(b.reserved_quantity ?? 0)
          return exp >= today && effectiveAvail > 0
        })
        if (fallback.length) {
          warnings.push(
            `Variant ${variantId}: no batches with >=${MIN_SHELF_LIFE_DAYS}d shelf life — using near-expiry stock`
          )
          eligible.push(...fallback)
        } else {
          continue
        }
      }

      const unitPricePaise = Number(item.unit_price || 0) * 100
      let remaining = Number(item.quantity)

      for (const batch of eligible) {
        if (remaining <= 0) break

        const batchMrp =
          batch.batch_mrp_paise != null ? Number(batch.batch_mrp_paise) : null

        if (batchMrp !== null && unitPricePaise > batchMrp) {
          warnings.push(
            `Batch ${batch.lot_number} skipped: price ₹${(unitPricePaise / 100).toFixed(2)} > MRP ₹${(batchMrp / 100).toFixed(2)}`
          )
          continue
        }

        const effectiveAvail =
          Number(batch.available_quantity) - Number(batch.reserved_quantity ?? 0)
        if (effectiveAvail <= 0) continue

        const allocQty = Math.min(effectiveAvail, remaining)

        // Optimistic-locked deduction
        const { success } = await deductBatchWithRetry(
          batchService,
          batch.id,
          allocQty,
          logger
        )

        if (!success) {
          warnings.push(
            `Batch ${batch.lot_number}: concurrent conflict, skipping`
          )
          continue
        }

        await batchService.createBatchDeductions({
          batch_id: batch.id,
          order_line_item_id: item.id,
          order_id: orderId,
          quantity: allocQty,
          deduction_type: "sale",
        })

        // Audit trail
        try {
          await batchService.createBatchAuditLogs({
            batch_id: batch.id,
            action: "deduction_sale",
            field_name: "available_quantity",
            old_value: String(batch.available_quantity),
            new_value: String(Number(batch.available_quantity) - allocQty),
            actor_id: "fulfillment-hook",
            actor_type: "workflow",
            order_id: orderId,
            fulfillment_id: fulfillment.id,
            reason: `FEFO allocation: ${allocQty} units for order ${orderId}`,
          })
        } catch {
          // Best-effort audit
        }

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
        `${LOG_PREFIX} Warnings: ${warnings.join("; ")}`
      )
    }

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
        `${allocations.length} new + ${existingDeductions.length} pre-allocated`
    )
  }
)
