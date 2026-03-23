import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { WAREHOUSE_MODULE } from "../../../../modules/warehouse"

/**
 * POST /admin/pincodes/import
 *
 * Chunked import endpoint. Each request sends a batch of pre-parsed rows.
 * The frontend parses the CSV and splits it into chunks for progress tracking.
 *
 * Body:
 *   rows         — array of row objects (pre-parsed by the frontend)
 *   mode         — "replace" (first chunk, clears DB) | "append" (subsequent chunks)
 *   chunk_index  — 0-based index of this chunk
 *   total_chunks — total number of chunks being sent
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any
  const warehouseService = req.scope.resolve(WAREHOUSE_MODULE) as any

  const {
    rows,
    mode = "replace",
    chunk_index = 0,
    total_chunks = 1,
  } = req.body as {
    rows?: Record<string, string>[]
    mode?: "replace" | "append"
    chunk_index?: number
    total_chunks?: number
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: "rows array is required and must not be empty" })
  }

  try {
    // First chunk with mode=replace: delete all existing records
    if (mode === "replace" && chunk_index === 0) {
      const existing = (await warehouseService.listServiceablePincodes(
        {},
        { take: null, select: ["id"] }
      )) as any[]

      if (existing.length > 0) {
        const ids = existing.map((r: any) => r.id)
        for (let i = 0; i < ids.length; i += 100) {
          await warehouseService.deleteServiceablePincodes(ids.slice(i, i + 100))
          if (i + 100 < ids.length) await new Promise((r) => setTimeout(r, 50))
        }
        logger.info(`[pincode-import] Cleared ${existing.length} existing records for fresh import`)
      }
    }

    // Insert this batch
    let imported = 0
    let skipped = 0
    const toCreate: any[] = []

    for (const row of rows) {
      const pincode = String(row.pincode ?? "").trim()
      if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
        skipped++
        continue
      }
      toCreate.push({
        pincode,
        officename: String(row.officename ?? "").trim() || "Unknown",
        officetype: row.officetype?.trim() || null,
        delivery: String(row.delivery ?? "").trim() || "Non Delivery",
        district: String(row.district ?? "").trim() || "Unknown",
        statename: String(row.statename ?? "").trim() || "Unknown",
        divisionname: row.divisionname?.trim() || null,
        regionname: row.regionname?.trim() || null,
        circlename: row.circlename?.trim() || null,
        latitude: (row.latitude?.trim() === "NA" || !row.latitude?.trim()) ? null : row.latitude.trim(),
        longitude: (row.longitude?.trim() === "NA" || !row.longitude?.trim()) ? null : row.longitude.trim(),
        is_serviceable: String(row.delivery ?? "").trim().toLowerCase() === "delivery",
      })
    }

    if (toCreate.length > 0) {
      // Insert in sub-batches of 100 with small delays to stay under
      // managed Redis Lua script execution limits (Medusa Cloud)
      const SUB_BATCH = 100
      for (let i = 0; i < toCreate.length; i += SUB_BATCH) {
        await warehouseService.createServiceablePincodes(toCreate.slice(i, i + SUB_BATCH))
        if (i + SUB_BATCH < toCreate.length) {
          await new Promise((r) => setTimeout(r, 50))
        }
      }
      imported = toCreate.length
    }

    logger.info(
      `[pincode-import] Chunk ${chunk_index + 1}/${total_chunks}: ${imported} imported, ${skipped} skipped`
    )

    return res.status(200).json({
      success: true,
      chunk_index,
      total_chunks,
      imported,
      skipped,
      is_last_chunk: chunk_index === total_chunks - 1,
    })
  } catch (error: any) {
    logger.error(`[pincode-import] Chunk ${chunk_index} failed: ${error.message}`)
    return res.status(500).json({
      message: error.message || "Import chunk failed",
      chunk_index,
    })
  }
}
