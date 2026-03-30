/**
 * Fix migration: add stock levels + batches to the 10 test products
 * that were created by 005-test-products but left with 0 inventory
 * due to the createInventoryItemsWorkflow "already exists" error.
 *
 * This is a NEW migration name so Medusa Cloud will run it automatically.
 */

import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
} from "@medusajs/framework/utils"
import {
  batchInventoryItemLevelsWorkflow,
} from "@medusajs/medusa/core-flows"
import { INVENTORY_BATCH_MODULE } from "../modules/inventoryBatch"
import { createLogger } from "../lib/logger"

const logger = createLogger("migration:006-fix-test-product-stock")

interface BatchDef {
  lotNumber: string
  expiryDate: string
  manufacturedOn: string
  mrp: number
  purchasePrice: number
  supplier: string
  grnNumber: string
  qty: number
}

const PRODUCTS: {
  handle: string
  batches: BatchDef[]
}[] = [
  {
    handle: "dolo-650",
    batches: [
      { lotNumber: "LOT-DOLO-2024-A", expiryDate: "2026-09-30", manufacturedOn: "2024-09-01", mrp: 32, purchasePrice: 14, supplier: "Micro Labs Ltd", grnNumber: "GRN-SM-202409-001", qty: 40 },
      { lotNumber: "LOT-DOLO-2025-B", expiryDate: "2027-03-31", manufacturedOn: "2025-03-01", mrp: 32, purchasePrice: 14, supplier: "Micro Labs Ltd", grnNumber: "GRN-SM-202503-001", qty: 35 },
      { lotNumber: "LOT-DOLO-2025-C", expiryDate: "2027-09-30", manufacturedOn: "2025-09-01", mrp: 32, purchasePrice: 14, supplier: "Micro Labs Ltd", grnNumber: "GRN-SM-202509-001", qty: 25 },
    ],
  },
  {
    handle: "glycomet-sr-500",
    batches: [
      { lotNumber: "LOT-MET-2024-A", expiryDate: "2026-09-30", manufacturedOn: "2024-09-01", mrp: 48, purchasePrice: 21, supplier: "USV Ltd", grnNumber: "GRN-SM-202409-002", qty: 40 },
      { lotNumber: "LOT-MET-2025-B", expiryDate: "2027-03-31", manufacturedOn: "2025-03-01", mrp: 48, purchasePrice: 21, supplier: "USV Ltd", grnNumber: "GRN-SM-202503-002", qty: 35 },
      { lotNumber: "LOT-MET-2025-C", expiryDate: "2027-09-30", manufacturedOn: "2025-09-01", mrp: 48, purchasePrice: 21, supplier: "USV Ltd", grnNumber: "GRN-SM-202509-002", qty: 25 },
    ],
  },
  {
    handle: "telma-40",
    batches: [
      { lotNumber: "LOT-TELMA-2024-A", expiryDate: "2026-09-30", manufacturedOn: "2024-09-01", mrp: 120, purchasePrice: 52, supplier: "Glenmark Pharmaceuticals", grnNumber: "GRN-SM-202409-003", qty: 40 },
      { lotNumber: "LOT-TELMA-2025-B", expiryDate: "2027-03-31", manufacturedOn: "2025-03-01", mrp: 120, purchasePrice: 52, supplier: "Glenmark Pharmaceuticals", grnNumber: "GRN-SM-202503-003", qty: 35 },
      { lotNumber: "LOT-TELMA-2025-C", expiryDate: "2027-09-30", manufacturedOn: "2025-09-01", mrp: 120, purchasePrice: 52, supplier: "Glenmark Pharmaceuticals", grnNumber: "GRN-SM-202509-003", qty: 25 },
    ],
  },
  {
    handle: "atorva-10",
    batches: [
      { lotNumber: "LOT-ATORVA-2024-A", expiryDate: "2026-09-30", manufacturedOn: "2024-09-01", mrp: 68, purchasePrice: 30, supplier: "Zydus Lifesciences", grnNumber: "GRN-SM-202409-004", qty: 40 },
      { lotNumber: "LOT-ATORVA-2025-B", expiryDate: "2027-03-31", manufacturedOn: "2025-03-01", mrp: 68, purchasePrice: 30, supplier: "Zydus Lifesciences", grnNumber: "GRN-SM-202503-004", qty: 35 },
      { lotNumber: "LOT-ATORVA-2025-C", expiryDate: "2027-09-30", manufacturedOn: "2025-09-01", mrp: 68, purchasePrice: 30, supplier: "Zydus Lifesciences", grnNumber: "GRN-SM-202509-004", qty: 25 },
    ],
  },
  {
    handle: "pan-40",
    batches: [
      { lotNumber: "LOT-PAN-2024-A", expiryDate: "2026-09-30", manufacturedOn: "2024-09-01", mrp: 72, purchasePrice: 32, supplier: "Alkem Laboratories", grnNumber: "GRN-SM-202409-005", qty: 40 },
      { lotNumber: "LOT-PAN-2025-B", expiryDate: "2027-03-31", manufacturedOn: "2025-03-01", mrp: 72, purchasePrice: 32, supplier: "Alkem Laboratories", grnNumber: "GRN-SM-202503-005", qty: 35 },
      { lotNumber: "LOT-PAN-2025-C", expiryDate: "2027-09-30", manufacturedOn: "2025-09-01", mrp: 72, purchasePrice: 32, supplier: "Alkem Laboratories", grnNumber: "GRN-SM-202509-005", qty: 25 },
    ],
  },
  {
    handle: "azithral-500",
    batches: [
      { lotNumber: "LOT-AZIO-2024-A", expiryDate: "2026-09-30", manufacturedOn: "2024-09-01", mrp: 95, purchasePrice: 42, supplier: "Alembic Pharmaceuticals", grnNumber: "GRN-SM-202409-006", qty: 40 },
      { lotNumber: "LOT-AZIO-2025-B", expiryDate: "2027-03-31", manufacturedOn: "2025-03-01", mrp: 95, purchasePrice: 42, supplier: "Alembic Pharmaceuticals", grnNumber: "GRN-SM-202503-006", qty: 35 },
      { lotNumber: "LOT-AZIO-2025-C", expiryDate: "2027-09-30", manufacturedOn: "2025-09-01", mrp: 95, purchasePrice: 42, supplier: "Alembic Pharmaceuticals", grnNumber: "GRN-SM-202509-006", qty: 25 },
    ],
  },
  {
    handle: "cetzine-10",
    batches: [
      { lotNumber: "LOT-CET-2024-A", expiryDate: "2026-09-30", manufacturedOn: "2024-09-01", mrp: 28, purchasePrice: 12, supplier: "Dr. Reddy's Laboratories", grnNumber: "GRN-SM-202409-007", qty: 40 },
      { lotNumber: "LOT-CET-2025-B", expiryDate: "2027-03-31", manufacturedOn: "2025-03-01", mrp: 28, purchasePrice: 12, supplier: "Dr. Reddy's Laboratories", grnNumber: "GRN-SM-202503-007", qty: 35 },
      { lotNumber: "LOT-CET-2025-C", expiryDate: "2027-09-30", manufacturedOn: "2025-09-01", mrp: 28, purchasePrice: 12, supplier: "Dr. Reddy's Laboratories", grnNumber: "GRN-SM-202509-007", qty: 25 },
    ],
  },
  {
    handle: "amlong-5",
    batches: [
      { lotNumber: "LOT-AML-2024-A", expiryDate: "2026-09-30", manufacturedOn: "2024-09-01", mrp: 55, purchasePrice: 24, supplier: "Micro Labs Ltd", grnNumber: "GRN-SM-202409-008", qty: 40 },
      { lotNumber: "LOT-AML-2025-B", expiryDate: "2027-03-31", manufacturedOn: "2025-03-01", mrp: 55, purchasePrice: 24, supplier: "Micro Labs Ltd", grnNumber: "GRN-SM-202503-008", qty: 35 },
      { lotNumber: "LOT-AML-2025-C", expiryDate: "2027-09-30", manufacturedOn: "2025-09-01", mrp: 55, purchasePrice: 24, supplier: "Micro Labs Ltd", grnNumber: "GRN-SM-202509-008", qty: 25 },
    ],
  },
  {
    handle: "calcirol-d3-60000",
    batches: [
      { lotNumber: "LOT-CALC-2024-A", expiryDate: "2026-09-30", manufacturedOn: "2024-09-01", mrp: 180, purchasePrice: 79, supplier: "Cadila Pharmaceuticals", grnNumber: "GRN-SM-202409-009", qty: 40 },
      { lotNumber: "LOT-CALC-2025-B", expiryDate: "2027-03-31", manufacturedOn: "2025-03-01", mrp: 180, purchasePrice: 79, supplier: "Cadila Pharmaceuticals", grnNumber: "GRN-SM-202503-009", qty: 35 },
      { lotNumber: "LOT-CALC-2025-C", expiryDate: "2027-09-30", manufacturedOn: "2025-09-01", mrp: 180, purchasePrice: 79, supplier: "Cadila Pharmaceuticals", grnNumber: "GRN-SM-202509-009", qty: 25 },
    ],
  },
  {
    handle: "omez-20",
    batches: [
      { lotNumber: "LOT-OMEZ-2024-A", expiryDate: "2026-09-30", manufacturedOn: "2024-09-01", mrp: 38, purchasePrice: 17, supplier: "Dr. Reddy's Laboratories", grnNumber: "GRN-SM-202409-010", qty: 40 },
      { lotNumber: "LOT-OMEZ-2025-B", expiryDate: "2027-03-31", manufacturedOn: "2025-03-01", mrp: 38, purchasePrice: 17, supplier: "Dr. Reddy's Laboratories", grnNumber: "GRN-SM-202503-010", qty: 35 },
      { lotNumber: "LOT-OMEZ-2025-C", expiryDate: "2027-09-30", manufacturedOn: "2025-09-01", mrp: 38, purchasePrice: 17, supplier: "Dr. Reddy's Laboratories", grnNumber: "GRN-SM-202509-010", qty: 25 },
    ],
  },
]

