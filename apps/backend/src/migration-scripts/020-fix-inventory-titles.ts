/**
 * 020 — Fix Inventory Item Titles
 *
 * Inventory items created by script 019 have empty titles because only
 * `sku` was passed to createInventoryItemsWorkflow. This script sets the
 * title of each inventory item to the parent product's title.
 *
 * Idempotent: only updates items where title is null or empty.
 */
import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const LOG = "[020]"

export default async function fixInventoryTitles({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const inventoryService = container.resolve(Modules.INVENTORY) as any

  logger.info(`${LOG} Fix Inventory Item Titles — starting...`)

  // Get all products with variants + SKUs
  const { data: allProducts } = await query.graph({
    entity: "product",
    fields: ["id", "title", "variants.id", "variants.sku"],
  })

  // Build SKU → product title map
  const skuToTitle = new Map<string, string>()
  for (const product of allProducts as any[]) {
    for (const variant of product.variants || []) {
      if (variant?.sku) {
        skuToTitle.set(variant.sku, product.title)
      }
    }
  }

  if (!skuToTitle.size) {
    logger.info(`${LOG} No product variants with SKUs found. Nothing to fix.`)
    return
  }

  // Get all inventory items
  const skus = Array.from(skuToTitle.keys())
  const { data: invItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku", "title"],
    filters: { sku: skus },
  })

  let updated = 0
  for (const item of invItems as any[]) {
    if (!item?.sku) continue
    const productTitle = skuToTitle.get(item.sku)
    if (!productTitle) continue

    // Only update if title is missing or empty
    if (!item.title || item.title === "-" || item.title.trim() === "") {
      try {
        await inventoryService.updateInventoryItems(item.id, { title: productTitle })
        updated++
      } catch (err: any) {
        logger.warn(`${LOG} Could not update title for ${item.sku}: ${err.message}`)
      }
    }
  }

  logger.info(`${LOG} Updated ${updated}/${(invItems as any[]).length} inventory item titles.`)
}
