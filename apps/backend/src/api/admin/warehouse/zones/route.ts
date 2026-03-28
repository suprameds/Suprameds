import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { WAREHOUSE_MODULE } from "../../../../modules/warehouse"
import { createLogger } from "../../../../lib/logger"

const logger = createLogger("admin:warehouse:zones")

/**
 * GET /admin/warehouse/zones
 * List all warehouse zones, optionally filtered by warehouse_id.
 *
 * POST /admin/warehouse/zones
 * Create a new warehouse zone.
 * Body: { warehouse_id, zone_code, zone_type, access_level?, description? }
 */

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const warehouseService = req.scope.resolve(WAREHOUSE_MODULE) as any

    const {
      warehouse_id,
      limit: limitStr,
      offset: offsetStr,
    } = req.query as Record<string, string>

    const limit = Number(limitStr) || 50
    const offset = Number(offsetStr) || 0

    const filters: Record<string, any> = {}
    if (warehouse_id) filters.warehouse_id = warehouse_id

    const zones = await warehouseService.listWarehouseZones(filters, {
      take: limit,
      skip: offset,
      order: { created_at: "ASC" },
    })

    const list: any[] = Array.isArray(zones?.[0])
      ? zones[0]
      : Array.isArray(zones)
      ? zones
      : []

    return res.json({ data: list, count: list.length, limit, offset })
  } catch (err: any) {
    logger.error("GET failed:", err?.message)
    return res.status(500).json({ error: "Failed to fetch warehouse zones" })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as Record<string, any>

  if (!body.warehouse_id) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "warehouse_id is required")
  }

  if (!body.zone_code) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "zone_code is required")
  }

  if (!body.zone_type) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "zone_type is required")
  }

  try {
    const warehouseService = req.scope.resolve(WAREHOUSE_MODULE) as any

    const zone = await warehouseService.createWarehouseZones({
      warehouse_id: body.warehouse_id,
      zone_code: body.zone_code,
      zone_type: body.zone_type,
      access_level: body.access_level ?? "open",
    })

    return res.status(201).json({ zone })
  } catch (err: any) {
    logger.error("POST failed:", err?.message)
    return res.status(400).json({ error: err?.message || "Failed to create zone" })
  }
}
