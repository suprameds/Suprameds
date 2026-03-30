/**
 * 010 — Set stock levels via raw SQL.
 *
 * All previous approaches failed to set stocked_quantity:
 *   - batchInventoryItemLevelsWorkflow: created levels but showed 0
 *   - inventoryService.createInventoryLevels: created levels but showed 0
 *   - inventoryService.updateInventoryLevels: same result
 *
 * This migration goes direct: raw SQL UPDATE on the inventory_level table.
 */

import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createLogger } from "../lib/logger"

const logger = createLogger("migration:010-set-stock-levels")

const SKUS = [
  "SUPRA-DOLO-650",
  "SUPRA-GLYCOMET-SR-500",
  "SUPRA-TELMA-40",
  "SUPRA-ATORVA-10",
  "SUPRA-PAN-40",
  "SUPRA-AZITHRAL-500",
  "SUPRA-CETZINE-10",
  "SUPRA-AMLONG-5",
  "SUPRA-CALCIROL-D3-60000",
  "SUPRA-OMEZ-20",
]

const TARGET_QTY = 100

export default async function setStockLevels({
  container,
}: {
  container: MedusaContainer
}) {
  const pgConnection = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const inventoryService = container.resolve(Modules.INVENTORY) as any

  // Get location ID
  const { rows: locRows } = await pgConnection.raw(
    `SELECT id FROM stock_location LIMIT 1`
  )
  const locationId = locRows?.[0]?.id
  if (!locationId) throw new Error("010: no stock_location found")

  logger.info(`010: location=${locationId}`)

  let updated = 0

  for (const sku of SKUS) {
    try {
      // Find inventory item by SKU
      const { rows: itemRows } = await pgConnection.raw(
        `SELECT id FROM inventory_item WHERE sku = ?`,
        [sku]
      )
      const invItemId = itemRows?.[0]?.id
      if (!invItemId) {
        logger.warn(`010: no inventory_item for SKU ${sku}`)
        continue
      }

      // Check if inventory_level exists
      const { rows: levelRows } = await pgConnection.raw(
        `SELECT id, stocked_quantity FROM inventory_level WHERE inventory_item_id = ? AND location_id = ?`,
        [invItemId, locationId]
      )

      if (levelRows?.length > 0) {
        // Update existing level
        const currentQty = levelRows[0].stocked_quantity
        if (currentQty !== TARGET_QTY) {
          await pgConnection.raw(
            `UPDATE inventory_level SET stocked_quantity = ? WHERE id = ?`,
            [TARGET_QTY, levelRows[0].id]
          )
          logger.info(`010: ${sku} updated ${currentQty} → ${TARGET_QTY}`)
        } else {
          logger.info(`010: ${sku} already at ${TARGET_QTY}`)
        }
      } else {
        // Create level via raw SQL
        await pgConnection.raw(
          `INSERT INTO inventory_level (id, inventory_item_id, location_id, stocked_quantity, reserved_quantity, incoming_quantity, created_at, updated_at)
           VALUES (gen_random_uuid()::text, ?, ?, ?, 0, 0, NOW(), NOW())`,
          [invItemId, locationId, TARGET_QTY]
        )
        logger.info(`010: ${sku} created level with ${TARGET_QTY}`)
      }

      updated++
    } catch (err: any) {
      logger.error(`010: ${sku} failed: ${err.message}`)
      throw err
    }
  }

  logger.info(`010: done. ${updated}/10 updated.`)
}