export default async function fixTestProductStock({
  container,
}: {
  container: MedusaContainer
}) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any

  // Find stock location
  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  const stockLocation = (stockLocations as any[])?.[0]
  if (!stockLocation?.id) {
    logger.error("006: No stock location found — skipping.")
    return
  }

  let fixed = 0
  let skipped = 0
  let errors = 0

  for (const product of PRODUCTS) {
    try {
      // Find product by handle
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["id", "handle"],
        filters: { handle: [product.handle] },
      })
      const productRecord = (products as any[])[0]
      if (!productRecord?.id) {
        logger.warn(`006: product "${product.handle}" not found — skipping.`)
        skipped++
        continue
      }

      // Find variant + inventory item
      const { data: variants } = await query.graph({
        entity: "variant",
        fields: [
          "id",
          "inventory_items.id",
          "inventory_items.location_levels.stocked_quantity",
          "inventory_items.location_levels.location_id",
        ],
        filters: { product_id: [productRecord.id] },
      })
      const variant = (variants as any[])[0]
      const invItem = variant?.inventory_items?.[0]

      if (!variant?.id || !invItem?.id) {
        logger.warn(`006: no variant/inventory for "${product.handle}" — skipping.`)
        skipped++
        continue
      }

      // ── Create batches (skip if lot already exists) ────────────────

      let batchesCreated = 0
      const totalQty = product.batches.reduce((s, b) => s + b.qty, 0)

      for (const batch of product.batches) {
        try {
          const existing = await batchService.listBatches({
            lot_number: batch.lotNumber,
          })
          if (existing.length) continue

          await batchService.createBatches({
            product_variant_id: variant.id,
            product_id: productRecord.id,
            lot_number: batch.lotNumber,
            manufactured_on: batch.manufacturedOn,
            expiry_date: batch.expiryDate,
            received_quantity: batch.qty,
            available_quantity: batch.qty,
            reserved_quantity: 0,
            batch_mrp_paise: batch.mrp * 100,
            purchase_price_paise: batch.purchasePrice * 100,
            location_id: stockLocation.id,
            supplier_name: batch.supplier,
            grn_number: batch.grnNumber,
            received_on: new Date().toISOString(),
            status: "active",
            metadata: { source: "seed:006-fix" },
          })
          batchesCreated++
          logger.info(`006:   ↳ ${batch.lotNumber} (qty: ${batch.qty}, exp: ${batch.expiryDate})`)
        } catch (bErr: any) {
          logger.warn(`006:   batch ${batch.lotNumber} failed: ${bErr.message}`)
        }
      }

      // ── Set stock level ────────────────────────────────────────────

      const currentLevel = invItem.location_levels?.find(
        (l: any) => l.location_id === stockLocation.id
      )

      if (currentLevel) {
        // Level exists — update to total
        if (currentLevel.stocked_quantity < totalQty) {
          await batchInventoryItemLevelsWorkflow(container).run({
            input: {
              creates: [],
              updates: [
                {
                  inventory_item_id: invItem.id,
                  location_id: stockLocation.id,
                  stocked_quantity: totalQty,
                },
              ],
              deletes: [],
            } as any,
          })
        }
      } else {
        // No level at this location — create it
        await batchInventoryItemLevelsWorkflow(container).run({
          input: {
            creates: [
              {
                inventory_item_id: invItem.id,
                location_id: stockLocation.id,
                stocked_quantity: totalQty,
              },
            ],
            updates: [],
            deletes: [],
          } as any,
        })
      }

      logger.info(
        `006: FIXED "${product.handle}" — ${totalQty} units, ${batchesCreated} new batches`
      )
      fixed++
    } catch (err: any) {
      logger.error(`006: ERROR "${product.handle}": ${err.message}`)
      errors++
    }
  }

  logger.info(`006: done. Fixed: ${fixed}, skipped: ${skipped}, errors: ${errors}`)
}
