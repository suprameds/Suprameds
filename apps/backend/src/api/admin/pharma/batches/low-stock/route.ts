import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { INVENTORY_BATCH_MODULE } from "../../../../../modules/inventoryBatch"

const DEFAULT_THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD) || 50

type LowStockVariant = {
  variant_id: string
  product_id: string
  product_title: string | null
  current_quantity: number
  threshold: number
  batches_count: number
}

/**
 * GET /admin/pharma/batches/low-stock?threshold=50
 *
 * Returns product variants whose total active stock is below the threshold.
 * Optionally accepts ?threshold=N to override the default.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any
  const productService = req.scope.resolve(Modules.PRODUCT) as any
  const logger = req.scope.resolve("logger") as any

  const threshold = req.query.threshold
    ? Number(req.query.threshold)
    : DEFAULT_THRESHOLD

  if (isNaN(threshold) || threshold < 0) {
    return res.status(400).json({ message: "Invalid threshold value" })
  }

  try {
    // Fetch all active batches
    const activeBatches = await batchService.listBatches(
      { status: "active" },
      { take: null }
    )

    // Aggregate by variant
    const variantMap = new Map<
      string,
      { product_id: string; total: number; count: number }
    >()

    for (const batch of activeBatches) {
      const vid = batch.product_variant_id
      const existing = variantMap.get(vid)

      if (existing) {
        existing.total += Number(batch.available_quantity)
        existing.count += 1
      } else {
        variantMap.set(vid, {
          product_id: batch.product_id,
          total: Number(batch.available_quantity),
          count: 1,
        })
      }
    }

    // Filter to variants below threshold
    const lowStockEntries: Array<{
      variant_id: string
      product_id: string
      current_quantity: number
      batches_count: number
    }> = []

    for (const [variantId, data] of variantMap) {
      if (data.total < threshold) {
        lowStockEntries.push({
          variant_id: variantId,
          product_id: data.product_id,
          current_quantity: data.total,
          batches_count: data.count,
        })
      }
    }

    // Sort: out-of-stock first, then by ascending quantity
    lowStockEntries.sort((a, b) => a.current_quantity - b.current_quantity)

    // Enrich with product titles where possible
    const productIds = [...new Set(lowStockEntries.map((e) => e.product_id))]
    const productTitleMap = new Map<string, string>()

    if (productIds.length > 0) {
      try {
        const products = await productService.listProducts(
          { id: productIds },
          { select: ["id", "title"], take: null }
        )

        for (const p of products) {
          productTitleMap.set(p.id, p.title)
        }
      } catch (err: any) {
        logger.warn(
          `[low-stock-api] Could not fetch product titles: ${err.message}`
        )
      }
    }

    const result: LowStockVariant[] = lowStockEntries.map((entry) => ({
      variant_id: entry.variant_id,
      product_id: entry.product_id,
      product_title: productTitleMap.get(entry.product_id) ?? null,
      current_quantity: entry.current_quantity,
      threshold,
      batches_count: entry.batches_count,
    }))

    return res.json({
      low_stock_variants: result,
      total: result.length,
      threshold,
    })
  } catch (err: any) {
    logger.error(`[low-stock-api] Failed: ${err.message}`)
    return res.status(500).json({
      message: err.message || "Failed to retrieve low stock data",
    })
  }
}
