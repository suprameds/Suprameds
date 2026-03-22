import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { WAREHOUSE_MODULE } from "../../../modules/warehouse"

/**
 * GET /admin/pincodes?pincode=&state=&district=&limit=50&offset=0
 *
 * List/search pincodes with pagination. Also returns aggregate stats.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const warehouseService = req.scope.resolve(WAREHOUSE_MODULE) as any

  const {
    pincode,
    state,
    district,
    limit: rawLimit,
    offset: rawOffset,
    stats_only,
  } = req.query as Record<string, string>

  try {
    // Stats mode — just return counts
    if (stats_only === "true") {
      const [, totalCount] = await warehouseService.listAndCountServiceablePincodes({})
      const [, deliveryCount] = await warehouseService.listAndCountServiceablePincodes({
        delivery: "Delivery",
      })

      // Get unique state count via listing all states
      const allRecords = (await warehouseService.listServiceablePincodes(
        {},
        { take: null, select: ["statename"] }
      )) as any[]
      const uniqueStates = new Set(allRecords.map((r: any) => r.statename))
      const uniquePincodes = new Set(allRecords.map((r: any) => r.pincode))

      return res.json({
        stats: {
          total_records: totalCount,
          delivery_pincodes: deliveryCount,
          unique_pincodes: uniquePincodes.size,
          states_covered: uniqueStates.size,
        },
      })
    }

    const limit = Math.min(parseInt(rawLimit || "50", 10) || 50, 200)
    const offset = parseInt(rawOffset || "0", 10) || 0

    const filters: Record<string, any> = {}
    if (pincode) filters.pincode = pincode
    if (state) filters.statename = state
    if (district) filters.district = district

    const [records, count] = await warehouseService.listAndCountServiceablePincodes(
      filters,
      { take: limit, skip: offset, order: { pincode: "ASC" } }
    )

    return res.json({
      pincodes: records,
      count,
      limit,
      offset,
    })
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Failed to list pincodes" })
  }
}
