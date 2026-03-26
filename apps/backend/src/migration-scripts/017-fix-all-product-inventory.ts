/**
 * 017 — Fix All Product Inventory
 *
 * Ensures every product variant has:
 *   1. An InventoryItem (with matching SKU)
 *   2. An InventoryLevel at the default stock location (stocked_quantity = 50)
 *   3. A Product → InventoryItem link
 *   4. manage_inventory = true on the variant
 *
 * This fixes Supracyn products (from 007) that were created with manage_inventory: false,
 * and also ensures script 008 products have correct stock levels (may have been 0).
 */
import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  batchInventoryItemLevelsWorkflow,
  createInventoryItemsWorkflow,
} from "@medusajs/medusa/core-flows"

const DEFAULT_STOCK = 50

export default async function fixAllProductInventory({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  logger.info("[017] Fix All Product Inventory — starting...")

  // 1. Get the stock location
  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  const stockLocation = (stockLocations as any[])?.[0]
  if (!stockLocation?.id) {
    logger.warn("[017] No stock location found — cannot fix inventory. Skipping.")
    return
  }
  logger.info(`[017] Using stock location: ${stockLocation.name} (${stockLocation.id})`)

  // 2. Get ALL product variants
  const { data: allProducts } = await query.graph({
    entity: "product",
    fields: ["id"],
  })
  const productIds = (allProducts as any[]).map((p) => p.id).filter(Boolean)
  if (!productIds.length) {
    logger.info("[017] No products found. Nothing to fix.")
    return
  }

  const { data: allVariants } = await query.graph({
    entity: "variant",
    fields: ["id", "sku", "product_id", "manage_inventory"],
    filters: { product_id: productIds },
  })
  const variants = (allVariants as any[]).filter((v) => v?.sku)
  logger.info(`[017] Found ${variants.length} variants across ${productIds.length} products`)

  if (!variants.length) {
    logger.info("[017] No variants with SKUs found. Nothing to fix.")
    return
  }

  // 3. Enable manage_inventory on all variants that have it disabled
  const productService = container.resolve(Modules.PRODUCT) as any
  const disabledVariants = variants.filter((v) => !v.manage_inventory)
  if (disabledVariants.length) {
    for (const v of disabledVariants) {
      try {
        await productService.updateProductVariants(v.id, { manage_inventory: true })
      } catch (err: any) {
        logger.warn(`[017] Could not enable manage_inventory on variant ${v.id}: ${err.message}`)
      }
    }
    logger.info(`[017] Enabled manage_inventory on ${disabledVariants.length} variants`)
  }

  // 4. Ensure inventory items exist for all SKUs
  const skus = variants.map((v) => v.sku)
  const { data: existingInvItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku"],
    filters: { sku: skus },
  })
  const invBySku = new Map<string, any>(
    (existingInvItems as any[]).filter((i) => i?.sku).map((i) => [i.sku, i])
  )

  const missingSkus = skus.filter((s) => !invBySku.has(s))
  if (missingSkus.length) {
    logger.info(`[017] Creating ${missingSkus.length} missing inventory items...`)
    const { result: createdItems } = await createInventoryItemsWorkflow(container).run({
      input: { items: missingSkus.map((sku) => ({ sku })) as any },
    })
    for (const item of createdItems as any[]) {
      if (item?.sku) invBySku.set(item.sku, item)
    }
    logger.info(`[017] Created ${createdItems.length} inventory items`)
  }

  // 5. Ensure inventory levels at stock location with correct stock
  const invItemIds = skus.map((s) => invBySku.get(s)?.id).filter(Boolean) as string[]

  const { data: existingLevels } = await query.graph({
    entity: "inventory_levels",
    fields: ["id", "inventory_item_id", "location_id", "stocked_quantity"],
    filters: { inventory_item_id: invItemIds, location_id: [stockLocation.id] },
  })

  const levelMap = new Map<string, any>(
    (existingLevels as any[]).map((l) => [`${l.inventory_item_id}:${l.location_id}`, l])
  )

  const creates: any[] = []
  const updates: any[] = []

  for (const invId of invItemIds) {
    const key = `${invId}:${stockLocation.id}`
    const existing = levelMap.get(key)
    if (existing) {
      if (existing.stocked_quantity === 0) {
        updates.push({
          id: existing.id,
          inventory_item_id: invId,
          location_id: stockLocation.id,
          stocked_quantity: DEFAULT_STOCK,
        })
      }
    } else {
      creates.push({
        inventory_item_id: invId,
        location_id: stockLocation.id,
        stocked_quantity: DEFAULT_STOCK,
      })
    }
  }

  if (creates.length || updates.length) {
    await batchInventoryItemLevelsWorkflow(container).run({
      input: { creates, updates, deletes: [] } as any,
    })
    logger.info(
      `[017] Inventory levels: ${creates.length} created, ${updates.length} updated to ${DEFAULT_STOCK} stock`
    )
  } else {
    logger.info("[017] All inventory levels already have stock. No changes needed.")
  }

  // 6. Ensure variant → inventory item links exist
  const link = container.resolve(ContainerRegistrationKeys.LINK) as any

  // Check existing links
  const { data: existingLinks } = await query.graph({
    entity: "product_variant_inventory_item",
    fields: ["variant_id", "inventory_item_id"],
    filters: { variant_id: variants.map((v) => v.id) },
  })
  const linkedVariantIds = new Set(
    (existingLinks as any[]).map((l) => l.variant_id)
  )

  const newLinks = variants
    .filter((v) => !linkedVariantIds.has(v.id) && invBySku.get(v.sku)?.id)
    .map((v) => ({
      [Modules.PRODUCT]: { variant_id: v.id },
      [Modules.INVENTORY]: { inventory_item_id: invBySku.get(v.sku).id },
    }))

  if (newLinks.length) {
    await link.create(newLinks as any)
    logger.info(`[017] Created ${newLinks.length} variant → inventory item links`)
  }

  logger.info(
    `[017] Fix All Product Inventory complete. ` +
    `${invItemIds.length} items with ${DEFAULT_STOCK} stock each.`
  )
}
