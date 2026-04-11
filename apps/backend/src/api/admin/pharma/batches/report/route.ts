import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { INVENTORY_BATCH_MODULE } from "../../../../../modules/inventoryBatch"

/**
 * GET /admin/pharma/batches/report
 *
 * Returns per-product batch summary for the Batch Report page.
 * Includes total stock, batch count, earliest expiry, and near-expiry warnings.
 *
 * Query params:
 *   - status: filter by batch status (active, quarantine, expired, depleted)
 *   - near_expiry_days: number of days threshold for near-expiry flag (default 90)
 *   - search: search product names
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any

  const statusFilter = req.query.status as string | undefined
  const nearExpiryDays = Number(req.query.near_expiry_days || 90)
  const searchQuery = (req.query.search as string || "").trim().toLowerCase()

  try {
    // Fetch all batches
    const filters: Record<string, any> = {}
    if (statusFilter) filters.status = statusFilter

    const batches = await batchService.listBatches(filters, {
      order: { expiry_date: "ASC" },
      take: null, // All batches
    })

    // Load product titles
    const productIds = [...new Set((batches as any[]).map((b: any) => b.product_id).filter(Boolean))]

    const productTitleMap = new Map<string, string>()
    if (productIds.length > 0) {
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["id", "title"],
        filters: { id: productIds },
      }) as any

      for (const p of products || []) {
        productTitleMap.set(p.id, p.title)
      }
    }

    // Aggregate by product
    const today = new Date()
    const nearExpiryThreshold = new Date(today.getTime() + nearExpiryDays * 24 * 60 * 60 * 1000)

    const productSummaries = new Map<string, {
      product_id: string
      product_title: string
      total_stock: number
      batch_count: number
      active_batches: number
      expired_batches: number
      quarantined_batches: number
      earliest_expiry: string | null
      near_expiry_count: number
      batches: Array<{
        id: string
        lot_number: string
        expiry_date: string
        days_to_expiry: number
        available_quantity: number
        reserved_quantity: number
        received_quantity: number
        status: string
        batch_mrp_paise: number | null
        supplier_name: string | null
        grn_number: string | null
      }>
    }>()

    for (const batch of batches as any[]) {
      const pid = batch.product_id
      if (!pid) continue

      const title = productTitleMap.get(pid) || "Unknown"

      // Search filter
      if (searchQuery && !title.toLowerCase().includes(searchQuery)) continue

      if (!productSummaries.has(pid)) {
        productSummaries.set(pid, {
          product_id: pid,
          product_title: title,
          total_stock: 0,
          batch_count: 0,
          active_batches: 0,
          expired_batches: 0,
          quarantined_batches: 0,
          earliest_expiry: null,
          near_expiry_count: 0,
          batches: [],
        })
      }

      const summary = productSummaries.get(pid)!
      const expiryDate = new Date(batch.expiry_date)
      const daysToExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))

      summary.batch_count++
      summary.total_stock += Number(batch.available_quantity || 0)

      if (batch.status === "active") summary.active_batches++
      else if (batch.status === "expired") summary.expired_batches++
      else if (batch.status === "quarantine") summary.quarantined_batches++

      if (expiryDate <= nearExpiryThreshold && batch.status === "active") {
        summary.near_expiry_count++
      }

      if (!summary.earliest_expiry || expiryDate < new Date(summary.earliest_expiry)) {
        summary.earliest_expiry = batch.expiry_date
      }

      summary.batches.push({
        id: batch.id,
        lot_number: batch.lot_number,
        expiry_date: batch.expiry_date,
        days_to_expiry: daysToExpiry,
        available_quantity: Number(batch.available_quantity || 0),
        reserved_quantity: Number(batch.reserved_quantity || 0),
        received_quantity: Number(batch.received_quantity || 0),
        status: batch.status,
        batch_mrp_paise: batch.batch_mrp_paise ? Number(batch.batch_mrp_paise) : null,
        supplier_name: batch.supplier_name,
        grn_number: batch.grn_number,
      })
    }

    // Sort by product title
    const report = Array.from(productSummaries.values()).sort((a, b) =>
      a.product_title.localeCompare(b.product_title)
    )

    // Summary totals
    const totals = {
      total_products: report.length,
      total_batches: report.reduce((s, r) => s + r.batch_count, 0),
      total_stock: report.reduce((s, r) => s + r.total_stock, 0),
      products_in_stock: report.filter((r) => r.total_stock > 0).length,
      products_out_of_stock: report.filter((r) => r.total_stock === 0).length,
      near_expiry_products: report.filter((r) => r.near_expiry_count > 0).length,
    }

    return res.json({ report, totals })
  } catch (err: any) {
    logger.error(`[batch-report] Failed: ${err?.message}`)
    return res.status(500).json({ message: err?.message || "Failed to generate batch report" })
  }
}
