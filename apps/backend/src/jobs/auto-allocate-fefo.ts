import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { jobGuard } from "../lib/job-guard"
import { INVENTORY_BATCH_MODULE } from "../modules/inventoryBatch"
import { ORDERS_MODULE } from "../modules/orders"

const LOG = "[job:auto-allocate-fefo]"

const MIN_SHELF_LIFE_DAYS = Number(process.env.BATCH_MIN_SHELF_LIFE_DAYS ?? 60)
const LOW_STOCK_THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD ?? 50)

/**
 * Runs every 5 minutes — pre-allocates inventory to paid orders using FEFO
 * (First Expiry First Out) before fulfillment is triggered.
 *
 * Creates BatchDeduction records (type "sale") so the fulfillment hook
 * can skip already-allocated line items. This is the primary allocator;
 * the fulfillment hook acts as a safety net for anything missed.
 *
 * Uses optimistic locking via the batch version column to prevent
 * concurrent allocation races.
 */
export default async function AutoAllocateFefoJob(container: MedusaContainer) {
  const guard = jobGuard("auto-allocate-fefo")
  if (guard.shouldSkip()) return

  const logger = container.resolve("logger") as any
  logger.info(`${LOG} Starting`)

  try {
    const pharmaOrderService = container.resolve(ORDERS_MODULE) as any
    const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any
    const orderService = container.resolve(Modules.ORDER) as any

    const pendingOrders = await pharmaOrderService.listOrderExtensions(
      { status: "payment_captured" },
      { take: 50 }
    )

    if (!pendingOrders?.length) {
      logger.info(`${LOG} No orders pending allocation`)
      return
    }

    const mslCutoff = new Date()
    mslCutoff.setHours(0, 0, 0, 0)
    mslCutoff.setDate(mslCutoff.getDate() + MIN_SHELF_LIFE_DAYS)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // --- Batch-fetch all data upfront to avoid N+1 queries ---
    const orderIds = pendingOrders.map((ext: any) => ext.order_id)

    // 1. Batch-fetch all orders at once
    const allOrders = await orderService.listOrders(
      { id: orderIds },
      { relations: ["items", "items.variant"] }
    )
    const orderMap = new Map<string, any>()
    for (const o of allOrders) {
      orderMap.set(o.id, o)
    }

    // 2. Batch-fetch all existing deductions for all orders
    let allDeductions: any[] = []
    try {
      allDeductions = await batchService.listBatchDeductions(
        { order_id: orderIds, deduction_type: "sale" },
        { take: null }
      )
    } catch {
      // None
    }
    const deductionsByOrderId = new Map<string, any[]>()
    for (const d of allDeductions) {
      const arr = deductionsByOrderId.get(d.order_id) || []
      arr.push(d)
      deductionsByOrderId.set(d.order_id, arr)
    }

    // 3. Collect all variant_ids across all orders
    const allVariantIds = new Set<string>()
    for (const o of allOrders) {
      if (!o?.items?.length) continue
      for (const item of o.items) {
        if (item.variant_id) allVariantIds.add(item.variant_id)
      }
    }

    // 4. Batch-fetch all active batches for all variants
    let allBatches: any[] = []
    if (allVariantIds.size > 0) {
      allBatches = await batchService.listBatches(
        { product_variant_id: [...allVariantIds], status: "active" },
        { take: null, order: { expiry_date: "ASC" } }
      )
    }
    const batchesByVariantId = new Map<string, any[]>()
    for (const b of allBatches) {
      const arr = batchesByVariantId.get(b.product_variant_id) || []
      arr.push(b)
      batchesByVariantId.set(b.product_variant_id, arr)
    }

    // Running stock totals — tracks in-memory available_quantity changes
    // as allocations happen, so we can check low_stock without re-querying
    const runningStockByBatchId = new Map<string, number>()
    for (const b of allBatches) {
      runningStockByBatchId.set(b.id, Number(b.available_quantity))
    }

    let allocated = 0
    let failed = 0

    for (const ext of pendingOrders) {
      try {
        const order = orderMap.get(ext.order_id)
        if (!order?.items?.length) continue

        // Use pre-fetched deductions for this order
        const existingDeductions = deductionsByOrderId.get(ext.order_id) || []
        const alreadyAllocatedItems = new Set(
          existingDeductions.map((d: any) => d.order_line_item_id)
        )

        let allItemsAllocated = true

        for (const item of order.items) {
          if (alreadyAllocatedItems.has(item.id)) continue

          const variantId = item.variant_id
          if (!variantId) continue

          // Use pre-fetched batches for this variant
          const batches = batchesByVariantId.get(variantId) || []

          // Prefer MSL-compliant batches, fall back to any non-expired
          let eligible = (batches as any[]).filter((b: any) => {
            const exp = new Date(b.expiry_date)
            exp.setHours(0, 0, 0, 0)
            const currentAvail = runningStockByBatchId.get(b.id) ?? Number(b.available_quantity)
            const effectiveAvail =
              currentAvail - Number(b.reserved_quantity ?? 0)
            return exp >= mslCutoff && effectiveAvail > 0
          })

          if (!eligible.length) {
            eligible = (batches as any[]).filter((b: any) => {
              const exp = new Date(b.expiry_date)
              exp.setHours(0, 0, 0, 0)
              const currentAvail = runningStockByBatchId.get(b.id) ?? Number(b.available_quantity)
              const effectiveAvail =
                currentAvail - Number(b.reserved_quantity ?? 0)
              return exp >= today && effectiveAvail > 0
            })
          }

          let remaining = Number(item.quantity)

          for (const batch of eligible) {
            if (remaining <= 0) break

            const currentAvail = runningStockByBatchId.get(batch.id) ?? Number(batch.available_quantity)
            const effectiveAvail =
              currentAvail - Number(batch.reserved_quantity ?? 0)
            if (effectiveAvail <= 0) continue

            const allocQty = Math.min(remaining, effectiveAvail)
            const currentVersion = Number(batch.version ?? 0)
            const newAvail = currentAvail - allocQty

            const updatePayload: Record<string, any> = {
              id: batch.id,
              available_quantity: newAvail,
              version: currentVersion + 1,
            }
            if (newAvail === 0) updatePayload.status = "depleted"

            try {
              await batchService.updateBatches(updatePayload)

              // Verify version to detect concurrent writes
              const verified = await batchService.retrieveBatch(batch.id)
              if (Number(verified.version) !== currentVersion + 1) {
                logger.warn(
                  `${LOG} Version conflict on batch ${batch.id} — skipping`
                )
                continue
              }
            } catch (err: any) {
              logger.warn(`${LOG} Batch update failed: ${err?.message}`)
              continue
            }

            // Update in-memory running stock total
            runningStockByBatchId.set(batch.id, newAvail)

            // Create proper deduction record for traceability
            await batchService.createBatchDeductions({
              batch_id: batch.id,
              order_line_item_id: item.id,
              order_id: ext.order_id,
              quantity: allocQty,
              deduction_type: "sale",
            })

            // Audit trail
            try {
              await batchService.createBatchAuditLogs({
                batch_id: batch.id,
                action: "deduction_sale",
                field_name: "available_quantity",
                old_value: String(currentAvail),
                new_value: String(newAvail),
                actor_id: "auto-allocate-fefo",
                actor_type: "job",
                order_id: ext.order_id,
                reason: `Auto FEFO allocation: ${allocQty} units`,
              })
            } catch {
              // Best-effort audit
            }

            remaining -= allocQty
          }

          if (remaining > 0) {
            allItemsAllocated = false
            logger.warn(
              `${LOG} Insufficient stock for variant ${variantId} in order ${ext.order_id} ` +
                `(need ${remaining} more)`
            )
          }

          // Emit low_stock event using in-memory running totals (no extra DB query)
          try {
            const variantBatches = batchesByVariantId.get(variantId) || []
            const totalStock = variantBatches.reduce(
              (sum: number, b: any) => sum + (runningStockByBatchId.get(b.id) ?? Number(b.available_quantity)), 0
            )
            if (totalStock < LOW_STOCK_THRESHOLD) {
              const eventBus = container.resolve(Modules.EVENT_BUS) as any
              await eventBus.emit({
                name: "inventory.low_stock",
                data: {
                  product_variant_id: variantId,
                  product_id: item.variant?.product_id ?? null,
                },
              })
            }
          } catch {
            // Best-effort — don't block allocation
          }
        }

        if (allItemsAllocated) {
          await pharmaOrderService.updateOrderExtensions({
            id: ext.id,
            status: "ready_for_dispatch",
          })
          await pharmaOrderService.createOrderStateHistorys({
            order_id: ext.order_id,
            from_status: "payment_captured",
            to_status: "ready_for_dispatch",
            changed_by: "system:auto-allocate-fefo",
            reason: "FEFO allocation complete",
          })
          allocated++
        }
      } catch (err) {
        failed++
        logger.error(`${LOG} Order ${ext.order_id}: ${(err as Error).message}`)
      }
    }

    logger.info(
      `${LOG} Done — allocated: ${allocated}, failed: ${failed}, total: ${pendingOrders.length}`
    )
    guard.success()
  } catch (err) {
    guard.failure(err)
    logger.error(`${LOG} Failed: ${(err as Error).message}`)
  }
}

export const config = {
  name: "auto-allocate-fefo",
  schedule: "1-59/5 * * * *", // was: */5 * * * * — staggered to avoid pool exhaustion
}
