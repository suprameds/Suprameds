/**
 * 015 — Seed Product Batches
 *
 * Creates 2–3 batches per product variant to populate the pharmaInventoryBatch
 * module for FEFO testing. Each batch has a realistic lot number, expiry date,
 * MRP, cost price, and stock quantity.
 *
 * Idempotent: deletes existing seed batches (metadata.source = "seed-batches-2026")
 * before recreating them.
 *
 * Run: npx medusa exec ./src/scripts/run-migrations.ts
 */
import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { INVENTORY_BATCH_MODULE } from "../modules/inventoryBatch"

/** Months from now — generates a Date that many months ahead */
function monthsFromNow(months: number): Date {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d
}

/** Months ago — generates a Date that many months in the past */
function monthsAgo(months: number): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d
}

/** Generates a realistic-looking lot number: YYMMDD + random suffix */
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
  /** MRP multiplier relative to product price (e.g., 1.2 = 20% markup) */
  mrpMultiplier: number
  /** Cost multiplier relative to product price (e.g., 0.6 = 40% margin) */
  costMultiplier: number
  supplier: string
}

const BATCH_TEMPLATES: BatchTemplate[][] = [
  // Template set A: 3 batches (some near-expiry for FEFO testing)
  [
    {
      lotSuffix: "A",
      manufacturedMonthsAgo: 18,
      expiryMonths: 6,
      receivedQuantity: 100,
      availableQuantity: 25,
      mrpMultiplier: 1.25,
      costMultiplier: 0.55,
      supplier: "Cipla Ltd.",
    },
    {
      lotSuffix: "B",
      manufacturedMonthsAgo: 6,
      expiryMonths: 18,
      receivedQuantity: 200,
      availableQuantity: 180,
      mrpMultiplier: 1.20,
      costMultiplier: 0.58,
      supplier: "Sun Pharma",
    },
    {
      lotSuffix: "C",
      manufacturedMonthsAgo: 1,
      expiryMonths: 23,
      receivedQuantity: 150,
      availableQuantity: 150,
      mrpMultiplier: 1.22,
      costMultiplier: 0.56,
      supplier: "Supracyn Pharma",
    },
  ],
  // Template set B: 2 batches (standard)
  [
    {
      lotSuffix: "X",
      manufacturedMonthsAgo: 12,
      expiryMonths: 12,
      receivedQuantity: 150,
      availableQuantity: 80,
      mrpMultiplier: 1.30,
      costMultiplier: 0.52,
      supplier: "Hetero Drugs",
    },
    {
      lotSuffix: "Y",
      manufacturedMonthsAgo: 3,
      expiryMonths: 21,
      receivedQuantity: 200,
      availableQuantity: 200,
      mrpMultiplier: 1.25,
      costMultiplier: 0.55,
      supplier: "Supracyn Pharma",
    },
  ],
  // Template set C: 3 batches (one almost depleted)
  [
    {
      lotSuffix: "P",
      manufacturedMonthsAgo: 20,
      expiryMonths: 4,
      receivedQuantity: 80,
      availableQuantity: 5,
      mrpMultiplier: 1.20,
      costMultiplier: 0.60,
      supplier: "Dr. Reddy's",
    },
    {
      lotSuffix: "Q",
      manufacturedMonthsAgo: 8,
      expiryMonths: 16,
      receivedQuantity: 120,
      availableQuantity: 95,
      mrpMultiplier: 1.22,
      costMultiplier: 0.57,
      supplier: "Cipla Ltd.",
    },
    {
      lotSuffix: "R",
      manufacturedMonthsAgo: 2,
      expiryMonths: 22,
      receivedQuantity: 250,
      availableQuantity: 250,
      mrpMultiplier: 1.18,
      costMultiplier: 0.53,
      supplier: "Supracyn Pharma",
    },
  ],
]

export default async function seedProductBatches({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any

  logger.info("[seed-batches] Starting batch seeding...")

  // Get stock location
  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  const stockLocation = (stockLocations as any[])?.[0]
  if (!stockLocation?.id) {
    logger.warn("[seed-batches] No stock location found; skipping.")
    return
  }

  // Delete existing seed batches for idempotency
  const existingBatches = await batchService.listBatchs({}, { take: 5000 })
  const seedBatchIds = (existingBatches as any[])
    .filter((b: any) => b?.metadata?.source === "seed-batches-2026")
    .map((b: any) => b.id)

  if (seedBatchIds.length) {
    logger.info(`[seed-batches] Deleting ${seedBatchIds.length} existing seed batches...`)
    for (const id of seedBatchIds) {
      await batchService.deleteBatchs(id)
    }
  }

  // Get all products with their variants
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "variants.id", "variants.sku"],
  })

  if (!products?.length) {
    logger.warn("[seed-batches] No products found; skipping.")
    return
  }

  // Get product prices to derive MRP/cost from actual selling price
  const priceMap = new Map<string, number>()
  for (const product of products as any[]) {
    for (const variant of product.variants ?? []) {
      try {
        const { data: priceSets } = await query.graph({
          entity: "variant",
          fields: ["calculated_price.calculated_amount"],
          filters: { id: [variant.id] },
          context: { currency_code: "inr" },
        })
        const calcPrice = (priceSets as any[])?.[0]?.calculated_price?.calculated_amount
        if (calcPrice) {
          priceMap.set(variant.id, Number(calcPrice))
        }
      } catch {
        // Pricing context not available during seed — we'll derive from handle
      }
    }
  }

  let totalBatches = 0

  for (let i = 0; i < (products as any[]).length; i++) {
    const product = (products as any[])[i]
    const variants = product.variants ?? []
    if (!variants.length) continue

    // Rotate through batch template sets
    const templates = BATCH_TEMPLATES[i % BATCH_TEMPLATES.length]

    for (const variant of variants) {
      // Derive a base price from the price map or a reasonable default
      const basePrice = priceMap.get(variant.id) || 150

      for (const tmpl of templates) {
        const lotNumber = makeLotNumber(
          (variant.sku || product.handle || "LOT").slice(0, 8).toUpperCase() + "-" + tmpl.lotSuffix,
          templates.indexOf(tmpl)
        )

        const batchMrpPaise = Math.round(basePrice * tmpl.mrpMultiplier * 100)
        const purchasePricePaise = Math.round(basePrice * tmpl.costMultiplier * 100)

        await batchService.createBatchs({
          product_variant_id: variant.id,
          product_id: product.id,
          lot_number: lotNumber,
          manufactured_on: monthsAgo(tmpl.manufacturedMonthsAgo),
          expiry_date: monthsFromNow(tmpl.expiryMonths),
          received_quantity: tmpl.receivedQuantity,
          available_quantity: tmpl.availableQuantity,
          reserved_quantity: 0,
          batch_mrp_paise: batchMrpPaise,
          purchase_price_paise: purchasePricePaise,
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

  logger.info(
    `[seed-batches] Seeded ${totalBatches} batches across ${(products as any[]).length} products.`
  )
}
