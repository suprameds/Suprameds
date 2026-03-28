import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { INVENTORY_BATCH_MODULE } from "../../../../modules/inventoryBatch"
import { createLogger } from "../../../../lib/logger"

const logger = createLogger("admin:warehouse:inventory")

/**
 * GET /admin/warehouse/inventory
 * Lists inventory batches with optional filters.
 *
 * Query params:
 *   status        — batch status filter (e.g. "active", "recalled", "quarantine")
 *   near_expiry   — "true" to return batches expiring within 90 days
 *   recalled      — "true" to return only recalled batches
 *   product_id    — filter by product
 *   limit         — page size (default 20)
 *   offset        — page offset (default 0)
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any

    const {
      status,
      near_expiry,
      recalled,
      product_id,
      limit: limitStr,
      offset: offsetStr,
    } = req.query as Record<string, string>

    const limit = Number(limitStr) || 20
    const offset = Number(offsetStr) || 0

    const filters: Record<string, any> = {}

    // recalled=true overrides any status param
    if (recalled === "true") {
      filters.status = "recalled"
    } else if (status) {
      filters.status = status
    }

    if (product_id) {
      filters.product_id = product_id
    }

    if (near_expiry === "true") {
      const ninetyDaysFromNow = new Date()
      ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90)
      filters.expiry_date = { lte: ninetyDaysFromNow.toISOString() }
    }

    const batches = await batchService.listBatches(filters, {
      take: limit,
      skip: offset,
      order: { expiry_date: "ASC" },
    })

    const list: any[] = Array.isArray(batches?.[0])
      ? batches[0]
      : Array.isArray(batches)
      ? batches
      : []

    return res.json({ data: list, count: list.length, limit, offset })
  } catch (err: any) {
    logger.error("GET failed:", err?.message)
    return res.status(500).json({ error: "Failed to fetch inventory batches" })
  }
}
