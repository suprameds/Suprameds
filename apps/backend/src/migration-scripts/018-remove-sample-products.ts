/**
 * 018 — Remove sample products seeded by the now-deleted 008 script.
 *
 * Targets products with metadata.source = "seed-basic-pharmacy-2026"
 * (the tag used by 008-pharmacy-taxonomy-and-sample-catalog.ts).
 *
 * Also cleans up:
 *   - pharma drug metadata linked to those products
 *   - inventory items, levels, and variant links
 *   - product batches (pharmaInventoryBatch)
 *
 * Idempotent — no-ops if no matching products exist.
 */

import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

const SAMPLE_SOURCE_TAG = "seed-basic-pharmacy-2026"

export default async function migration_018_remove_sample_products({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productService = container.resolve(Modules.PRODUCT) as any
  const inventoryService = container.resolve(Modules.INVENTORY) as any

  logger.info("[018] Looking for sample products to remove...")

  // Find products tagged by script 008
  const { data: allProducts } = await query.graph({
    entity: "product",
    fields: ["id", "title", "metadata", "variants.*"],
  })

  const sampleProducts = (allProducts as any[]).filter(
    (p) => p.metadata?.source === SAMPLE_SOURCE_TAG
  )

  if (!sampleProducts.length) {
    logger.info("[018] No sample products found — nothing to remove.")
    return
  }

  logger.info(`[018] Found ${sampleProducts.length} sample product(s) to remove.`)

  // Collect variant IDs and SKUs for inventory cleanup
  const variantIds: string[] = []
  const skus: string[] = []
  for (const product of sampleProducts) {
    for (const variant of product.variants ?? []) {
      variantIds.push(variant.id)
      if (variant.sku) skus.push(variant.sku)
    }
  }

  // ── 1. Clean up pharma drug metadata (custom module) ──────────────
  try {
    const pharmaService = container.resolve("pharma") as any
    if (pharmaService?.listDrugMetadatas) {
      for (const product of sampleProducts) {
        const existing = await pharmaService.listDrugMetadatas(
          { product_id: product.id },
          { take: 1 }
        )
        if (existing?.length) {
          await pharmaService.deleteDrugMetadatas(existing[0].id)
          logger.info(`[018]   Deleted pharma metadata for ${product.title}`)
        }
      }
    }
  } catch (err) {
    logger.warn(`[018] Pharma metadata cleanup skipped: ${(err as Error).message}`)
  }

  // ── 2. Clean up batches (pharmaInventoryBatch module) ─────────────
  try {
    const batchService = container.resolve("pharmaInventoryBatch") as any
    if (batchService?.listBatchs || batchService?.listBatches) {
      const listFn = batchService.listBatches ?? batchService.listBatchs
      for (const sku of skus) {
        const batches = await listFn.call(batchService, { sku }, { take: 100 })
        if (batches?.length) {
          for (const batch of batches) {
            await batchService.deleteBatchs?.(batch.id) ?? batchService.deleteBatches?.(batch.id)
          }
          logger.info(`[018]   Deleted ${batches.length} batch(es) for SKU ${sku}`)
        }
      }
    }
  } catch (err) {
    logger.warn(`[018] Batch cleanup skipped: ${(err as Error).message}`)
  }

  // ── 3. Clean up inventory items and levels ────────────────────────
  try {
    for (const sku of skus) {
      const items = await inventoryService.listInventoryItems({ sku }, { take: 10 })
      for (const item of items) {
        const levels = await inventoryService.listInventoryLevels(
          { inventory_item_id: item.id },
          { take: 50 }
        )
        for (const level of levels) {
          await inventoryService.deleteInventoryLevels(level.id)
        }
        await inventoryService.deleteInventoryItems(item.id)
        logger.info(`[018]   Deleted inventory item ${item.sku} (${item.id})`)
      }
    }
  } catch (err) {
    logger.warn(`[018] Inventory cleanup had issues: ${(err as Error).message}`)
  }

  // ── 4. Delete the products themselves ─────────────────────────────
  const productIds = sampleProducts.map((p) => p.id)
  await productService.deleteProducts(productIds)
  logger.info(`[018] Deleted ${productIds.length} sample product(s).`)

  logger.info("[018] Sample product cleanup complete.")
}
