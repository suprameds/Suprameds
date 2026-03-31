import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { INVENTORY_BATCH_MODULE } from "../../../../../modules/inventoryBatch"
import { createLogger } from "../../../../../lib/logger"

const logger = createLogger("admin:warehouse:inventory:sync")

/**
 * POST /admin/warehouse/inventory/sync
 * Manually triggers a full inventory sync from batch system → Medusa inventory levels.
 *
 * Same logic as the `sync-inventory` scheduled job, but callable on-demand.
 * Useful for:
 *   - Development (no Redis = no cron jobs)
 *   - Immediate reconciliation after bulk imports
 *   - Debugging inventory mismatches
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any
    const inventoryService = req.scope.resolve(Modules.INVENTORY) as any
    const productService = req.scope.resolve(Modules.PRODUCT) as any

    // 1. Get all active batches
    const allBatches = await batchService.listBatches(
      { status: "active" },
      { take: null }
    )

    if (!allBatches?.length) {
      return res.json({ synced: 0, skipped: 0, message: "No active batches found" })
    }

    // 2. Resolve variant_id → sku
    const variantIds = [...new Set(
      allBatches.map((b: any) => b.product_variant_id).filter(Boolean)
    )] as string[]

    const variantSkuMap = new Map<string, string>()
    if (variantIds.length > 0) {
      const variants = await productService.listProductVariants(
        { id: variantIds },
        { select: ["id", "sku"], take: null }
      )
      for (const v of variants) {
        if (v.sku) variantSkuMap.set(v.id, v.sku)
      }
    }

    // 3. Aggregate by SKU
    const stockBySku = new Map<string, number>()
    for (const batch of allBatches) {
      const sku = variantSkuMap.get(batch.product_variant_id)
      if (!sku) continue
      const current = stockBySku.get(sku) || 0
      stockBySku.set(sku, current + Number(batch.available_quantity))
    }

    // 4. Update inventory levels
    let synced = 0
    let skipped = 0
    const details: Array<{ sku: string; totalStock: number; status: string }> = []

    for (const [sku, totalStock] of stockBySku) {
      try {
        const [inventoryItems] = await inventoryService.listInventoryItems({ sku })

        if (!inventoryItems?.length) {
          skipped++
          details.push({ sku, totalStock, status: "skipped — no inventory item" })
          continue
        }

        for (const item of inventoryItems) {
          const [levels] = await inventoryService.listInventoryLevels({
            inventory_item_id: item.id,
          })

          for (const level of levels ?? []) {
            await inventoryService.updateInventoryLevels({
              id: level.id,
              stocked_quantity: totalStock,
            })
          }
        }

        synced++
        details.push({ sku, totalStock, status: "synced" })
      } catch (err) {
        details.push({ sku, totalStock, status: `error: ${(err as Error).message}` })
      }
    }

    logger.info(`[manual-sync] Synced ${synced} SKUs, skipped ${skipped}`)

    return res.json({
      synced,
      skipped,
      total_batches: allBatches.length,
      total_skus: stockBySku.size,
      details,
    })
  } catch (err) {
    logger.error(`[manual-sync] Failed: ${(err as Error).message}`)
    return res.status(500).json({ error: (err as Error).message })
  }
}
