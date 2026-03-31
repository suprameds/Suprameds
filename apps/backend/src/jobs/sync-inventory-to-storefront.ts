import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { INVENTORY_BATCH_MODULE } from "../modules/inventoryBatch"

const LOG = "[job:sync-inventory]"

/**
 * Runs every 5 minutes — syncs aggregated batch quantities into Medusa's
 * native inventory system so the storefront shows accurate stock levels.
 *
 * For each product variant, sums available_quantity across all active
 * batches and updates the corresponding InventoryLevel.
 *
 * NOTE: Batches store `product_variant_id` (Medusa variant UUID), but
 * inventory items are keyed by the variant's human-readable `sku`.
 * We must resolve variant_id → sku before looking up inventory items.
 */
export default async function SyncInventoryToStorefrontJob(container: MedusaContainer) {
  const logger = container.resolve("logger") as any
  logger.info(`${LOG} Starting`)

  try {
    const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any
    const inventoryService = container.resolve(Modules.INVENTORY) as any
    const productService = container.resolve(Modules.PRODUCT) as any

    // Get all active batches grouped by variant
    const allBatches = await batchService.listBatches(
      { status: "active" },
      { take: null }
    )

    if (!allBatches?.length) {
      logger.info(`${LOG} No active batches found`)
      return
    }

    // Collect unique variant IDs from batches
    const variantIds = [...new Set(
      allBatches.map((b: any) => b.product_variant_id).filter(Boolean)
    )] as string[]

    // Resolve variant_id → sku in bulk
    const variantSkuMap = new Map<string, string>()
    if (variantIds.length > 0) {
      try {
        const variants = await productService.listProductVariants(
          { id: variantIds },
          { select: ["id", "sku"], take: null }
        )
        for (const v of variants) {
          if (v.sku) variantSkuMap.set(v.id, v.sku)
        }
      } catch (err) {
        logger.warn(`${LOG} Failed to resolve variant SKUs: ${(err as Error).message}`)
      }
    }

    logger.info(`${LOG} ${allBatches.length} active batches, ${variantSkuMap.size} variants with SKUs`)

    // Aggregate by SKU (not variant UUID)
    const stockBySku = new Map<string, number>()
    for (const batch of allBatches) {
      const sku = variantSkuMap.get(batch.product_variant_id)
      if (!sku) continue
      const current = stockBySku.get(sku) || 0
      stockBySku.set(sku, current + Number(batch.available_quantity))
    }

    let synced = 0
    let skipped = 0

    for (const [sku, totalStock] of stockBySku) {
      try {
        // Find inventory items by actual product SKU
        const [inventoryItems] = await inventoryService.listInventoryItems({ sku })

        if (!inventoryItems?.length) {
          skipped++
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
      } catch (err) {
        logger.warn(`${LOG} SKU ${sku}: ${(err as Error).message}`)
      }
    }

    logger.info(`${LOG} Synced ${synced} SKUs, skipped ${skipped}`)
  } catch (err) {
    logger.error(`${LOG} Failed: ${(err as Error).message}`)
  }
}

export const config = {
  name: "sync-inventory",
  schedule: "*/5 * * * *",
}
