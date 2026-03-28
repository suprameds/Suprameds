import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { WAREHOUSE_MODULE } from "../../../../modules/warehouse"
import { createLogger } from "../../../../lib/logger"

const logger = createLogger("admin:warehouse:bins")

/**
 * GET /admin/warehouse/bins
 * List warehouse bins, optionally filtered by zone_id.
 * Query params: zone_id, limit, offset
 *
 * POST /admin/warehouse/bins
 * Create a new warehouse bin.
 * Body: { zone_id, bin_code, bin_barcode, capacity_units? }
 */

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const warehouseService = req.scope.resolve(WAREHOUSE_MODULE) as any

    const {
      zone_id,
      limit: limitStr,
      offset: offsetStr,
    } = req.query as Record<string, string>

    const limit = Number(limitStr) || 50
    const offset = Number(offsetStr) || 0

    const filters: Record<string, any> = {}
    if (zone_id) filters.zone_id = zone_id

    const bins = await warehouseService.listWarehouseBins(filters, {
      take: limit,
      skip: offset,
      order: { bin_code: "ASC" },
    })

    const list: any[] = Array.isArray(bins?.[0])
      ? bins[0]
      : Array.isArray(bins)
      ? bins
      : []

    return res.json({ data: list, count: list.length, limit, offset })
  } catch (err: any) {
    logger.error("GET failed:", err?.message)
    return res.status(500).json({ error: "Failed to fetch warehouse bins" })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as Record<string, any>

  if (!body.zone_id) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "zone_id is required")
  }

  if (!body.bin_code) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "bin_code is required")
  }

  if (!body.bin_barcode) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "bin_barcode is required")
  }

  try {
    const warehouseService = req.scope.resolve(WAREHOUSE_MODULE) as any

    const bin = await warehouseService.createWarehouseBins({
      zone_id: body.zone_id,
      bin_code: body.bin_code,
      bin_barcode: body.bin_barcode,
      capacity_units: body.capacity_units ? Number(body.capacity_units) : 0,
      current_units: 0,
      is_active: true,
      last_audit_at: null,
    })

    return res.status(201).json({ bin })
  } catch (err: any) {
    logger.error("POST failed:", err?.message)
    return res.status(400).json({ error: err?.message || "Failed to create bin" })
  }
}
