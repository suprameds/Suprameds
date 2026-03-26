/**
 * 019 — Fix Cloud Inventory (March 2026)
 *
 * This script exists because:
 *   - Script 015 crashed on cloud ("listBatchs is not a function")
 *   - Script 017 either never ran or ran when stock was already 0 and got tracked as "complete"
 *   - Medusa's MigrationScriptsMigrator tracks by filename — once marked, never re-runs
 *
 * This script has a NEW filename, so Medusa will definitely run it on the next deploy.
 * It combines two critical operations:
 *   1. Seed batches for all product variants (same logic as 015, with defensive method names)
 *   2. Fix Medusa core inventory levels to stocked_quantity = 50
 *
 * Idempotent: safe to re-run.
 */
import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createInventoryItemsWorkflow,
} from "@medusajs/medusa/core-flows"
import { INVENTORY_BATCH_MODULE } from "../modules/inventoryBatch"

const DEFAULT_STOCK = 50
const LOG = "[019]"

function monthsFromNow(months: number): Date {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d
}

function monthsAgo(months: number): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d
}

function makeLotNumber(prefix: string, index: number): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1 - index).padStart(2, "0")
  return `${prefix}${yy}${mm}-${String(100 + index * 37).slice(-3)}`
}

type BatchTemplate = {
  lotSuffix: string
  manufacturedMonthsAgo: number
  expiryMonths: number
  receivedQuantity: number
  availableQuantity: number
  mrpMultiplier: number
  costMultiplier: number
  supplier: string
}

const BATCH_TEMPLATES: BatchTemplate[][] = [
  [
    { lotSuffix: "A", manufacturedMonthsAgo: 18, expiryMonths: 6, receivedQuantity: 100, availableQuantity: 25, mrpMultiplier: 1.25, costMultiplier: 0.55, supplier: "Cipla Ltd." },
    { lotSuffix: "B", manufacturedMonthsAgo: 6, expiryMonths: 18, receivedQuantity: 200, availableQuantity: 180, mrpMultiplier: 1.20, costMultiplier: 0.58, supplier: "Sun Pharma" },
    { lotSuffix: "C", manufacturedMonthsAgo: 1, expiryMonths: 23, receivedQuantity: 150, availableQuantity: 150, mrpMultiplier: 1.22, costMultiplier: 0.56, supplier: "Supracyn Pharma" },
  ],
  [
    { lotSuffix: "X", manufacturedMonthsAgo: 12, expiryMonths: 12, receivedQuantity: 150, availableQuantity: 80, mrpMultiplier: 1.30, costMultiplier: 0.52, supplier: "Hetero Drugs" },
    { lotSuffix: "Y", manufacturedMonthsAgo: 3, expiryMonths: 21, receivedQuantity: 200, availableQuantity: 200, mrpMultiplier: 1.25, costMultiplier: 0.55, supplier: "Supracyn Pharma" },
  ],
  [
    { lotSuffix: "P", manufacturedMonthsAgo: 20, expiryMonths: 4, receivedQuantity: 80, availableQuantity: 5, mrpMultiplier: 1.20, costMultiplier: 0.60, supplier: "Dr. Reddy's" },
    { lotSuffix: "Q", manufacturedMonthsAgo: 8, expiryMonths: 16, receivedQuantity: 120, availableQuantity: 95, mrpMultiplier: 1.22, costMultiplier: 0.57, supplier: "Cipla Ltd." },
    { lotSuffix: "R", manufacturedMonthsAgo: 2, expiryMonths: 22, receivedQuantity: 250, availableQuantity: 250, mrpMultiplier: 1.18, costMultiplier: 0.53, supplier: "Supracyn Pharma" },
  ],
]

