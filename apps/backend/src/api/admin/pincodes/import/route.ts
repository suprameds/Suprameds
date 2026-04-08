import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { generateEntityId } from "@medusajs/framework/utils"

/**
 * POST /admin/pincodes/import
 *
 * Bulk import endpoint. Receives all pre-parsed rows at once and writes
 * directly to the database via raw SQL, bypassing the service layer and
 * Redis event bus. This avoids Medusa Cloud's Redis Lua script limits
 * that forced the old chunked approach.
 *
 * Body:
 *   rows  — array of row objects (pre-parsed by the frontend)
 *   mode  — "replace" (default, clears DB first) | "append"
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any
  const pgConnection = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any

  const {
    rows,
    mode = "replace",
    chunk_index,
    total_chunks,
  } = req.body as {
    rows?: Record<string, string>[]
    mode?: "replace" | "append"
    chunk_index?: number
    total_chunks?: number
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: "rows array is required and must not be empty" })
  }

  // Backward compat: if frontend still sends chunks, only clear on first chunk
  const isFirstChunk = chunk_index === undefined || chunk_index === 0

  try {
    // Clear existing records if mode=replace and this is the first (or only) request
    if (mode === "replace" && isFirstChunk) {
      await pgConnection.raw(`DELETE FROM "serviceable_pincode"`)
      logger.info(`[pincode-import] Cleared existing records for fresh import`)
    }

    // Parse and validate rows
    let imported = 0
    let skipped = 0
    const validRows: any[] = []

    for (const row of rows) {
      const pincode = String(row.pincode ?? "").trim()
      if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
        skipped++
        continue
      }
      validRows.push({
        id: generateEntityId("", "svcpin"),
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

    // Bulk insert via raw SQL. Postgres allows max 65,535 params per query.
    // 13 columns × 5000 rows = 65,000 params — just under the limit.
    const BATCH = 5000
    for (let i = 0; i < validRows.length; i += BATCH) {
      const batch = validRows.slice(i, i + BATCH)
      const cols = [
        "id", "pincode", "officename", "officetype", "delivery", "district",
        "statename", "divisionname", "regionname", "circlename",
        "latitude", "longitude", "is_serviceable",
      ]
      const placeholders: string[] = []
      const values: any[] = []
      let paramIdx = 1

      for (const row of batch) {
        const rowPlaceholders: string[] = []
        for (const col of cols) {
          rowPlaceholders.push(`$${paramIdx++}`)
          values.push(row[col])
        }
        placeholders.push(`(${rowPlaceholders.join(", ")})`)
      }

      await pgConnection.raw(
        `INSERT INTO "serviceable_pincode" (${cols.map(c => `"${c}"`).join(", ")})
         VALUES ${placeholders.join(", ")}`,
        values
      )
    }

    imported = validRows.length

    logger.info(
      `[pincode-import] Done: ${imported} imported, ${skipped} skipped` +
      (chunk_index !== undefined ? ` (chunk ${chunk_index + 1}/${total_chunks})` : "")
    )

    return res.status(200).json({
      success: true,
      imported,
      skipped,
      ...(chunk_index !== undefined && { chunk_index, total_chunks, is_last_chunk: chunk_index === (total_chunks ?? 1) - 1 }),
    })
  } catch (error: any) {
    logger.error(`[pincode-import] Failed: ${error.message}`)
    return res.status(500).json({
      message: error.message || "Import failed",
    })
  }
}
