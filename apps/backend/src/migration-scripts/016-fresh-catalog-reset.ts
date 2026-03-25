/**
 * 016 — Fresh Catalog Reset
 *
 * One-time cleanup script to fix cloud deployment where:
 *   - Old test products (created via admin UI) still exist
 *   - Product prices were set to ₹1 placeholder
 *   - Inventory levels are 0
 *   - Batches need to be re-created for the fresh catalog
 *
 * This script:
 *   1. Deletes ALL products (both manual test & seeded)
 *   2. Deletes ALL batches and audit logs
 *   3. Re-imports products from 007 (Supracyn brochure, ₹100-300)
 *   4. Re-imports products from 008 (sample catalog, ₹100-300, with inventory)
 *   5. Re-seeds batches from 015 (2-3 per product)
 *
 * This runs once and is recorded in script_migrations so it won't re-run.
 */
import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
} from "@medusajs/framework/utils"
import { deleteProductsWorkflow } from "@medusajs/medusa/core-flows"
import { INVENTORY_BATCH_MODULE } from "../modules/inventoryBatch"

import supracynProducts from "./007-supracyn-products"
import pharmacyCatalog from "./008-pharmacy-taxonomy-and-sample-catalog"
import seedProductBatches from "./015-seed-product-batches"

export default async function freshCatalogReset({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  logger.info("╔══════════════════════════════════════════════════╗")
  logger.info("║     016 — Fresh Catalog Reset (one-time fix)    ║")
  logger.info("╚══════════════════════════════════════════════════╝")

  // ── Step 1: Delete ALL batches, deductions, and audit logs ──
  logger.info("[016] Step 1: Cleaning up all batches...")
  try {
    const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any

    const allDeductions = await batchService.listBatchDeductions({}, { take: 10000 })
    if (allDeductions?.length) {
      for (const d of allDeductions) {
        await batchService.deleteBatchDeductions(d.id)
      }
      logger.info(`[016]   Deleted ${allDeductions.length} batch deductions`)
    }

    const allAuditLogs = await batchService.listBatchAuditLogs({}, { take: 10000 })
    if (allAuditLogs?.length) {
      for (const a of allAuditLogs) {
        await batchService.deleteBatchAuditLogs(a.id)
      }
      logger.info(`[016]   Deleted ${allAuditLogs.length} audit log entries`)
    }

    const allBatches = await batchService.listBatches({}, { take: 10000 })
    if (allBatches?.length) {
      for (const b of allBatches) {
        await batchService.deleteBatches(b.id)
      }
      logger.info(`[016]   Deleted ${allBatches.length} batches`)
    }
  } catch (err) {
    logger.warn(`[016]   Batch cleanup encountered error (may be empty): ${err instanceof Error ? err.message : err}`)
  }

  // ── Step 2: Delete ALL products ──
  logger.info("[016] Step 2: Deleting ALL products...")
  const { data: allProducts } = await query.graph({
    entity: "product",
    fields: ["id"],
  })

  if (allProducts?.length) {
    const productIds = (allProducts as any[]).map((p) => p.id)
    const CHUNK_SIZE = 20
    for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
      const chunk = productIds.slice(i, i + CHUNK_SIZE)
      await deleteProductsWorkflow(container).run({
        input: { ids: chunk },
      })
    }
    logger.info(`[016]   Deleted ${productIds.length} products`)
  } else {
    logger.info("[016]   No products to delete")
  }

  // ── Step 3: Delete orphaned inventory items ──
  logger.info("[016] Step 3: Cleaning up orphaned inventory items...")
  try {
    const inventoryService = container.resolve(ModuleRegistrationName.INVENTORY) as any
    const [items] = await inventoryService.listInventoryItems({}, { take: 10000 })
    if (items?.length) {
      for (const item of items) {
        try {
          await inventoryService.deleteInventoryItems([item.id])
        } catch {
          // May fail if linked — that's fine
        }
      }
      logger.info(`[016]   Cleaned up ${items.length} inventory items`)
    }
  } catch (err) {
    logger.warn(`[016]   Inventory cleanup: ${err instanceof Error ? err.message : err}`)
  }

  // ── Step 4: Delete orphaned pharma drug_product records ──
  logger.info("[016] Step 4: Cleaning up pharma metadata...")
  try {
    const { PHARMA_MODULE } = await import("../modules/pharma/index.js")
    const pharmaService = container.resolve(PHARMA_MODULE) as any
    const existingDrugs = await pharmaService.listDrugProducts({}, { take: 10000 })
    if (existingDrugs?.length) {
      for (const d of existingDrugs) {
        await pharmaService.deleteDrugProducts(d.id)
      }
      logger.info(`[016]   Deleted ${existingDrugs.length} pharma records`)
    }
  } catch (err) {
    logger.warn(`[016]   Pharma cleanup: ${err instanceof Error ? err.message : err}`)
  }

  // ── Step 5: Re-create Supracyn products (007) ──
  logger.info("[016] Step 5: Re-creating Supracyn products (₹100-300 prices)...")
  try {
    await supracynProducts({ container })
    logger.info("[016]   Supracyn products created successfully")
  } catch (err) {
    logger.error(`[016]   Supracyn products failed: ${err instanceof Error ? err.message : err}`)
  }

  // ── Step 6: Re-create sample catalog (008) ──
  logger.info("[016] Step 6: Re-creating sample catalog (₹100-300 prices + inventory)...")
  try {
    await pharmacyCatalog({ container })
    logger.info("[016]   Sample catalog created successfully")
  } catch (err) {
    logger.error(`[016]   Sample catalog failed: ${err instanceof Error ? err.message : err}`)
  }

  // ── Step 7: Re-seed batches (015) ──
  logger.info("[016] Step 7: Re-seeding batches (2-3 per product)...")
  try {
    await seedProductBatches({ container })
    logger.info("[016]   Batches seeded successfully")
  } catch (err) {
    logger.error(`[016]   Batch seeding failed: ${err instanceof Error ? err.message : err}`)
  }

  logger.info("")
  logger.info("╔══════════════════════════════════════════════════╗")
  logger.info("║     016 — Fresh Catalog Reset COMPLETE          ║")
  logger.info("╚══════════════════════════════════════════════════╝")
}