export default async function fixCloudInventory({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  logger.info(`${LOG} Fix Cloud Inventory — starting...`)

  // ── Step 1: Get stock location ────────────────────────────────────
  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  const stockLocation = (stockLocations as any[])?.[0]
  if (!stockLocation?.id) {
    logger.warn(`${LOG} No stock location found — cannot fix inventory. Skipping.`)
    return
  }
  logger.info(`${LOG} Stock location: ${stockLocation.name} (${stockLocation.id})`)

  // ── Step 2: Get all product variants ──────────────────────────────
  const { data: allProducts } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "variants.id", "variants.sku", "variants.manage_inventory"],
  })
  const products = (allProducts as any[]).filter((p) => p?.variants?.length)
  if (!products.length) {
    logger.info(`${LOG} No products found. Nothing to fix.`)
    return
  }

  const allVariants = products.flatMap((p: any) => (p.variants || []).filter((v: any) => v?.sku))
  logger.info(`${LOG} Found ${allVariants.length} variants across ${products.length} products`)

  // ── Step 3: Enable manage_inventory on all variants ───────────────
  const productService = container.resolve(Modules.PRODUCT) as any
  const disabledVariants = allVariants.filter((v: any) => !v.manage_inventory)
  if (disabledVariants.length) {
    for (const v of disabledVariants) {
      try {
        await productService.updateProductVariants(v.id, { manage_inventory: true })
      } catch (err: any) {
        logger.warn(`${LOG} Could not enable manage_inventory on ${v.id}: ${err.message}`)
      }
    }
    logger.info(`${LOG} Enabled manage_inventory on ${disabledVariants.length} variants`)
  }

  // ── Step 4: Ensure inventory items exist for all SKUs ─────────────
  const skus = allVariants.map((v: any) => v.sku)
  const { data: existingInvItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku"],
    filters: { sku: skus },
  })
  const invBySku = new Map<string, any>(
    (existingInvItems as any[]).filter((i) => i?.sku).map((i) => [i.sku, i])
  )

  // Build SKU → product title map for inventory item naming
  const skuToTitle = new Map<string, string>()
  for (const p of products) {
    for (const v of (p as any).variants || []) {
      if (v?.sku) skuToTitle.set(v.sku, (p as any).title || v.sku)
    }
  }

  const missingSkus = skus.filter((s: string) => !invBySku.has(s))
  if (missingSkus.length) {
    logger.info(`${LOG} Creating ${missingSkus.length} missing inventory items...`)
    const { result: createdItems } = await createInventoryItemsWorkflow(container).run({
      input: {
        items: missingSkus.map((sku: string) => ({
          sku,
          title: skuToTitle.get(sku) || sku,
        })) as any,
      },
    })
    for (const item of createdItems as any[]) {
      if (item?.sku) invBySku.set(item.sku, item)
    }
    logger.info(`${LOG} Created ${createdItems.length} inventory items`)
  }

  // ── Step 5: Fix inventory levels (direct service calls) ───────────
  const inventoryService = container.resolve(Modules.INVENTORY) as any
  const invItemIds = skus.map((s: string) => invBySku.get(s)?.id).filter(Boolean) as string[]

  let existingLevels: any[] = []
  try {
    existingLevels = await inventoryService.listInventoryLevels(
      { inventory_item_id: invItemIds, location_id: stockLocation.id },
      { take: invItemIds.length + 100 }
    )
  } catch (err: any) {
    logger.warn(`${LOG} Could not list inventory levels: ${err.message}`)
  }

  const levelMap = new Map<string, any>(
    existingLevels
      .filter((l: any) => l?.inventory_item_id)
      .map((l: any) => [l.inventory_item_id, l])
  )

  let created = 0
  let updated = 0

  for (const invId of invItemIds) {
    const existing = levelMap.get(invId)
    if (existing) {
      const currentStock = Number(existing.stocked_quantity) || 0
      if (currentStock < DEFAULT_STOCK) {
        try {
          await inventoryService.updateInventoryLevels(existing.id, {
            stocked_quantity: DEFAULT_STOCK,
          })
          updated++
        } catch (err: any) {
          logger.warn(`${LOG} Could not update level ${existing.id}: ${err.message}`)
        }
      }
    } else {
      try {
        await inventoryService.createInventoryLevels({
          inventory_item_id: invId,
          location_id: stockLocation.id,
          stocked_quantity: DEFAULT_STOCK,
        })
        created++
      } catch (err: any) {
        logger.warn(`${LOG} Could not create level for ${invId}: ${err.message}`)
      }
    }
  }

  logger.info(`${LOG} Inventory levels: ${created} created, ${updated} updated to ${DEFAULT_STOCK}`)

  // ── Step 6: Ensure variant → inventory item links ─────────────────
  const link = container.resolve(ContainerRegistrationKeys.LINK) as any
  const { data: existingLinks } = await query.graph({
    entity: "product_variant_inventory_item",
    fields: ["variant_id", "inventory_item_id"],
    filters: { variant_id: allVariants.map((v: any) => v.id) },
  })
  const linkedVariantIds = new Set((existingLinks as any[]).map((l) => l.variant_id))

  const newLinks = allVariants
    .filter((v: any) => !linkedVariantIds.has(v.id) && invBySku.get(v.sku)?.id)
    .map((v: any) => ({
      [Modules.PRODUCT]: { variant_id: v.id },
      [Modules.INVENTORY]: { inventory_item_id: invBySku.get(v.sku).id },
    }))

  if (newLinks.length) {
    await link.create(newLinks as any)
    logger.info(`${LOG} Created ${newLinks.length} variant → inventory item links`)
  }

  // ── Step 7: Seed batches (if none exist) ──────────────────────────
  try {
    const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any
    const _listBatches = (batchService.listBatches ?? batchService.listBatchs)?.bind(batchService)
    const _createBatches = (batchService.createBatches ?? batchService.createBatchs)?.bind(batchService)

    if (!_listBatches || !_createBatches) {
      logger.warn(`${LOG} Batch service methods not found; skipping batch seeding.`)
    } else {
      const existingBatches = await _listBatches({}, { take: 1 })
      if (existingBatches?.length) {
        logger.info(`${LOG} Batches already exist (${existingBatches.length}+); skipping batch seeding.`)
      } else {
        logger.info(`${LOG} No batches found — seeding batches for all variants...`)
        let totalBatches = 0

        for (let i = 0; i < products.length; i++) {
          const product = products[i]
          const variants = (product.variants || []).filter((v: any) => v?.sku)
          if (!variants.length) continue

          const templates = BATCH_TEMPLATES[i % BATCH_TEMPLATES.length]

          for (const variant of variants) {
            const basePrice = 150 // default INR price for MRP/cost derivation
            for (const tmpl of templates) {
              const lotNumber = makeLotNumber(
                (variant.sku || product.handle || "LOT").slice(0, 8).toUpperCase() + "-" + tmpl.lotSuffix,
                templates.indexOf(tmpl)
              )
              await _createBatches({
                product_variant_id: variant.id,
                product_id: product.id,
                lot_number: lotNumber,
                manufactured_on: monthsAgo(tmpl.manufacturedMonthsAgo),
                expiry_date: monthsFromNow(tmpl.expiryMonths),
                received_quantity: tmpl.receivedQuantity,
                available_quantity: tmpl.availableQuantity,
                reserved_quantity: 0,
                batch_mrp_paise: Math.round(basePrice * tmpl.mrpMultiplier * 100),
                purchase_price_paise: Math.round(basePrice * tmpl.costMultiplier * 100),
                location_id: stockLocation.id,
                supplier_name: tmpl.supplier,
                grn_number: `GRN-${new Date().getFullYear()}-${String(totalBatches + 1).padStart(4, "0")}`,
                received_on: monthsAgo(tmpl.manufacturedMonthsAgo - 1),
                status: "active",
                metadata: { source: "seed-batches-2026" },
              })
              totalBatches++
            }
          }
        }
        logger.info(`${LOG} Seeded ${totalBatches} batches across ${products.length} products`)
      }
    }
  } catch (err: any) {
    logger.warn(`${LOG} Batch seeding failed (non-blocking): ${err.message}`)
  }

  logger.info(`${LOG} Fix Cloud Inventory complete.`)
}
