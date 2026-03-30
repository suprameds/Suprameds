/**
 * Direct stock level fix — bypasses batchInventoryItemLevelsWorkflow
 * and uses the inventory module service directly to set stocked_quantity.
 *
 * Previous attempts via workflow created levels that got overwritten
 * when locations were manually managed from the admin UI.
 */

import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { createLogger } from "../lib/logger"

const logger = createLogger("migration:008-set-test-product-stock")

const PRODUCTS = [
  { handle: "dolo-650", qty: 100 },
  { handle: "glycomet-sr-500", qty: 100 },
  { handle: "telma-40", qty: 100 },
  { handle: "atorva-10", qty: 100 },
  { handle: "pan-40", qty: 100 },
  { handle: "azithral-500", qty: 100 },
  { handle: "cetzine-10", qty: 100 },
  { handle: "amlong-5", qty: 100 },
  { handle: "calcirol-d3-60000", qty: 100 },
  { handle: "omez-20", qty: 100 },
]

export default async function setTestProductStock({
  container,
}: {
  container: MedusaContainer
}) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const inventoryService = container.resolve(Modules.INVENTORY) as any

  // Get stock location
  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  const locationId = (stockLocations as any[])?.[0]?.id
  if (!locationId) {
    throw new Error("008: No stock location found")
  }
  logger.info(`008: using location ${locationId}`)

  let fixed = 0
  let errors = 0

  for (const product of PRODUCTS) {
    try {
      // Find product
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["id"],
        filters: { handle: [product.handle] },
      })
      const productId = (products as any[])[0]?.id
      if (!productId) {
        logger.warn(`008: "${product.handle}" not found — skipping`)
        continue
      }

      // Find variant → inventory item via link
      const { data: variants } = await query.graph({
        entity: "variant",
        fields: ["id", "inventory_items.id"],
        filters: { product_id: [productId] },
      })
      const invItemId = (variants as any[])[0]?.inventory_items?.[0]?.id
      if (!invItemId) {
        logger.warn(`008: "${product.handle}" no inventory item — skipping`)
        continue
      }

      // Check if level exists at this location
      const [existingLevels] = await inventoryService.listInventoryLevels({
        inventory_item_id: invItemId,
        location_id: locationId,
      })

      if (existingLevels?.length > 0) {
        // Level exists — update stocked_quantity directly
        const level = existingLevels[0]
        if (level.stocked_quantity !== product.qty) {
          await inventoryService.updateInventoryLevels({
            id: level.id,
            stocked_quantity: product.qty,
          })
          logger.info(`008: "${product.handle}" updated ${level.stocked_quantity} → ${product.qty}`)
        } else {
          logger.info(`008: "${product.handle}" already at ${product.qty} — no change`)
        }
      } else {
        // No level — create one
        await inventoryService.createInventoryLevels({
          inventory_item_id: invItemId,
          location_id: locationId,
          stocked_quantity: product.qty,
        })
        logger.info(`008: "${product.handle}" created level with ${product.qty}`)
      }

      fixed++
    } catch (err: any) {
      logger.error(`008: "${product.handle}" failed: ${err.message}`)
      errors++
    }
  }

  logger.info(`008: done. Fixed: ${fixed}, errors: ${errors}`)

  if (errors > 0) {
    throw new Error(`008: ${errors} product(s) failed — will retry next deploy`)
  }
}
