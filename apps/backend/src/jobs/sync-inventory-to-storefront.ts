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
 */
export default async function SyncInventoryToStorefrontJob(container: MedusaContainer) {
  const logger = container.resolve("logger") as any
  logger.info(`${LOG} Starting`)

  try {
    const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any
    const inventoryService = container.resolve(Modules.INVENTORY) as any

    // Get all active batches grouped by variant
    const allBatches = await batchService.listBatches(
      { status: "active" },
      { take: null }
    )

    if (!allBatches?.length) {
      logger.info(`${LOG} No active batches found`)
      return
    }

    // Aggregate by product_variant_id
    const stockByVariant = new Map<string, number>()
    for (const batch of allBatches) {
      const vid = batch.product_variant_id
      if (!vid) continue
      const current = stockByVariant.get(vid) || 0
      stockByVariant.set(vid, current + Number(batch.available_quantity))
    }

    let synced = 0
    let skipped = 0

    for (const [variantId, totalStock] of stockByVariant) {
      try {
        // Find inventory items linked to this variant
        const inventoryItems = await inventoryService.listInventoryItems({
          sku: variantId,
        })

        if (!inventoryItems?.length) {
          skipped++
          continue
        }

        for (const item of inventoryItems) {
          const levels = await inventoryService.listInventoryLevels({
            inventory_item_id: item.id,
          })

          for (const level of levels) {
            await inventoryService.updateInventoryLevels(level.id, {
              stocked_quantity: totalStock,
            })
          }
        }

        synced++
      } catch (err) {
        logger.warn(`${LOG} Variant ${variantId}: ${(err as Error).message}`)
      }
    }

    logger.info(`${LOG} Synced ${synced} variants, skipped ${skipped}`)
  } catch (err) {
    logger.error(`${LOG} Failed: ${(err as Error).message}`)
  }
}

export const config = {
  name: "sync-inventory",
  schedule: "*/5 * * * *",
}
